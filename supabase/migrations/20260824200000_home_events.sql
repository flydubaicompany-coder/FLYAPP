-- =============================================================================
-- Eventos, viagens (espinha) e notificações
--
-- Fase 3 da especificação (§38).
--
-- Sobre `trips` aparecer aqui: a §38.1 pede que a Home tenha os estados sem
-- viagem, pré, durante e pós. Sem saber que existe uma viagem e quando ela
-- começa, não há como escolher estado — o critério "Home muda corretamente por
-- estado" seria impossível de cumprir e de testar.
--
-- Então entra só a espinha: destino, fuso, datas e quem participa. Roteiro,
-- documentos, voos, QR e presença são da Fase 4, que estende estas tabelas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Destinos
-- -----------------------------------------------------------------------------
create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text not null,
  -- Fuso IANA, não offset. Offset quebra no horário de verão, e a Fly opera
  -- em destinos que mudam de hora.
  timezone text not null,
  created_at timestamptz not null default now(),

  constraint destinations_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,63}$'),
  constraint destinations_timezone_valid check (timezone ~ '^[A-Za-z]+/[A-Za-z_+-]+$')
);

-- -----------------------------------------------------------------------------
-- Viagens (espinha)
-- -----------------------------------------------------------------------------
create type public.trip_status as enum ('draft', 'published', 'ongoing', 'finished', 'cancelled');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id),
  name text not null,
  status public.trip_status not null default 'draft',
  -- Datas em `date`, não `timestamptz`: uma viagem começa "dia 10", e o
  -- momento exato depende do fuso do destino. Guardar instante aqui
  -- produziria viagem que começa no dia errado para quem está no Brasil.
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trips_ends_after_starts check (ends_on >= starts_on)
);

create index trips_status_idx on public.trips (status, starts_on);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- Agora que `trips` existe, a atribuição de equipe ganha a chave estrangeira
-- que a Fase 2 deixou documentada como pendente.
delete from public.staff_assignments sa
where not exists (select 1 from public.trips t where t.id = sa.trip_id);

alter table public.staff_assignments
  add constraint staff_assignments_trip_fk
  foreign key (trip_id) references public.trips (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Eventos (§5.6 e §38.6)
-- -----------------------------------------------------------------------------
create table public.event_categories (
  key text primary key,
  label text not null,
  sort_order int not null default 0,

  constraint event_categories_key_format check (key ~ '^[a-z][a-z0-9_-]{1,63}$')
);

create type public.event_status as enum ('announced', 'registration_open', 'happening', 'finished');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category_key text not null references public.event_categories (key),
  title text not null,
  summary text,
  description text,
  city text,
  country text,
  -- Fuso do evento, para "acontece hoje" ser verdade no lugar do evento.
  timezone text not null default 'America/Sao_Paulo',
  starts_at timestamptz,
  ends_at timestamptz,
  status public.event_status not null default 'announced',
  cover_path text,
  -- Benefício para cliente Fly (§5.6). Texto livre, definido no painel.
  fly_benefit text,
  -- Ordem de destaque na Home. Menor aparece primeiro.
  home_order int,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,79}$'),
  constraint events_ends_after_starts check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint events_published_has_date check (not is_published or published_at is not null)
);

create index events_home_idx on public.events (home_order, starts_at)
  where is_published and home_order is not null;
create index events_published_idx on public.events (starts_at desc) where is_published;

comment on column public.events.home_order is
  'Ordem na Home. Nulo = nao aparece em destaque, mas segue na listagem.';

-- Participantes em destaque (§5.6): artistas, atletas, influenciadores.
create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  role text,
  avatar_path text,
  sort_order int not null default 0
);

create index event_participants_event_idx on public.event_participants (event_id, sort_order);

-- CTA do evento (§5.6). O tipo é fechado: a lista de CTAs aceitos está na
-- especificação, e inventar um sexto seria decidir produto no código.
create type public.event_cta_kind as enum (
  'view_event',
  'buy_ticket',
  'join_list',
  'watch',
  'view_results',
  'open_fly_cup',
  'want_dubai'
);

create table public.event_ctas (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind public.event_cta_kind not null,
  label text not null,
  -- Deep link ou URL. Para `open_fly_cup`, o destino no outro app.
  target_url text,
  sort_order int not null default 0
);

create index event_ctas_event_idx on public.event_ctas (event_id, sort_order);

create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  kind text not null default 'image',
  sort_order int not null default 0,

  constraint event_media_kind_known check (kind in ('image', 'video'))
);

-- Interesse do cliente em um evento (§19.10).
create table public.event_interests (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_interests_user_idx on public.event_interests (user_id);

-- -----------------------------------------------------------------------------
-- Notificações (§26 e §38.9)
-- -----------------------------------------------------------------------------
create table public.notification_categories (
  key text primary key,
  label text not null,
  description text not null,
  -- Alerta operacional crítico não é silenciável. A §26 é literal:
  -- "marketing nunca pode silenciar alertas operacionais críticos".
  is_critical boolean not null default false,
  sort_order int not null default 0,

  constraint notification_categories_key_format check (key ~ '^[a-z][a-z0-9_]{2,63}$')
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  category_key text not null references public.notification_categories (key),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  -- Rota interna do app. Deep link resolve o contexto exato (§22.3).
  deep_link text,
  created_at timestamptz not null default now(),
  -- Quando a notificação deixa de fazer sentido. Um aviso de embarque de
  -- ontem não deve aparecer hoje.
  expires_at timestamptz,
  read_at timestamptz,
  -- Deduplicação: duas fontes gerando o mesmo aviso não viram dois cards.
  dedupe_key text,

  constraint notifications_title_length check (char_length(title) between 1 and 160)
);

create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;
create index notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_key text not null references public.notification_categories (key),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

-- Trigger que impede desligar categoria crítica. A regra da §26 vira
-- constraint de banco, e não recomendação em documento: um bug no painel ou
-- uma chamada direta não conseguem silenciar um alerta de roteiro.
create or replace function fly_private.block_disabling_critical()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_enabled and exists (
    select 1 from public.notification_categories nc
    where nc.key = new.category_key and nc.is_critical
  ) then
    raise exception 'categoria critica nao pode ser silenciada: %', new.category_key
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger notification_preferences_protect_critical
  before insert or update on public.notification_preferences
  for each row execute function fly_private.block_disabling_critical();

create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function fly_private.touch_updated_at();

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function fly_private.touch_updated_at();

create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function fly_private.touch_updated_at();

-- =============================================================================
-- Estado da Home, decidido no servidor (§38.2)
--
-- Por que no servidor e não no app: a §5 faz a Home mudar por fase da viagem,
-- e essa decisão depende de datas, fuso do destino e do que já foi publicado.
-- Calcular no cliente significaria que um celular com a data errada, ou em
-- outro fuso, mostraria a tela errada — e mudar a regra exigiria nova build.
--
-- Sobre fuso: "hoje" é calculado **no fuso do destino**. Um viajante em Dubai
-- às 2h da manhã está num dia diferente de quem olha do Brasil. Usar o fuso do
-- servidor faria a viagem começar no dia errado para metade das pessoas.
-- =============================================================================

create or replace function public.home_state()
returns table (
  state text,
  trip_id uuid,
  trip_name text,
  destination_name text,
  destination_timezone text,
  starts_on date,
  ends_on date,
  -- Quantos dias faltam, no fuso do destino.
  days_until int,
  -- Qual dia da viagem é hoje, começando em 1.
  day_number int,
  total_days int,
  days_since int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_janela_pos int;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  -- Por quantos dias a Home continua em modo pós-viagem. É regra de exibição,
  -- ajustável no painel — não valor de negócio. Cai em 14 se ninguém definiu.
  select coalesce((value #>> '{}')::int, 14) into v_janela_pos
  from public.app_config where key = 'home.post_trip_days';
  v_janela_pos := coalesce(v_janela_pos, 14);

  return query
  with viagens as (
    select
      t.id,
      t.name,
      d.name as destino,
      d.timezone as fuso,
      t.starts_on,
      t.ends_on,
      -- A data de hoje NO DESTINO. Esta linha é o núcleo do critério
      -- "próximo passo considera fuso".
      (now() at time zone d.timezone)::date as hoje_no_destino
    from public.trips t
    join public.destinations d on d.id = t.destination_id
    join public.trip_members tm on tm.trip_id = t.id
    where tm.user_id = v_user
      and t.status in ('published', 'ongoing', 'finished')
  ),
  classificadas as (
    select
      v.*,
      case
        when v.hoje_no_destino < v.starts_on then 'pre_trip'
        when v.hoje_no_destino between v.starts_on and v.ends_on then 'during_trip'
        when v.hoje_no_destino <= v.ends_on + v_janela_pos then 'post_trip'
        else 'archived'
      end as estado
    from viagens v
  )
  select
    c.estado,
    c.id,
    c.name,
    c.destino,
    c.fuso,
    c.starts_on,
    c.ends_on,
    greatest(0, (c.starts_on - c.hoje_no_destino))::int,
    case when c.estado = 'during_trip'
         then (c.hoje_no_destino - c.starts_on + 1)::int
         else null end,
    (c.ends_on - c.starts_on + 1)::int,
    greatest(0, (c.hoje_no_destino - c.ends_on))::int
  from classificadas c
  where c.estado <> 'archived'
  -- Viagem em andamento ganha de qualquer outra. Depois, a que começa antes.
  order by
    case c.estado when 'during_trip' then 0 when 'pre_trip' then 1 else 2 end,
    c.starts_on
  limit 1;

  -- Nenhuma viagem relevante: a Home entra no estado sem viagem (§5.2).
  if not found then
    return query select 'no_trip'::text, null::uuid, null::text, null::text, null::text,
                        null::date, null::date, null::int, null::int, null::int, null::int;
  end if;
end;
$$;

revoke all on function public.home_state() from public, anon;
grant execute on function public.home_state() to authenticated;

-- =============================================================================
-- Eventos da Home (§5.6)
--
-- Até três na Home, e um "Ver todos". A regra de exibição de evento encerrado
-- vive aqui, e não no app: a §38 exige que "evento encerrado respeite regra de
-- exibição", e essa regra muda sem nova build.
-- =============================================================================

create or replace function public.home_events(p_limit int default 3)
returns setof public.events
language sql
security definer
stable
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.is_published
    and e.home_order is not null
    -- Evento encerrado sai da Home depois da janela configurada. Ele continua
    -- existindo na listagem completa — some do destaque, não do app.
    and (
      e.status <> 'finished'
      or e.ends_at is null
      or e.ends_at > now() - (
        coalesce(
          (select (value #>> '{}')::int from public.app_config where key = 'home.finished_event_days'),
          7
        ) || ' days'
      )::interval
    )
  order by e.home_order, e.starts_at nulls last
  limit greatest(1, least(p_limit, 10));
$$;

revoke all on function public.home_events(int) from public, anon;
grant execute on function public.home_events(int) to authenticated;

-- =============================================================================
-- RLS da Fase 3
-- =============================================================================

alter table public.destinations             enable row level security;
alter table public.trips                    enable row level security;
alter table public.trip_members             enable row level security;
alter table public.event_categories         enable row level security;
alter table public.events                   enable row level security;
alter table public.event_participants       enable row level security;
alter table public.event_ctas               enable row level security;
alter table public.event_media              enable row level security;
alter table public.event_interests          enable row level security;
alter table public.notification_categories  enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;

-- destinations: catálogo, legível por qualquer autenticado.
create policy destinations_select_authenticated on public.destinations for select
  to authenticated using (true);
create policy destinations_write_operator on public.destinations for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

-- trips: o cliente vê a viagem em que está. Equipe vê a que lhe foi atribuída.
create policy trips_select_member on public.trips for select
  to authenticated using (
    exists (select 1 from public.trip_members tm
            where tm.trip_id = id and tm.user_id = (select auth.uid()))
  );

create policy trips_select_assigned on public.trips for select
  to authenticated using (
    exists (select 1 from public.staff_assignments sa
            where sa.trip_id = id and sa.user_id = (select auth.uid())
              and sa.revoked_at is null)
    or fly_private.is_global_operator()
  );

create policy trips_write_operator on public.trips for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

-- trip_members: cada um vê o próprio vínculo; equipe atribuída vê o grupo.
create policy trip_members_select_own on public.trip_members for select
  to authenticated using ((select auth.uid()) = user_id);

create policy trip_members_select_assigned on public.trip_members for select
  to authenticated using (
    exists (select 1 from public.staff_assignments sa
            where sa.trip_id = trip_id and sa.user_id = (select auth.uid())
              and sa.revoked_at is null)
    or fly_private.is_global_operator()
  );

create policy trip_members_write_operator on public.trip_members for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

-- Eventos: só o que está publicado chega ao cliente. Rascunho é do operador.
create policy event_categories_select_authenticated on public.event_categories for select
  to authenticated using (true);
create policy event_categories_write_operator on public.event_categories for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

create policy events_select_published on public.events for select
  to authenticated using (is_published);

create policy events_select_operator on public.events for select
  to authenticated using (fly_private.is_global_operator());

create policy events_write_operator on public.events for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

-- Filhos do evento seguem a visibilidade do pai. Sem isso, um rascunho
-- vazaria pela lista de participantes.
create policy event_participants_select on public.event_participants for select
  to authenticated using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.is_published or fly_private.is_global_operator()))
  );
create policy event_participants_write_operator on public.event_participants for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

create policy event_ctas_select on public.event_ctas for select
  to authenticated using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.is_published or fly_private.is_global_operator()))
  );
create policy event_ctas_write_operator on public.event_ctas for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

create policy event_media_select on public.event_media for select
  to authenticated using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.is_published or fly_private.is_global_operator()))
  );
create policy event_media_write_operator on public.event_media for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

-- Interesse é do cliente: ele marca e desmarca o próprio.
create policy event_interests_all_own on public.event_interests for all
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy event_interests_select_operator on public.event_interests for select
  to authenticated using (fly_private.is_global_operator());

-- Notificações
create policy notification_categories_select_authenticated on public.notification_categories for select
  to authenticated using (true);
create policy notification_categories_write_operator on public.notification_categories for all
  to authenticated using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

create policy notifications_select_own on public.notifications for select
  to authenticated using ((select auth.uid()) = user_id);

-- O cliente só marca como lida. Sem policy de INSERT: notificação é enviada
-- pelo servidor, e um cliente que pudesse criar a própria forjaria aviso.
create policy notifications_update_own on public.notifications for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notification_preferences_all_own on public.notification_preferences for all
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- =============================================================================
-- Privilégios
-- =============================================================================

grant select on public.destinations to authenticated;
grant insert, update, delete on public.destinations to authenticated;
grant select on public.trips to authenticated;
grant insert, update, delete on public.trips to authenticated;
grant select on public.trip_members to authenticated;
grant insert, update, delete on public.trip_members to authenticated;
grant select on public.event_categories to authenticated;
grant insert, update, delete on public.event_categories to authenticated;
grant select on public.events to authenticated;
grant insert, update, delete on public.events to authenticated;
grant select on public.event_participants to authenticated;
grant insert, update, delete on public.event_participants to authenticated;
grant select on public.event_ctas to authenticated;
grant insert, update, delete on public.event_ctas to authenticated;
grant select on public.event_media to authenticated;
grant insert, update, delete on public.event_media to authenticated;
grant select, insert, delete on public.event_interests to authenticated;
grant select on public.notification_categories to authenticated;
grant insert, update, delete on public.notification_categories to authenticated;
-- Notificação: o cliente lê e marca como lida. Nunca cria nem apaga.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
