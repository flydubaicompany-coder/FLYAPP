-- =============================================================================
-- Ranking: o nome publicado mora na propria linha do ranking.
--
-- Achado revisando: a tela lia `profiles` para descobrir os nomes, e a policy
-- `profiles_select_own` so deixa o cliente ler o **proprio** perfil. O ranking
-- apareceria com "Viajante Fly" em toda linha que nao fosse a dele.
--
-- A correcao nao e afrouxar a policy de `profiles` — seria abrir o cadastro
-- inteiro para achar um nome. A §9.3 pede "**nome autorizado**", e e isso que
-- o schema passa a expressar: o nome que vai a publico e **copiado para a
-- linha do ranking no momento do calculo**, e so para quem optou por
-- participar. Quem nao optou nao tem linha, e portanto nao tem nome exposto.
--
-- Efeito colateral bom: some a consulta de 200 perfis que a tela fazia so para
-- traduzir ids.
-- =============================================================================

alter table public.ranking_scores
  add column public_name text;

comment on column public.ranking_scores.public_name is
  'Nome autorizado (§9.3), copiado no calculo e so para quem optou por participar.';

-- -----------------------------------------------------------------------------
-- Recalculo, agora gravando o nome — e sem tabela temporaria.
--
-- A versao anterior usava `create temporary table ... on commit drop`, que
-- falha se a funcao for chamada duas vezes na mesma transacao ("relation
-- already exists"). Uma CTE faz o mesmo trabalho sem esse risco.
-- -----------------------------------------------------------------------------
create or replace function public.recalcular_ranking(p_period uuid)
returns table (ok boolean, motivo text, participantes int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.ranking_periods;
  v_n int;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_p from public.ranking_periods rp where rp.id = p_period for update;
  if not found then
    return query select false, 'periodo nao encontrado', 0;
    return;
  end if;

  if v_p.basis = 'manual' then
    return query select false, 'periodo manual: as pontuacoes sao digitadas, nao calculadas', 0;
    return;
  end if;

  delete from public.ranking_scores where period_id = p_period;

  -- Base `points_earned`: soma dos ganhos dentro da janela, so de quem optou
  -- por participar. Estorno e vencimento nao entram — a pergunta e "quanto
  -- essa pessoa viveu no periodo", nao "quanto sobrou na conta".
  with base as (
    select l.user_id, sum(l.amount)::bigint as bruto
    from public.points_ledger l
    join public.customer_preferences cp on cp.user_id = l.user_id
    where l.kind = 'earn'
      and cp.ranking_opt_in
      and l.occurred_at::date between v_p.starts_on and v_p.ends_on
    group by l.user_id
    having sum(l.amount) > 0
  ),
  topo as (select max(bruto) as maior from base)
  insert into public.ranking_scores (period_id, user_id, public_score, position, public_name)
  select
    p_period,
    b.user_id,
    -- Normalizada em 0..1000 contra o primeiro colocado. O valor bruto nao sai
    -- daqui: quem ve o ranking ve escala, nao quanto alguem ganhou.
    greatest(1, round(b.bruto::numeric * 1000 / t.maior))::int,
    row_number() over (order by b.bruto desc, b.user_id),
    -- O nome autorizado, congelado no calculo.
    coalesce(pr.preferred_name, pr.display_name, 'Viajante Fly')
  from base b
  cross join topo t
  left join public.profiles pr on pr.id = b.user_id;

  select count(*)::int into v_n from public.ranking_scores where period_id = p_period;
  update public.ranking_periods set computed_at = now() where id = p_period;

  return query select true,
    case when v_n = 0 then 'nenhum participante no periodo' else 'recalculado' end,
    v_n;
end;
$$;

revoke all on function public.recalcular_ranking(uuid) from public, anon;
grant execute on function public.recalcular_ranking(uuid) to authenticated;
