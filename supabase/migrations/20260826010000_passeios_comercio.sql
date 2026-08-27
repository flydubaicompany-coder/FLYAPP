-- =============================================================================
-- Fase 5 — Carrinho, pedido, pagamento e reembolso (§6.5 e §40)
--
-- Catálogo é conteúdo e se edita. **Isto é registro financeiro e não se
-- edita.** A separação em dois arquivos é essa, e ela se reflete nas
-- políticas: nada aqui aceita `update` do cliente, e `delete` só existe onde
-- não há dinheiro envolvido.
--
-- As regras da §40, e onde cada uma mora:
--
--   preço no servidor            → `criar_pedido()` recalcula tudo; o cliente
--                                  não manda valor, manda intenção
--   moeda explícita              → domínio `currency_code`, e pedido de moeda
--                                  única (ver `orders_single_currency`)
--   hold expira                  → `cart_items.hold_expires_at`, conferido em
--                                  toda leitura de disponibilidade
--   concorrência                 → `select … for update` no slot
--   webhook não duplica          → `payment_events.provider_event_id` único
--   cartão tokenizado            → só `payments.provider_ref` existe aqui
--   política versionada          → copiada para dentro do pedido na compra
-- =============================================================================

create type public.order_status as enum (
  'pending_payment',
  'paid',
  'confirmed',
  'cancelled',
  'refunded',
  'partially_refunded',
  'failed'
);

create type public.payment_status as enum (
  'created', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'
);

-- -----------------------------------------------------------------------------
-- Carrinho
--
-- Um por cliente, persistente entre sessões (§6.5). Não expira; o que expira é
-- a **reserva** de cada item.
-- -----------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint carts_one_per_user unique (user_id)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  slot_id uuid not null references public.tour_slots (id) on delete cascade,
  variant_id uuid not null references public.tour_variants (id) on delete cascade,

  people int not null,

  /**
   * Até quando a vaga está segurada.
   *
   * Passado esse instante o item continua no carrinho — some a reserva, não o
   * item. A diferença importa: apagar o item faria o cliente perder o que
   * escolheu por ter demorado a decidir; manter sem reserva o obriga apenas a
   * conferir se ainda há vaga.
   */
  hold_expires_at timestamptz not null,

  /**
   * Preço no momento em que entrou no carrinho.
   *
   * Não é o preço que será cobrado — `criar_pedido()` recalcula do catálogo.
   * Existe para a tela poder avisar "o preço mudou desde que você colocou no
   * carrinho" em vez de cobrar diferente em silêncio.
   */
  price_cents_snapshot bigint not null,
  currency_snapshot public.currency_code not null,

  created_at timestamptz not null default now(),

  constraint cart_items_people_positive check (people > 0),
  -- O mesmo slot duas vezes no mesmo carrinho é sempre engano de toque duplo.
  constraint cart_items_unique unique (cart_id, slot_id)
);

create index cart_items_cart_idx on public.cart_items (cart_id);
create index cart_items_slot_idx on public.cart_items (slot_id, hold_expires_at);
create index cart_items_variant_idx on public.cart_items (variant_id);

-- -----------------------------------------------------------------------------
-- Cupom
-- -----------------------------------------------------------------------------
create table public.coupons (
  code text primary key,
  label text not null,
  -- Percentual OU valor fixo, nunca os dois. Cupom que é as duas coisas é
  -- ambiguidade que vira reclamação.
  percent_off int,
  amount_off_cents bigint,
  currency public.currency_code,

  valid_from timestamptz,
  valid_until timestamptz,
  max_redemptions int,
  redemptions int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint coupons_one_kind check (
    (percent_off is not null and amount_off_cents is null and currency is null)
    or (percent_off is null and amount_off_cents is not null and currency is not null)
  ),
  constraint coupons_percent_range check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  constraint coupons_amount_positive check (amount_off_cents is null or amount_off_cents > 0),
  constraint coupons_redemptions_within_max
    check (max_redemptions is null or redemptions <= max_redemptions)
);

-- -----------------------------------------------------------------------------
-- Pedido
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  trip_id uuid references public.trips (id) on delete set null,

  -- Número curto e legível, para o cliente citar no suporte.
  reference text not null,

  status public.order_status not null default 'pending_payment',

  /**
   * Moeda única por pedido.
   *
   * Somar BRL com AED exige câmbio, e a §33 proíbe inventar câmbio. Um
   * carrinho com moedas misturadas vira dois pedidos — e `criar_pedido()`
   * recusa em vez de escolher por conta própria.
   */
  currency public.currency_code not null,
  subtotal_cents bigint not null,
  discount_cents bigint not null default 0,
  total_cents bigint not null,

  coupon_code text references public.coupons (code),

  /**
   * A política de cancelamento, copiada para dentro do pedido.
   *
   * A §40 exige que ela fique "versionada com o pedido". Referência por chave
   * estrangeira não bastaria: editar a política mudaria retroativamente o que
   * o cliente aceitou. O texto vem junto porque é ele que vale numa disputa,
   * e o `id` fica só para rastrear a origem.
   */
  cancellation_policy_id uuid references public.cancellation_policies (id),
  cancellation_policy_version int,
  cancellation_policy_label text,
  cancellation_policy_text text,
  cancellation_policy_rules jsonb,

  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_reference_unique unique (reference),
  constraint orders_totals_non_negative check (
    subtotal_cents >= 0 and discount_cents >= 0 and total_cents >= 0
  ),
  constraint orders_total_matches check (total_cents = subtotal_cents - discount_cents),
  constraint orders_discount_within_subtotal check (discount_cents <= subtotal_cents),
  -- Pedido confirmado sem data de confirmação é histórico que não fecha.
  constraint orders_confirmed_has_date
    check (status not in ('confirmed', 'paid') or confirmed_at is not null or status = 'paid'),
  constraint orders_cancelled_has_date
    check (status <> 'cancelled' or cancelled_at is not null)
);

create index orders_user_idx on public.orders (user_id, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at);
create index orders_trip_idx on public.orders (trip_id);
create index orders_coupon_idx on public.orders (coupon_code);
create index orders_policy_idx on public.orders (cancellation_policy_id);

/**
 * Item do pedido.
 *
 * Tudo aqui é **cópia**, não referência: título, preço, horário. O catálogo
 * muda, e o pedido não pode mudar junto. Quem quiser saber o que o passeio é
 * hoje segue o `tour_id`; quem quiser saber o que foi vendido lê estas
 * colunas.
 */
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,

  tour_id uuid references public.tours (id) on delete set null,
  variant_id uuid references public.tour_variants (id) on delete set null,
  slot_id uuid references public.tour_slots (id) on delete set null,

  tour_title text not null,
  variant_label text not null,
  starts_at timestamptz,
  timezone text,

  people int not null,
  unit_price_cents bigint not null,
  currency public.currency_code not null,
  line_total_cents bigint not null,

  created_at timestamptz not null default now(),

  constraint order_items_people_positive check (people > 0),
  constraint order_items_price_positive check (unit_price_cents > 0),
  constraint order_items_total_positive check (line_total_cents > 0)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_slot_idx on public.order_items (slot_id);
create index order_items_tour_idx on public.order_items (tour_id);
create index order_items_variant_idx on public.order_items (variant_id);

/**
 * Participantes de um item (§6.5, passo 5).
 *
 * Nome por pessoa, porque ingresso e lista de embarque precisam dele. Não há
 * documento aqui: o passaporte mora em `passports`, e duplicá-lo por pedido
 * criaria uma segunda cópia do dado mais sensível do app.
 */
create table public.order_participants (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  -- Nulo quando é acompanhante sem conta no app.
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  notes text,

  constraint order_participants_name_not_blank check (length(trim(full_name)) >= 2)
);

create index order_participants_item_idx on public.order_participants (order_item_id);
create index order_participants_user_idx on public.order_participants (user_id);

-- -----------------------------------------------------------------------------
-- Pagamento
--
-- Nada de número de cartão, validade ou CVV — nem coluna para isso existir. O
-- que o app guarda é a referência opaca que o provedor devolve.
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,

  provider text not null,
  -- O identificador do provedor. É por ele que o webhook encontra o pedido.
  provider_ref text,
  -- Últimos quatro dígitos e bandeira, que o provedor devolve e o cliente
  -- precisa ver para reconhecer a cobrança. Nada além disso.
  card_brand text,
  card_last4 char(4),

  status public.payment_status not null default 'created',
  amount_cents bigint not null,
  currency public.currency_code not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_last4_digits check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  constraint payments_ref_unique unique (provider, provider_ref)
);

create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status, created_at);

/**
 * Eventos de webhook (§40, "um webhook repetido não duplica pedido").
 *
 * `provider_event_id` é único, e é isso que torna o webhook idempotente: o
 * provedor reenvia o mesmo evento quando não recebe 200, e o segundo insert
 * bate na unicidade em vez de processar de novo.
 *
 * Append-only. O histórico de um pagamento é o que se apresenta numa
 * contestação, e não se reescreve.
 */
create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments (id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  -- O corpo como veio. Guardado inteiro porque, quando algo diverge, a
  -- pergunta é sempre "o que exatamente eles mandaram?".
  payload jsonb not null,
  signature_valid boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  -- Por que não foi processado, quando não foi.
  skipped_reason text,

  constraint payment_events_unique unique (provider, provider_event_id)
);

create index payment_events_payment_idx on public.payment_events (payment_id, received_at desc);
create index payment_events_pendentes_idx on public.payment_events (received_at)
  where processed_at is null;

/**
 * Reembolso (§40, "reembolso gera evento e não apaga histórico").
 *
 * Linha própria, e não `orders.status = 'refunded'` sozinho: reembolso pode
 * ser parcial, pode haver mais de um, e cada um tem valor, motivo e autor.
 */
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,

  amount_cents bigint not null,
  currency public.currency_code not null,
  reason text not null,
  provider_ref text,

  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint refunds_amount_positive check (amount_cents > 0),
  constraint refunds_reason_not_blank check (length(trim(reason)) >= 3)
);

create index refunds_order_idx on public.refunds (order_id, created_at desc);
create index refunds_payment_idx on public.refunds (payment_id);
create index refunds_by_idx on public.refunds (requested_by);

create trigger carts_touch before update on public.carts
  for each row execute function fly_private.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function fly_private.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function fly_private.touch_updated_at();

-- =============================================================================
-- Funções
-- =============================================================================

/**
 * Aliasar coluna dentro de plpgsql não é preciosismo.
 *
 * `order_id`, `status`, `reference` e `currency` são nomes de parâmetro de
 * saída **e** de coluna. Sem o alias da tabela, o plpgsql resolve para o
 * parâmetro e o Postgres para com "column reference is ambiguous" — que foi o
 * que aconteceu na primeira execução desta migration.
 *
 * É o mesmo erro da D34, em outra linguagem: o nome resolveu para algo que
 * não era o que eu quis dizer. Por isso tudo abaixo vai qualificado, mesmo
 * onde hoje não haveria conflito — o conflito aparece quando alguém acrescenta
 * um parâmetro de saída meses depois.
 */

/**
 * Vagas realmente livres num slot.
 *
 * `capacity - sold - reservas ativas`. A reserva expirada não conta, e é por
 * isso que o cálculo olha `hold_expires_at > now()` em vez de confiar num
 * contador que alguém precisaria lembrar de devolver.
 *
 * `p_ignorar_carrinho` existe para o próprio carrinho não competir consigo
 * mesmo ao revalidar: sem isso, aumentar de 2 para 3 pessoas veria as suas 2
 * já reservadas como ocupadas por terceiros.
 */
create or replace function public.vagas_livres(p_slot uuid, p_ignorar_carrinho uuid default null)
returns int
language sql
security definer
stable
set search_path = ''
as $$
  select greatest(
    0,
    s.capacity - s.sold - coalesce((
      select sum(ci.people)::int
      from public.cart_items ci
      where ci.slot_id = s.id
        and ci.hold_expires_at > now()
        and (p_ignorar_carrinho is null or ci.cart_id <> p_ignorar_carrinho)
    ), 0)
  )
  from public.tour_slots s
  where s.id = p_slot and s.is_active;
$$;

revoke all on function public.vagas_livres(uuid, uuid) from public, anon;
grant execute on function public.vagas_livres(uuid, uuid) to authenticated;

/**
 * Coloca no carrinho, segurando a vaga (§6.5, passos 1 a 3).
 *
 * **`for update` no slot é o que impede a venda além do estoque.** Duas
 * pessoas comprando a última vaga ao mesmo tempo competem pelo mesmo bloqueio
 * de linha; a segunda só avalia a disponibilidade depois que a primeira
 * terminou, e encontra zero. Ler e depois gravar, sem o bloqueio, deixaria a
 * janela aberta — e é exatamente a janela que esgota inventário em promoção.
 *
 * O prazo do hold vem de `app_config`, não de constante: quanto tempo segurar
 * uma vaga é decisão comercial, e muda sem nova versão do app.
 */
create or replace function public.reservar_no_carrinho(
  p_slot uuid,
  p_people int
)
returns table (ok boolean, motivo text, expira_em timestamptz, vagas int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cart uuid;
  v_slot public.tour_slots;
  v_variant public.tour_variants;
  v_livres int;
  v_minutos int;
  v_expira timestamptz;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '28000';
  end if;

  if p_people is null or p_people < 1 then
    return query select false, 'quantidade invalida', null::timestamptz, null::int;
    return;
  end if;

  -- Carrinho é criado na primeira necessidade, não no cadastro.
  insert into public.carts (user_id) values (v_user)
  on conflict (user_id) do nothing;
  select id into v_cart from public.carts where user_id = v_user;

  -- O bloqueio. Tudo depois desta linha vê um estoque estável.
  select * into v_slot from public.tour_slots where id = p_slot for update;

  if not found or not v_slot.is_active then
    return query select false, 'slot indisponivel', null::timestamptz, null::int;
    return;
  end if;

  if v_slot.starts_at <= now() then
    return query select false, 'slot ja aconteceu', null::timestamptz, null::int;
    return;
  end if;

  select * into v_variant from public.tour_variants where id = v_slot.variant_id;
  if not found or not v_variant.is_active then
    return query select false, 'opcao indisponivel', null::timestamptz, null::int;
    return;
  end if;

  if p_people < v_variant.min_people
     or (v_variant.max_people is not null and p_people > v_variant.max_people) then
    return query select false, 'quantidade fora do permitido', null::timestamptz, null::int;
    return;
  end if;

  v_livres := public.vagas_livres(p_slot, v_cart);
  if v_livres < p_people then
    return query select false, 'sem vagas', null::timestamptz, v_livres;
    return;
  end if;

  v_minutos := coalesce(
    (select nullif(value #>> '{}', 'PENDENTE')::int
     from public.app_config where key = 'cart.hold_minutes'),
    15
  );
  v_expira := now() + (v_minutos || ' minutes')::interval;

  insert into public.cart_items
    (cart_id, slot_id, variant_id, people, hold_expires_at,
     price_cents_snapshot, currency_snapshot)
  values
    (v_cart, p_slot, v_slot.variant_id, p_people, v_expira,
     v_variant.price_cents, v_variant.currency)
  on conflict (cart_id, slot_id) do update
    set people = excluded.people,
        hold_expires_at = excluded.hold_expires_at,
        price_cents_snapshot = excluded.price_cents_snapshot,
        currency_snapshot = excluded.currency_snapshot;

  return query select true, null::text, v_expira, v_livres - p_people;
end;
$$;

revoke all on function public.reservar_no_carrinho(uuid, int) from public, anon;
grant execute on function public.reservar_no_carrinho(uuid, int) to authenticated;

/**
 * Fecha o pedido (§6.5, passos 4 a 7).
 *
 * O cliente **não manda preço**. Manda a intenção — o que está no carrinho, e
 * qual cupom — e o servidor recalcula tudo do catálogo. Aceitar valor do
 * cliente é aceitar o valor que ele escolher.
 *
 * Idempotente por chave: a mesma chave devolve o mesmo pedido em vez de criar
 * outro. É o que protege contra toque duplo e contra repetição de requisição
 * na borda instável de uma rede de celular.
 *
 * `sold` é incrementado aqui, com o pedido ainda por pagar. Um pedido não pago
 * continua segurando a vaga de propósito: a alternativa é duas pessoas pagando
 * pelo mesmo lugar e alguém descobrindo no embarque.
 */
create or replace function public.criar_pedido(
  p_idempotency_key text,
  p_coupon text default null,
  p_trip uuid default null
)
returns table (ok boolean, motivo text, order_id uuid, reference text, total_cents bigint,
               currency public.currency_code)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cart uuid;
  v_existente jsonb;
  v_moedas int;
  v_currency public.currency_code;
  v_order uuid;
  v_ref text;
  v_subtotal bigint := 0;
  v_desconto bigint := 0;
  v_cupom public.coupons;
  v_item record;
  v_livres int;
  v_politica public.cancellation_policies;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '28000';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    return query select false, 'chave de idempotencia ausente', null::uuid, null::text,
                        null::bigint, null::public.currency_code;
    return;
  end if;

  -- Chave já usada: devolve o que devolveu antes, sem criar nada.
  select ik.response into v_existente
  from public.idempotency_keys ik
  where ik.key = p_idempotency_key and ik.scope = 'criar_pedido';

  if found and v_existente is not null then
    return query select true, 'ja processado',
      (v_existente ->> 'order_id')::uuid,
      v_existente ->> 'reference',
      (v_existente ->> 'total_cents')::bigint,
      (v_existente ->> 'currency')::public.currency_code;
    return;
  end if;

  select c.id into v_cart from public.carts c where c.user_id = v_user;
  if v_cart is null then
    return query select false, 'carrinho vazio', null::uuid, null::text,
                        null::bigint, null::public.currency_code;
    return;
  end if;

  if not exists (select 1 from public.cart_items ci where ci.cart_id = v_cart) then
    return query select false, 'carrinho vazio', null::uuid, null::text,
                        null::bigint, null::public.currency_code;
    return;
  end if;

  /**
   * Moeda única.
   *
   * Somar BRL com AED exige câmbio, e a §33 proíbe inventar câmbio. O erro é
   * dito ao cliente para ele dividir a compra — escolher uma moeda por ele
   * seria decidir quanto ele paga.
   */
  select count(distinct v.currency) into v_moedas
  from public.cart_items ci
  join public.tour_variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart;

  if v_moedas > 1 then
    return query select false, 'carrinho com moedas diferentes', null::uuid, null::text,
                        null::bigint, null::public.currency_code;
    return;
  end if;

  select v.currency into v_currency
  from public.cart_items ci
  join public.tour_variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart
  limit 1;

  v_ref := 'FLY-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));

  insert into public.orders (user_id, trip_id, reference, currency, subtotal_cents, total_cents)
  values (v_user, p_trip, v_ref, v_currency, 0, 0)
  returning id into v_order;

  -- Cada item: bloqueia o slot, reconfere a vaga, copia o preço do catálogo.
  for v_item in
    select ci.id as cart_item_id, ci.slot_id, ci.variant_id, ci.people
    from public.cart_items ci
    where ci.cart_id = v_cart
    order by ci.created_at
  loop
    perform 1 from public.tour_slots s where s.id = v_item.slot_id for update;

    v_livres := public.vagas_livres(v_item.slot_id, v_cart);
    if v_livres < v_item.people then
      -- Nada é gravado pela metade: o rollback desfaz o pedido inteiro.
      raise exception 'sem vagas para o item %', v_item.slot_id using errcode = '23514';
    end if;

    insert into public.order_items (
      order_id, tour_id, variant_id, slot_id, tour_title, variant_label,
      starts_at, timezone, people, unit_price_cents, currency, line_total_cents
    )
    select
      v_order, t.id, var.id, s.id, t.title, var.label, s.starts_at, s.timezone,
      v_item.people, var.price_cents, var.currency,
      -- Preço por vaga vezes pessoas, salvo quando a variante cobre um grupo:
      -- um privativo de quatro custa por barco, não por cabeça.
      case when var.covers_people > 1 then var.price_cents
           else var.price_cents * v_item.people end
    from public.tour_slots s
    join public.tour_variants var on var.id = s.variant_id
    join public.tours t on t.id = var.tour_id
    where s.id = v_item.slot_id;

    update public.tour_slots s
    set sold = s.sold + v_item.people
    where s.id = v_item.slot_id;
  end loop;

  -- `oi.` obrigatorio: `order_id` e nome de parametro de saida desta funcao
  -- **e** coluna de `order_items`. Sem o alias, o plpgsql resolve para o
  -- parametro e o Postgres para com "column reference is ambiguous". Mesma
  -- familia do erro de RLS da D34: o nome resolveu para outra coisa.
  select coalesce(sum(oi.line_total_cents), 0) into v_subtotal
  from public.order_items oi where oi.order_id = v_order;

  -- Cupom
  if p_coupon is not null then
    select * into v_cupom from public.coupons cp
    where cp.code = upper(trim(p_coupon))
      and cp.is_active
      and (cp.valid_from is null or cp.valid_from <= now())
      and (cp.valid_until is null or cp.valid_until > now())
      and (cp.max_redemptions is null or cp.redemptions < cp.max_redemptions);

    if found then
      if v_cupom.percent_off is not null then
        v_desconto := (v_subtotal * v_cupom.percent_off) / 100;
      elsif v_cupom.currency = v_currency then
        -- Cupom em outra moeda não se aplica: converter exigiria câmbio.
        v_desconto := least(v_cupom.amount_off_cents, v_subtotal);
      end if;

      if v_desconto > 0 then
        update public.orders o set coupon_code = v_cupom.code where o.id = v_order;
        update public.coupons cp set redemptions = cp.redemptions + 1 where cp.code = v_cupom.code;
      end if;
    end if;
  end if;

  -- Política de cancelamento, copiada para dentro do pedido.
  select cp.* into v_politica
  from public.order_items oi
  join public.tours t on t.id = oi.tour_id
  join public.cancellation_policies cp on cp.id = t.cancellation_policy_id
  where oi.order_id = v_order
  order by cp.version desc
  limit 1;

  update public.orders o
  set subtotal_cents = v_subtotal,
      discount_cents = v_desconto,
      total_cents = v_subtotal - v_desconto,
      cancellation_policy_id = v_politica.id,
      cancellation_policy_version = v_politica.version,
      cancellation_policy_label = v_politica.label,
      cancellation_policy_text = v_politica.description,
      cancellation_policy_rules = v_politica.rules
  where o.id = v_order;

  delete from public.cart_items ci where ci.cart_id = v_cart;

  insert into public.idempotency_keys (key, scope, request_fingerprint, response, expires_at)
  values (
    p_idempotency_key, 'criar_pedido', v_user::text,
    jsonb_build_object('order_id', v_order, 'reference', v_ref,
                       'total_cents', v_subtotal - v_desconto, 'currency', v_currency),
    now() + interval '30 days'
  )
  on conflict (key) do nothing;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'order.placed', 'orders', v_order::text,
          jsonb_build_object('reference', v_ref, 'total_cents', v_subtotal - v_desconto,
                             'currency', v_currency));

  return query select true, null::text, v_order, v_ref, v_subtotal - v_desconto, v_currency;
end;
$$;

revoke all on function public.criar_pedido(text, text, uuid) from public, anon;
grant execute on function public.criar_pedido(text, text, uuid) to authenticated;

/**
 * Recebe um evento do provedor de pagamento (§40, webhook idempotente).
 *
 * `security definer` e chamada **só pela Edge Function**, que é onde a
 * assinatura é conferida — a chave secreta do provedor não pode existir no
 * cliente, e `signature_valid` chega já resolvido de lá.
 *
 * A idempotência é a unicidade de `(provider, provider_event_id)`. O provedor
 * reenvia o mesmo evento quando não recebe 200; o segundo insert bate na
 * constraint, a função devolve `duplicado` e nada é processado de novo.
 * Conferir "já processei?" com um `select` antes do `insert` deixaria a janela
 * aberta entre a leitura e a gravação — que é justamente quando as duas
 * tentativas do provedor chegam.
 */
create or replace function public.registrar_evento_pagamento(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_valid boolean
)
returns table (resultado text, order_id uuid, order_status public.order_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento_id bigint;
  v_ref text;
  v_payment public.payments;
  v_order public.orders;
begin
  -- Assinatura inválida entra no registro e para por aí. Descartar em
  -- silêncio esconderia uma tentativa de forjar pagamento, que é exatamente o
  -- que se quer enxergar.
  if not p_signature_valid then
    insert into public.payment_events
      (provider, provider_event_id, event_type, payload, signature_valid, skipped_reason)
    values (p_provider, p_event_id, p_event_type, p_payload, false, 'assinatura invalida')
    on conflict (provider, provider_event_id) do nothing;

    return query select 'assinatura_invalida'::text, null::uuid, null::public.order_status;
    return;
  end if;

  insert into public.payment_events
    (provider, provider_event_id, event_type, payload, signature_valid)
  values (p_provider, p_event_id, p_event_type, p_payload, true)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_evento_id;

  -- Sem `id` de retorno, o insert não aconteceu: já estava lá.
  if v_evento_id is null then
    select o.id, o.status into v_order.id, v_order.status
    from public.payment_events pe
    join public.payments p on p.id = pe.payment_id
    join public.orders o on o.id = p.order_id
    where pe.provider = p_provider and pe.provider_event_id = p_event_id;

    return query select 'duplicado'::text, v_order.id, v_order.status;
    return;
  end if;

  v_ref := p_payload ->> 'provider_ref';

  select * into v_payment
  from public.payments
  where provider = p_provider and provider_ref = v_ref;

  if not found then
    update public.payment_events
    set skipped_reason = 'pagamento nao encontrado', processed_at = now()
    where id = v_evento_id;

    return query select 'pagamento_desconhecido'::text, null::uuid, null::public.order_status;
    return;
  end if;

  update public.payment_events set payment_id = v_payment.id where id = v_evento_id;

  select * into v_order from public.orders where id = v_payment.order_id;

  if p_event_type in ('payment.succeeded', 'payment.captured') then
    update public.payments
    set status = 'captured',
        card_brand = coalesce(p_payload ->> 'card_brand', card_brand),
        card_last4 = coalesce(p_payload ->> 'card_last4', card_last4)
    where id = v_payment.id;

    -- Só avança quem ainda está esperando. Um evento repetido de outro tipo,
    -- ou fora de ordem, não pode reabrir um pedido cancelado.
    update public.orders
    set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now())
    where id = v_order.id and status = 'pending_payment';

  elsif p_event_type in ('payment.failed', 'payment.cancelled') then
    update public.payments set status = 'failed' where id = v_payment.id;

    -- Pagamento que não veio devolve a vaga ao estoque.
    update public.tour_slots s
    set sold = greatest(0, s.sold - oi.people)
    from public.order_items oi
    where oi.order_id = v_order.id and s.id = oi.slot_id;

    update public.orders
    set status = 'failed'
    where id = v_order.id and status = 'pending_payment';
  end if;

  update public.payment_events set processed_at = now() where id = v_evento_id;

  select status into v_order.status from public.orders where id = v_order.id;
  return query select 'processado'::text, v_order.id, v_order.status;
end;
$$;

revoke all on function public.registrar_evento_pagamento(text, text, text, jsonb, boolean)
  from public, anon, authenticated;

/**
 * Reembolso (§40, "gera evento e não apaga histórico").
 *
 * Insere uma linha; não apaga nada. O pedido muda de status e mantém itens,
 * pagamento e valores — quem precisar saber o que foi vendido continua
 * encontrando.
 */
create or replace function public.reembolsar_pedido(
  p_order uuid,
  p_amount_cents bigint,
  p_reason text
)
returns table (ok boolean, motivo text, status public.order_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.orders;
  v_ja bigint;
  v_payment uuid;
  v_novo public.order_status;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_order from public.orders o where o.id = p_order for update;
  if not found then
    return query select false, 'pedido nao encontrado', null::public.order_status;
    return;
  end if;

  if v_order.status not in ('paid', 'confirmed', 'partially_refunded') then
    return query select false, 'pedido nao esta pago', v_order.status;
    return;
  end if;

  select coalesce(sum(rf.amount_cents), 0) into v_ja
  from public.refunds rf where rf.order_id = p_order;

  if p_amount_cents <= 0 or v_ja + p_amount_cents > v_order.total_cents then
    return query select false, 'valor acima do total do pedido', v_order.status;
    return;
  end if;

  -- `status` tambem e parametro de saida aqui. Mesmo cuidado.
  select pg.id into v_payment from public.payments pg
  where pg.order_id = p_order and pg.status = 'captured'
  order by pg.created_at desc limit 1;

  insert into public.refunds (order_id, payment_id, amount_cents, currency, reason, requested_by)
  values (p_order, v_payment, p_amount_cents, v_order.currency, p_reason, v_user);

  v_novo := case when v_ja + p_amount_cents >= v_order.total_cents
                 then 'refunded'::public.order_status
                 else 'partially_refunded'::public.order_status end;

  update public.orders o set status = v_novo where o.id = p_order;

  -- Reembolso total devolve as vagas. Parcial não: o passeio continua de pé.
  if v_novo = 'refunded' then
    update public.tour_slots s
    set sold = greatest(0, s.sold - oi.people)
    from public.order_items oi
    where oi.order_id = p_order and s.id = oi.slot_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'order.refunded', 'orders', p_order::text,
          jsonb_build_object('amount_cents', p_amount_cents, 'currency', v_order.currency,
                             'reason', p_reason, 'status', v_novo));

  return query select true, null::text, v_novo;
end;
$$;

revoke all on function public.reembolsar_pedido(uuid, bigint, text) from public, anon;
grant execute on function public.reembolsar_pedido(uuid, bigint, text) to authenticated;

/**
 * Cancelamento pelo cliente.
 *
 * Devolve a vaga e registra. **Não** decide reembolso: quanto volta depende da
 * política gravada no pedido, e aplicar percentual sem o dono do produto ter
 * definido a regra seria inventar dinheiro (§33). O pedido fica cancelado, e o
 * reembolso é ato da operação.
 */
create or replace function public.cancelar_pedido(p_order uuid, p_reason text default null)
returns table (ok boolean, motivo text, politica text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order for update;

  if not found then
    return query select false, 'pedido nao encontrado', null::text;
    return;
  end if;

  if v_order.user_id <> v_user and not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  if v_order.status in ('cancelled', 'refunded') then
    return query select false, 'pedido ja cancelado', v_order.cancellation_policy_text;
    return;
  end if;

  update public.tour_slots s
  set sold = greatest(0, s.sold - oi.people)
  from public.order_items oi
  where oi.order_id = p_order and s.id = oi.slot_id;

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = p_reason
  where id = p_order;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'order.cancelled', 'orders', p_order::text,
          jsonb_build_object('reason', p_reason, 'policy_version', v_order.cancellation_policy_version));

  return query select true, null::text, v_order.cancellation_policy_text;
end;
$$;

revoke all on function public.cancelar_pedido(uuid, text) from public, anon;
grant execute on function public.cancelar_pedido(uuid, text) to authenticated;

-- =============================================================================
-- RLS do comércio
--
-- Regra que atravessa tudo: **o cliente não escreve dinheiro.** Ele lê o que é
-- dele e chama RPC para agir. Pedido, item, pagamento e reembolso não têm
-- política de INSERT nem de UPDATE para `authenticated` — as funções acima são
-- `security definer` e são a única porta.
--
-- Carrinho é a exceção, e é de propósito: remover item é ação sem consequência
-- financeira, e obrigar uma RPC para isso seria cerimônia sem ganho.
-- =============================================================================
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_participants enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;

create or replace function fly_private.carrinho_proprio(p_cart uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.carts c
    where c.id = p_cart and c.user_id = (select auth.uid())
  );
$$;

create or replace function fly_private.pedido_proprio(p_order uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order and o.user_id = (select auth.uid())
  );
$$;

create policy carts_select_own on public.carts for select to authenticated
  using ((select auth.uid()) = public.carts.user_id);

create policy cart_items_select_own on public.cart_items for select to authenticated
  using (fly_private.carrinho_proprio(public.cart_items.cart_id));
-- Tirar do carrinho é do cliente. Colocar passa por `reservar_no_carrinho`,
-- que é onde o bloqueio de estoque acontece.
create policy cart_items_delete_own on public.cart_items for delete to authenticated
  using (fly_private.carrinho_proprio(public.cart_items.cart_id));

/**
 * Cupom: existe, mas não se lista.
 *
 * Sem política de SELECT para o cliente. Uma tabela de cupons legível é uma
 * lista de descontos para experimentar — quem tem o código o aplica no
 * checkout, e `criar_pedido()` valida do lado do servidor.
 */
create policy coupons_select_operator on public.coupons for select to authenticated
  using (fly_private.is_global_operator());
create policy coupons_insert_operator on public.coupons for insert to authenticated
  with check (fly_private.is_global_operator());
create policy coupons_update_operator on public.coupons for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

create policy orders_select on public.orders for select to authenticated
  using (
    (select auth.uid()) = public.orders.user_id
    or fly_private.is_global_operator()
  );

create policy order_items_select on public.order_items for select to authenticated
  using (
    fly_private.pedido_proprio(public.order_items.order_id)
    or fly_private.is_global_operator()
  );

create policy order_participants_select on public.order_participants for select to authenticated
  using (
    exists (
      select 1 from public.order_items oi
      where oi.id = public.order_participants.order_item_id
        and (fly_private.pedido_proprio(oi.order_id) or fly_private.is_global_operator())
    )
  );
-- O cliente informa quem vai (§6.5, passo 5). É a única escrita dele em
-- território de pedido, e não toca em valor.
create policy order_participants_insert on public.order_participants for insert to authenticated
  with check (
    exists (
      select 1 from public.order_items oi
      where oi.id = order_item_id and fly_private.pedido_proprio(oi.order_id)
    )
  );
create policy order_participants_update on public.order_participants for update to authenticated
  using (
    exists (
      select 1 from public.order_items oi
      where oi.id = public.order_participants.order_item_id
        and fly_private.pedido_proprio(oi.order_id)
    )
  )
  with check (
    exists (
      select 1 from public.order_items oi
      where oi.id = order_item_id and fly_private.pedido_proprio(oi.order_id)
    )
  );
create policy order_participants_delete on public.order_participants for delete to authenticated
  using (
    exists (
      select 1 from public.order_items oi
      where oi.id = public.order_participants.order_item_id
        and fly_private.pedido_proprio(oi.order_id)
    )
  );

create policy payments_select on public.payments for select to authenticated
  using (
    fly_private.pedido_proprio(public.payments.order_id)
    or fly_private.is_global_operator()
  );

-- Evento de webhook é registro interno. O cliente não precisa dele, e ele
-- carrega o corpo cru do provedor.
create policy payment_events_select_operator on public.payment_events for select to authenticated
  using (fly_private.is_global_operator());

create policy refunds_select on public.refunds for select to authenticated
  using (
    fly_private.pedido_proprio(public.refunds.order_id)
    or fly_private.is_global_operator()
  );

-- -----------------------------------------------------------------------------
-- GRANTs
--
-- `grant select` não fecha nada sozinho no Supabase — ver D65. Os `revoke`
-- abaixo é que fecham, e sem eles a RLS seria a única camada.
-- -----------------------------------------------------------------------------
grant select on public.carts to authenticated;
revoke insert, update, delete on public.carts from authenticated, anon;

grant select, delete on public.cart_items to authenticated;
revoke insert, update on public.cart_items from authenticated, anon;

grant select, insert, update on public.coupons to authenticated;
revoke delete on public.coupons from authenticated, anon;

grant select on public.orders to authenticated;
revoke insert, update, delete on public.orders from authenticated, anon;

grant select on public.order_items to authenticated;
revoke insert, update, delete on public.order_items from authenticated, anon;

grant select, insert, update, delete on public.order_participants to authenticated;

grant select on public.payments to authenticated;
revoke insert, update, delete on public.payments from authenticated, anon;

grant select on public.payment_events to authenticated;
revoke insert, update, delete on public.payment_events from authenticated, anon;

grant select on public.refunds to authenticated;
revoke insert, update, delete on public.refunds from authenticated, anon;

revoke all on public.carts from anon;
revoke all on public.cart_items from anon;
revoke all on public.coupons from anon;
revoke all on public.orders from anon;
revoke all on public.order_items from anon;
revoke all on public.order_participants from anon;
revoke all on public.payments from anon;
revoke all on public.payment_events from anon;
revoke all on public.refunds from anon;

/**
 * Registra a intenção de pagar (§6.5, passo 6).
 *
 * Cria a linha de `payments` com a referência que o provedor devolveu. Chamada
 * pelo app depois de o provedor tokenizar o cartão — **o número nunca passa
 * por aqui**, e não há coluna onde ele caberia.
 */
create or replace function public.iniciar_pagamento(
  p_order uuid,
  p_provider text,
  p_provider_ref text
)
returns table (ok boolean, motivo text, payment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.orders;
  v_payment uuid;
begin
  select * into v_order from public.orders where id = p_order;
  if not found then
    return query select false, 'pedido nao encontrado', null::uuid;
    return;
  end if;

  if v_order.user_id <> v_user and not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  if v_order.status <> 'pending_payment' then
    return query select false, 'pedido nao esta aguardando pagamento', null::uuid;
    return;
  end if;

  -- Repetir a mesma referência devolve o mesmo pagamento: tentar de novo
  -- depois de uma rede instável não pode gerar duas cobranças.
  select id into v_payment from public.payments
  where provider = p_provider and provider_ref = p_provider_ref;

  if v_payment is not null then
    return query select true, 'ja iniciado', v_payment;
    return;
  end if;

  insert into public.payments (order_id, provider, provider_ref, amount_cents, currency)
  values (p_order, p_provider, p_provider_ref, v_order.total_cents, v_order.currency)
  returning id into v_payment;

  return query select true, null::text, v_payment;
end;
$$;

revoke all on function public.iniciar_pagamento(uuid, text, text) from public, anon;
grant execute on function public.iniciar_pagamento(uuid, text, text) to authenticated;
