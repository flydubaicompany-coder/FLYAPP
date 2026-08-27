-- =============================================================================
-- 20260824000000 — Fundação
--
-- Escopo deliberadamente estreito (spec §35.9: "sem criar ainda todos os
-- domínios"). Aqui entra apenas a espinha de sistema que o resto do produto
-- vai apoiar: identidade mínima, papéis, configuração, flags, auditoria e
-- idempotência.
--
-- O modelo completo da §19 — viagens, roteiro, passeios, carteira, álbum —
-- é das fases seguintes, uma migration por domínio. NÃO acrescente tabelas
-- aqui.
--
-- Regras aplicadas (spec §19.15 e §21.4):
--   • nomes em snake_case;
--   • horários em timestamptz;
--   • RLS em toda tabela exposta;
--   • RLS e GRANTs são controles diferentes — os dois são configurados;
--   • funções privilegiadas ficam fora de schema exposto;
--   • papel NUNCA vive em metadado editável pelo usuário;
--   • ledgers e trilhas são append-only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema privado. Não é exposto pela API: guarda as funções security definer.
-- -----------------------------------------------------------------------------
create schema if not exists fly_private;

revoke all on schema fly_private from public;
revoke all on schema fly_private from anon, authenticated;

comment on schema fly_private is
  'Funcoes privilegiadas. Fora do schema exposto por decisao de seguranca (spec §21.4).';

-- -----------------------------------------------------------------------------
-- Papéis (spec §18). Espelha FLY_ROLES em packages/domain-types/src/roles.ts —
-- os dois precisam ser alterados juntos.
-- -----------------------------------------------------------------------------
create type public.fly_role as enum (
  'customer',
  'family_lead',
  'creator',
  'guide',
  'base',
  'media',
  'experience',
  'support',
  'finance',
  'trip_manager',
  'admin'
);

-- -----------------------------------------------------------------------------
-- profiles — identidade mínima. O Fly ID completo é entrega da Fase 2.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 120),
  constraint profiles_locale_format
    check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

comment on table public.profiles is
  'Perfil minimo da Fase 0. Preferencias, documentos e consentimentos chegam na Fase 2.';

-- -----------------------------------------------------------------------------
-- user_roles — a fonte de verdade de autorização.
--
-- Deliberadamente NÃO fica em auth.users.raw_user_meta_data: aquele campo é
-- editável pelo próprio usuário, o que transformaria autorização em sugestão.
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.fly_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,

  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

comment on table public.user_roles is
  'Papeis por usuario. Nenhum cliente escreve aqui — so o servidor, com auditoria.';

-- -----------------------------------------------------------------------------
-- app_config — textos, horários, contatos e parâmetros administráveis.
--
-- Existe para cumprir a regra da §3.8: "Tudo importante vem do painel."
-- `is_public` separa o que o app cliente pode ler do que é só de operação.
-- -----------------------------------------------------------------------------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint app_config_key_format check (key ~ '^[a-z][a-z0-9_.]{2,99}$')
);

create index app_config_public_idx on public.app_config (key) where is_public;

comment on column public.app_config.is_public is
  'true = o app cliente pode ler. Deixe false por padrao; abra caso a caso.';

-- -----------------------------------------------------------------------------
-- feature_flags — toda função regulada nasce atrás de flag (spec §8.6).
-- -----------------------------------------------------------------------------
create table public.feature_flags (
  key text primary key,
  is_enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint feature_flags_key_format check (key ~ '^[a-z][a-z0-9_.]{2,99}$')
);

-- -----------------------------------------------------------------------------
-- audit_logs — append-only. Sem update, sem delete, nem para admin.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.fly_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  -- Metadados de contexto. NUNCA grave PII aqui (spec §23.2: logs sem
  -- conteudo sensivel). O logger da aplicacao ja redige; o banco confia
  -- mas nao verifica — a revisao de codigo verifica.
  metadata jsonb not null default '{}'::jsonb,

  constraint audit_logs_action_format check (char_length(action) between 1 and 120)
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);

comment on table public.audit_logs is
  'Trilha append-only. A ausencia de policy de update/delete e proposital.';

-- -----------------------------------------------------------------------------
-- idempotency_keys — pagamentos, QR, pontos e webhooks são idempotentes
-- (spec §34, regras técnicas). A infraestrutura nasce aqui; o uso, nas fases
-- que tiverem esses fluxos.
-- -----------------------------------------------------------------------------
create table public.idempotency_keys (
  key text primary key,
  scope text not null,
  request_fingerprint text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint idempotency_keys_expires_after_creation check (expires_at > created_at)
);

create index idempotency_keys_expires_idx on public.idempotency_keys (expires_at);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function fly_private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function fly_private.touch_updated_at();

create trigger app_config_touch_updated_at
  before update on public.app_config
  for each row execute function fly_private.touch_updated_at();

create trigger feature_flags_touch_updated_at
  before update on public.feature_flags
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers de autorização.
--
-- security definer com search_path fixado em '' — sem isso, um schema no
-- caminho de busca do chamador poderia sequestrar a resolução de nomes.
-- -----------------------------------------------------------------------------
create or replace function fly_private.has_role(p_role public.fly_role)
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
      and ur.role = p_role
  );
$$;

create or replace function fly_private.is_staff()
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
      and ur.role in (
        'guide', 'base', 'media', 'experience',
        'support', 'finance', 'trip_manager', 'admin'
      )
  );
$$;

revoke all on function fly_private.has_role(public.fly_role) from public, anon, authenticated;
revoke all on function fly_private.is_staff() from public, anon, authenticated;

-- As policies executam como o dono da tabela, então precisam do EXECUTE.
grant execute on function fly_private.has_role(public.fly_role) to authenticated;
grant execute on function fly_private.is_staff() to authenticated;

-- -----------------------------------------------------------------------------
-- Perfil criado junto com a conta.
-- -----------------------------------------------------------------------------
create or replace function fly_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function fly_private.handle_new_user();

-- =============================================================================
-- RLS
--
-- Ligada em todas as tabelas. Onde não há policy, o acesso é negado — e essa
-- ausência é a decisão, não um esquecimento.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.user_roles        enable row level security;
alter table public.app_config        enable row level security;
alter table public.feature_flags     enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.idempotency_keys  enable row level security;

-- Também força a RLS para o dono das tabelas, de modo que nem o owner
-- escape das policies por acidente.
alter table public.audit_logs        force row level security;
alter table public.idempotency_keys  force row level security;

-- profiles ---------------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using (fly_private.is_staff());

-- UPDATE precisa de USING (o que pode ler para atualizar) e de WITH CHECK
-- (o que pode gravar). Só USING deixaria o usuário reescrever a linha para
-- outro dono.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sem policy de INSERT: perfil nasce pelo trigger, não pelo cliente.
-- Sem policy de DELETE: conta é removida via auth, com cascata.

-- user_roles -------------------------------------------------------------
create policy user_roles_select_own
  on public.user_roles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_roles_select_admin
  on public.user_roles for select
  to authenticated
  using (fly_private.has_role('admin'));

-- Sem policy de INSERT/UPDATE/DELETE por design: conceder papel é operação
-- de servidor, auditada. Um cliente não promove a si mesmo.

-- app_config -------------------------------------------------------------
create policy app_config_select_public
  on public.app_config for select
  to authenticated
  using (is_public);

create policy app_config_select_staff
  on public.app_config for select
  to authenticated
  using (fly_private.is_staff());

create policy app_config_write_admin
  on public.app_config for all
  to authenticated
  using (fly_private.has_role('admin'))
  with check (fly_private.has_role('admin'));

-- feature_flags ----------------------------------------------------------
create policy feature_flags_select_authenticated
  on public.feature_flags for select
  to authenticated
  using (true);

create policy feature_flags_write_admin
  on public.feature_flags for all
  to authenticated
  using (fly_private.has_role('admin'))
  with check (fly_private.has_role('admin'));

-- audit_logs -------------------------------------------------------------
create policy audit_logs_select_admin
  on public.audit_logs for select
  to authenticated
  using (fly_private.has_role('admin'));

-- Sem INSERT/UPDATE/DELETE para cliente algum. Escrita é do servidor.
-- A ausencia de UPDATE e DELETE e o que torna a trilha append-only.

-- idempotency_keys -------------------------------------------------------
-- Nenhuma policy: tabela de uso exclusivo do servidor.

-- =============================================================================
-- Privilégios explícitos.
--
-- RLS e GRANT são controles independentes (spec §21.4). Uma tabela com RLS
-- ligada e GRANT aberto ainda depende inteiramente das policies; preferimos
-- fechar os dois.
-- =============================================================================

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

grant select on public.user_roles to authenticated;

grant select on public.app_config to authenticated;
grant insert, update, delete on public.app_config to authenticated;

grant select on public.feature_flags to authenticated;
grant insert, update, delete on public.feature_flags to authenticated;

grant select on public.audit_logs to authenticated;

-- idempotency_keys: nenhum grant. Nem anon, nem authenticated.

-- anon não acessa nada nesta fase. Conteúdo público, quando existir, será
-- liberado tabela a tabela com decisão registrada.
