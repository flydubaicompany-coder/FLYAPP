-- =============================================================================
-- Passaporte digitado, não escaneado (§7.5, §7.7 e §9)
--
-- Correção de rumo. Eu tinha tratado o passaporte como **arquivo**: foto do
-- documento oficial no cofre, biometria para abrir, OCR para extrair os
-- campos. O produto é outro: a pessoa **digita** os dados. Não há captura do
-- documento oficial, e por isso não há OCR — o que também dispensa a pendência
-- do fornecedor (P33) e resolve, por eliminação, a proibição da §7.7 de mandar
-- passaporte a modelo genérico de IA.
--
-- Tabela própria, e não colunas em `profiles`, por três razões:
--
-- 1. A RLS de `profiles` é larga: toda equipe com atribuição ativa lê perfil.
--    Número de passaporte não pode herdar essa largura.
-- 2. Passaporte duplo é comum neste público. Coluna única forçaria escolher um.
-- 3. Dado de documento tem ciclo próprio — vence, é substituído, é conferido
--    pela Fly. Isso é linha, não coluna.
-- =============================================================================

create table public.passports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Como está impresso no documento, que nem sempre é como a pessoa se chama.
  -- É este nome que vai na passagem, e divergência aqui é embarque negado.
  full_name text not null,
  number text not null,
  -- ISO 3166-1 alpha-3. País que emitiu, que pode não ser o da nacionalidade.
  issuing_country text not null,
  nationality text,
  birth_date date,
  issued_on date,
  expires_on date not null,

  /**
   * Conferido pela Fly.
   *
   * Dado digitado erra: um dígito trocado no número vira passagem emitida com
   * documento inválido. `verified_at` distingue "a pessoa preencheu" de "a
   * operação conferiu", e só o segundo serve para emitir.
   */
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- O mesmo documento não entra duas vezes.
  constraint passports_unique_per_user unique (user_id, issuing_country, number),
  constraint passports_country_format check (issuing_country ~ '^[A-Z]{3}$'),
  constraint passports_nationality_format
    check (nationality is null or nationality ~ '^[A-Z]{3}$'),
  constraint passports_expires_after_issue
    check (issued_on is null or expires_on > issued_on),
  -- Número em branco ou com espaços é o erro de digitação mais comum.
  constraint passports_number_not_blank check (length(trim(number)) >= 5)
);

create index passports_user_idx on public.passports (user_id, expires_on);
create index passports_verified_by_idx on public.passports (verified_by);

create trigger passports_touch before update on public.passports
  for each row execute function fly_private.touch_updated_at();

/**
 * Normaliza o número antes de gravar.
 *
 * Gente digita "AB 123 456" e "ab123456" para o mesmo passaporte. Sem
 * normalizar, a constraint de unicidade não pega a duplicata e a Fly acaba
 * com dois registros do mesmo documento.
 */
create or replace function fly_private.normalize_passport()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.number := upper(regexp_replace(new.number, '[^A-Za-z0-9]', '', 'g'));
  new.issuing_country := upper(new.issuing_country);
  new.nationality := upper(new.nationality);

  -- Qualquer edição de dado invalida a conferência anterior. Se não
  -- invalidasse, bastaria corrigir um dígito depois de conferido para a Fly
  -- emitir passagem com número que ninguém olhou.
  if tg_op = 'UPDATE' and (
       new.number is distinct from old.number
    or new.full_name is distinct from old.full_name
    or new.issuing_country is distinct from old.issuing_country
    or new.expires_on is distinct from old.expires_on
    or new.birth_date is distinct from old.birth_date
  ) then
    new.verified_at := null;
    new.verified_by := null;
  end if;

  return new;
end;
$$;

create trigger passports_normalize before insert or update on public.passports
  for each row execute function fly_private.normalize_passport();

-- -----------------------------------------------------------------------------
-- Consentimento
--
-- A Fly precisa do número para emitir passagem. Isso é tratamento de dado
-- pessoal com finalidade específica, e a finalidade fica explícita — mesmo
-- padrão de `health_data` e `product_analytics`. O texto jurídico é do dono do
-- produto (§33); aqui fica a estrutura.
-- -----------------------------------------------------------------------------
insert into public.consent_purposes (key, label, description, is_required, is_sensitive)
values (
  'travel_documents',
  'Documentos de viagem',
  'Permite à equipe Fly usar os dados do seu passaporte para emitir passagens, reservas e autorizações da sua viagem.',
  false,
  true
)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.passports enable row level security;

/**
 * Quem lê.
 *
 * O dono, sempre. O responsável por um dependente, sempre — é ele quem embarca
 * o menor. A equipe atribuída à viagem, **só com consentimento vigente**: sem
 * o `travel_documents`, a linha some, do mesmo jeito que dado de saúde some
 * sem `health_data`.
 *
 * Não há cláusula de operador global sem consentimento. Precisar do número
 * para trabalhar não é o mesmo que ter direito a ele por padrão.
 */
create policy passports_select on public.passports for select to authenticated
  using (
    (select auth.uid()) = public.passports.user_id
    or fly_private.is_responsible_for(public.passports.user_id)
    or (
      (fly_private.has_active_assignment() or fly_private.is_global_operator())
      and fly_private.has_consent(public.passports.user_id, 'travel_documents')
    )
  );

-- Só o dono escreve os próprios dados. Nem a equipe digita passaporte de
-- cliente: se digitasse, o erro de digitação viraria responsabilidade de quem
-- não tem o documento na mão.
create policy passports_insert_own on public.passports for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    or fly_private.is_responsible_for(user_id)
  );

create policy passports_update_own on public.passports for update to authenticated
  using (
    (select auth.uid()) = public.passports.user_id
    or fly_private.is_responsible_for(public.passports.user_id)
  )
  with check (
    (select auth.uid()) = user_id
    or fly_private.is_responsible_for(user_id)
  );

create policy passports_delete_own on public.passports for delete to authenticated
  using (
    (select auth.uid()) = public.passports.user_id
    or fly_private.is_responsible_for(public.passports.user_id)
  );

grant select, insert, update, delete on public.passports to authenticated;

/**
 * Conferir o passaporte é da operação — e é a **única** coisa que ela escreve.
 *
 * Não há política de UPDATE para a equipe, de propósito. Uma política de
 * UPDATE libera a linha inteira: o operador poderia mudar o número enquanto
 * "confere", e o GRANT por coluna não ajudaria, porque dono e operação são o
 * mesmo papel do Postgres (`authenticated`) — a união dos grants daria tudo a
 * ambos.
 *
 * A separação, então, é esta função: ela toca duas colunas e mais nenhuma.
 */
create or replace function public.conferir_passaporte(p_id uuid, p_confere boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_dono uuid;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select user_id into v_dono from public.passports where id = p_id;
  if v_dono is null then
    raise exception 'passaporte nao encontrado' using errcode = '22023';
  end if;

  -- Sem consentimento, a operação não viu o dado — e não pode atestar o que
  -- não viu.
  if not fly_private.has_consent(v_dono, 'travel_documents') then
    raise exception 'sem consentimento para documentos de viagem' using errcode = '42501';
  end if;

  update public.passports
  set verified_at = case when p_confere then now() end,
      verified_by = case when p_confere then v_user end
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user,
    case when p_confere then 'passport.verified' else 'passport.unverified' end,
    'passports',
    p_id::text,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.conferir_passaporte(uuid, boolean) from public, anon;
grant execute on function public.conferir_passaporte(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Validade mínima antes da viagem
--
-- A regra dos seis meses é comum, mas varia por destino e por nacionalidade —
-- e a §33 proíbe inventar regra que a Fly vai afirmar ao cliente. Fica em
-- configuração, marcada como pendente. Enquanto for `PENDENTE`, o app mostra a
-- data de validade e só alerta pelo que é aritmética, não política: passaporte
-- que vence **antes do fim da viagem**.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public)
values (
  'documents.passport_min_validity_months',
  '"PENDENTE"'::jsonb,
  'Meses de validade exigidos alem do fim da viagem. Varia por destino e nacionalidade — decisao do dono do produto (§33).',
  true
)
on conflict (key) do nothing;

/**
 * O passaporte que vale para uma viagem, com o alerta já resolvido.
 *
 * A conta de "vence antes do fim da viagem" fica no servidor pela mesma razão
 * de sempre: depende da data da viagem, e um celular com data errada daria
 * outro resultado.
 */
create or replace function public.passaporte_para_viagem(p_trip uuid)
returns table (
  id uuid,
  full_name text,
  number text,
  issuing_country text,
  expires_on date,
  verified_at timestamptz,
  vence_antes_do_fim boolean,
  dias_de_folga int
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    p.id, p.full_name, p.number, p.issuing_country, p.expires_on, p.verified_at,
    p.expires_on <= t.ends_on,
    (p.expires_on - t.ends_on)::int
  from public.passports p
  cross join (select ends_on from public.trips where id = p_trip) t
  where p.user_id = (select auth.uid())
  order by p.expires_on desc
  limit 1;
$$;

revoke all on function public.passaporte_para_viagem(uuid) from public, anon;
grant execute on function public.passaporte_para_viagem(uuid) to authenticated;
