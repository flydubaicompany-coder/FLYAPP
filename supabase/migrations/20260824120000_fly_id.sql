-- =============================================================================
-- Fly ID: identidade, convites, consentimentos, vinculos e preferencias
--
-- Fase 2 da especificacao mestre (§37). Este e o esqueleto de autorizacao do
-- produto inteiro: tudo que vier depois — viagem, carteira, album — apoia
-- nestas tabelas para decidir quem enxerga o que.
--
-- Regras da §37 aplicadas aqui:
--   • autorizacao NUNCA em user_metadata;
--   • perfil completo nunca e publico;
--   • preferencia interna de surpresa nao e visivel a outro cliente;
--   • dado de menor tem regra propria;
--   • QR pessoal usa identificador opaco.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identificador publico opaco (§37, regra do QR).
--
-- O uuid do usuario nunca vai para um QR: ele aparece em foreign keys, logs e
-- URLs internas, e vazaria correlacao. Este id e curto, aleatorio e descartavel
-- — se um QR for comprometido, gira-se o id sem tocar na identidade.
--
-- Alfabeto sem 0/O/1/I/L para o codigo poder ser lido em voz alta na base.
-- -----------------------------------------------------------------------------
create or replace function fly_private.generate_public_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  resultado text := '';
  i integer;
begin
  for i in 1..10 loop
    resultado := resultado || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return resultado;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: o perfil minimo da Fase 0 vira o Fly ID
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column public_id text not null default fly_private.generate_public_id(),
  add column preferred_name text,
  add column phone text,
  -- Caminho no Storage privado, nunca URL publica.
  add column avatar_path text,
  add column birth_date date,
  add column onboarding_step text not null default 'invited',
  add column onboarding_completed_at timestamptz,
  -- Menor de idade tem regra propria (§37 e §23.1). Marcado pela operacao,
  -- nao inferido de birth_date: a data pode faltar ou estar errada, e a
  -- consequencia de errar aqui e grave.
  add column is_minor boolean not null default false,
  add column deleted_at timestamptz;

alter table public.profiles
  add constraint profiles_public_id_unique unique (public_id),
  add constraint profiles_public_id_format check (public_id ~ '^[2-9A-HJ-NP-Z]{10}$'),
  add constraint profiles_onboarding_step_valid check (
    onboarding_step in ('invited', 'account', 'identity', 'preferences', 'consents', 'done')
  ),
  add constraint profiles_phone_format check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint profiles_completed_implies_done check (
    onboarding_completed_at is null or onboarding_step = 'done'
  );

comment on column public.profiles.public_id is
  'Identificador opaco do QR pessoal. Nunca exponha profiles.id em QR ou URL.';
comment on column public.profiles.is_minor is
  'Definido pela operacao, nao inferido da data de nascimento.';

-- -----------------------------------------------------------------------------
-- invitations: a unica porta de entrada (§37.1)
--
-- O token e guardado como HASH. Guardar o token em claro significaria que um
-- dump de banco, um log ou um backup permitiriam ativar contas alheias.
-- -----------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  role public.fly_role not null default 'customer',
  token_hash text not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,

  constraint invitations_token_hash_unique unique (token_hash),
  -- Precisa de pelo menos um canal para entregar o convite.
  constraint invitations_has_channel check (email is not null or phone is not null),
  constraint invitations_email_format check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint invitations_phone_format check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint invitations_expires_after_creation check (expires_at > created_at),
  -- Uso unico: aceito exige quem aceitou, e vice-versa.
  constraint invitations_accepted_pair check (
    (accepted_at is null) = (accepted_by is null)
  ),
  -- Um convite nao pode estar aceito e revogado ao mesmo tempo.
  constraint invitations_not_both check (accepted_at is null or revoked_at is null)
);

create index invitations_email_idx on public.invitations (lower(email)) where email is not null;
create index invitations_phone_idx on public.invitations (phone) where phone is not null;
create index invitations_pending_idx on public.invitations (expires_at)
  where accepted_at is null and revoked_at is null;

comment on table public.invitations is
  'Convites do Fly ID. token_hash guarda o hash; o token em claro so existe no link enviado.';

-- -----------------------------------------------------------------------------
-- staff_assignments: a atribuicao limita a viagem (§18)
--
-- `trip_id` ainda nao tem foreign key: a tabela `trips` e entrega da Fase 4.
-- A coluna existe agora porque a §37.4 exige RLS por atribuicao, e sem ela a
-- politica de "guia so ve viagem atribuida" nao teria como ser escrita nem
-- testada. A FK entra junto com `trips`.
-- -----------------------------------------------------------------------------
create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null,
  role public.fly_role not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,

  constraint staff_assignments_unique unique (user_id, trip_id, role)
);

create index staff_assignments_user_idx on public.staff_assignments (user_id) where revoked_at is null;
create index staff_assignments_trip_idx on public.staff_assignments (trip_id) where revoked_at is null;

comment on column public.staff_assignments.trip_id is
  'Sem FK ate a Fase 4 criar public.trips. Documentado de proposito.';

-- -----------------------------------------------------------------------------
-- companionships: responsavel e dependente (§7.10 e §37.8)
-- -----------------------------------------------------------------------------
create type public.companionship_kind as enum ('family_lead', 'companion', 'guardian');

create table public.companionships (
  id uuid primary key default gen_random_uuid(),
  responsible_id uuid not null references auth.users (id) on delete cascade,
  dependent_id uuid not null references auth.users (id) on delete cascade,
  kind public.companionship_kind not null,
  -- O que o responsavel pode ver do dependente. Lista fechada e conferida por
  -- constraint: vinculo nao da acesso irrestrito.
  scopes text[] not null default array['itinerary', 'documents', 'meals']::text[],
  authorized_at timestamptz not null default now(),
  authorized_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,

  constraint companionships_unique unique (responsible_id, dependent_id),
  -- Ninguem e acompanhante de si mesmo.
  constraint companionships_not_self check (responsible_id <> dependent_id),
  constraint companionships_scopes_known check (
    scopes <@ array['itinerary', 'documents', 'meals', 'tickets', 'location', 'health']::text[]
  ),
  constraint companionships_scopes_not_empty check (cardinality(scopes) > 0)
);

create index companionships_responsible_idx on public.companionships (responsible_id) where revoked_at is null;
create index companionships_dependent_idx on public.companionships (dependent_id) where revoked_at is null;

comment on column public.companionships.scopes is
  'Escopo do acesso do responsavel. Vinculo nao e cheque em branco.';

-- -----------------------------------------------------------------------------
-- consents: consentimento por finalidade (§23.2)
--
-- Append-only por decisao: revogar cria um evento novo, nunca apaga o anterior.
-- Sem isso nao ha como responder "o cliente tinha consentido em tal data?".
-- -----------------------------------------------------------------------------
create table public.consent_purposes (
  key text primary key,
  label text not null,
  description text not null,
  -- Consentimento obrigatorio para usar o app (termos, por exemplo).
  is_required boolean not null default false,
  -- Categoria sensivel da §23.1 exige consentimento separado e explicito.
  is_sensitive boolean not null default false,
  current_version integer not null default 1,

  constraint consent_purposes_key_format check (key ~ '^[a-z][a-z0-9_.]{2,63}$'),
  constraint consent_purposes_version_positive check (current_version > 0)
);

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose_key text not null references public.consent_purposes (key),
  granted boolean not null,
  version integer not null,
  recorded_at timestamptz not null default now(),
  -- De onde veio: onboarding, perfil, painel. Ajuda auditoria e disputa.
  source text not null default 'app',

  constraint consents_version_positive check (version > 0),
  constraint consents_source_known check (source in ('app', 'ops', 'crew', 'import'))
);

create index consents_lookup_idx on public.consents (user_id, purpose_key, recorded_at desc);

comment on table public.consents is
  'Append-only. Revogar grava granted=false; nunca apaga o registro anterior.';

-- Estado atual de consentimento, derivado do ultimo evento de cada finalidade.
create view public.current_consents
with (security_invoker = true)
as
select distinct on (c.user_id, c.purpose_key)
  c.user_id,
  c.purpose_key,
  c.granted,
  c.version,
  c.recorded_at
from public.consents c
order by c.user_id, c.purpose_key, c.recorded_at desc, c.id desc;

comment on view public.current_consents is
  'security_invoker: a view respeita a RLS de quem consulta, nao a do dono.';

-- -----------------------------------------------------------------------------
-- emergency_contacts (§9.2)
-- -----------------------------------------------------------------------------
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint emergency_contacts_name_length check (char_length(name) between 1 and 120),
  constraint emergency_contacts_phone_format check (phone ~ '^\+[1-9][0-9]{7,14}$')
);

-- Um contato principal por pessoa. Em emergencia, ambiguidade custa tempo.
create unique index emergency_contacts_one_primary_idx
  on public.emergency_contacts (user_id) where is_primary;

create index emergency_contacts_user_idx on public.emergency_contacts (user_id);

-- -----------------------------------------------------------------------------
-- devices e push_tokens (§19.1)
-- -----------------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  model text,
  app_version text,
  -- Biometria habilitada NESTE aparelho. A chave nunca sai do aparelho.
  biometric_enabled boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,

  constraint devices_platform_known check (platform in ('ios', 'android', 'web'))
);

create index devices_user_idx on public.devices (user_id) where revoked_at is null;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,

  constraint push_tokens_token_unique unique (token)
);

create index push_tokens_user_idx on public.push_tokens (user_id) where revoked_at is null;

-- -----------------------------------------------------------------------------
-- Preferencias (§9.4)
--
-- Divididas em duas tabelas de proposito:
--   • `customer_preferences` guarda o punhado de campos estruturados que o
--     app consulta em toda tela;
--   • `preference_items` guarda a cauda longa — snacks, tamanhos, artistas,
--     hobbies — que muda sem migration.
--
-- `is_sensitive` marca alergia, restricao e condicao de saude: sao dado de
-- saude da §23.1 e so aparecem para quem tem necessidade operacional.
-- -----------------------------------------------------------------------------
create table public.customer_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'pt-BR',
  communication_channel text not null default 'app',
  -- Opt-in, sempre. O padrao e nao aparecer (§9.3).
  ranking_opt_in boolean not null default false,
  image_authorization boolean not null default false,
  surprise_opt_in boolean not null default true,
  updated_at timestamptz not null default now(),

  constraint customer_preferences_locale_format check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint customer_preferences_channel_known check (
    communication_channel in ('app', 'whatsapp', 'email', 'sms')
  )
);

create table public.preference_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  is_sensitive boolean not null default false,
  updated_at timestamptz not null default now(),

  constraint preference_items_unique unique (user_id, key),
  constraint preference_items_key_format check (key ~ '^[a-z][a-z0-9_.]{2,63}$')
);

create index preference_items_user_idx on public.preference_items (user_id);
create index preference_items_sensitive_idx on public.preference_items (user_id) where is_sensitive;

comment on column public.preference_items.is_sensitive is
  'Alergia, restricao alimentar e condicao de saude. Acesso restrito (§23.1).';

-- updated_at automatico nas novas tabelas
create trigger emergency_contacts_touch_updated_at
  before update on public.emergency_contacts
  for each row execute function fly_private.touch_updated_at();

create trigger customer_preferences_touch_updated_at
  before update on public.customer_preferences
  for each row execute function fly_private.touch_updated_at();

create trigger preference_items_touch_updated_at
  before update on public.preference_items
  for each row execute function fly_private.touch_updated_at();

-- =============================================================================
-- Autorizacao
--
-- O principio da §18, literal: "o papel permite uma funcao; a atribuicao
-- limita a viagem; o consentimento limita o dado." As tres camadas viram
-- funcoes separadas para poderem ser combinadas sem virar um `using` ilegivel.
-- =============================================================================

-- Equipe com pelo menos uma atribuicao ativa.
--
-- Ate a Fase 4 criar `trips` e `trip_members`, esta e a checagem possivel — e
-- ja cumpre o criterio "guia sem atribuicao nao le cliente". Na Fase 4 ela se
-- estreita para a viagem especifica, sem mudar a forma das policies.
create or replace function fly_private.has_active_assignment()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_assignments sa
    where sa.user_id = (select auth.uid())
      and sa.revoked_at is null
  );
$$;

-- Papeis que enxergam a operacao inteira, sem depender de atribuicao.
create or replace function fly_private.is_global_operator()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin', 'trip_manager')
  );
$$;

-- Vinculo familiar com escopo. Vinculo nao e cheque em branco: quem quer ver
-- documento do dependente precisa do escopo 'documents'.
create or replace function fly_private.is_responsible_for(
  p_dependent uuid,
  p_scope text default null
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.companionships c
    where c.responsible_id = (select auth.uid())
      and c.dependent_id = p_dependent
      and c.revoked_at is null
      and (p_scope is null or p_scope = any (c.scopes))
  );
$$;

-- Consentimento vigente para uma finalidade.
create or replace function fly_private.has_consent(p_user uuid, p_purpose text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      select c.granted
      from public.consents c
      where c.user_id = p_user
        and c.purpose_key = p_purpose
      order by c.recorded_at desc, c.id desc
      limit 1
    ),
    false
  );
$$;

revoke all on function fly_private.has_active_assignment() from public, anon, authenticated;
revoke all on function fly_private.is_global_operator() from public, anon, authenticated;
revoke all on function fly_private.is_responsible_for(uuid, text) from public, anon, authenticated;
revoke all on function fly_private.has_consent(uuid, text) from public, anon, authenticated;

grant execute on function fly_private.has_active_assignment() to authenticated;
grant execute on function fly_private.is_global_operator() to authenticated;
grant execute on function fly_private.is_responsible_for(uuid, text) to authenticated;
grant execute on function fly_private.has_consent(uuid, text) to authenticated;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.invitations           enable row level security;
alter table public.staff_assignments     enable row level security;
alter table public.companionships        enable row level security;
alter table public.consent_purposes      enable row level security;
alter table public.consents              enable row level security;
alter table public.emergency_contacts    enable row level security;
alter table public.devices               enable row level security;
alter table public.push_tokens           enable row level security;
alter table public.customer_preferences  enable row level security;
alter table public.preference_items      enable row level security;

-- Append-only de verdade: nem o dono da tabela escapa.
alter table public.consents    force row level security;
alter table public.invitations force row level security;

-- profiles ---------------------------------------------------------------
-- A Fase 0 dava leitura a qualquer membro da equipe. Estreita agora: equipe
-- precisa de atribuicao ativa, e responsavel enxerga o dependente vinculado.
drop policy if exists profiles_select_staff on public.profiles;

create policy profiles_select_assigned_staff
  on public.profiles for select
  to authenticated
  using (fly_private.has_active_assignment() or fly_private.is_global_operator());

create policy profiles_select_dependent
  on public.profiles for select
  to authenticated
  using (fly_private.is_responsible_for(id));

-- invitations -------------------------------------------------------------
-- Cliente algum le convites: o token, mesmo em hash, e material de ataque.
-- A ativacao acontece em Edge Function com service_role, nunca por SELECT.
create policy invitations_select_operator
  on public.invitations for select
  to authenticated
  using (fly_private.is_global_operator());

-- staff_assignments -------------------------------------------------------
create policy staff_assignments_select_own
  on public.staff_assignments for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy staff_assignments_select_operator
  on public.staff_assignments for select
  to authenticated
  using (fly_private.is_global_operator());

-- Sem policy de escrita: atribuir e operacao de servidor, auditada.

-- companionships ----------------------------------------------------------
create policy companionships_select_own
  on public.companionships for select
  to authenticated
  using (
    (select auth.uid()) = responsible_id
    or (select auth.uid()) = dependent_id
  );

create policy companionships_select_operator
  on public.companionships for select
  to authenticated
  using (fly_private.is_global_operator());

-- Criar vinculo passa pelo servidor: envolve consentimento e, no caso de
-- menor, regra propria.

-- consent_purposes --------------------------------------------------------
-- O catalogo e legivel por qualquer autenticado: e o texto que a tela mostra.
create policy consent_purposes_select_authenticated
  on public.consent_purposes for select
  to authenticated
  using (true);

create policy consent_purposes_write_admin
  on public.consent_purposes for all
  to authenticated
  using (fly_private.has_role('admin'))
  with check (fly_private.has_role('admin'));

-- consents ----------------------------------------------------------------
create policy consents_select_own
  on public.consents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy consents_select_operator
  on public.consents for select
  to authenticated
  using (fly_private.is_global_operator());

-- O proprio usuario registra consentimento, mas so em nome proprio e sempre
-- como evento novo. Sem UPDATE e sem DELETE: a trilha e imutavel.
create policy consents_insert_own
  on public.consents for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- emergency_contacts ------------------------------------------------------
create policy emergency_contacts_all_own
  on public.emergency_contacts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Equipe atribuida le contato de emergencia — e para isso que ele existe.
create policy emergency_contacts_select_assigned
  on public.emergency_contacts for select
  to authenticated
  using (fly_private.has_active_assignment() or fly_private.is_global_operator());

-- devices e push_tokens ---------------------------------------------------
create policy devices_all_own
  on public.devices for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy push_tokens_all_own
  on public.push_tokens for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- customer_preferences ----------------------------------------------------
create policy customer_preferences_all_own
  on public.customer_preferences for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy customer_preferences_select_assigned
  on public.customer_preferences for select
  to authenticated
  using (fly_private.has_active_assignment() or fly_private.is_global_operator());

-- preference_items --------------------------------------------------------
create policy preference_items_all_own
  on public.preference_items for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Equipe le preferencia comum. Preferencia SENSIVEL — alergia, restricao,
-- condicao de saude — exige consentimento vigente do proprio cliente para a
-- finalidade `health_data`. Sem consentimento, a linha some para a equipe,
-- ainda que ela esteja atribuida.
create policy preference_items_select_assigned
  on public.preference_items for select
  to authenticated
  using (
    (fly_private.has_active_assignment() or fly_private.is_global_operator())
    and (
      not is_sensitive
      or fly_private.has_consent(user_id, 'health_data')
    )
  );

-- Responsavel enxerga preferencia do dependente quando o escopo permite.
create policy preference_items_select_dependent
  on public.preference_items for select
  to authenticated
  using (
    fly_private.is_responsible_for(user_id, 'meals')
    and (not is_sensitive or fly_private.is_responsible_for(user_id, 'health'))
  );

-- =============================================================================
-- Privilegios explicitos
-- =============================================================================

grant select on public.invitations to authenticated;
grant select on public.staff_assignments to authenticated;
grant select on public.companionships to authenticated;
grant select on public.consent_purposes to authenticated;
grant insert, update, delete on public.consent_purposes to authenticated;
grant select, insert on public.consents to authenticated;
grant select, insert, update, delete on public.emergency_contacts to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert, update, delete on public.customer_preferences to authenticated;
grant select, insert, update, delete on public.preference_items to authenticated;
grant select on public.current_consents to authenticated;

-- O cliente pode editar mais campos do proprio perfil agora.
grant update (preferred_name, locale, phone, avatar_path, birth_date) on public.profiles to authenticated;

-- anon continua sem nada.
