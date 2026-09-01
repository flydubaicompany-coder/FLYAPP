-- =============================================================================
-- Fase 7 — restaurantes (§11.2) e estilo de vida (§11.3).
--
-- A §11.3 e explicita sobre por onde comecar: "**catalogo e solicitacao
-- administravel**. Ativar Noon, Careem e outros somente quando houver API,
-- contrato e termos validos."
--
-- Entao: catalogo que a Fly cura, pedido que uma pessoa atende, e os parceiros
-- atras de flag desligada. Nao ha adapter escrito — escrever integracao sem
-- contrato produz codigo que envelhece sem nunca ter rodado.
--
-- ## Reserva nao e compra
--
-- Pedir mesa e **pedido**, nao confirmacao: quem confirma e o restaurante, via
-- Fly. Por isso `requested` e o estado inicial e `confirmed` exige alguem da
-- equipe — o cliente nao pode sair do app achando que tem mesa garantida.
-- =============================================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references public.destinations (id) on delete set null,

  name text not null,
  cuisine text,
  neighborhood text,
  description text,

  /**
   * Curadoria da Fly, e o porque dela.
   *
   * A §6.4 ja tinha estabelecido que "a Fly recomenda" e curadoria humana, e
   * nao algoritmo. Aqui vale igual: `fly_note` e o motivo escrito por alguem.
   */
  is_curated boolean not null default false,
  fly_note text,

  -- Alguns exigem deposito. Quanto, e decisao do restaurante — aqui so se
  -- registra que exige, para a tela avisar antes.
  requires_deposit boolean not null default false,

  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurants_nome_preenchido check (length(btrim(name)) > 0),
  -- Curadoria sem motivo escrito e so um selo.
  constraint restaurants_curadoria_tem_motivo check (
    not is_curated or (fly_note is not null and length(btrim(fly_note)) > 0)
  )
);

create index restaurants_ativos_idx on public.restaurants (is_active, sort_order);

create type public.reservation_status as enum (
  'requested',  -- o cliente pediu; ninguem confirmou
  'confirmed',  -- o restaurante aceitou, via Fly
  'waitlist',   -- sem mesa no horario; a Fly tenta
  'declined',   -- nao foi possivel
  'cancelled',  -- o cliente desistiu
  'seated',     -- compareceu
  'no_show'
);

create table public.restaurant_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  restaurant_id uuid not null references public.restaurants (id) on delete restrict,

  party_size int not null,
  desired_at timestamptz not null,

  -- Ocasiao especial e pedido de namoro/casamento, da §11.2.
  occasion text,
  notes text,

  status public.reservation_status not null default 'requested',
  decline_reason text,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservations_grupo_valido check (party_size >= 1 and party_size <= 40),
  -- Recusar sem dizer por que deixa o cliente sem saber se tenta outro dia.
  constraint reservations_recusa_tem_motivo check (
    status <> 'declined' or (decline_reason is not null and length(btrim(decline_reason)) > 0)
  )
);

create index reservations_user_idx on public.restaurant_reservations (user_id, desired_at desc);
create index reservations_fila_idx on public.restaurant_reservations (status, desired_at)
  where status in ('requested', 'waitlist');

-- -----------------------------------------------------------------------------
-- Estilo de vida (§11.3).
-- -----------------------------------------------------------------------------
create type public.service_kind as enum (
  'pharmacy', 'grocery', 'salon', 'barber', 'spa', 'laundry', 'essentials', 'other'
);

create table public.lifestyle_services (
  id uuid primary key default gen_random_uuid(),
  kind public.service_kind not null,
  name text not null,
  description text,
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),

  constraint lifestyle_nome_preenchido check (length(btrim(name)) > 0)
);

create index lifestyle_ativos_idx on public.lifestyle_services (is_active, kind, sort_order);

create type public.service_request_status as enum (
  'requested', 'in_progress', 'done', 'declined', 'cancelled'
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  service_id uuid not null references public.lifestyle_services (id) on delete restrict,

  -- O que a pessoa quer, nas palavras dela. E o coracao do pedido manual.
  details text not null,
  deliver_to text,

  status public.service_request_status not null default 'requested',
  response_note text,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_requests_detalhe_preenchido check (length(btrim(details)) > 0),
  constraint service_requests_recusa_tem_motivo check (
    status <> 'declined' or (response_note is not null and length(btrim(response_note)) > 0)
  )
);

create index service_requests_user_idx on public.service_requests (user_id, created_at desc);
create index service_requests_fila_idx on public.service_requests (status, created_at)
  where status in ('requested', 'in_progress');

-- -----------------------------------------------------------------------------
-- Só a equipe decide o desfecho.
--
-- Sem isto o cliente poderia marcar a propria reserva como confirmada e ir ao
-- restaurante sem mesa. Cancelar, sim — desistir e direito dele.
-- -----------------------------------------------------------------------------
create or replace function fly_private.so_equipe_decide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if fly_private.is_staff() then
    new.handled_by := coalesce(new.handled_by, (select auth.uid()));
    new.handled_at := coalesce(new.handled_at, now());
    return new;
  end if;

  -- O cliente so pode cancelar o proprio pedido.
  if new.status is distinct from old.status and new.status::text <> 'cancelled' then
    raise exception 'so a Fly muda a situacao deste pedido'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger reservations_so_equipe_decide
  before update on public.restaurant_reservations
  for each row execute function fly_private.so_equipe_decide();

create trigger service_requests_so_equipe_decide
  before update on public.service_requests
  for each row execute function fly_private.so_equipe_decide();

create trigger restaurants_touch before update on public.restaurants
  for each row execute function fly_private.touch_updated_at();
create trigger reservations_touch before update on public.restaurant_reservations
  for each row execute function fly_private.touch_updated_at();
create trigger service_requests_touch before update on public.service_requests
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Parceiros, desligados.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'partners.delivery_enabled',
    'false'::jsonb,
    'Pedido a parceiro (Noon, Careem e outros) por deep link ou API. A §11.3 manda ativar SOMENTE com API, contrato e termos validos. Nao ha adapter escrito: integracao sem contrato produz codigo que envelhece sem nunca ter rodado.',
    true
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.restaurants              enable row level security;
alter table public.restaurant_reservations  enable row level security;
alter table public.lifestyle_services       enable row level security;
alter table public.service_requests         enable row level security;

create policy restaurants_select on public.restaurants for select to authenticated
  using (is_active or fly_private.is_staff());
create policy restaurants_write_operator on public.restaurants for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

create policy lifestyle_select on public.lifestyle_services for select to authenticated
  using (is_active or fly_private.is_staff());
create policy lifestyle_write_operator on public.lifestyle_services for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

create policy reservations_select on public.restaurant_reservations for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy reservations_insert on public.restaurant_reservations for insert to authenticated
  with check ((select auth.uid()) = user_id or fly_private.is_staff());
create policy reservations_update on public.restaurant_reservations for update to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff())
  with check ((select auth.uid()) = user_id or fly_private.is_staff());

create policy service_requests_select on public.service_requests for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy service_requests_insert on public.service_requests for insert to authenticated
  with check ((select auth.uid()) = user_id or fly_private.is_staff());
create policy service_requests_update on public.service_requests for update to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff())
  with check ((select auth.uid()) = user_id or fly_private.is_staff());

revoke all on public.restaurants             from anon;
revoke all on public.restaurant_reservations from anon;
revoke all on public.lifestyle_services      from anon;
revoke all on public.service_requests        from anon;

grant select on public.restaurants to authenticated;
grant insert, update, delete on public.restaurants to authenticated;
grant select on public.lifestyle_services to authenticated;
grant insert, update, delete on public.lifestyle_services to authenticated;
grant select, insert, update on public.restaurant_reservations to authenticated;
grant select, insert, update on public.service_requests to authenticated;
-- Pedido nao se apaga: some do painel e ninguem sabe o que aconteceu.
revoke delete on public.restaurant_reservations from authenticated;
revoke delete on public.service_requests from authenticated;

revoke all on function fly_private.so_equipe_decide() from public, anon, authenticated;
