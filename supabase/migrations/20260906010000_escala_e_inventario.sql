-- =============================================================================
-- Fase 11 — escala, passagem de turno e inventário (§46, entregas 7 e 8)
--
-- Duas coisas que a operação faz todo dia e que não existiam em lugar nenhum:
--
--   • quem está de plantão agora, e o que ficou aberto quando trocou;
--   • quantos press kits sobraram, e para quem foi o brinde.
--
-- Nenhuma delas inventa conteúdo: o que o kit contém, quanto custa e quem
-- recebe é a operação que escreve. A §33 vale aqui como em todo o resto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Escala (§46, entrega 8)
--
-- Turno é diferente de atribuição. `staff_assignments` diz que o guia trabalha
-- **nesta viagem**; o turno diz que ele está de plantão **das 8 às 16 de
-- quinta**. Sem a segunda, "quem eu chamo agora" não tem resposta, e a §43 já
-- pedia essa resposta para o SOS.
-- -----------------------------------------------------------------------------
create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  role public.fly_role not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint staff_shifts_ordem check (ends_at > starts_at),
  constraint staff_shifts_notes_length check (notes is null or char_length(notes) <= 2000)
);

/**
 * Turno sem viagem existe: plantão de plataforma — suporte, financeiro — não é
 * de uma viagem. Por isso `trip_id` é anulável, e por isso o índice de busca
 * cobre os dois casos.
 */
create index staff_shifts_janela_idx on public.staff_shifts (starts_at, ends_at);
create index staff_shifts_user_idx on public.staff_shifts (user_id, starts_at desc);
create index staff_shifts_trip_idx on public.staff_shifts (trip_id, starts_at)
  where trip_id is not null;

comment on table public.staff_shifts is
  'Plantao. Atribuicao diz em que viagem; turno diz em que horas.';

-- -----------------------------------------------------------------------------
-- 2. Passagem de turno (§46, entrega 8)
--
-- Aceitação é separada do envio, pela mesma razão que na fila de atendimento:
-- deixar um bilhete não é a mesma coisa que alguém ter lido. Um handoff sem
-- `accepted_at` é uma pendência, e a tela precisa poder mostrar isso.
-- -----------------------------------------------------------------------------
create table public.shift_handoffs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid references auth.users (id) on delete set null,
  summary text not null,
  open_items text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,

  constraint shift_handoffs_summary_length check (char_length(summary) between 1 and 4000),
  constraint shift_handoffs_open_length check (open_items is null or char_length(open_items) <= 4000),
  -- Aceite é quem e quando, sempre juntos. A mesma restrição de
  -- `support_cases_atribuicao_completa`, pela mesma razão: metade preenchida
  -- é um estado que ninguém sabe ler.
  constraint shift_handoffs_aceite_completo check ((accepted_at is null) = (accepted_by is null))
);

create index shift_handoffs_abertos_idx on public.shift_handoffs (created_at desc)
  where accepted_at is null;
create index shift_handoffs_trip_idx on public.shift_handoffs (trip_id, created_at desc);

comment on column public.shift_handoffs.to_user is
  'Nulo = passagem para quem assumir. Nem toda troca tem sucessor nomeado.';

create or replace function public.aceitar_passagem(p_handoff uuid)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.shift_handoffs;
begin
  if not fly_private.is_staff() then
    raise exception 'aceitar passagem e da equipe' using errcode = '42501';
  end if;

  select * into v_linha from public.shift_handoffs h where h.id = p_handoff;
  if not found then
    return query select false, 'Passagem não encontrada.'::text;
    return;
  end if;

  if v_linha.accepted_at is not null then
    return query select false, 'Alguém já assumiu esta passagem.'::text;
    return;
  end if;

  -- Nomear sucessor não impede outra pessoa de assumir: às onze da noite, o
  -- que importa é que alguém leia. O registro guarda quem assumiu de fato.
  update public.shift_handoffs h
  set accepted_at = now(), accepted_by = (select auth.uid())
  where h.id = p_handoff and h.accepted_at is null;

  if not found then
    return query select false, 'Alguém assumiu enquanto você lia.'::text;
    return;
  end if;

  perform fly_private.registrar(
    'passagem.aceita', 'shift_handoffs', p_handoff::text,
    jsonb_build_object('de', v_linha.from_user, 'trip', v_linha.trip_id)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Inventário (§46, entrega 7)
--
-- Press kit, brinde e recompensa. Os três nomes são os da §46, e não há um
-- quarto: "material" genérico viraria depósito de tudo, e o relatório de
-- entrega perderia o sentido.
-- -----------------------------------------------------------------------------
create type public.inventory_kind as enum ('press_kit', 'gift', 'reward');

create type public.inventory_reason as enum (
  'entrada',    -- chegou
  'entrega',    -- saiu para alguém
  'perda',      -- sumiu, quebrou
  'devolucao',  -- voltou
  'ajuste'      -- contagem física corrigiu o número
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  kind public.inventory_kind not null,
  name text not null,
  description text,
  trip_id uuid references public.trips (id) on delete set null,
  -- Estoque mínimo para o painel avisar. Nulo = não avisa. Nasce nulo porque
  -- "quantos press kits são poucos" é decisão de quem opera, não do código.
  low_stock_at int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint inventory_items_name_length check (char_length(name) between 1 and 160),
  constraint inventory_items_low_stock check (low_stock_at is null or low_stock_at >= 0)
);

create index inventory_items_kind_idx on public.inventory_items (kind, name);
create index inventory_items_trip_idx on public.inventory_items (trip_id) where trip_id is not null;

/**
 * O movimento é append-only, como todo ledger deste projeto.
 *
 * Estoque não é uma coluna que se edita: é a soma do que entrou e saiu. Uma
 * coluna `quantidade` seria o mesmo erro do saldo de pontos — dois números
 * para a mesma verdade, e o dia em que discordarem ninguém saberá qual vale.
 */
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  delta int not null,
  reason public.inventory_reason not null,
  -- Para quem foi. Anulável: entrada e perda não têm destinatário.
  recipient_id uuid references auth.users (id) on delete set null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint inventory_movements_delta check (delta <> 0),
  constraint inventory_movements_note_length check (note is null or char_length(note) <= 500),
  -- Entrega tira do estoque; entrada põe. Deixar o sinal livre faria um
  -- 'entrega' positivo virar reposição silenciosa no relatório.
  constraint inventory_movements_sinal check (
    (reason = 'entrada'   and delta > 0) or
    (reason = 'devolucao' and delta > 0) or
    (reason = 'entrega'   and delta < 0) or
    (reason = 'perda'     and delta < 0) or
    (reason = 'ajuste')
  ),
  constraint inventory_movements_destinatario check (
    recipient_id is null or reason in ('entrega', 'devolucao')
  )
);

create index inventory_movements_item_idx on public.inventory_movements (item_id, occurred_at desc);
create index inventory_movements_recipient_idx on public.inventory_movements (recipient_id)
  where recipient_id is not null;

create or replace function fly_private.inventory_is_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'inventory_movements e append-only: para corrigir, lance um ajuste com o sinal contrario.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger inventory_movements_no_update
  before update on public.inventory_movements
  for each row execute function fly_private.inventory_is_append_only();

create trigger inventory_movements_no_delete
  before delete on public.inventory_movements
  for each row execute function fly_private.inventory_is_append_only();

create view public.inventory_balance
with (security_invoker = true)
as
  select
    i.id as item_id,
    i.kind,
    i.name,
    i.trip_id,
    i.low_stock_at,
    i.is_active,
    coalesce(sum(m.delta), 0)::int as saldo,
    coalesce(sum(-m.delta) filter (where m.reason = 'entrega'), 0)::int as entregues,
    max(m.occurred_at) as ultimo_movimento
  from public.inventory_items i
  left join public.inventory_movements m on m.item_id = i.id
  group by i.id;

comment on view public.inventory_balance is
  'Saldo derivado do ledger. Nao guarde quantidade em coluna: ela diverge do movimento.';

/**
 * A única porta de escrita do movimento.
 *
 * Existe por causa do saldo negativo. Um `insert` direto deixaria entregar
 * trinta kits havendo dez, e o erro só apareceria na contagem física — depois
 * da viagem. O `ajuste` é a exceção deliberada: contagem física que achou
 * menos do que o sistema tem que poder registrar o que achou.
 */
create or replace function public.movimentar_estoque(
  p_item uuid,
  p_delta int,
  p_reason public.inventory_reason,
  p_recipient uuid default null,
  p_note text default null
)
returns table (ok boolean, saldo int, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo int;
begin
  if not (fly_private.is_staff()) then
    raise exception 'movimentar estoque e da equipe' using errcode = '42501';
  end if;

  if not exists (select 1 from public.inventory_items i where i.id = p_item) then
    return query select false, 0, 'Item não encontrado.'::text;
    return;
  end if;

  if p_delta is null or p_delta = 0 then
    return query select false, 0, 'Movimento precisa de quantidade.'::text;
    return;
  end if;

  -- `for update` no item serializa duas entregas simultâneas do mesmo kit:
  -- sem isso, duas transações leem o mesmo saldo dez e entregam vinte.
  perform 1 from public.inventory_items i where i.id = p_item for update;

  select coalesce(sum(m.delta), 0) into v_saldo
  from public.inventory_movements m where m.item_id = p_item;

  if v_saldo + p_delta < 0 and p_reason <> 'ajuste' then
    return query select false, v_saldo,
      ('Não há tanto em estoque: restam ' || v_saldo || '.')::text;
    return;
  end if;

  insert into public.inventory_movements (item_id, delta, reason, recipient_id, note, created_by)
  values (p_item, p_delta, p_reason, p_recipient, nullif(btrim(coalesce(p_note, '')), ''),
          (select auth.uid()));

  perform fly_private.registrar(
    'estoque.movimento', 'inventory_items', p_item::text,
    jsonb_build_object('delta', p_delta, 'motivo', p_reason)
  );

  return query select true, v_saldo + p_delta, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS e GRANT — controles diferentes, configurados os dois
-- -----------------------------------------------------------------------------
alter table public.staff_shifts        enable row level security;
alter table public.shift_handoffs      enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.inventory_movements enable row level security;

alter table public.inventory_movements force row level security;

/**
 * A escala é da equipe, e o cliente não a lê.
 *
 * Onde está um funcionário é dado da lista da §33 que nunca se inventa, e é
 * também dado que não se expõe: `staff_shifts` diz onde a pessoa está e a que
 * horas. Nenhuma policy dá isso a `customer`.
 */
create policy staff_shifts_select on public.staff_shifts for select to authenticated
  using (fly_private.is_staff());
create policy staff_shifts_insert on public.staff_shifts for insert to authenticated
  with check (fly_private.is_global_operator());
create policy staff_shifts_update on public.staff_shifts for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy staff_shifts_delete on public.staff_shifts for delete to authenticated
  using (fly_private.is_global_operator());

-- A passagem é escrita por quem sai e lida por toda a equipe. Quem escreve
-- assina: `from_user` é quem está logado, e não um campo livre.
create policy shift_handoffs_select on public.shift_handoffs for select to authenticated
  using (fly_private.is_staff());
create policy shift_handoffs_insert on public.shift_handoffs for insert to authenticated
  with check (fly_private.is_staff() and from_user = (select auth.uid()));
-- Sem policy de update: o aceite passa pela RPC, e o texto não se reescreve.
create policy shift_handoffs_delete on public.shift_handoffs for delete to authenticated
  using (fly_private.has_role('admin'));

create policy inventory_items_select on public.inventory_items for select to authenticated
  using (fly_private.is_staff());
create policy inventory_items_insert on public.inventory_items for insert to authenticated
  with check (fly_private.is_global_operator() or fly_private.has_role('experience'));
create policy inventory_items_update on public.inventory_items for update to authenticated
  using (fly_private.is_global_operator() or fly_private.has_role('experience'))
  with check (fly_private.is_global_operator() or fly_private.has_role('experience'));
-- Sem delete: item com movimento é histórico. Desative em vez de apagar.

/**
 * O movimento é lido pela equipe e escrito só pela RPC.
 *
 * Não há policy de insert, e a ausência é o controle: `movimentar_estoque` é
 * DEFINER e é a única porta. Um insert direto passaria por cima da conferência
 * de saldo, que é a única razão de a RPC existir.
 */
create policy inventory_movements_select on public.inventory_movements for select to authenticated
  using (fly_private.is_staff());

revoke all on public.staff_shifts        from anon;
revoke all on public.shift_handoffs      from anon;
revoke all on public.inventory_items     from anon;
revoke all on public.inventory_movements from anon;
revoke all on public.inventory_balance   from anon;

grant select, insert, update, delete on public.staff_shifts to authenticated;
grant select, insert on public.shift_handoffs to authenticated;
grant delete on public.shift_handoffs to authenticated;
revoke update on public.shift_handoffs from authenticated;
grant select, insert, update on public.inventory_items to authenticated;
revoke delete on public.inventory_items from authenticated;
grant select on public.inventory_movements to authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
grant select on public.inventory_balance to authenticated;

revoke all on function public.aceitar_passagem(uuid) from public, anon;
revoke all on function public.movimentar_estoque(uuid, int, public.inventory_reason, uuid, text)
  from public, anon;
grant execute on function public.aceitar_passagem(uuid) to authenticated;
grant execute on function public.movimentar_estoque(uuid, int, public.inventory_reason, uuid, text)
  to authenticated;
