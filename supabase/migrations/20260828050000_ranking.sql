-- =============================================================================
-- Fase 6 — ranking opt-in e periodos (§9.3 e §41, entregas 9 e 10).
--
-- Duas decisoes de projeto valem mais que o schema:
--
-- 1. **`ranking_scores` nao tem coluna de dinheiro.** A §9.3 proibe expor
--    gasto exato publicamente. A forma mais segura de nunca vazar um valor e
--    nao guardar valor nenhum na tabela que o publico le. Só a pontuacao
--    normalizada mora aqui.
--
-- 2. **O criterio nao esta no codigo.** "Criterios de ranking" esta na lista
--    da §33 do que nunca se inventa. Cada periodo declara a **base** que o
--    operador escolheu e uma nota que o cliente le. Sem base escolhida, o
--    periodo nao pontua ninguem.
--
-- O criterio da §41 "usuario fora do ranking nao aparece" e garantido pela
-- RLS, que confere `customer_preferences.ranking_opt_in` — nao pela consulta
-- que a tela escreve.
-- =============================================================================

create type public.ranking_basis as enum (
  -- O operador digita as pontuacoes. Serve para dimensoes que nenhuma conta
  -- automatica captura (curadoria, indicacao avaliada a mao).
  'manual',
  -- Pontos de Fly Points ganhos dentro da janela do periodo, normalizados.
  'points_earned'
);

create table public.ranking_periods (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,

  /**
   * A dimensao, entre as que a §9.3 lista: clientes da semana, engajamento,
   * capitulos completos, embaixadores, grupos e familias, eventos.
   *
   * Texto livre e nao enum: a lista da spec e de exemplos, e travar em enum
   * obrigaria migration para cada dimensao nova.
   */
  dimension text not null,

  starts_on date not null,
  ends_on date not null,

  basis public.ranking_basis not null default 'manual',

  /**
   * Como se pontua, em portugues, para o cliente ler.
   *
   * Nulo = o operador ainda nao declarou. **Periodo sem nota nao publica** —
   * ranking cujo criterio ninguem sabe explicar e ranking que gera briga.
   */
  criteria_note text,

  is_published boolean not null default false,
  computed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint ranking_periods_key_unique unique (key),
  constraint ranking_periods_janela check (ends_on >= starts_on),
  constraint ranking_periods_publicado_tem_criterio check (
    not is_published or (criteria_note is not null and length(btrim(criteria_note)) > 0)
  )
);

create index ranking_periods_publicados_idx on public.ranking_periods (is_published, starts_on desc);

create table public.ranking_scores (
  period_id uuid not null references public.ranking_periods (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Pontuacao publica normalizada, 0 a 1000. **Nao e dinheiro e nao e o saldo
  -- de Fly Points**: e uma escala relativa dentro do periodo.
  public_score int not null,
  position int not null,

  computed_at timestamptz not null default now(),

  primary key (period_id, user_id),
  constraint ranking_scores_score_faixa check (public_score between 0 and 1000),
  constraint ranking_scores_posicao_positiva check (position > 0)
);

create index ranking_scores_periodo_idx on public.ranking_scores (period_id, position);

comment on table public.ranking_scores is
  'Sem coluna de dinheiro, de proposito: nao se vaza o que nao se guarda (§9.3).';

-- -----------------------------------------------------------------------------
-- Recalculo.
--
-- So o operador chama, e so para periodo com base escolhida. Apaga e regrava
-- as linhas **do periodo** — `ranking_scores` nao e ledger: e uma projecao
-- que se recalcula, e nao um historico de movimentos.
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
  v_max bigint;
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
  create temporary table tmp_base on commit drop as
  select l.user_id, sum(l.amount)::bigint as bruto
  from public.points_ledger l
  join public.customer_preferences cp on cp.user_id = l.user_id
  where l.kind = 'earn'
    and cp.ranking_opt_in
    and l.occurred_at::date between v_p.starts_on and v_p.ends_on
  group by l.user_id
  having sum(l.amount) > 0;

  select max(bruto) into v_max from tmp_base;
  if v_max is null then
    update public.ranking_periods set computed_at = now() where id = p_period;
    return query select true, 'nenhum participante no periodo', 0;
    return;
  end if;

  insert into public.ranking_scores (period_id, user_id, public_score, position)
  select
    p_period,
    b.user_id,
    -- Normalizada em 0..1000 contra o primeiro colocado. O valor bruto nao
    -- sai daqui: quem ve o ranking ve escala, nao quanto alguem gastou.
    greatest(1, round(b.bruto::numeric * 1000 / v_max))::int,
    row_number() over (order by b.bruto desc, b.user_id)
  from tmp_base b;

  select count(*)::int into v_n from public.ranking_scores where period_id = p_period;
  update public.ranking_periods set computed_at = now() where id = p_period;

  return query select true, 'recalculado'::text, v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.ranking_periods enable row level security;
alter table public.ranking_scores  enable row level security;

create policy ranking_periods_select on public.ranking_periods for select to authenticated
  using (is_published or fly_private.is_staff());
create policy ranking_periods_insert_operator on public.ranking_periods for insert to authenticated
  with check (fly_private.is_global_operator());
create policy ranking_periods_update_operator on public.ranking_periods for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy ranking_periods_delete_operator on public.ranking_periods for delete to authenticated
  using (fly_private.is_global_operator());

/**
 * "usuario fora do ranking nao aparece" — o criterio da §41 vira policy.
 *
 * A conferencia de `ranking_opt_in` esta **aqui**, e nao na consulta da tela:
 * uma tela nova que esquecesse o filtro exporia todo mundo. A equipe ve tudo,
 * porque a §9.3 permite valores completos para funcionario autorizado.
 */
create policy ranking_scores_select on public.ranking_scores for select to authenticated
  using (
    fly_private.is_staff()
    or (
      exists (
        select 1 from public.ranking_periods rp
        where rp.id = period_id and rp.is_published
      )
      and exists (
        select 1 from public.customer_preferences cp
        where cp.user_id = ranking_scores.user_id and cp.ranking_opt_in
      )
    )
  );

create policy ranking_scores_write_operator on public.ranking_scores for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

revoke all on public.ranking_periods from anon;
revoke all on public.ranking_scores  from anon;

grant select on public.ranking_periods to authenticated;
grant insert, update, delete on public.ranking_periods to authenticated;
grant select on public.ranking_scores to authenticated;
grant insert, update, delete on public.ranking_scores to authenticated;

revoke all on function public.recalcular_ranking(uuid) from public, anon;
grant execute on function public.recalcular_ranking(uuid) to authenticated;
