-- =============================================================================
-- Fase 6 — a compra passa a render Fly Points sozinha.
--
-- Ate agora a regra existia em `app_config` e ninguem a aplicava: ponto so
-- entrava se alguem inserisse na mao. Aqui ela vira gatilho.
--
-- Os tres criterios da §41 que isto fecha, e o que os garante:
--
--   "compra elegivel lanca pontos uma vez"
--     A idempotency key e derivada do pedido (`order:<id>:earn:v1`), com
--     `on conflict do nothing`. Nao depende de o gatilho rodar uma vez so.
--
--   "webhook repetido nao pontua duas vezes"
--     Mesma chave. O webhook pode reprocessar a vontade; a segunda insercao
--     nao acontece.
--
--   "reembolso cria reversao"
--     Gatilho em `refunds`, proporcional ao valor devolvido, e **limitado** ao
--     que foi creditado — estornar mais do que se deu viraria saldo negativo
--     vindo do nada.
--
-- **Nada e creditado enquanto `points.earning_rule` tiver `version` nula.** E
-- o freio que a §33 exige: sem regra decidida, o sistema nao inventa uma.
-- =============================================================================

create or replace function fly_private.pontos_por_unidade()
returns int
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when (c.value ->> 'version') is null then 0
    else coalesce((c.value ->> 'spend_points_per_unit')::int, 0)
  end
  from public.app_config c
  where c.key = 'points.earning_rule';
$$;

create or replace function fly_private.versao_da_regra()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select c.value ->> 'version' from public.app_config c where c.key = 'points.earning_rule';
$$;

create or replace function fly_private.validade_dos_pontos()
returns int
language sql
security definer
stable
set search_path = ''
as $$
  select nullif(c.value #>> '{}', 'null')::int
  from public.app_config c where c.key = 'points.validity_months';
$$;

-- -----------------------------------------------------------------------------
-- Credito: o pedido virou `confirmed`.
--
-- `total_cents` esta em centavos; a regra e por unidade de moeda. Entao
-- `centavos / 100 * pontos_por_unidade`, com `div` para nao gerar fracao de
-- ponto — ponto quebrado nao existe e arredondar para cima daria ponto de
-- graca em toda compra.
-- -----------------------------------------------------------------------------
create or replace function fly_private.creditar_pontos_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_por_unidade int := fly_private.pontos_por_unidade();
  v_meses int := fly_private.validade_dos_pontos();
  v_pontos int;
begin
  if v_por_unidade <= 0 then
    return null;  -- sem regra decidida, nao se inventa uma
  end if;

  v_pontos := (new.total_cents / 100) * v_por_unidade;
  if v_pontos <= 0 then
    return null;
  end if;

  insert into public.points_ledger
    (user_id, kind, amount, source, reference, occurred_at, expires_on, rule_version, idempotency_key)
  values (
    new.user_id, 'earn', v_pontos, 'order', new.reference, now(),
    case when v_meses is null then null
         else (now() + make_interval(months => v_meses))::date end,
    fly_private.versao_da_regra(),
    'order:' || new.id::text || ':earn:' || coalesce(fly_private.versao_da_regra(), 'v0')
  )
  on conflict (idempotency_key) do nothing;

  return null;
end;
$$;

create trigger orders_creditam_pontos
  after update of status on public.orders
  for each row
  when (new.status = 'confirmed' and old.status is distinct from 'confirmed')
  execute function fly_private.creditar_pontos_do_pedido();

-- -----------------------------------------------------------------------------
-- Estorno: entrou uma linha em `refunds`.
--
-- Proporcional ao valor devolvido, e **limitado ao que foi creditado**. Um
-- reembolso parcial de metade estorna metade; a soma dos estornos nunca passa
-- do credito original, senao o saldo cairia abaixo do que a compra rendeu.
-- -----------------------------------------------------------------------------
create or replace function fly_private.estornar_pontos_do_reembolso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_credito public.points_ledger;
  v_ja_estornado int;
  v_pontos int;
begin
  select * into v_order from public.orders o where o.id = new.order_id;
  if not found then return null; end if;

  select * into v_credito
  from public.points_ledger l
  where l.source = 'order'
    and l.kind = 'earn'
    and l.idempotency_key like 'order:' || new.order_id::text || ':earn:%'
  limit 1;

  -- Sem credito nao ha o que estornar. Acontece com pedido anterior a regra.
  if not found then return null; end if;

  select coalesce(-sum(l.amount), 0)::int into v_ja_estornado
  from public.points_ledger l
  where l.reverses_id = v_credito.id;

  -- Proporcional ao valor devolvido, e nunca mais do que ainda resta.
  v_pontos := least(
    (v_credito.amount::bigint * new.amount_cents / nullif(v_order.total_cents, 0))::int,
    v_credito.amount - v_ja_estornado
  );

  if v_pontos is null or v_pontos <= 0 then return null; end if;

  insert into public.points_ledger
    (user_id, kind, amount, source, reference, occurred_at, rule_version, idempotency_key,
     reverses_id, reason)
  values (
    v_order.user_id, 'reverse', -v_pontos, 'order', v_order.reference, now(),
    v_credito.rule_version,
    'refund:' || new.id::text,
    v_credito.id,
    'Reembolso do pedido ' || v_order.reference
  )
  on conflict (idempotency_key) do nothing;

  return null;
end;
$$;

create trigger refunds_estornam_pontos
  after insert on public.refunds
  for each row
  execute function fly_private.estornar_pontos_do_reembolso();

revoke all on function fly_private.pontos_por_unidade() from public, anon, authenticated;
revoke all on function fly_private.versao_da_regra() from public, anon, authenticated;
revoke all on function fly_private.validade_dos_pontos() from public, anon, authenticated;
