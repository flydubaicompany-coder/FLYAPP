-- =============================================================================
-- Fase 4 — Minha Viagem (§7 e §39)
--
-- O coração operacional: roteiro, inclusões, voos, hotel, transfer, cofre,
-- QR, presença.
--
-- Três decisões atravessam o arquivo inteiro:
--
-- 1. **Horário é `timestamptz`, data de viagem é `date`.** Um compromisso
--    acontece num instante; um dia de viagem é "dia 12", e o instante em que
--    ele começa depende do fuso do destino. Misturar os dois produz o bug de
--    roteiro que aparece só para quem está em outro fuso.
--
-- 2. **Documento nunca é público.** O caminho no Storage fica aqui, o acesso
--    é concedido linha a linha, e a URL é temporária. Passaporte em bucket
--    público é o pior erro possível deste produto.
--
-- 3. **QR é token opaco.** Nada de dado pessoal dentro. O que o código carrega
--    é um segredo aleatório; tudo mais o servidor resolve na leitura.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.activity_status as enum (
  'scheduled',   -- futuro
  'confirmed',
  'in_progress',
  'done',
  'changed',     -- alterado depois de publicado: exige destaque no app
  'cancelled'
);

create type public.inclusion_category as enum (
  'air', 'lodging', 'food', 'transport', 'tours',
  'insurance', 'benefits', 'press_kit', 'special'
);

create type public.inclusion_status as enum ('included', 'optional', 'purchased', 'unavailable');

create type public.qr_kind as enum (
  'fly_id', 'activity_checkin', 'ticket', 'benefit',
  'wristband', 'album', 'city_point', 'press_kit', 'manual_fallback'
);

create type public.qr_scan_result as enum (
  'ok', 'expired', 'revoked', 'already_used', 'wrong_scope', 'unknown'
);

create type public.ready_state as enum ('ready', 'late', 'lost', 'needs_help');

create type public.document_kind as enum (
  'passport', 'ticket', 'hotel_reservation', 'insurance',
  'voucher', 'authorization', 'other'
);

create type public.transfer_status as enum (
  'scheduled', 'driver_assigned', 'en_route', 'arrived', 'boarded', 'completed', 'cancelled'
);

-- -----------------------------------------------------------------------------
-- Roteiro (§7.3)
-- -----------------------------------------------------------------------------
create table public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Dia 1, dia 2… O número é o que o cliente vê; a data é derivada mas
  -- guardada, porque um roteiro pode ter dia livre fora da sequência.
  day_number int not null,
  day_date date not null,
  title text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trip_days_number_positive check (day_number > 0),
  constraint trip_days_unique unique (trip_id, day_number)
);

create index trip_days_trip_idx on public.trip_days (trip_id, day_number);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  title text not null,
  description text,
  image_path text,
  status public.activity_status not null default 'scheduled',

  -- Instante, não hora local em texto: o app formata no fuso do destino.
  starts_at timestamptz,
  ends_at timestamptz,
  -- Horário de sair, que não é o de começar. A §7.3 pede os dois, e a
  -- diferença entre eles é o que faz alguém perder o ônibus.
  departure_at timestamptz,

  meeting_point text,
  meeting_map_url text,
  responsible_name text,
  what_to_bring text,
  dress_code text,
  instructions text,

  -- Quando a atividade muda depois de publicada e a leitura precisa ser
  -- confirmada (§7.3). Sem isso, "avisamos" vira palavra contra palavra.
  requires_ack boolean not null default false,
  changed_at timestamptz,
  change_note text,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activities_ends_after_starts
    check (ends_at is null or starts_at is null or ends_at >= starts_at),
  -- Sair depois de começar não faz sentido.
  constraint activities_departure_before_start
    check (departure_at is null or starts_at is null or departure_at <= starts_at),
  -- Status 'changed' sem data de mudança é um destaque que ninguém explica.
  constraint activities_changed_has_date
    check (status <> 'changed' or changed_at is not null)
);

create index activities_day_idx on public.activities (trip_day_id, sort_order, starts_at);
create index activities_starts_idx on public.activities (starts_at) where status <> 'cancelled';

/**
 * Quem participa de qual atividade.
 *
 * Nem toda atividade é do grupo inteiro. Sem esta tabela, "o roteiro" seria
 * igual para todos e um passeio opcional apareceria para quem não comprou.
 */
create table public.activity_participants (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (activity_id, user_id)
);

create index activity_participants_user_idx on public.activity_participants (user_id);

/**
 * Confirmação de leitura de uma alteração (§7.3).
 *
 * Tabela própria, e não coluna: a mesma atividade pode mudar duas vezes, e
 * cada mudança precisa da sua confirmação.
 */
create table public.activity_acks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A qual versão da mudança esta confirmação se refere.
  changed_at timestamptz not null,
  acknowledged_at timestamptz not null default now(),

  constraint activity_acks_unique unique (activity_id, user_id, changed_at)
);

create index activity_acks_user_idx on public.activity_acks (user_id);

-- -----------------------------------------------------------------------------
-- Tudo que está incluso (§7.4)
-- -----------------------------------------------------------------------------
create table public.trip_inclusions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  category public.inclusion_category not null,
  title text not null,
  details text,
  rules text,
  status public.inclusion_status not null default 'included',
  -- A §7.4 exige que opcional seja "claramente diferenciado do já pago".
  -- O status carrega isso; a coluna existe para o app não ter que inferir.
  is_optional boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trip_inclusions_optional_matches_status
    check ((status = 'optional') = is_optional or status in ('purchased', 'unavailable'))
);

create index trip_inclusions_trip_idx on public.trip_inclusions (trip_id, category, sort_order);

-- -----------------------------------------------------------------------------
-- Voos (§7.5)
-- -----------------------------------------------------------------------------
create table public.flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  airline text not null,
  flight_number text not null,
  origin_iata text not null,
  destination_iata text not null,
  departs_at timestamptz not null,
  arrives_at timestamptz not null,
  -- Fuso de cada ponta, para o app mostrar "sai 22h de Guarulhos, chega 18h
  -- de Dubai" sem que ninguém faça a conta de cabeça.
  origin_timezone text not null,
  destination_timezone text not null,
  terminal text,
  gate text,
  baggage_allowance text,
  -- Quando sair do hotel/casa. É o dado que o cliente realmente usa.
  leave_by_at timestamptz,
  fly_base_instructions text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint flights_arrives_after_departs check (arrives_at > departs_at),
  constraint flights_iata_format check (
    origin_iata ~ '^[A-Z]{3}$' and destination_iata ~ '^[A-Z]{3}$'
  )
);

create index flights_trip_idx on public.flights (trip_id, departs_at);

create table public.flight_passengers (
  flight_id uuid not null references public.flights (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat text,
  -- Cartão de embarque é documento: mora no cofre, e aqui fica só a
  -- referência. Nunca o arquivo, nunca o código de barras em texto.
  document_id uuid,
  created_at timestamptz not null default now(),

  primary key (flight_id, user_id)
);

create index flight_passengers_user_idx on public.flight_passengers (user_id);

-- -----------------------------------------------------------------------------
-- Hotel e transfer (§7.6)
-- -----------------------------------------------------------------------------
create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  address text,
  map_url text,
  phone text,
  checkin_at timestamptz,
  checkout_at timestamptz,
  policy text,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accommodations_trip_idx on public.accommodations (trip_id);

create table public.accommodation_guests (
  accommodation_id uuid not null references public.accommodations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Número do quarto só depois de liberado pelo hotel (§7.6). Nulo até lá,
  -- e nulo é a resposta honesta — não "a definir" com cara de dado.
  room_number text,
  room_released_at timestamptz,
  created_at timestamptz not null default now(),

  primary key (accommodation_id, user_id),
  constraint accommodation_guests_room_release
    check (room_number is null or room_released_at is not null)
);

create index accommodation_guests_user_idx on public.accommodation_guests (user_id);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  pickup_point text not null,
  pickup_at timestamptz not null,
  dropoff_point text,
  status public.transfer_status not null default 'scheduled',
  -- Dados do motorista aparecem conforme política de privacidade (§7.6): só
  -- perto do horário, e só para quem embarca. A RLS cuida do "quem".
  driver_name text,
  vehicle_description text,
  vehicle_plate text,
  tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transfers_trip_idx on public.transfers (trip_id, pickup_at);

create table public.transfer_passengers (
  transfer_id uuid not null references public.transfers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  boarded_at timestamptz,
  created_at timestamptz not null default now(),

  primary key (transfer_id, user_id)
);

create index transfer_passengers_user_idx on public.transfer_passengers (user_id);

-- -----------------------------------------------------------------------------
-- Cofre da viagem (§7.7)
--
-- A regra mais dura do produto mora aqui. O arquivo vive num bucket privado;
-- esta tabela guarda o caminho e o dono. Nenhuma coluna carrega conteúdo de
-- documento — número de passaporte, data de validade e afins ficam em
-- `extracted`, que é `jsonb` e é tratado como dado sensível pela RLS.
-- -----------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  -- De quem é o documento. Não é quem enviou: a equipe envia voucher para o
  -- cliente, e o dono continua sendo o cliente.
  owner_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  kind public.document_kind not null,
  title text not null,
  -- Caminho no bucket privado `documentos`. Nunca uma URL: URL pronta
  -- envelhece e vaza; o caminho exige assinar na hora.
  storage_path text not null,
  mime_type text,
  size_bytes bigint,

  /**
   * Campos extraídos por OCR, ainda não revisados.
   *
   * A §7.7 exige revisão humana antes de valer. Enquanto `reviewed_at` for
   * nulo, isto é rascunho: o app mostra para conferência, e nada mais lê.
   */
  extracted jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,

  -- Documento sensível exige biometria para abrir (§7.7).
  requires_biometric boolean not null default false,
  -- Autorizado a ficar em cache no aparelho. Padrão: não.
  cacheable_offline boolean not null default false,

  expires_at timestamptz,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Passaporte é sempre sensível, sem exceção de configuração.
  constraint documents_passport_is_sensitive
    check (kind <> 'passport' or requires_biometric),
  -- E nunca fica em cache no aparelho, mesmo que alguém marque.
  constraint documents_passport_not_cached
    check (kind <> 'passport' or not cacheable_offline)
);

create index documents_owner_idx on public.documents (owner_id, kind);
create index documents_trip_idx on public.documents (trip_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index documents_reviewed_by_idx on public.documents (reviewed_by);

/**
 * Concessão explícita de acesso a um documento.
 *
 * O dono sempre vê o seu. Qualquer outra pessoa — equipe, responsável
 * familiar — só vê com uma linha aqui. É o "documento sem grant é negado" da
 * §39, e o modelo é o de lista de permissão, não o de "quem trabalha aqui vê".
 */
create table public.document_grants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  grantee_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,

  constraint document_grants_unique unique (document_id, grantee_id)
);

create index document_grants_grantee_idx on public.document_grants (grantee_id)
  where revoked_at is null;
create index document_grants_document_idx on public.document_grants (document_id);
create index document_grants_granted_by_idx on public.document_grants (granted_by);

/**
 * Log de acesso a documento (§7.7).
 *
 * Append-only, como a auditoria: sem política de UPDATE nem de DELETE. Quem
 * abriu o passaporte de quem, e quando, é registro que ninguém apaga.
 */
create table public.document_access_log (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  accessed_by uuid not null references auth.users (id) on delete cascade,
  accessed_at timestamptz not null default now(),
  -- 'owner', 'grant' ou 'staff': por que o acesso foi permitido.
  via text not null,
  ip inet
);

create index document_access_log_document_idx on public.document_access_log (document_id, accessed_at desc);
create index document_access_log_by_idx on public.document_access_log (accessed_by);

-- -----------------------------------------------------------------------------
-- QR (§7.8)
--
-- O token é opaco: 32 bytes aleatórios em base64url. Não é assinado, não
-- carrega nada. Quem lê pergunta ao servidor, e o servidor sabe.
--
-- A alternativa — JWT assinado com os dados dentro — permitiria validar
-- offline, mas colocaria dado pessoal num código que qualquer câmera lê e que
-- qualquer print compartilha.
-- -----------------------------------------------------------------------------
create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  kind public.qr_kind not null,

  -- A quem o código pertence e a que ele dá acesso. Nem todo QR tem os três.
  user_id uuid references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete cascade,

  -- Escopo textual livre para os casos que não são atividade: 'benefit:spa',
  -- 'album:2026-dubai'. Validado na leitura pelo Crew.
  scope text,

  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,

  -- Uso duplicado é o ataque óbvio: um print circula no grupo. `max_uses`
  -- nulo significa sem limite (Fly ID pessoal); qualquer número significa
  -- que a contagem é conferida na hora do resgate, atomicamente.
  max_uses int,
  uses int not null default 0,

  created_at timestamptz not null default now(),

  constraint qr_tokens_token_unique unique (token),
  constraint qr_tokens_uses_within_max check (max_uses is null or uses <= max_uses),
  constraint qr_tokens_max_uses_positive check (max_uses is null or max_uses > 0),
  -- Um token de check-in sem atividade não tem o que validar.
  constraint qr_tokens_checkin_has_activity
    check (kind <> 'activity_checkin' or activity_id is not null)
);

create index qr_tokens_user_idx on public.qr_tokens (user_id, kind)
  where revoked_at is null;
create index qr_tokens_activity_idx on public.qr_tokens (activity_id);
create index qr_tokens_trip_idx on public.qr_tokens (trip_id);
create index qr_tokens_revoked_by_idx on public.qr_tokens (revoked_by);

/**
 * Log de leitura (§7.8).
 *
 * Registra **toda** tentativa, não só as bem-sucedidas. Uma sequência de
 * `already_used` é exatamente o sinal de que um print está circulando, e
 * guardar só o sucesso apagaria o sinal.
 *
 * Append-only.
 */
create table public.qr_scans (
  id bigint generated always as identity primary key,
  -- Nulo quando o token nem existe: a tentativa continua valendo registro.
  token_id uuid references public.qr_tokens (id) on delete set null,
  scanned_by uuid references auth.users (id) on delete set null,
  scanned_at timestamptz not null default now(),
  result public.qr_scan_result not null,
  -- Onde o Crew estava. Ajuda a distinguir erro de operação de fraude.
  note text
);

create index qr_scans_token_idx on public.qr_scans (token_id, scanned_at desc);
create index qr_scans_by_idx on public.qr_scans (scanned_by, scanned_at desc);
create index qr_scans_result_idx on public.qr_scans (result, scanned_at desc)
  where result <> 'ok';

-- -----------------------------------------------------------------------------
-- Ready Check e presença (§7.9)
-- -----------------------------------------------------------------------------
create table public.ready_checks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users (id) on delete set null,
  closes_at timestamptz,
  closed_at timestamptz,

  constraint ready_checks_one_open_per_activity unique (activity_id, opened_at)
);

create index ready_checks_activity_idx on public.ready_checks (activity_id, opened_at desc);
create index ready_checks_opened_by_idx on public.ready_checks (opened_by);

create table public.ready_check_responses (
  ready_check_id uuid not null references public.ready_checks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  state public.ready_state not null,
  note text,
  responded_at timestamptz not null default now(),

  primary key (ready_check_id, user_id)
);

create index ready_check_responses_user_idx on public.ready_check_responses (user_id);

/**
 * Presença numa atividade (§7.9 e §39).
 *
 * Separada do Ready Check de propósito: "estou pronto" é intenção, presença é
 * fato. O check-in por QR grava aqui; o manual também, com justificativa —
 * que é obrigatória, porque check-in manual sem motivo é o caminho por onde
 * a lista deixa de valer.
 */
create table public.activity_checkins (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users (id) on delete set null,
  -- 'qr' ou 'manual'.
  method text not null,
  justification text,

  constraint activity_checkins_unique unique (activity_id, user_id),
  constraint activity_checkins_method_known check (method in ('qr', 'manual')),
  constraint activity_checkins_manual_needs_reason
    check (method <> 'manual' or (justification is not null and length(trim(justification)) >= 3))
);

create index activity_checkins_activity_idx on public.activity_checkins (activity_id);
create index activity_checkins_user_idx on public.activity_checkins (user_id);
create index activity_checkins_by_idx on public.activity_checkins (checked_in_by);

-- -----------------------------------------------------------------------------
-- Templates de roteiro (§39, entregas do Fly Ops)
-- -----------------------------------------------------------------------------
create table public.itinerary_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination_id uuid references public.destinations (id) on delete set null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itinerary_templates_created_by_idx on public.itinerary_templates (created_by);
create index itinerary_templates_destination_idx on public.itinerary_templates (destination_id);

create table public.template_activities (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.itinerary_templates (id) on delete cascade,
  day_number int not null,
  title text not null,
  description text,
  -- Hora do dia, sem data: o template é reaproveitável. A data sai da viagem
  -- em que ele for aplicado.
  starts_at_time time,
  ends_at_time time,
  meeting_point text,
  what_to_bring text,
  dress_code text,
  sort_order int not null default 0,

  constraint template_activities_day_positive check (day_number > 0)
);

create index template_activities_template_idx
  on public.template_activities (template_id, day_number, sort_order);

-- =============================================================================
-- Funções auxiliares
--
-- Cada uma responde uma pergunta de autorização. Elas existem para que as
-- políticas abaixo sejam legíveis — e porque repetir o mesmo `exists` em
-- vinte tabelas é como as regras acabam divergindo.
--
-- Todas são `security definer` com `search_path` vazio: precisam ler tabelas
-- que o próprio usuário não pode ler diretamente, e é justamente esse o
-- ponto — a política pergunta "você é membro?" sem expor a lista de membros.
-- =============================================================================

create or replace function fly_private.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip and tm.user_id = (select auth.uid())
  );
$$;

create or replace function fly_private.is_assigned_to_trip(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_assignments sa
    where sa.trip_id = p_trip
      and sa.user_id = (select auth.uid())
      and sa.revoked_at is null
  );
$$;

/**
 * Quem pode **ver** a viagem: membro, equipe atribuída, operação global, ou
 * responsável por um dependente que é membro.
 */
create or replace function fly_private.can_see_trip(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    fly_private.is_trip_member(p_trip)
    or fly_private.is_assigned_to_trip(p_trip)
    or fly_private.is_global_operator()
    or exists (
      select 1
      from public.trip_members tm
      join public.companionships c on c.dependent_id = tm.user_id
      where tm.trip_id = p_trip
        and c.responsible_id = (select auth.uid())
        and c.revoked_at is null
    );
$$;

/** Quem pode **operar** a viagem: equipe atribuída ou operação global. */
create or replace function fly_private.can_operate_trip(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select fly_private.is_assigned_to_trip(p_trip) or fly_private.is_global_operator();
$$;

/** A viagem à qual um dia de roteiro pertence. */
create or replace function fly_private.trip_of_day(p_day uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select td.trip_id from public.trip_days td where td.id = p_day;
$$;

/** A viagem à qual uma atividade pertence, subindo por `trip_days`. */
create or replace function fly_private.trip_of_activity(p_activity uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select td.trip_id
  from public.activities a
  join public.trip_days td on td.id = a.trip_day_id
  where a.id = p_activity;
$$;

/**
 * Se o usuário atual participa de uma atividade.
 *
 * Sem participantes listados, a atividade é do grupo inteiro — é o caso
 * comum, e exigir uma linha por pessoa em cada café da manhã seria ruído.
 */
create or replace function fly_private.is_in_activity(p_activity uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    case
      when not exists (
        select 1 from public.activity_participants ap where ap.activity_id = p_activity
      )
      then fly_private.is_trip_member(fly_private.trip_of_activity(p_activity))
      else exists (
        select 1 from public.activity_participants ap
        where ap.activity_id = p_activity and ap.user_id = (select auth.uid())
      )
    end;
$$;

-- Gatilhos de `updated_at`.
create trigger trip_days_touch before update on public.trip_days
  for each row execute function fly_private.touch_updated_at();
create trigger activities_touch before update on public.activities
  for each row execute function fly_private.touch_updated_at();
create trigger trip_inclusions_touch before update on public.trip_inclusions
  for each row execute function fly_private.touch_updated_at();
create trigger flights_touch before update on public.flights
  for each row execute function fly_private.touch_updated_at();
create trigger accommodations_touch before update on public.accommodations
  for each row execute function fly_private.touch_updated_at();
create trigger transfers_touch before update on public.transfers
  for each row execute function fly_private.touch_updated_at();
create trigger documents_touch before update on public.documents
  for each row execute function fly_private.touch_updated_at();
create trigger itinerary_templates_touch before update on public.itinerary_templates
  for each row execute function fly_private.touch_updated_at();

/**
 * Toda alteração de atividade publicada marca a data da mudança.
 *
 * Sem isto, "alterado" dependeria de alguém lembrar de preencher a coluna —
 * e o destaque no app da §7.3 sumiria justamente na mudança de última hora,
 * que é a que importa.
 */
create or replace function fly_private.stamp_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Só conta como mudança o que o cliente vê: horário, ponto de encontro,
  -- título e status. Corrigir uma vírgula na descrição não é alteração de
  -- roteiro, e tratar como tal treinaria todo mundo a ignorar o destaque.
  if new.starts_at is distinct from old.starts_at
     or new.departure_at is distinct from old.departure_at
     or new.meeting_point is distinct from old.meeting_point
     or new.title is distinct from old.title
     or (new.status = 'cancelled' and old.status <> 'cancelled')
  then
    new.changed_at := now();
    if new.status not in ('cancelled', 'done') then
      new.status := 'changed';
    end if;
  end if;

  return new;
end;
$$;

create trigger activities_stamp_change before update on public.activities
  for each row execute function fly_private.stamp_activity_change();

-- =============================================================================
-- RLS
--
-- Padrão de leitura: quem pode ver a viagem vê o roteiro dela.
-- Padrão de escrita: só a equipe atribuída àquela viagem, ou a operação
-- global. Nunca `for all` — ver D35.
--
-- Toda referência à linha em avaliação vai **qualificada pelo nome da
-- tabela**. Ver D34: um `sa.trip_id = trip_id` sem qualificação já virou
-- tautologia neste repositório uma vez.
-- =============================================================================

alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;
alter table public.activity_acks enable row level security;
alter table public.trip_inclusions enable row level security;
alter table public.flights enable row level security;
alter table public.flight_passengers enable row level security;
alter table public.accommodations enable row level security;
alter table public.accommodation_guests enable row level security;
alter table public.transfers enable row level security;
alter table public.transfer_passengers enable row level security;
alter table public.documents enable row level security;
alter table public.document_grants enable row level security;
alter table public.document_access_log enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.qr_scans enable row level security;
alter table public.ready_checks enable row level security;
alter table public.ready_check_responses enable row level security;
alter table public.activity_checkins enable row level security;
alter table public.itinerary_templates enable row level security;
alter table public.template_activities enable row level security;

-- --- Roteiro ---------------------------------------------------------------
create policy trip_days_select on public.trip_days for select to authenticated
  using (fly_private.can_see_trip(public.trip_days.trip_id));
create policy trip_days_insert on public.trip_days for insert to authenticated
  with check (fly_private.can_operate_trip(trip_id));
create policy trip_days_update on public.trip_days for update to authenticated
  using (fly_private.can_operate_trip(public.trip_days.trip_id))
  with check (fly_private.can_operate_trip(trip_id));
create policy trip_days_delete on public.trip_days for delete to authenticated
  using (fly_private.can_operate_trip(public.trip_days.trip_id));

create policy activities_select on public.activities for select to authenticated
  using (fly_private.can_see_trip(fly_private.trip_of_day(public.activities.trip_day_id)));
create policy activities_insert on public.activities for insert to authenticated
  with check (fly_private.can_operate_trip(fly_private.trip_of_day(trip_day_id)));
create policy activities_update on public.activities for update to authenticated
  using (fly_private.can_operate_trip(fly_private.trip_of_day(public.activities.trip_day_id)))
  with check (fly_private.can_operate_trip(fly_private.trip_of_day(trip_day_id)));
create policy activities_delete on public.activities for delete to authenticated
  using (fly_private.can_operate_trip(fly_private.trip_of_day(public.activities.trip_day_id)));

create policy activity_participants_select on public.activity_participants for select to authenticated
  using (
    (select auth.uid()) = public.activity_participants.user_id
    or fly_private.can_operate_trip(
         fly_private.trip_of_activity(public.activity_participants.activity_id))
  );
create policy activity_participants_insert on public.activity_participants for insert to authenticated
  with check (fly_private.can_operate_trip(fly_private.trip_of_activity(activity_id)));
create policy activity_participants_delete on public.activity_participants for delete to authenticated
  using (fly_private.can_operate_trip(
           fly_private.trip_of_activity(public.activity_participants.activity_id)));

-- Confirmação de leitura: cada um confirma a sua, e a operação vê todas.
create policy activity_acks_select on public.activity_acks for select to authenticated
  using (
    (select auth.uid()) = public.activity_acks.user_id
    or fly_private.can_operate_trip(fly_private.trip_of_activity(public.activity_acks.activity_id))
  );
create policy activity_acks_insert on public.activity_acks for insert to authenticated
  with check ((select auth.uid()) = user_id and fly_private.is_in_activity(activity_id));
-- Sem UPDATE nem DELETE: confirmação de leitura é registro, não preferência.

-- --- Inclusões -------------------------------------------------------------
create policy trip_inclusions_select on public.trip_inclusions for select to authenticated
  using (fly_private.can_see_trip(public.trip_inclusions.trip_id));
create policy trip_inclusions_insert on public.trip_inclusions for insert to authenticated
  with check (fly_private.can_operate_trip(trip_id));
create policy trip_inclusions_update on public.trip_inclusions for update to authenticated
  using (fly_private.can_operate_trip(public.trip_inclusions.trip_id))
  with check (fly_private.can_operate_trip(trip_id));
create policy trip_inclusions_delete on public.trip_inclusions for delete to authenticated
  using (fly_private.can_operate_trip(public.trip_inclusions.trip_id));

-- --- Voos ------------------------------------------------------------------
create policy flights_select on public.flights for select to authenticated
  using (fly_private.can_see_trip(public.flights.trip_id));
create policy flights_insert on public.flights for insert to authenticated
  with check (fly_private.can_operate_trip(trip_id));
create policy flights_update on public.flights for update to authenticated
  using (fly_private.can_operate_trip(public.flights.trip_id))
  with check (fly_private.can_operate_trip(trip_id));
create policy flights_delete on public.flights for delete to authenticated
  using (fly_private.can_operate_trip(public.flights.trip_id));

-- Assento é dado de quem viaja. Um passageiro vê o próprio; a operação vê a
-- lista para poder embarcar o grupo.
create policy flight_passengers_select on public.flight_passengers for select to authenticated
  using (
    (select auth.uid()) = public.flight_passengers.user_id
    or fly_private.can_operate_trip(
         (select f.trip_id from public.flights f where f.id = public.flight_passengers.flight_id))
  );
create policy flight_passengers_insert on public.flight_passengers for insert to authenticated
  with check (fly_private.can_operate_trip(
    (select f.trip_id from public.flights f where f.id = flight_id)));
create policy flight_passengers_update on public.flight_passengers for update to authenticated
  using (fly_private.can_operate_trip(
    (select f.trip_id from public.flights f where f.id = public.flight_passengers.flight_id)))
  with check (fly_private.can_operate_trip(
    (select f.trip_id from public.flights f where f.id = flight_id)));
create policy flight_passengers_delete on public.flight_passengers for delete to authenticated
  using (fly_private.can_operate_trip(
    (select f.trip_id from public.flights f where f.id = public.flight_passengers.flight_id)));

-- --- Hotel e transfer ------------------------------------------------------
create policy accommodations_select on public.accommodations for select to authenticated
  using (fly_private.can_see_trip(public.accommodations.trip_id));
create policy accommodations_insert on public.accommodations for insert to authenticated
  with check (fly_private.can_operate_trip(trip_id));
create policy accommodations_update on public.accommodations for update to authenticated
  using (fly_private.can_operate_trip(public.accommodations.trip_id))
  with check (fly_private.can_operate_trip(trip_id));
create policy accommodations_delete on public.accommodations for delete to authenticated
  using (fly_private.can_operate_trip(public.accommodations.trip_id));

-- Número do quarto é dado de segurança pessoal: só o hóspede e a operação.
-- Nem os outros hóspedes da mesma viagem.
create policy accommodation_guests_select on public.accommodation_guests for select to authenticated
  using (
    (select auth.uid()) = public.accommodation_guests.user_id
    or fly_private.can_operate_trip(
         (select a.trip_id from public.accommodations a
          where a.id = public.accommodation_guests.accommodation_id))
  );
create policy accommodation_guests_insert on public.accommodation_guests for insert to authenticated
  with check (fly_private.can_operate_trip(
    (select a.trip_id from public.accommodations a where a.id = accommodation_id)));
create policy accommodation_guests_update on public.accommodation_guests for update to authenticated
  using (fly_private.can_operate_trip(
    (select a.trip_id from public.accommodations a
     where a.id = public.accommodation_guests.accommodation_id)))
  with check (fly_private.can_operate_trip(
    (select a.trip_id from public.accommodations a where a.id = accommodation_id)));
create policy accommodation_guests_delete on public.accommodation_guests for delete to authenticated
  using (fly_private.can_operate_trip(
    (select a.trip_id from public.accommodations a
     where a.id = public.accommodation_guests.accommodation_id)));

create policy transfers_select on public.transfers for select to authenticated
  using (fly_private.can_see_trip(public.transfers.trip_id));
create policy transfers_insert on public.transfers for insert to authenticated
  with check (fly_private.can_operate_trip(trip_id));
create policy transfers_update on public.transfers for update to authenticated
  using (fly_private.can_operate_trip(public.transfers.trip_id))
  with check (fly_private.can_operate_trip(trip_id));
create policy transfers_delete on public.transfers for delete to authenticated
  using (fly_private.can_operate_trip(public.transfers.trip_id));

create policy transfer_passengers_select on public.transfer_passengers for select to authenticated
  using (
    (select auth.uid()) = public.transfer_passengers.user_id
    or fly_private.can_operate_trip(
         (select t.trip_id from public.transfers t
          where t.id = public.transfer_passengers.transfer_id))
  );
create policy transfer_passengers_insert on public.transfer_passengers for insert to authenticated
  with check (fly_private.can_operate_trip(
    (select t.trip_id from public.transfers t where t.id = transfer_id)));
create policy transfer_passengers_update on public.transfer_passengers for update to authenticated
  using (fly_private.can_operate_trip(
    (select t.trip_id from public.transfers t
     where t.id = public.transfer_passengers.transfer_id)))
  with check (fly_private.can_operate_trip(
    (select t.trip_id from public.transfers t where t.id = transfer_id)));
create policy transfer_passengers_delete on public.transfer_passengers for delete to authenticated
  using (fly_private.can_operate_trip(
    (select t.trip_id from public.transfers t
     where t.id = public.transfer_passengers.transfer_id)));

-- --- Cofre -----------------------------------------------------------------
--
-- Esta é a política mais restritiva do sistema, e é de propósito.
--
-- Não há cláusula de equipe. Um guia atribuído à viagem **não** vê o
-- passaporte de ninguém por ser guia — precisa de uma linha em
-- `document_grants`, com motivo e com data. É o "documento sem grant é
-- negado" da §39, e a diferença entre "quem trabalha aqui vê" e "quem
-- precisou, com registro".

/**
 * As tres perguntas do cofre, respondidas por funcao `definer`.
 *
 * A politica de `documents` precisa consultar `document_grants`, e a de
 * `document_grants` precisa consultar `documents`. Escritas como `exists`
 * direto, uma dispara a avaliacao da outra e o Postgres para com
 * "infinite recursion detected in policy". `definer` le a tabela sem
 * reativar a RLS, e o ciclo se rompe.
 */
create or replace function fly_private.has_document_grant(p_document uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.document_grants g
    where g.document_id = p_document
      and g.grantee_id = (select auth.uid())
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

create or replace function fly_private.owns_document(p_document uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_document and d.owner_id = (select auth.uid())
  );
$$;

/** Responsável por dependente vê os documentos do dependente (§7.10). */
create or replace function fly_private.is_guardian_of_owner(p_document uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents d
    join public.companionships c on c.dependent_id = d.owner_id
    where d.id = p_document
      and c.responsible_id = (select auth.uid())
      and c.revoked_at is null
  );
$$;

create policy documents_select on public.documents for select to authenticated
  using (
    (select auth.uid()) = public.documents.owner_id
    or fly_private.has_document_grant(public.documents.id)
    or fly_private.is_guardian_of_owner(public.documents.id)
  );

-- O dono envia os próprios documentos; a equipe atribuída envia para a
-- viagem que opera (voucher, autorização). Em ambos os casos, `uploaded_by`
-- registra quem foi.
create policy documents_insert on public.documents for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    or (trip_id is not null and fly_private.can_operate_trip(trip_id))
  );

create policy documents_update on public.documents for update to authenticated
  using (
    (select auth.uid()) = public.documents.owner_id
    or (public.documents.trip_id is not null
        and fly_private.can_operate_trip(public.documents.trip_id))
  )
  with check (
    (select auth.uid()) = owner_id
    or (trip_id is not null and fly_private.can_operate_trip(trip_id))
  );

-- Só o dono apaga o próprio documento. A equipe não apaga passaporte de
-- cliente — retenção e exclusão são decisão do titular (§7.7).
create policy documents_delete on public.documents for delete to authenticated
  using ((select auth.uid()) = public.documents.owner_id);

create policy document_grants_select on public.document_grants for select to authenticated
  using (
    (select auth.uid()) = public.document_grants.grantee_id
    or fly_private.owns_document(public.document_grants.document_id)
    or fly_private.is_global_operator()
  );

-- Quem concede é o dono do documento. A operação global também, para o caso
-- de suporte — e por isso a coluna `reason` é obrigatória.
create policy document_grants_insert on public.document_grants for insert to authenticated
  with check (fly_private.owns_document(document_id) or fly_private.is_global_operator());

-- Revogar é UPDATE de `revoked_at`. O dono sempre pode.
create policy document_grants_update on public.document_grants for update to authenticated
  using (fly_private.owns_document(public.document_grants.document_id)
         or fly_private.is_global_operator())
  with check (fly_private.owns_document(document_id) or fly_private.is_global_operator());

-- O log de acesso: o dono vê quem abriu o documento dele. Sem UPDATE nem
-- DELETE — append-only, como a auditoria.
-- O log e do DONO do documento, nao de quem acessou. Quem abriu nao ve a
-- propria linha: o registro existe para o titular auditar, e um acessante que
-- pudesse ler o log poderia conferir se o acesso dele foi notado.
create policy document_access_log_select on public.document_access_log for select to authenticated
  using (
    fly_private.owns_document(public.document_access_log.document_id)
    or fly_private.has_role('admin')
  );
create policy document_access_log_insert on public.document_access_log for insert to authenticated
  with check ((select auth.uid()) = accessed_by);

-- --- QR --------------------------------------------------------------------
--
-- O cliente lê os próprios códigos; a operação lê os da viagem que opera.
-- Ninguém escreve direto: emitir e revogar passam por RPC, que é onde o
-- token é gerado e a autorização conferida.

create policy qr_tokens_select on public.qr_tokens for select to authenticated
  using (
    (select auth.uid()) = public.qr_tokens.user_id
    or (public.qr_tokens.trip_id is not null
        and fly_private.can_operate_trip(public.qr_tokens.trip_id))
  );

create policy qr_scans_select on public.qr_scans for select to authenticated
  using (
    (select auth.uid()) = public.qr_scans.scanned_by
    or fly_private.is_global_operator()
  );
-- Sem INSERT/UPDATE/DELETE: `redeem_qr` é a única porta, e é `definer`.

-- --- Ready Check e presença ------------------------------------------------
create policy ready_checks_select on public.ready_checks for select to authenticated
  using (fly_private.can_see_trip(fly_private.trip_of_activity(public.ready_checks.activity_id)));
create policy ready_checks_insert on public.ready_checks for insert to authenticated
  with check (fly_private.can_operate_trip(fly_private.trip_of_activity(activity_id)));
create policy ready_checks_update on public.ready_checks for update to authenticated
  using (fly_private.can_operate_trip(fly_private.trip_of_activity(public.ready_checks.activity_id)))
  with check (fly_private.can_operate_trip(fly_private.trip_of_activity(activity_id)));

/**
 * Resposta ao Ready Check.
 *
 * A §7.9 é explícita: "o cliente nunca deve ver informações sensíveis dos
 * demais integrantes". Então cada um vê a **própria** resposta, e só a
 * operação vê o painel. Um cliente saber que outro está atrasado não ajuda
 * ninguém e expõe quem se atrasou.
 */
create policy ready_check_responses_select on public.ready_check_responses for select to authenticated
  using (
    (select auth.uid()) = public.ready_check_responses.user_id
    or fly_private.can_operate_trip(
         fly_private.trip_of_activity(
           (select rc.activity_id from public.ready_checks rc
            where rc.id = public.ready_check_responses.ready_check_id)))
  );
create policy ready_check_responses_insert on public.ready_check_responses for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- Mudar de "atrasado" para "pronto" é o caso normal.
create policy ready_check_responses_update on public.ready_check_responses for update to authenticated
  using ((select auth.uid()) = public.ready_check_responses.user_id)
  with check ((select auth.uid()) = user_id);

create policy activity_checkins_select on public.activity_checkins for select to authenticated
  using (
    (select auth.uid()) = public.activity_checkins.user_id
    or fly_private.can_operate_trip(
         fly_private.trip_of_activity(public.activity_checkins.activity_id))
  );
-- Check-in manual pela operação. O por QR passa por `redeem_qr`.
create policy activity_checkins_insert on public.activity_checkins for insert to authenticated
  with check (fly_private.can_operate_trip(fly_private.trip_of_activity(activity_id)));
-- Sem UPDATE nem DELETE: presença é fato registrado. Corrigir engano é
-- assunto de suporte, com trilha — não de um toque na tela.

-- --- Templates -------------------------------------------------------------
create policy itinerary_templates_select on public.itinerary_templates for select to authenticated
  using (fly_private.is_staff());
create policy itinerary_templates_insert on public.itinerary_templates for insert to authenticated
  with check (fly_private.is_global_operator());
create policy itinerary_templates_update on public.itinerary_templates for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy itinerary_templates_delete on public.itinerary_templates for delete to authenticated
  using (fly_private.is_global_operator());

create policy template_activities_select on public.template_activities for select to authenticated
  using (fly_private.is_staff());
create policy template_activities_insert on public.template_activities for insert to authenticated
  with check (fly_private.is_global_operator());
create policy template_activities_update on public.template_activities for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy template_activities_delete on public.template_activities for delete to authenticated
  using (fly_private.is_global_operator());

-- =============================================================================
-- Storage: o bucket dos documentos (§7.7 e §39)
--
-- Privado. Sempre. O `public` é `false` e não há política que devolva URL
-- pública — o app pede uma URL assinada de curta duração a cada abertura.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  20 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

/**
 * O caminho no bucket é `{owner_id}/{document_id}.{ext}`.
 *
 * A primeira pasta ser o id do dono é o que torna a política abaixo simples e
 * verificável: sem consultar `documents`, o Storage já sabe de quem é o
 * arquivo. A checagem de grant continua acontecendo em `documents`, na hora
 * de assinar a URL.
 */
create policy documentos_select_proprio on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.documents d
        join public.document_grants g on g.document_id = d.id
        where d.storage_path = storage.objects.name
          and g.grantee_id = (select auth.uid())
          and g.revoked_at is null
          and (g.expires_at is null or g.expires_at > now())
      )
    )
  );

create policy documentos_insert_proprio on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy documentos_update_proprio on storage.objects for update to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy documentos_delete_proprio on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =============================================================================
-- RPCs
-- =============================================================================

/**
 * Emite um QR (§7.8).
 *
 * O token é gerado **aqui**, no servidor, com `gen_random_bytes`. Se o app
 * gerasse, o cliente escolheria o próprio código — e um cliente que escolhe o
 * código escolhe também o de outra pessoa.
 *
 * Idempotente por escopo: pedir de novo o mesmo tipo de código para a mesma
 * atividade devolve o que já existe, em vez de encher a tabela de tokens
 * válidos que ninguém revogou.
 */
create or replace function public.emitir_qr(
  p_kind public.qr_kind,
  p_activity uuid default null,
  p_trip uuid default null,
  p_scope text default null,
  p_valid_minutes int default null,
  p_max_uses int default null
)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_trip uuid := p_trip;
  v_existente public.qr_tokens;
  v_token text;
  v_expira timestamptz;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '28000';
  end if;

  if p_kind = 'activity_checkin' then
    if p_activity is null then
      raise exception 'check-in exige atividade' using errcode = '22023';
    end if;

    -- Só quem participa da atividade recebe o código dela. Sem esta linha,
    -- qualquer membro da viagem emitiria check-in de um passeio opcional que
    -- não comprou.
    if not fly_private.is_in_activity(p_activity) then
      raise exception 'nao participa desta atividade' using errcode = '42501';
    end if;

    v_trip := fly_private.trip_of_activity(p_activity);
  elsif v_trip is not null and not fly_private.is_trip_member(v_trip) then
    raise exception 'nao e membro desta viagem' using errcode = '42501';
  end if;

  -- Reaproveita um código ainda válido para o mesmo escopo.
  select * into v_existente
  from public.qr_tokens q
  where q.user_id = v_user
    and q.kind = p_kind
    and q.activity_id is not distinct from p_activity
    and q.scope is not distinct from p_scope
    and q.revoked_at is null
    and (q.expires_at is null or q.expires_at > now())
    and (q.max_uses is null or q.uses < q.max_uses)
  order by q.issued_at desc
  limit 1;

  if found then
    return query select v_existente.token, v_existente.expires_at;
    return;
  end if;

  -- 32 bytes de entropia. base64url para caber num QR pequeno e sobreviver a
  -- URL sem escapar nada.
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_expira := case when p_valid_minutes is null
                   then null
                   else now() + (p_valid_minutes || ' minutes')::interval
              end;

  insert into public.qr_tokens (token, kind, user_id, trip_id, activity_id, scope, expires_at, max_uses)
  values (v_token, p_kind, v_user, v_trip, p_activity, p_scope, v_expira, p_max_uses);

  return query select v_token, v_expira;
end;
$$;

revoke all on function public.emitir_qr(public.qr_kind, uuid, uuid, text, int, int) from public, anon;
grant execute on function public.emitir_qr(public.qr_kind, uuid, uuid, text, int, int) to authenticated;

/**
 * Lê e resgata um QR (§7.8 e §39).
 *
 * Duas exigências da §39 vivem aqui:
 *
 * - **"QR expirado/usado é recusado"**. A recusa é distinta do erro: o Crew
 *   precisa saber *por que* recusou, para decidir entre chamar o suporte e
 *   fazer check-in manual.
 *
 * - **"proteção contra uso duplicado"**. O incremento e a checagem do limite
 *   acontecem no mesmo `UPDATE`. Duas leituras simultâneas do mesmo print
 *   competem pelo mesmo bloqueio de linha, e a segunda encontra `uses` já
 *   incrementado. Ler antes e gravar depois deixaria a janela aberta.
 *
 * Toda tentativa vai para `qr_scans`, inclusive as recusadas — uma sequência
 * de `already_used` é o sinal de que um código está circulando.
 */
create or replace function public.ler_qr(
  p_token text,
  p_expected_kind public.qr_kind default null,
  p_note text default null
)
returns table (
  resultado public.qr_scan_result,
  kind public.qr_kind,
  pessoa text,
  atividade text,
  usos int,
  limite int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scanner uuid := (select auth.uid());
  v_token public.qr_tokens;
  v_res public.qr_scan_result;
  v_atualizado public.qr_tokens;
  -- Guardado a parte: `v_token` e sobrescrito no meio da funcao, e depender
  -- da ordem de avaliacao para reler a propria linha e frágil demais para
  -- uma funcao que decide se alguem embarca.
  v_id uuid;
begin
  if v_scanner is null then
    raise exception 'sem sessao' using errcode = '28000';
  end if;

  select * into v_token from public.qr_tokens q where q.token = p_token;

  -- Token inexistente: registra e sai. Não diz mais que isso — enumerar
  -- tokens válidos a partir das mensagens de erro seria fácil demais.
  if not found then
    insert into public.qr_scans (token_id, scanned_by, result, note)
    values (null, v_scanner, 'unknown', p_note);
    return query select 'unknown'::public.qr_scan_result, null::public.qr_kind,
                        null::text, null::text, null::int, null::int;
    return;
  end if;

  v_id := v_token.id;

  -- Quem lê precisa operar a viagem do código. Um guia de outra viagem lendo
  -- um código não é leitor: é alguém coletando presença que não é dele.
  if v_token.trip_id is not null and not fly_private.can_operate_trip(v_token.trip_id) then
    raise exception 'nao opera esta viagem' using errcode = '42501';
  end if;

  if p_expected_kind is not null and v_token.kind <> p_expected_kind then
    v_res := 'wrong_scope';
  elsif v_token.revoked_at is not null then
    v_res := 'revoked';
  elsif v_token.expires_at is not null and v_token.expires_at <= now() then
    v_res := 'expired';
  else
    -- A checagem do limite e o incremento, no mesmo comando.
    update public.qr_tokens q
    set uses = q.uses + 1
    where q.id = v_id
      and q.revoked_at is null
      and (q.expires_at is null or q.expires_at > now())
      and (q.max_uses is null or q.uses < q.max_uses)
    returning * into v_atualizado;

    if found then
      v_res := 'ok';
      v_token := v_atualizado;
    else
      -- Chegou aqui com o token válido nas checagens acima: o limite estourou
      -- entre a leitura e o update, ou seja, alguém leu o mesmo código agora.
      v_res := 'already_used';
      select * into v_token from public.qr_tokens q where q.id = v_id;
    end if;
  end if;

  insert into public.qr_scans (token_id, scanned_by, result, note)
  values (v_id, v_scanner, v_res, p_note);

  -- Check-in bem-sucedido vira presença. `on conflict do nothing` porque a
  -- presença já registrada não é erro: é o mesmo fato, contado de novo.
  if v_res = 'ok' and v_token.kind = 'activity_checkin' and v_token.activity_id is not null then
    insert into public.activity_checkins (activity_id, user_id, checked_in_by, method)
    values (v_token.activity_id, v_token.user_id, v_scanner, 'qr')
    on conflict (activity_id, user_id) do nothing;
  end if;

  return query
    select
      v_res,
      v_token.kind,
      (select coalesce(p.preferred_name, p.display_name)
       from public.profiles p where p.id = v_token.user_id),
      (select a.title from public.activities a where a.id = v_token.activity_id),
      v_token.uses,
      v_token.max_uses;
end;
$$;

revoke all on function public.ler_qr(text, public.qr_kind, text) from public, anon;
grant execute on function public.ler_qr(text, public.qr_kind, text) to authenticated;

/**
 * Revoga um QR.
 *
 * Só quem emitiu (o dono) ou quem opera a viagem. Idempotente: revogar duas
 * vezes não muda a data da primeira revogação — a hora em que o código
 * deixou de valer é um fato só.
 */
create or replace function public.revogar_qr(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_token public.qr_tokens;
begin
  select * into v_token from public.qr_tokens q where q.id = p_id;
  if not found then
    raise exception 'codigo nao encontrado' using errcode = '22023';
  end if;

  if v_token.user_id is distinct from v_user
     and not (v_token.trip_id is not null and fly_private.can_operate_trip(v_token.trip_id))
  then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  update public.qr_tokens q
  set revoked_at = now(), revoked_by = v_user
  where q.id = p_id and q.revoked_at is null;
end;
$$;

revoke all on function public.revogar_qr(uuid) from public, anon;
grant execute on function public.revogar_qr(uuid) to authenticated;

/**
 * O documento, com URL assinada e acesso registrado (§7.7).
 *
 * Existe para que o registro no log **não** dependa de o app lembrar de
 * gravá-lo. Quem quiser o caminho de um documento passa por aqui, e passar
 * por aqui deixa rastro.
 *
 * A função não assina a URL — isso é papel do Storage, chamado pelo cliente
 * com o caminho que ela devolve. O que ela garante é a autorização e o log.
 */
create or replace function public.abrir_documento(p_id uuid)
returns table (
  permitido boolean,
  storage_path text,
  requires_biometric boolean,
  kind public.document_kind
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_doc public.documents;
  v_via text;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '28000';
  end if;

  select * into v_doc from public.documents d where d.id = p_id;
  if not found then
    raise exception 'documento nao encontrado' using errcode = '22023';
  end if;

  if v_doc.owner_id = v_user then
    v_via := 'owner';
  elsif exists (
    select 1 from public.document_grants g
    where g.document_id = p_id
      and g.grantee_id = v_user
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  ) then
    v_via := 'grant';
  elsif exists (
    select 1 from public.companionships c
    where c.dependent_id = v_doc.owner_id
      and c.responsible_id = v_user
      and c.revoked_at is null
  ) then
    v_via := 'guardian';
  else
    /**
     * Tentativa negada também é registro: é o padrão que denuncia varredura.
     *
     * E é por isso que a negativa **volta como dado**, e não como exceção.
     * `raise` desfaz tudo o que a função escreveu na mesma transação,
     * inclusive este `insert` — o Postgres não tem transação autônoma. Uma
     * função que loga e depois lança não loga nada.
     *
     * Quem chama distingue pelo `permitido`. Note que chegar aqui já é
     * anômalo: a RLS impede o usuário de listar o documento, então ele teria
     * que ter obtido o id por outro caminho.
     */
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_user, 'document.access_denied', 'documents', p_id::text, '{}'::jsonb);

    return query select false, null::text, null::boolean, null::public.document_kind;
    return;
  end if;

  insert into public.document_access_log (document_id, accessed_by, via)
  values (p_id, v_user, v_via);

  return query select true, v_doc.storage_path, v_doc.requires_biometric, v_doc.kind;
end;
$$;

revoke all on function public.abrir_documento(uuid) from public, anon;
grant execute on function public.abrir_documento(uuid) to authenticated;

/**
 * Aplica um template a uma viagem (§39, Fly Ops).
 *
 * Cria os dias que faltarem e as atividades do template. Não apaga nada: um
 * template aplicado por engano numa viagem em andamento não pode levar junto
 * o roteiro que já estava lá.
 */
create or replace function public.aplicar_template(p_template uuid, p_trip uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
  v_tz text;
  v_criadas int := 0;
  -- `get diagnostics` devolve o total do ultimo comando, nao o acumulado.
  -- Sem `v_lote`, a funcao retornava so as atividades do ultimo dia.
  v_lote int;
  v_dia record;
  v_day_id uuid;
begin
  if not fly_private.can_operate_trip(p_trip) then
    raise exception 'sem permissao nesta viagem' using errcode = '42501';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip;
  if not found then
    raise exception 'viagem nao encontrada' using errcode = '22023';
  end if;

  -- Resolvido uma vez: repetir o subselect dentro do `at time zone` de cada
  -- atividade e mais lento e mais facil de errar.
  select d.timezone into v_tz from public.destinations d where d.id = v_trip.destination_id;

  for v_dia in
    select distinct ta.day_number from public.template_activities ta
    where ta.template_id = p_template
    order by ta.day_number
  loop
    -- A data do dia N sai da data de início da viagem. É aqui que o template,
    -- que não tem data, ganha uma.
    insert into public.trip_days (trip_id, day_number, day_date)
    values (p_trip, v_dia.day_number, v_trip.starts_on + (v_dia.day_number - 1))
    on conflict (trip_id, day_number) do nothing;

    select td.id into v_day_id
    from public.trip_days td
    where td.trip_id = p_trip and td.day_number = v_dia.day_number;

    insert into public.activities (
      trip_day_id, title, description, meeting_point, what_to_bring, dress_code,
      sort_order, starts_at, ends_at
    )
    select
      v_day_id, ta.title, ta.description, ta.meeting_point, ta.what_to_bring,
      ta.dress_code, ta.sort_order,
      -- Hora do template + data do dia, no fuso do destino. Sem o `at time
      -- zone`, uma atividade das 9h em Dubai viraria 9h UTC, que é 13h lá.
      case when ta.starts_at_time is null then null
           else ((v_trip.starts_on + (v_dia.day_number - 1)) + ta.starts_at_time) at time zone v_tz
      end,
      case when ta.ends_at_time is null then null
           else ((v_trip.starts_on + (v_dia.day_number - 1)) + ta.ends_at_time) at time zone v_tz
      end
    from public.template_activities ta
    where ta.template_id = p_template and ta.day_number = v_dia.day_number;

    get diagnostics v_lote = row_count;
    v_criadas := v_criadas + v_lote;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), 'trip.template_applied', 'trips', p_trip::text,
    jsonb_build_object('template_id', p_template)
  );

  return v_criadas;
end;
$$;

revoke all on function public.aplicar_template(uuid, uuid) from public, anon;
grant execute on function public.aplicar_template(uuid, uuid) to authenticated;

/**
 * O estado de Minha Viagem, resolvido no servidor.
 *
 * Mesma razão de `home_state`: a conta depende do fuso do destino, e mudar a
 * regra não pode exigir nova build. Devolve o "agora/próximo" da §7.1 já
 * decidido.
 */
create or replace function public.viagem_atual()
returns table (
  trip_id uuid,
  trip_name text,
  destination_name text,
  timezone text,
  starts_on date,
  ends_on date,
  day_number int,
  total_days int,
  agora_id uuid,
  agora_titulo text,
  agora_comeca timestamptz,
  proximo_id uuid,
  proximo_titulo text,
  proximo_comeca timestamptz,
  proximo_saida timestamptz,
  proximo_ponto text,
  alteracoes_sem_confirmacao int
)
language sql
security invoker
stable
set search_path = ''
as $$
  with v as (
    select
      t.id, t.name, t.starts_on, t.ends_on,
      d.name as destino, d.timezone,
      (now() at time zone d.timezone)::date as hoje
    from public.trips t
    join public.destinations d on d.id = t.destination_id
    join public.trip_members tm on tm.trip_id = t.id
    where tm.user_id = (select auth.uid())
      and t.status in ('published', 'ongoing')
    order by t.starts_on
    limit 1
  ),
  atividades as (
    select a.*, v.id as vid
    from v
    join public.trip_days td on td.trip_id = v.id
    join public.activities a on a.trip_day_id = td.id
    where a.status <> 'cancelled'
  )
  select
    v.id, v.name, v.destino, v.timezone, v.starts_on, v.ends_on,
    case when v.hoje between v.starts_on and v.ends_on
         then (v.hoje - v.starts_on + 1)::int end,
    (v.ends_on - v.starts_on + 1)::int,
    agora.id, agora.title, agora.starts_at,
    prox.id, prox.title, prox.starts_at, prox.departure_at, prox.meeting_point,
    (select count(*)::int from atividades a
     where a.status = 'changed'
       and a.requires_ack
       and not exists (
         select 1 from public.activity_acks ack
         where ack.activity_id = a.id
           and ack.user_id = (select auth.uid())
           and ack.changed_at = a.changed_at
       ))
  from v
  -- O que está acontecendo agora: já começou e ainda não terminou.
  left join lateral (
    select a.id, a.title, a.starts_at from atividades a
    where a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
    order by a.starts_at desc
    limit 1
  ) agora on true
  -- O próximo: o primeiro que ainda não começou.
  left join lateral (
    select a.id, a.title, a.starts_at, a.departure_at, a.meeting_point
    from atividades a
    where a.starts_at > now()
    order by a.starts_at
    limit 1
  ) prox on true;
$$;

revoke all on function public.viagem_atual() from public, anon;
grant execute on function public.viagem_atual() to authenticated;

-- =============================================================================
-- GRANTs
--
-- RLS e GRANT são controles diferentes, e os dois precisam existir. A RLS diz
-- quais linhas; o GRANT diz se a tabela é alcançável.
-- =============================================================================
grant select, insert, update, delete on public.trip_days to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, delete on public.activity_participants to authenticated;
grant select, insert on public.activity_acks to authenticated;
grant select, insert, update, delete on public.trip_inclusions to authenticated;
grant select, insert, update, delete on public.flights to authenticated;
grant select, insert, update, delete on public.flight_passengers to authenticated;
grant select, insert, update, delete on public.accommodations to authenticated;
grant select, insert, update, delete on public.accommodation_guests to authenticated;
grant select, insert, update, delete on public.transfers to authenticated;
grant select, insert, update, delete on public.transfer_passengers to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update on public.document_grants to authenticated;
grant select, insert on public.document_access_log to authenticated;
grant select, insert, update on public.ready_checks to authenticated;
grant select, insert, update on public.ready_check_responses to authenticated;
grant select, insert on public.activity_checkins to authenticated;
grant select, insert, update, delete on public.itinerary_templates to authenticated;
grant select, insert, update, delete on public.template_activities to authenticated;

/**
 * QR: só leitura pela tabela.
 *
 * Emitir, resgatar e revogar passam por RPC. Um `insert` direto em
 * `qr_tokens` permitiria escolher o próprio token; um `update` permitiria
 * zerar `uses` e reusar um código gasto.
 *
 * ATENÇÃO: `grant select` **não** fecha as outras portas. O Supabase concede
 * todos os privilégios de `public` a `anon` e `authenticated` por padrão, e
 * este comando só repete o que já estava lá. O fechamento vem da migration
 * `20260825200000_grants_append_only`, que revoga — e da RLS, que é quem de
 * fato negava enquanto o GRANT esteve aberto.
 */
grant select on public.qr_tokens to authenticated;
grant select on public.qr_scans to authenticated;

-- `document_access_log`, `activity_acks` e `activity_checkins` são
-- append-only: sem política de update nem de delete. O GRANT correspondente é
-- revogado em `20260825200000_grants_append_only` — omitir da lista acima não
-- bastava, pelo mesmo motivo.
