-- =============================================================================
-- Fase 6 — premiacao e finalistas (§9.3 e §41, entrega 10).
--
-- **O premio nao mora no codigo.** A §33 poe "premios" na lista do que nunca
-- se inventa: o que a Fly entrega a quem ganha e decisao do dono, por periodo.
-- Aqui existe a estrutura para ele declarar, e nada preenchido.
--
-- ## Finalista nao e o mesmo que primeiro colocado
--
-- Um premio pode cobrir uma faixa ("1º ao 3º"), e a mesma faixa pode ter mais
-- de um premio. Por isso a premiacao e uma tabela de **faixas**, e nao uma
-- coluna em `ranking_scores`.
--
-- ## Nao se anuncia vencedor no meio da corrida
--
-- `finalists_published_at` so pode ser preenchido **depois de o periodo
-- terminar**. Publicar antes transforma um ranking em vitrine de quem esta na
-- frente hoje — e quem ficou para tras para de jogar.
-- =============================================================================

alter table public.ranking_periods
  add column finalists_published_at timestamptz;

comment on column public.ranking_periods.finalists_published_at is
  'Quando os finalistas foram anunciados. So pode ser preenchido depois de ends_on.';

alter table public.ranking_periods
  add constraint ranking_periods_finalistas_apos_fim check (
    finalists_published_at is null
    or finalists_published_at::date > ends_on
  );

create table public.ranking_prizes (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.ranking_periods (id) on delete cascade,

  -- A faixa que este premio cobre. `1..1` e o primeiro lugar; `1..3` e o
  -- podio inteiro levando a mesma coisa.
  position_from int not null,
  position_to int not null,

  label text not null,
  description text,

  /**
   * Premio que ja existe como beneficio da Carteira.
   *
   * Nulo = premio de mundo real (jantar, upgrade, convite), entregue pela
   * operacao. Nao ha entrega automatica: a §33 nao deixa inventar como se
   * cumpre um premio, e cumprir errado e pior que nao prometer.
   */
  benefit_id uuid references public.benefits (id) on delete set null,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),

  constraint ranking_prizes_faixa_valida check (position_from >= 1 and position_to >= position_from),
  constraint ranking_prizes_label_preenchido check (length(btrim(label)) > 0)
);

create index ranking_prizes_periodo_idx on public.ranking_prizes (period_id, sort_order);

comment on table public.ranking_prizes is
  'Premiacao por faixa de colocacao. O conteudo e decisao do dono (§33), nunca do codigo.';

-- -----------------------------------------------------------------------------
-- Publicar os finalistas.
--
-- Recusa em tres casos, e cada um por um motivo:
--   - periodo ainda correndo: nao se anuncia vencedor no meio da corrida;
--   - sem pontuacao calculada: nao ha finalista para anunciar;
--   - sem premiacao declarada: anunciar vencedor sem dizer o que ele ganhou
--     e o comeco de uma discussao.
-- -----------------------------------------------------------------------------
create or replace function public.publicar_finalistas(p_period uuid)
returns table (ok boolean, motivo text, finalistas int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.ranking_periods;
  v_premios int;
  v_scores int;
  v_cobertos int;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_p from public.ranking_periods rp where rp.id = p_period for update;
  if not found then
    return query select false, 'periodo nao encontrado', 0;
    return;
  end if;

  if current_date <= v_p.ends_on then
    return query select false,
      'o periodo ainda nao terminou: nao se anuncia vencedor no meio da corrida', 0;
    return;
  end if;

  select count(*)::int into v_scores from public.ranking_scores where period_id = p_period;
  if v_scores = 0 then
    return query select false, 'nao ha pontuacao calculada neste periodo', 0;
    return;
  end if;

  select count(*)::int into v_premios from public.ranking_prizes where period_id = p_period;
  if v_premios = 0 then
    return query select false,
      'nao ha premiacao declarada: anunciar vencedor sem dizer o que ele ganhou vira discussao', 0;
    return;
  end if;

  -- Quantas colocacoes estao cobertas por alguma faixa de premio.
  select count(distinct s.user_id)::int into v_cobertos
  from public.ranking_scores s
  join public.ranking_prizes pz
    on pz.period_id = p_period
   and s.position between pz.position_from and pz.position_to
  where s.period_id = p_period;

  update public.ranking_periods
  set finalists_published_at = now()
  where id = p_period;

  return query select true, 'finalistas publicados'::text, v_cobertos;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.ranking_prizes enable row level security;

-- A premiacao de um periodo publicado e visivel a quem ve o periodo. Saber o
-- que se ganha e parte de decidir se vale participar — esconder o premio ate
-- o fim seria pedir que alguem jogue sem saber o previo.
create policy ranking_prizes_select on public.ranking_prizes for select to authenticated
  using (
    exists (
      select 1 from public.ranking_periods rp
      where rp.id = ranking_prizes.period_id
        and (rp.is_published or fly_private.is_staff())
    )
  );

create policy ranking_prizes_write_operator on public.ranking_prizes for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

revoke all on public.ranking_prizes from anon;
grant select on public.ranking_prizes to authenticated;
grant insert, update, delete on public.ranking_prizes to authenticated;

revoke all on function public.publicar_finalistas(uuid) from public, anon;
grant execute on function public.publicar_finalistas(uuid) to authenticated;
