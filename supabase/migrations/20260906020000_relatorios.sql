-- =============================================================================
-- Fase 11 — relatórios (§46, entrega 6)
--
-- Seis relatórios foram pedidos: viagem, comércio, suporte, experiência,
-- eventos e patrocinadores. Cinco existem aqui. O sexto não:
--
--   **Não há domínio de patrocinador neste projeto.** Não há tabela, não há
--   contrato, não há cota. O que existe é `surprise_tasks.sponsor`, um texto
--   livre que a operação digita ao registrar quem bancou uma surpresa. O
--   relatório abaixo agrupa exatamente isso e chama pelo nome. Inventar uma
--   entidade de patrocinador seria inventar termo comercial, e termo comercial
--   está na lista da §33. Registrado como P56.
--
-- O critério da §46 que manda é este: "relatório reconcilia com ledgers". O de
-- comércio não soma pedidos e pronto — ele compara o que o pedido diz com o
-- que os pagamentos e estornos dizem, e devolve a diferença numa coluna. Um
-- relatório que sempre fecha é um relatório que não confere nada.
--
-- Todos são `security definer` com papel conferido dentro, e não `invoker`
-- sobre as tabelas: agregado não passa pela RLS linha a linha sem virar uma
-- consulta lenta e cheia de furos de escopo. Quem pode ver o quê é decidido
-- aqui, uma vez, explicitamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Viagem — a foto do dia de operação
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_viagem(p_trip uuid)
returns table (
  participantes int,
  dias int,
  atividades int,
  presencas int,
  presenca_esperada int,
  refeicoes_servicos int,
  refeicoes_escolhidas int,
  casos_abertos int,
  pedidos int,
  midia_liberada int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not fly_private.can_operate_trip(p_trip) then
    raise exception 'relatorio exige operar a viagem' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::int from public.trip_members tm where tm.trip_id = p_trip),
    (select count(*)::int from public.trip_days td where td.trip_id = p_trip),
    (select count(*)::int from public.activities a
       join public.trip_days td on td.id = a.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.activity_checkins ac
       join public.activities a on a.id = ac.activity_id
       join public.trip_days td on td.id = a.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.activity_participants ap
       join public.activities a on a.id = ap.activity_id
       join public.trip_days td on td.id = a.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.meal_services ms
       join public.trip_days td on td.id = ms.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.meal_choices mc
       join public.meal_services ms on ms.id = mc.service_id
       join public.trip_days td on td.id = ms.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.support_cases sc
      where sc.trip_id = p_trip
        and sc.status in ('open', 'accepted', 'in_progress', 'escalated')),
    (select count(*)::int from public.orders o where o.trip_id = p_trip),
    (select count(*)::int from public.trip_media m
      where m.trip_id = p_trip and m.is_released);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Comércio — e a reconciliação
--
-- Uma linha por moeda, porque somar moedas exige câmbio e câmbio está na §33.
-- É a mesma razão de `criar_pedido` recusar carrinho com moedas misturadas.
--
-- `divergencia_cents` é o coração do relatório: para os pedidos que já
-- deveriam estar pagos, é o que o pedido diz menos o que foi capturado menos o
-- que foi estornado. Zero é o esperado. Qualquer outro número é um pedido para
-- alguém olhar — e `pedidos_divergentes` diz quantos são.
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_comercio(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  currency public.currency_code,
  pedidos int,
  bruto_cents bigint,
  desconto_cents bigint,
  liquido_cents bigint,
  capturado_cents bigint,
  estornado_cents bigint,
  divergencia_cents bigint,
  pedidos_divergentes int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('finance')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'relatorio de comercio exige finance, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  with pedido as (
    select
      o.id,
      o.currency,
      o.status,
      o.subtotal_cents,
      o.discount_cents,
      o.total_cents,
      coalesce((
        select sum(p.amount_cents) from public.payments p
        where p.order_id = o.id and p.status = 'captured'
      ), 0) as capturado,
      coalesce((
        select sum(r.amount_cents) from public.refunds r where r.order_id = o.id
      ), 0) as estornado
    from public.orders o
    where o.placed_at >= p_de
      and o.placed_at < p_ate
      and (p_trip is null or o.trip_id = p_trip)
  ),
  -- Pedido pendente ou falho não entra na conta: ele **deve** estar sem
  -- captura, e contá-lo como divergência encheria o relatório de ruído.
  conferido as (
    select
      pd.*,
      case
        when pd.status in ('paid', 'confirmed', 'refunded', 'partially_refunded')
        then pd.total_cents - pd.capturado + pd.estornado
        else 0
      end as diferenca
    from pedido pd
  )
  select
    c.currency,
    count(*)::int,
    sum(c.subtotal_cents)::bigint,
    sum(c.discount_cents)::bigint,
    sum(c.total_cents)::bigint,
    sum(c.capturado)::bigint,
    sum(c.estornado)::bigint,
    sum(c.diferenca)::bigint,
    (count(*) filter (where c.diferenca <> 0))::int
  from conferido c
  group by c.currency
  order by c.currency;
end;
$$;

/**
 * Os pedidos que não fecham, um a um.
 *
 * O número agregado só serve se der para chegar às linhas. Sem isto, o
 * operador vê "3 pedidos divergentes" e não tem como agir.
 */
create or replace function public.comercio_divergencias(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  order_id uuid,
  reference text,
  status public.order_status,
  currency public.currency_code,
  total_cents bigint,
  capturado_cents bigint,
  estornado_cents bigint,
  diferenca_cents bigint,
  placed_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('finance')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'conferencia de comercio exige finance, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.reference,
    o.status,
    o.currency,
    o.total_cents,
    coalesce(pg.capturado, 0)::bigint,
    coalesce(rf.estornado, 0)::bigint,
    (o.total_cents - coalesce(pg.capturado, 0) + coalesce(rf.estornado, 0))::bigint,
    o.placed_at
  from public.orders o
  left join lateral (
    select sum(p.amount_cents) as capturado from public.payments p
    where p.order_id = o.id and p.status = 'captured'
  ) pg on true
  left join lateral (
    select sum(r.amount_cents) as estornado from public.refunds r where r.order_id = o.id
  ) rf on true
  where o.placed_at >= p_de
    and o.placed_at < p_ate
    and (p_trip is null or o.trip_id = p_trip)
    and o.status in ('paid', 'confirmed', 'refunded', 'partially_refunded')
    and o.total_cents - coalesce(pg.capturado, 0) + coalesce(rf.estornado, 0) <> 0
  order by o.placed_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Suporte — e o SLA que ainda não existe
--
-- Os tempos saem em minutos. O relatório **não** compara com alvo nenhum:
-- `support.sla_minutes` está `PENDENTE` desde a Fase 8 (P20), e um "dentro do
-- prazo" medido contra prazo inventado é pior do que nenhum.
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_suporte(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  level public.support_level,
  abertos int,
  resolvidos int,
  sem_aceite int,
  aceite_medio_min numeric,
  aceite_p90_min numeric,
  resposta_media_min numeric,
  resolucao_media_min numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('support')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'relatorio de suporte exige support, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  select
    sc.level,
    count(*)::int,
    (count(*) filter (where sc.status in ('resolved', 'closed')))::int,
    (count(*) filter (where sc.accepted_at is null))::int,
    round(avg(extract(epoch from (sc.accepted_at - sc.opened_at)) / 60.0)::numeric, 1),
    round(
      percentile_cont(0.9) within group (
        order by extract(epoch from (sc.accepted_at - sc.opened_at)) / 60.0
      )::numeric, 1
    ),
    round(avg(extract(epoch from (sc.first_response_at - sc.opened_at)) / 60.0)::numeric, 1),
    round(avg(extract(epoch from (sc.resolved_at - sc.opened_at)) / 60.0)::numeric, 1)
  from public.support_cases sc
  where sc.opened_at >= p_de
    and sc.opened_at < p_ate
    and (p_trip is null or sc.trip_id = p_trip)
  group by sc.level
  order by sc.level desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Experiência
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_experiencia(p_trip uuid)
returns table (
  figurinhas int,
  figurinhas_desbloqueadas int,
  pessoas_com_figurinha int,
  dias_completos int,
  missoes int,
  missoes_concluidas int,
  insights int,
  surpresas_sugeridas int,
  surpresas_entregues int,
  midia_liberada int,
  midia_com_revogacao int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('experience')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'relatorio de experiencia exige experience, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  with cap as (
    select c.id from public.album_chapters c where c.trip_id = p_trip
  ),
  fig as (
    select s.id from public.stickers s where s.chapter_id in (select cap.id from cap)
  )
  select
    (select count(*)::int from fig),
    (select count(*)::int from public.sticker_unlocks u
      where u.sticker_id in (select fig.id from fig)),
    (select count(distinct u.user_id)::int from public.sticker_unlocks u
      where u.sticker_id in (select fig.id from fig)),
    (select count(*)::int from public.chapter_completions cc
      where cc.chapter_id in (select cap.id from cap)),
    (select count(*)::int from public.quest_missions qm where qm.trip_id = p_trip),
    (select count(*)::int from public.quest_completions qc
       join public.quest_missions qm on qm.id = qc.mission_id
      where qm.trip_id = p_trip),
    (select count(*)::int from public.guest_insights gi where gi.trip_id = p_trip),
    (select count(*)::int from public.surprise_tasks st where st.trip_id = p_trip),
    (select count(*)::int from public.surprise_tasks st
      where st.trip_id = p_trip and st.status = 'entregue'),
    (select count(*)::int from public.trip_media m where m.trip_id = p_trip and m.is_released),
    (select count(*)::int from public.trip_media m
      where m.trip_id = p_trip and fly_private.midia_tem_revogacao(m.id));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Eventos
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_eventos(p_de timestamptz, p_ate timestamptz)
returns table (
  event_id uuid,
  slug text,
  title text,
  status public.event_status,
  is_published boolean,
  starts_at timestamptz,
  interessados int,
  na_home boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not fly_private.is_global_operator() then
    raise exception 'relatorio de eventos exige admin ou trip_manager' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.slug,
    e.title,
    e.status,
    e.is_published,
    e.starts_at,
    (select count(*)::int from public.event_interests ei where ei.event_id = e.id),
    e.home_order is not null
  from public.events e
  where e.starts_at is null or (e.starts_at >= p_de and e.starts_at < p_ate)
  order by e.starts_at nulls last;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Patrocínio — o que existe, com o nome que tem
--
-- Agrupa `surprise_tasks.sponsor`, que é **texto digitado**. "Rolex" e
-- "rolex " são duas linhas, e o relatório mostra as duas em vez de fingir que
-- normalizou: normalizar aqui esconderia o problema de cadastro em vez de
-- expô-lo, e o cadastro é que precisa de dono (P56).
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_patrocinio(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  sponsor text,
  tarefas int,
  entregues int,
  currency char(3),
  orcado_cents bigint,
  custo_cents bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('experience')
    or fly_private.has_role('finance')
    or fly_private.is_global_operator()
  ) then
    raise exception 'relatorio de patrocinio exige experience, finance, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  select
    st.sponsor,
    count(*)::int,
    (count(*) filter (where st.status = 'entregue'))::int,
    st.currency,
    coalesce(sum(st.budget_cents), 0)::bigint,
    coalesce(sum(st.cost_cents), 0)::bigint
  from public.surprise_tasks st
  where st.sponsor is not null
    and st.created_at >= p_de
    and st.created_at < p_ate
    and (p_trip is null or st.trip_id = p_trip)
  group by st.sponsor, st.currency
  order by count(*) desc, st.sponsor;
end;
$$;

-- -----------------------------------------------------------------------------
-- GRANT
-- -----------------------------------------------------------------------------
revoke all on function public.relatorio_viagem(uuid) from public, anon;
revoke all on function public.relatorio_comercio(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.comercio_divergencias(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.relatorio_suporte(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.relatorio_experiencia(uuid) from public, anon;
revoke all on function public.relatorio_eventos(timestamptz, timestamptz) from public, anon;
revoke all on function public.relatorio_patrocinio(timestamptz, timestamptz, uuid) from public, anon;

grant execute on function public.relatorio_viagem(uuid) to authenticated;
grant execute on function public.relatorio_comercio(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.comercio_divergencias(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.relatorio_suporte(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.relatorio_experiencia(uuid) to authenticated;
grant execute on function public.relatorio_eventos(timestamptz, timestamptz) to authenticated;
grant execute on function public.relatorio_patrocinio(timestamptz, timestamptz, uuid) to authenticated;
