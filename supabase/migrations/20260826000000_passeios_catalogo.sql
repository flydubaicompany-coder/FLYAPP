-- =============================================================================
-- Fase 5 — Passeios: catálogo, inventário e favoritos (§6 e §40)
--
-- Este arquivo é a metade "vitrine". A metade "caixa" — carrinho, pedido,
-- pagamento e reembolso — vem em `20260826010000_passeios_comercio.sql`, e
-- separá-las não é organização: são domínios com regras diferentes. Catálogo é
-- conteúdo, e conteúdo se edita. Pedido é registro financeiro, e registro
-- financeiro não se edita.
--
-- Duas decisões atravessam tudo:
--
-- 1. **Dinheiro é inteiro, em centavos, com a moeda ao lado.** Nunca `numeric`
--    solto e jamais ponto flutuante. `R$ 1.234,50` é `123450` + `'BRL'`. Um
--    preço sem moeda explícita é um número que alguém vai somar com outro de
--    moeda diferente.
--
-- 2. **Não há conversão de moeda.** A §6.5 pede BRL e AED "preparadas, sem
--    conversão inventada pelo cliente", e a §33 proíbe inventar câmbio. Cada
--    preço existe na sua moeda; um passeio cobrado em AED não vira BRL em
--    lugar nenhum deste schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Moeda
--
-- Domínio, e não `text`: o formato passa a ser conferido em toda coluna que o
-- usar, e uma moeda inventada não entra por descuido de digitação.
-- -----------------------------------------------------------------------------
create domain public.currency_code as char(3)
  check (value in ('BRL', 'AED', 'USD', 'EUR'));

comment on domain public.currency_code is
  'ISO 4217. A lista e curta de proposito: moeda nova exige decisao, nao insert.';

create type public.tour_badge as enum ('included', 'addon', 'exclusive', 'trending');

create type public.tour_status as enum ('draft', 'published', 'paused', 'archived');

/**
 * Perfil de quem viaja (§6.2).
 *
 * Filtro, não segmentação automática. O cliente escolhe; a Fly não deduz.
 */
create type public.tour_audience as enum (
  'family', 'couple', 'adventure', 'luxury', 'business', 'creator'
);

-- -----------------------------------------------------------------------------
-- Política de cancelamento (§6.5)
--
-- Versionada, e append-only na prática: a §40 exige que a política fique
-- "registrada no momento da compra". Editar a política de um passeio não pode
-- mudar retroativamente o que alguém comprou — então o pedido guarda a versão,
-- e a versão nunca muda.
-- -----------------------------------------------------------------------------
create table public.cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null,
  label text not null,
  -- Texto que o cliente lê antes de comprar. É o que vale numa disputa.
  description text not null,
  /**
   * Regras legíveis por máquina.
   *
   * Formato: `[{"ate_horas": 48, "reembolso_pct": 100}, …]`, do prazo mais
   * longo para o mais curto. Fica em `jsonb` porque a forma da regra ainda vai
   * mudar — e porque a §33 proíbe inventar percentual: quem preenche é o dono
   * do produto, no painel.
   */
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  constraint cancellation_policies_version_unique unique (key, version),
  constraint cancellation_policies_version_positive check (version > 0)
);

create index cancellation_policies_key_idx on public.cancellation_policies (key, version desc);

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create table public.tour_categories (
  key text primary key,
  label text not null,
  sort_order int not null default 0
);

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  category_key text not null references public.tour_categories (key),
  destination_id uuid references public.destinations (id) on delete set null,

  title text not null,
  summary text,
  description text,
  -- "Por que a Fly recomenda" (§6.4). Curadoria, não marketing genérico.
  fly_note text,
  included text,
  not_included text,

  city text,
  meeting_point text,
  meeting_map_url text,

  duration_minutes int,
  -- Regras que o cliente precisa ler antes de comprar (§6.4).
  dress_code text,
  min_age int,
  health_notes text,
  safety_notes text,
  accessibility_notes text,

  badge public.tour_badge,
  audiences public.tour_audience[] not null default '{}',
  status public.tour_status not null default 'draft',

  -- Nulo significa "sem política definida", e um passeio sem política não
  -- pode ser publicado — ver a constraint abaixo.
  cancellation_policy_id uuid references public.cancellation_policies (id),

  /**
   * Fly Points que a compra gera.
   *
   * Nulo enquanto a fórmula não existir. A §50.8 marca a fórmula de pontos
   * como decisão pendente, e a §33 proíbe inventar — então o card mostra o
   * espaço, não um número chutado.
   */
  points_awarded int,

  -- Fly Exclusives sem preço fechado usam "Solicitar proposta" (§6.6).
  is_quote_only boolean not null default false,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tours_slug_unique unique (slug),
  constraint tours_duration_positive check (duration_minutes is null or duration_minutes > 0),
  constraint tours_min_age_sane check (min_age is null or (min_age >= 0 and min_age < 120)),
  -- Publicar sem política de cancelamento é vender sem dizer a regra.
  constraint tours_published_has_policy
    check (status <> 'published' or cancellation_policy_id is not null)
);

create index tours_status_idx on public.tours (status, sort_order);
create index tours_category_idx on public.tours (category_key);
create index tours_destination_idx on public.tours (destination_id);
create index tours_policy_idx on public.tours (cancellation_policy_id);
create index tours_city_idx on public.tours (city) where status = 'published';
-- Busca por texto (§40.2). `simple` e não `portuguese`: o catálogo tem nome
-- próprio e estrangeirismo em quantidade, e o stemmer português os destrói.
create index tours_busca_idx on public.tours
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '')));

create table public.tour_media (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  kind text not null default 'image',
  storage_path text not null,
  alt_text text,
  sort_order int not null default 0,

  constraint tour_media_kind_known check (kind in ('image', 'video'))
);

create index tour_media_tour_idx on public.tour_media (tour_id, sort_order);

/**
 * Variante do passeio (§6.4, "opções e adicionais").
 *
 * É onde o preço mora, e não em `tours`: o mesmo passeio em grupo e privativo
 * custa diferente, e tratar isso como dois passeios duplicaria descrição,
 * mídia e avaliações.
 */
create table public.tour_variants (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  label text not null,
  description text,

  price_cents bigint not null,
  currency public.currency_code not null,

  -- Quantas pessoas o preço cobre. Um privativo de 4 custa por barco, não por
  -- cabeça; um grupo custa por pessoa.
  covers_people int not null default 1,
  min_people int not null default 1,
  max_people int,

  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Preço zero é engano de digitação até prova em contrário; cortesia se
  -- registra como desconto de 100%, que deixa rastro.
  constraint tour_variants_price_positive check (price_cents > 0),
  constraint tour_variants_people_sane check (
    covers_people > 0
    and min_people > 0
    and (max_people is null or max_people >= min_people)
  )
);

create index tour_variants_tour_idx on public.tour_variants (tour_id, sort_order)
  where is_active;

/**
 * Slot: uma data e hora com vagas (§6.5).
 *
 * `capacity` é o total; `sold` é o que já virou pedido pago. O que está em
 * carrinho **não** entra aqui — reserva temporária vive em `cart_items`, com
 * prazo, e a disponibilidade é calculada descontando as duas coisas. Guardar
 * hold como coluna obrigaria alguém a lembrar de devolver, e "alguém lembrar"
 * não é mecanismo.
 */
create table public.tour_slots (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.tour_variants (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- Fuso em que o horário deve ser lido. Mesmo motivo do roteiro: quem compra
  -- do Brasil precisa ver a hora de Dubai.
  timezone text not null,

  capacity int not null,
  sold int not null default 0,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tour_slots_capacity_positive check (capacity > 0),
  constraint tour_slots_sold_within_capacity check (sold >= 0 and sold <= capacity),
  constraint tour_slots_unique unique (variant_id, starts_at)
);

create index tour_slots_variant_idx on public.tour_slots (variant_id, starts_at)
  where is_active;
create index tour_slots_quando_idx on public.tour_slots (starts_at)
  where is_active and sold < capacity;

-- -----------------------------------------------------------------------------
-- Favoritos (§6.3)
-- -----------------------------------------------------------------------------
create table public.tour_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  tour_id uuid not null references public.tours (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, tour_id)
);

create index tour_favorites_tour_idx on public.tour_favorites (tour_id);

-- -----------------------------------------------------------------------------
-- Solicitação de proposta (§6.6)
-- -----------------------------------------------------------------------------
create type public.proposal_status as enum (
  'requested', 'in_review', 'quoted', 'accepted', 'declined', 'expired'
);

create table public.proposal_requests (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid references public.tours (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,

  message text,
  desired_date date,
  people int,
  status public.proposal_status not null default 'requested',

  -- A resposta da Fly. Preço aqui é proposta, não cobrança: vira pedido só
  -- quando o cliente aceita.
  quoted_price_cents bigint,
  quoted_currency public.currency_code,
  quoted_notes text,
  quoted_by uuid references auth.users (id) on delete set null,
  quoted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_people_positive check (people is null or people > 0),
  constraint proposal_quote_has_currency
    check (quoted_price_cents is null or quoted_currency is not null),
  -- Status `quoted` sem preço é uma promessa vazia na tela do cliente.
  constraint proposal_quoted_has_price
    check (status <> 'quoted' or quoted_price_cents is not null)
);

create index proposal_requests_user_idx on public.proposal_requests (user_id, created_at desc);
create index proposal_requests_status_idx on public.proposal_requests (status, created_at)
  where status in ('requested', 'in_review');
create index proposal_requests_tour_idx on public.proposal_requests (tour_id);
create index proposal_requests_trip_idx on public.proposal_requests (trip_id);
create index proposal_requests_quoted_by_idx on public.proposal_requests (quoted_by);

create trigger tours_touch before update on public.tours
  for each row execute function fly_private.touch_updated_at();
create trigger tour_variants_touch before update on public.tour_variants
  for each row execute function fly_private.touch_updated_at();
create trigger tour_slots_touch before update on public.tour_slots
  for each row execute function fly_private.touch_updated_at();
create trigger proposal_requests_touch before update on public.proposal_requests
  for each row execute function fly_private.touch_updated_at();

-- =============================================================================
-- RLS do catálogo
--
-- Vitrine: publicado é visível para qualquer pessoa autenticada. Rascunho e
-- pausado, só para a operação — um passeio em preparo não pode vazar preço
-- provisório para o cliente.
-- =============================================================================
alter table public.cancellation_policies enable row level security;
alter table public.tour_categories enable row level security;
alter table public.tours enable row level security;
alter table public.tour_media enable row level security;
alter table public.tour_variants enable row level security;
alter table public.tour_slots enable row level security;
alter table public.tour_favorites enable row level security;
alter table public.proposal_requests enable row level security;

create policy cancellation_policies_select on public.cancellation_policies for select to authenticated
  using (true);
create policy cancellation_policies_insert_operator on public.cancellation_policies for insert to authenticated
  with check (fly_private.is_global_operator());
-- Sem update nem delete: política é versionada. Mudar a regra é criar a
-- versão seguinte, porque a anterior está gravada dentro de pedidos.

create policy tour_categories_select on public.tour_categories for select to authenticated
  using (true);
create policy tour_categories_insert_operator on public.tour_categories for insert to authenticated
  with check (fly_private.is_global_operator());
create policy tour_categories_update_operator on public.tour_categories for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy tour_categories_delete_operator on public.tour_categories for delete to authenticated
  using (fly_private.is_global_operator());

create policy tours_select on public.tours for select to authenticated
  using (public.tours.status = 'published' or fly_private.is_global_operator());
create policy tours_insert_operator on public.tours for insert to authenticated
  with check (fly_private.is_global_operator());
create policy tours_update_operator on public.tours for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy tours_delete_operator on public.tours for delete to authenticated
  using (fly_private.is_global_operator());

/**
 * Filhos do passeio: enxergam o que o pai enxerga.
 *
 * Função `definer` em vez de `exists` direto porque `tours` tem RLS: sem ela,
 * a política do filho consultaria a do pai e o Postgres avaliaria as duas em
 * cadeia a cada linha. Ver D53 — foi assim que `documents` entrou em recursão.
 */
create or replace function fly_private.tour_visivel(p_tour uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.tours t
    where t.id = p_tour
      and (t.status = 'published' or fly_private.is_global_operator())
  );
$$;

create policy tour_media_select on public.tour_media for select to authenticated
  using (fly_private.tour_visivel(public.tour_media.tour_id));
create policy tour_media_insert_operator on public.tour_media for insert to authenticated
  with check (fly_private.is_global_operator());
create policy tour_media_update_operator on public.tour_media for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy tour_media_delete_operator on public.tour_media for delete to authenticated
  using (fly_private.is_global_operator());

create policy tour_variants_select on public.tour_variants for select to authenticated
  using (fly_private.tour_visivel(public.tour_variants.tour_id));
create policy tour_variants_insert_operator on public.tour_variants for insert to authenticated
  with check (fly_private.is_global_operator());
create policy tour_variants_update_operator on public.tour_variants for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy tour_variants_delete_operator on public.tour_variants for delete to authenticated
  using (fly_private.is_global_operator());

create or replace function fly_private.variante_visivel(p_variant uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.tour_variants v
    join public.tours t on t.id = v.tour_id
    where v.id = p_variant
      and (t.status = 'published' or fly_private.is_global_operator())
  );
$$;

create policy tour_slots_select on public.tour_slots for select to authenticated
  using (fly_private.variante_visivel(public.tour_slots.variant_id));
create policy tour_slots_insert_operator on public.tour_slots for insert to authenticated
  with check (fly_private.is_global_operator());
create policy tour_slots_update_operator on public.tour_slots for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy tour_slots_delete_operator on public.tour_slots for delete to authenticated
  using (fly_private.is_global_operator());

-- Favorito é de quem favoritou, e de mais ninguém. Nem a operação: saber o que
-- alguém cobiçou e não comprou não é dado operacional.
create policy tour_favorites_select_own on public.tour_favorites for select to authenticated
  using ((select auth.uid()) = public.tour_favorites.user_id);
create policy tour_favorites_insert_own on public.tour_favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy tour_favorites_delete_own on public.tour_favorites for delete to authenticated
  using ((select auth.uid()) = public.tour_favorites.user_id);

create policy proposal_requests_select on public.proposal_requests for select to authenticated
  using (
    (select auth.uid()) = public.proposal_requests.user_id
    or fly_private.is_global_operator()
  );
create policy proposal_requests_insert_own on public.proposal_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- O cliente aceita ou recusa; a operação responde. As duas escritas passam
-- pela mesma política, e a coluna que cada um alcança é diferente na tela.
create policy proposal_requests_update on public.proposal_requests for update to authenticated
  using (
    (select auth.uid()) = public.proposal_requests.user_id
    or fly_private.is_global_operator()
  )
  with check (
    (select auth.uid()) = user_id
    or fly_private.is_global_operator()
  );

grant select on public.cancellation_policies to authenticated;
grant insert on public.cancellation_policies to authenticated;
revoke update, delete on public.cancellation_policies from authenticated, anon;

grant select, insert, update, delete on public.tour_categories to authenticated;
grant select, insert, update, delete on public.tours to authenticated;
grant select, insert, update, delete on public.tour_media to authenticated;
grant select, insert, update, delete on public.tour_variants to authenticated;
grant select, insert, update, delete on public.tour_slots to authenticated;
grant select, insert, delete on public.tour_favorites to authenticated;
revoke update on public.tour_favorites from authenticated, anon;
grant select, insert, update on public.proposal_requests to authenticated;
revoke delete on public.proposal_requests from authenticated, anon;

revoke all on public.cancellation_policies from anon;
revoke all on public.tour_categories from anon;
revoke all on public.tours from anon;
revoke all on public.tour_media from anon;
revoke all on public.tour_variants from anon;
revoke all on public.tour_slots from anon;
revoke all on public.tour_favorites from anon;
revoke all on public.proposal_requests from anon;

-- Prazo da reserva temporária. Decisão comercial, não constante de código.
insert into public.app_config (key, value, description, is_public)
values (
  'cart.hold_minutes',
  '"PENDENTE"'::jsonb,
  'Minutos que o carrinho segura uma vaga. Sem valor definido, o servidor usa 15. Decisao do dono do produto (§33).',
  true
)
on conflict (key) do nothing;
