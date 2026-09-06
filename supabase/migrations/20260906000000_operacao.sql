-- =============================================================================
-- Fase 11 — a operação para de precisar de SQL (§46, entregas 5, 10 e 11)
--
-- A auditoria de paridade (`docs/quality/PARIDADE.md`) achou quatro coisas que
-- só existiam por dentro do banco:
--
--   • dar e tirar papel da equipe;
--   • atribuir alguém a uma viagem;
--   • mudar `app_config` e `feature_flags`;
--   • mandar um aviso para o cliente — `notifications` só tinha GRANT de
--     leitura, e o app tem uma caixa de avisos que ninguém conseguia encher.
--
-- O critério da §46 é literal: "nenhuma mudança comum exige editar código".
-- Hoje três delas exigem abrir o banco, que é pior.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. A trilha, num lugar só
--
-- `audit_logs` existe desde a Fase 0 e catorze funções escrevem nela à mão.
-- Nenhuma preenche `actor_role`, porque descobrir o papel de quem age dá três
-- linhas e ninguém as escreveu duas vezes.
--
-- O papel gravado é o **maior** de quem agiu. A ordem do enum `fly_role` foi
-- declarada do menor para o maior privilégio (`customer` … `admin`), então
-- `max(role)` é exatamente isso — e essa é a razão de a ordem do enum não ser
-- alfabética. Quem acrescentar papel novo no meio precisa saber disso.
-- -----------------------------------------------------------------------------
create or replace function fly_private.papel_maior(p_user uuid)
returns public.fly_role
language sql
security definer
stable
set search_path = ''
as $$
  select max(ur.role) from public.user_roles ur where ur.user_id = p_user;
$$;

create or replace function fly_private.registrar(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    fly_private.papel_maior((select auth.uid())),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

comment on function fly_private.registrar(text, text, text, jsonb) is
  'Trilha padrao. NUNCA passe PII em p_metadata (§23.2) — id e status, nao nome nem documento.';

revoke all on function fly_private.papel_maior(uuid) from public, anon, authenticated;
revoke all on function fly_private.registrar(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function fly_private.papel_maior(uuid) to authenticated;
grant execute on function fly_private.registrar(text, text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Papéis da equipe (§46, entrega 5)
--
-- `user_roles` continua sem policy de escrita: o comentário da Fase 0 —
-- "nenhum cliente escreve aqui, só o servidor, com auditoria" — vira verdade
-- agora que existe o servidor. As duas funções abaixo são a única porta.
-- -----------------------------------------------------------------------------

/** Papéis que esta porta administra. `customer` não é um deles. */
create or replace function fly_private.papel_de_equipe(p_role public.fly_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in (
    'creator', 'guide', 'base', 'media', 'experience', 'support', 'finance',
    'trip_manager', 'admin'
  );
$$;

create or replace function public.conceder_papel(p_user uuid, p_role public.fly_role)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not fly_private.has_role('admin') then
    raise exception 'conceder papel exige admin' using errcode = '42501';
  end if;

  /**
   * `customer` e `family_lead` vêm do convite aceito, e não daqui.
   *
   * Quem aceita convite recebe o papel que o convite carregava — é a
   * Edge Function `aceitar-convite`, com `service_role`. Deixar o painel
   * conceder `customer` criaria um segundo caminho para virar cliente, sem
   * convite e sem consentimento registrado.
   */
  if not fly_private.papel_de_equipe(p_role) then
    return query select false, 'Este papel vem do convite aceito, não do painel.'::text;
    return;
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user) then
    return query select false, 'Não existe perfil para esta pessoa.'::text;
    return;
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user, p_role, (select auth.uid()))
  on conflict (user_id, role) do nothing;

  if not found then
    return query select true, 'Já tinha esse papel.'::text;
    return;
  end if;

  perform fly_private.registrar(
    'papel.concedido', 'user_roles', p_user::text,
    jsonb_build_object('role', p_role)
  );

  return query select true, null::text;
end;
$$;

create or replace function public.revogar_papel(p_user uuid, p_role public.fly_role)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admins int;
begin
  if not fly_private.has_role('admin') then
    raise exception 'revogar papel exige admin' using errcode = '42501';
  end if;

  if not fly_private.papel_de_equipe(p_role) then
    return query select false, 'Este papel não é administrado por aqui.'::text;
    return;
  end if;

  /**
   * O último admin não sai.
   *
   * Sem esta trava, uma pessoa cansada às onze da noite tira o próprio papel
   * e ninguém mais consegue conceder papel nenhum — inclusive de volta. A
   * saída seria abrir o banco, que é justamente o que esta migration existe
   * para não precisar. A trava conta admins, e não "é você mesmo": tirar o
   * próprio admin havendo outro é legítimo.
   */
  if p_role = 'admin' then
    select count(*) into v_admins from public.user_roles ur where ur.role = 'admin';
    if v_admins <= 1 then
      return query select false,
        'Este é o último admin. Conceda o papel a outra pessoa antes de tirar este.'::text;
      return;
    end if;
  end if;

  delete from public.user_roles ur where ur.user_id = p_user and ur.role = p_role;
  if not found then
    return query select false, 'Essa pessoa não tinha esse papel.'::text;
    return;
  end if;

  perform fly_private.registrar(
    'papel.revogado', 'user_roles', p_user::text,
    jsonb_build_object('role', p_role)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Atribuição a viagem (§46, entrega 5)
--
-- Papel diz o que a pessoa faz; atribuição diz **onde**. Um guia sem
-- atribuição não enxerga viagem nenhuma — é assim que a RLS de `trips` foi
-- escrita desde a Fase 2, e foi o bug corrigido na auditoria das Fases 0-3.
-- -----------------------------------------------------------------------------
create or replace function public.atribuir_a_viagem(
  p_user uuid,
  p_trip uuid,
  p_role public.fly_role
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not fly_private.is_global_operator() then
    raise exception 'atribuir exige admin ou trip_manager' using errcode = '42501';
  end if;

  if not fly_private.papel_de_equipe(p_role) then
    return query select false, 'Atribuição é de papel de equipe.'::text;
    return;
  end if;

  -- A atribuição não confere o papel: são controles diferentes, e uma
  -- atribuição sem papel deixaria a pessoa dentro da viagem sem poder fazer
  -- nada — confuso de operar e difícil de auditar.
  if not exists (
    select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = p_role
  ) then
    return query select false, 'Conceda o papel antes de atribuir à viagem.'::text;
    return;
  end if;

  if not exists (select 1 from public.trips t where t.id = p_trip) then
    return query select false, 'Viagem não encontrada.'::text;
    return;
  end if;

  -- Reatribuir alguém revogado é o caso comum: o mesmo guia, na viagem
  -- seguinte, com o mesmo papel. `unique (user_id, trip_id, role)` faria isso
  -- falhar; o upsert reabre a linha e mantém uma linha por trio.
  insert into public.staff_assignments (user_id, trip_id, role, assigned_by)
  values (p_user, p_trip, p_role, (select auth.uid()))
  on conflict (user_id, trip_id, role)
    do update set revoked_at = null, assigned_at = now(), assigned_by = (select auth.uid())
  returning id into v_id;

  perform fly_private.registrar(
    'atribuicao.criada', 'staff_assignments', v_id::text,
    jsonb_build_object('user', p_user, 'trip', p_trip, 'role', p_role)
  );

  return query select true, null::text;
end;
$$;

create or replace function public.revogar_atribuicao(p_assignment uuid)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.staff_assignments;
begin
  if not fly_private.is_global_operator() then
    raise exception 'revogar atribuicao exige admin ou trip_manager' using errcode = '42501';
  end if;

  select * into v_linha from public.staff_assignments sa where sa.id = p_assignment;
  if not found then
    return query select false, 'Atribuição não encontrada.'::text;
    return;
  end if;

  if v_linha.revoked_at is not null then
    return query select true, 'Já estava revogada.'::text;
    return;
  end if;

  update public.staff_assignments sa set revoked_at = now() where sa.id = p_assignment;

  perform fly_private.registrar(
    'atribuicao.revogada', 'staff_assignments', p_assignment::text,
    jsonb_build_object('user', v_linha.user_id, 'trip', v_linha.trip_id, 'role', v_linha.role)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Configuração e flags (§46, entrega 10)
--
-- As policies de escrita de `app_config` e `feature_flags` saem. Não porque
-- estivessem largas — eram `admin` — mas porque escrita por policy é escrita
-- **sem trilha**: o admin muda `support.sla_minutes` e não fica registro de
-- quem, quando, nem de qual era o valor antes. Config é o painel de controle
-- do produto inteiro; a pergunta "quem mudou isso?" precisa ter resposta.
--
-- A partir daqui a única porta é RPC, e a RPC grava o valor anterior.
-- -----------------------------------------------------------------------------
drop policy if exists app_config_insert_admin on public.app_config;
drop policy if exists app_config_update_admin on public.app_config;
drop policy if exists app_config_delete_admin on public.app_config;
drop policy if exists feature_flags_insert_admin on public.feature_flags;
drop policy if exists feature_flags_update_admin on public.feature_flags;
drop policy if exists feature_flags_delete_admin on public.feature_flags;

revoke insert, update, delete on public.app_config from authenticated;
revoke insert, update, delete on public.feature_flags from authenticated;

create or replace function public.definir_config(
  p_key text,
  p_value jsonb,
  p_description text default null,
  p_is_public boolean default null
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_existia boolean;
begin
  if not fly_private.has_role('admin') then
    raise exception 'mudar configuracao exige admin' using errcode = '42501';
  end if;

  if p_key is null or p_key !~ '^[a-z][a-z0-9_.]{2,99}$' then
    return query select false, 'Chave fora do formato (minúsculas, ponto e sublinhado).'::text;
    return;
  end if;

  if p_value is null then
    return query select false, 'Valor é obrigatório. Para remover, apague a chave.'::text;
    return;
  end if;

  select c.value, true into v_antes, v_existia
  from public.app_config c where c.key = p_key;

  insert into public.app_config (key, value, description, is_public, updated_by)
  values (p_key, p_value, p_description, coalesce(p_is_public, false), (select auth.uid()))
  on conflict (key) do update set
    value = excluded.value,
    description = coalesce(p_description, app_config.description),
    is_public = coalesce(p_is_public, app_config.is_public),
    updated_by = (select auth.uid()),
    updated_at = now();

  /**
   * O valor entra na trilha, e é o único lugar do projeto onde conteúdo entra.
   *
   * `app_config` guarda parâmetro de operação — prazo, horário, teto, texto de
   * aviso. Não guarda dado de cliente. Se algum dia guardar, esta linha vira
   * vazamento, e é por isso que ela está comentada e não só escrita.
   */
  perform fly_private.registrar(
    case when v_existia then 'config.alterada' else 'config.criada' end,
    'app_config', p_key,
    jsonb_build_object('antes', v_antes, 'depois', p_value)
  );

  return query select true, null::text;
end;
$$;

create or replace function public.definir_flag(
  p_key text,
  p_enabled boolean,
  p_description text default null
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes boolean;
begin
  if not fly_private.has_role('admin') then
    raise exception 'mudar flag exige admin' using errcode = '42501';
  end if;

  if p_key is null or p_key !~ '^[a-z][a-z0-9_.]{2,99}$' then
    return query select false, 'Chave fora do formato.'::text;
    return;
  end if;

  select f.is_enabled into v_antes from public.feature_flags f where f.key = p_key;

  insert into public.feature_flags (key, is_enabled, description, updated_by)
  values (p_key, coalesce(p_enabled, false), p_description, (select auth.uid()))
  on conflict (key) do update set
    is_enabled = excluded.is_enabled,
    description = coalesce(p_description, feature_flags.description),
    updated_by = (select auth.uid()),
    updated_at = now();

  perform fly_private.registrar(
    'flag.alterada', 'feature_flags', p_key,
    jsonb_build_object('antes', v_antes, 'depois', coalesce(p_enabled, false))
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Flag por viagem (§46, entrega 10)
--
-- "Por ambiente" já está resolvido e não vira coluna: ambiente é **projeto do
-- Supabase separado**, e a linha da flag naquele banco é o valor daquele
-- ambiente. Uma coluna `environment` aqui seria a produção guardando a
-- configuração da homologação, e a primeira consulta que esquecesse o filtro
-- leria a flag errada.
--
-- "Por viagem" precisa existir de verdade: um piloto liga uma função para uma
-- viagem antes de ligar para todas.
-- -----------------------------------------------------------------------------
create table public.trip_feature_flags (
  trip_id uuid not null references public.trips (id) on delete cascade,
  key text not null references public.feature_flags (key) on delete cascade,
  is_enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  primary key (trip_id, key)
);

comment on table public.trip_feature_flags is
  'Sobreposicao por viagem. Ausencia de linha = vale a flag global, e nao "desligado".';

create index trip_feature_flags_key_idx on public.trip_feature_flags (key);

/**
 * O valor que vale para uma viagem: a sobreposição, se houver; senão a global;
 * senão desligado.
 *
 * `security invoker`: a RLS de `feature_flags` já libera leitura para
 * `authenticated`, e a de `trip_feature_flags` (abaixo) faz o mesmo. Não há
 * nada aqui que precise contornar RLS, e DEFINER sem necessidade só amplia
 * superfície — foi a correção 1 da auditoria das Fases 0-3.
 */
create or replace function public.flag_da_viagem(p_key text, p_trip uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce(
    (select tf.is_enabled from public.trip_feature_flags tf
      where tf.trip_id = p_trip and tf.key = p_key),
    (select f.is_enabled from public.feature_flags f where f.key = p_key),
    false
  );
$$;

create or replace function public.definir_flag_da_viagem(
  p_trip uuid,
  p_key text,
  p_enabled boolean
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sobrepor flag numa viagem é operação de viagem, não de plataforma: quem
  -- responde pela viagem decide. Criar a flag continua sendo do admin.
  if not fly_private.is_global_operator() then
    raise exception 'flag por viagem exige admin ou trip_manager' using errcode = '42501';
  end if;

  if not exists (select 1 from public.feature_flags f where f.key = p_key) then
    return query select false, 'Essa flag não existe. Crie a flag global antes.'::text;
    return;
  end if;

  if p_enabled is null then
    delete from public.trip_feature_flags tf where tf.trip_id = p_trip and tf.key = p_key;
    perform fly_private.registrar(
      'flag_viagem.removida', 'trip_feature_flags', p_key,
      jsonb_build_object('trip', p_trip)
    );
    return query select true, null::text;
    return;
  end if;

  insert into public.trip_feature_flags (trip_id, key, is_enabled, updated_by)
  values (p_trip, p_key, p_enabled, (select auth.uid()))
  on conflict (trip_id, key) do update set
    is_enabled = excluded.is_enabled,
    updated_by = (select auth.uid()),
    updated_at = now();

  perform fly_private.registrar(
    'flag_viagem.alterada', 'trip_feature_flags', p_key,
    jsonb_build_object('trip', p_trip, 'depois', p_enabled)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Avisos (lacuna 2 da auditoria de paridade)
--
-- O aviso é **por viagem**. Não existe botão de mandar para todo mundo, e a
-- ausência é deliberada: um broadcast global é a ação de mais alcance do
-- produto inteiro, e não há nenhum fluxo do cliente que precise dele. Quando
-- precisar, entra com aprovação de duas pessoas — não como parâmetro nulo
-- deste RPC.
-- -----------------------------------------------------------------------------
create or replace function public.enviar_aviso(
  p_trip uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_deep_link text default null,
  p_users uuid[] default null,
  p_expires_at timestamptz default null,
  p_dedupe text default null
)
returns table (ok boolean, enviados int, silenciados int, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_critica boolean;
  v_alvo uuid[];
  v_permitidos uuid[];
  v_enviados int := 0;
  v_silenciados int := 0;
begin
  if not (fly_private.is_global_operator() or fly_private.has_role('support')) then
    raise exception 'enviar aviso exige admin, trip_manager ou support' using errcode = '42501';
  end if;

  if not fly_private.can_operate_trip(p_trip) then
    return query select false, 0, 0, 'Você não opera esta viagem.'::text;
    return;
  end if;

  select nc.is_critical into v_critica
  from public.notification_categories nc where nc.key = p_category;
  if not found then
    return query select false, 0, 0, 'Categoria de aviso desconhecida.'::text;
    return;
  end if;

  if p_title is null or btrim(p_title) = '' then
    return query select false, 0, 0, 'O aviso precisa de título.'::text;
    return;
  end if;

  -- A audiência é sempre a lista de participantes da viagem. `p_users` só
  -- **restringe** — nunca acrescenta alguém de fora.
  select array_agg(tm.user_id) into v_alvo
  from public.trip_members tm
  where tm.trip_id = p_trip
    and (p_users is null or tm.user_id = any (p_users));

  if v_alvo is null then
    return query select false, 0, 0, 'Ninguém nessa viagem corresponde à seleção.'::text;
    return;
  end if;

  /**
   * A preferência do cliente vale, menos para categoria crítica.
   *
   * A §26 é literal: "marketing nunca pode silenciar alertas operacionais
   * críticos". O outro lado da mesma frase é que o resto **pode** ser
   * silenciado — e o painel precisa dizer quantas pessoas não receberam, ou o
   * operador acha que avisou todo mundo.
   */
  select array_agg(a.user_id) into v_permitidos
  from unnest(v_alvo) as a(user_id)
  where v_critica or coalesce(
    (select np.is_enabled from public.notification_preferences np
      where np.user_id = a.user_id and np.category_key = p_category),
    true
  );

  v_silenciados := coalesce(array_length(v_alvo, 1), 0)
                 - coalesce(array_length(v_permitidos, 1), 0);

  if v_permitidos is null then
    perform fly_private.registrar(
      'aviso.enviado', 'notifications', p_trip::text,
      jsonb_build_object('categoria', p_category, 'enviados', 0,
                         'silenciados', v_silenciados)
    );
    return query select true, 0, v_silenciados, null::text;
    return;
  end if;

  -- O CTE que escreve é referenciado direto no FROM do SELECT, e não dentro de
  -- um sub-select: é a forma canônica, e a única que não depende de como o
  -- plpgsql resolve o INTO de uma consulta que começa com WITH.
  with inseridos as (
    insert into public.notifications
      (category_key, user_id, title, body, deep_link, expires_at, dedupe_key)
    select p_category, p.user_id, btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''),
           p_deep_link, p_expires_at, p_dedupe
    from unnest(v_permitidos) as p(user_id)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into v_enviados from inseridos;

  perform fly_private.registrar(
    'aviso.enviado', 'notifications', p_trip::text,
    jsonb_build_object(
      'categoria', p_category, 'enviados', v_enviados, 'silenciados', v_silenciados
    )
  );

  return query select true, v_enviados, v_silenciados, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Exportação (§46, entrega 11)
--
-- Isto **não é um porteiro**, e chamar de "exportação autorizada" sem dizer
-- isso seria mentir sobre o controle. Quem exporta já leu as linhas — a RLS
-- decidiu isso antes, e é lá que a autorização acontece. O CSV é montado no
-- navegador, com dados que já estavam na tela.
--
-- O que esta função faz é deixar rastro: que relatório, com que escopo,
-- quantas linhas, por quem, quando. É o que transforma "alguém baixou a base
-- de clientes" de suposição em fato.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_exportacao(
  p_relatorio text,
  p_escopo jsonb default '{}'::jsonb,
  p_linhas int default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not fly_private.is_staff() then
    raise exception 'exportacao e da equipe' using errcode = '42501';
  end if;

  perform fly_private.registrar(
    'exportacao', 'relatorio', p_relatorio,
    jsonb_build_object('escopo', coalesce(p_escopo, '{}'::jsonb), 'linhas', p_linhas)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS e GRANT — controles diferentes, configurados os dois
-- -----------------------------------------------------------------------------
alter table public.trip_feature_flags enable row level security;
alter table public.trip_feature_flags force row level security;

-- Leitura para `authenticated`, como a flag global: o app precisa resolver a
-- própria flag. Escrita só pela RPC — não há policy de insert/update/delete, e
-- a ausência é o controle.
create policy trip_feature_flags_select on public.trip_feature_flags for select to authenticated
  using (true);

revoke all on public.trip_feature_flags from anon;
grant select on public.trip_feature_flags to authenticated;

/**
 * `audit_logs` passa a ser legível por quem opera, e não só por admin.
 *
 * A trilha existe para ser lida quando algo dá errado, e quem está no lugar
 * onde deu errado é o gerente da viagem. O que continua fechado é a escrita:
 * não há policy de insert, update nem delete — nem para admin — e é por isso
 * que `fly_private.registrar` é DEFINER.
 */
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (fly_private.is_global_operator());

revoke all on function public.conceder_papel(uuid, public.fly_role) from public, anon;
revoke all on function public.revogar_papel(uuid, public.fly_role) from public, anon;
revoke all on function public.atribuir_a_viagem(uuid, uuid, public.fly_role) from public, anon;
revoke all on function public.revogar_atribuicao(uuid) from public, anon;
revoke all on function public.definir_config(text, jsonb, text, boolean) from public, anon;
revoke all on function public.definir_flag(text, boolean, text) from public, anon;
revoke all on function public.definir_flag_da_viagem(uuid, text, boolean) from public, anon;
revoke all on function public.flag_da_viagem(text, uuid) from public, anon;
revoke all on function public.enviar_aviso(uuid, text, text, text, text, uuid[], timestamptz, text)
  from public, anon;
revoke all on function public.registrar_exportacao(text, jsonb, int) from public, anon;

grant execute on function public.conceder_papel(uuid, public.fly_role) to authenticated;
grant execute on function public.revogar_papel(uuid, public.fly_role) to authenticated;
grant execute on function public.atribuir_a_viagem(uuid, uuid, public.fly_role) to authenticated;
grant execute on function public.revogar_atribuicao(uuid) to authenticated;
grant execute on function public.definir_config(text, jsonb, text, boolean) to authenticated;
grant execute on function public.definir_flag(text, boolean, text) to authenticated;
grant execute on function public.definir_flag_da_viagem(uuid, text, boolean) to authenticated;
grant execute on function public.flag_da_viagem(text, uuid) to authenticated;
grant execute on function public.enviar_aviso(uuid, text, text, text, text, uuid[], timestamptz, text)
  to authenticated;
grant execute on function public.registrar_exportacao(text, jsonb, int) to authenticated;
