-- =============================================================================
-- Correções da auditoria das Fases 0 a 3
--
-- Três problemas encontrados no linter do banco, todos introduzidos por mim:
--
-- 1. `home_events` era SECURITY DEFINER sem precisar. Ela só devolve eventos
--    publicados — exatamente o que a RLS já permite. Usar DEFINER ali
--    contornava a RLS sem ganho nenhum, e ampliava a superfície à toa.
--
-- 2. Políticas de escrita escritas como `FOR ALL` também valem para SELECT.
--    Resultado: cada leitura avaliava a política de escrita junto, e o banco
--    reclamava de políticas permissivas duplicadas em 21 tabelas.
--
-- 3. Chaves estrangeiras sem índice. As colunas `*_by` importam de verdade:
--    ao excluir uma conta, o Postgres precisa varrer as tabelas que a
--    referenciam, e sem índice isso é varredura completa.
--
-- 4. E o grave, achado ao reler as políticas de viagem uma a uma:
--
--       trip_members_select_assigned:  sa.trip_id = sa.trip_id   -- sempre true
--       trips_select_assigned:         sa.trip_id = sa.id        -- nunca true
--
--    Escrevi `sa.trip_id = trip_id` dentro do subquery. Como
--    `staff_assignments` também tem uma coluna `trip_id`, o Postgres resolveu
--    o nome no escopo mais interno e comparou a coluna com ela mesma. A
--    política virou "verdadeiro", e qualquer guia com uma atribuição ativa
--    passou a ler a lista de participantes de **todas** as viagens. A de
--    `trips` errou para o outro lado e ficou morta: quem foi atribuído a uma
--    viagem não conseguia vê-la.
--
--    A correção é qualificar a linha em avaliação pelo nome da tabela
--    (`trip_members.trip_id`), que é como o Postgres a expõe dentro da
--    política. `public.trip_members_select_assigned` era uma escalação de
--    privilégio entre viagens, e o teste da Fase 2 não a pegou porque só
--    verificava o caso positivo — o guia via a própria viagem, e passava.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. home_events não precisa de SECURITY DEFINER
-- -----------------------------------------------------------------------------
create or replace function public.home_events(p_limit int default 3)
returns setof public.events
language sql
security invoker
stable
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.is_published
    and e.home_order is not null
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

comment on function public.home_events(int) is
  'security invoker: a RLS de events ja filtra o que o cliente pode ver.';

-- -----------------------------------------------------------------------------
-- 2. Separar escrita de leitura
--
-- Onde havia `for all`, agora há políticas explícitas de INSERT, UPDATE e
-- DELETE. Onde havia duas políticas de SELECT com a mesma finalidade, elas
-- viraram uma só com `or`.
-- -----------------------------------------------------------------------------

-- app_config
drop policy if exists app_config_select_public on public.app_config;
drop policy if exists app_config_select_staff on public.app_config;
drop policy if exists app_config_write_admin on public.app_config;

create policy app_config_select on public.app_config for select to authenticated
  using (is_public or fly_private.is_staff());
create policy app_config_insert_admin on public.app_config for insert to authenticated
  with check (fly_private.has_role('admin'));
create policy app_config_update_admin on public.app_config for update to authenticated
  using (fly_private.has_role('admin')) with check (fly_private.has_role('admin'));
create policy app_config_delete_admin on public.app_config for delete to authenticated
  using (fly_private.has_role('admin'));

-- feature_flags
drop policy if exists feature_flags_select_authenticated on public.feature_flags;
drop policy if exists feature_flags_write_admin on public.feature_flags;

create policy feature_flags_select on public.feature_flags for select to authenticated
  using (true);
create policy feature_flags_insert_admin on public.feature_flags for insert to authenticated
  with check (fly_private.has_role('admin'));
create policy feature_flags_update_admin on public.feature_flags for update to authenticated
  using (fly_private.has_role('admin')) with check (fly_private.has_role('admin'));
create policy feature_flags_delete_admin on public.feature_flags for delete to authenticated
  using (fly_private.has_role('admin'));

-- user_roles
drop policy if exists user_roles_select_own on public.user_roles;
drop policy if exists user_roles_select_admin on public.user_roles;

create policy user_roles_select on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.has_role('admin'));

-- profiles
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_assigned_staff on public.profiles;
drop policy if exists profiles_select_dependent on public.profiles;

create policy profiles_select on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or fly_private.has_active_assignment()
    or fly_private.is_global_operator()
    or fly_private.is_responsible_for(id)
  );

-- staff_assignments
drop policy if exists staff_assignments_select_own on public.staff_assignments;
drop policy if exists staff_assignments_select_operator on public.staff_assignments;

create policy staff_assignments_select on public.staff_assignments for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_global_operator());

-- companionships
drop policy if exists companionships_select_own on public.companionships;
drop policy if exists companionships_select_operator on public.companionships;

create policy companionships_select on public.companionships for select to authenticated
  using (
    (select auth.uid()) = responsible_id
    or (select auth.uid()) = dependent_id
    or fly_private.is_global_operator()
  );

-- consent_purposes
drop policy if exists consent_purposes_select_authenticated on public.consent_purposes;
drop policy if exists consent_purposes_write_admin on public.consent_purposes;

create policy consent_purposes_select on public.consent_purposes for select to authenticated
  using (true);
create policy consent_purposes_insert_admin on public.consent_purposes for insert to authenticated
  with check (fly_private.has_role('admin'));
create policy consent_purposes_update_admin on public.consent_purposes for update to authenticated
  using (fly_private.has_role('admin')) with check (fly_private.has_role('admin'));
create policy consent_purposes_delete_admin on public.consent_purposes for delete to authenticated
  using (fly_private.has_role('admin'));

-- consents
drop policy if exists consents_select_own on public.consents;
drop policy if exists consents_select_operator on public.consents;

create policy consents_select on public.consents for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_global_operator());

-- emergency_contacts
drop policy if exists emergency_contacts_all_own on public.emergency_contacts;
drop policy if exists emergency_contacts_select_assigned on public.emergency_contacts;

create policy emergency_contacts_select on public.emergency_contacts for select to authenticated
  using (
    (select auth.uid()) = user_id
    or fly_private.has_active_assignment()
    or fly_private.is_global_operator()
  );
create policy emergency_contacts_insert_own on public.emergency_contacts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy emergency_contacts_update_own on public.emergency_contacts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy emergency_contacts_delete_own on public.emergency_contacts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- customer_preferences
drop policy if exists customer_preferences_all_own on public.customer_preferences;
drop policy if exists customer_preferences_select_assigned on public.customer_preferences;

create policy customer_preferences_select on public.customer_preferences for select to authenticated
  using (
    (select auth.uid()) = user_id
    or fly_private.has_active_assignment()
    or fly_private.is_global_operator()
  );
create policy customer_preferences_insert_own on public.customer_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy customer_preferences_update_own on public.customer_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy customer_preferences_delete_own on public.customer_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

-- preference_items
drop policy if exists preference_items_all_own on public.preference_items;
drop policy if exists preference_items_select_assigned on public.preference_items;
drop policy if exists preference_items_select_dependent on public.preference_items;

-- A regra do dado sensivel continua exatamente a mesma: sem consentimento
-- vigente para `health_data`, a linha some para a equipe atribuida.
create policy preference_items_select on public.preference_items for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      (fly_private.has_active_assignment() or fly_private.is_global_operator())
      and (not is_sensitive or fly_private.has_consent(user_id, 'health_data'))
    )
    or (
      fly_private.is_responsible_for(user_id, 'meals')
      and (not is_sensitive or fly_private.is_responsible_for(user_id, 'health'))
    )
  );
create policy preference_items_insert_own on public.preference_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy preference_items_update_own on public.preference_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy preference_items_delete_own on public.preference_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- devices e push_tokens: `for all` sem politica de SELECT concorrente, mas
-- separadas do mesmo jeito, para a intencao ficar legivel.
drop policy if exists devices_all_own on public.devices;
create policy devices_select_own on public.devices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy devices_insert_own on public.devices for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy devices_update_own on public.devices for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy devices_delete_own on public.devices for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_tokens_all_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
create policy push_tokens_insert_own on public.push_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy push_tokens_update_own on public.push_tokens for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

-- destinations
drop policy if exists destinations_select_authenticated on public.destinations;
drop policy if exists destinations_write_operator on public.destinations;

create policy destinations_select on public.destinations for select to authenticated
  using (true);
create policy destinations_insert_operator on public.destinations for insert to authenticated
  with check (fly_private.is_global_operator());
create policy destinations_update_operator on public.destinations for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy destinations_delete_operator on public.destinations for delete to authenticated
  using (fly_private.is_global_operator());

-- trips
drop policy if exists trips_select_member on public.trips;
drop policy if exists trips_select_assigned on public.trips;
drop policy if exists trips_write_operator on public.trips;

-- `trips.id`, e nao `id`: dentro do subquery, `id` resolveria para a coluna
-- da tabela do FROM interno, e a comparacao viraria outra coisa.
create policy trips_select on public.trips for select to authenticated
  using (
    exists (select 1 from public.trip_members tm
            where tm.trip_id = public.trips.id
              and tm.user_id = (select auth.uid()))
    or exists (select 1 from public.staff_assignments sa
               where sa.trip_id = public.trips.id
                 and sa.user_id = (select auth.uid())
                 and sa.revoked_at is null)
    or fly_private.is_global_operator()
  );
create policy trips_insert_operator on public.trips for insert to authenticated
  with check (fly_private.is_global_operator());
create policy trips_update_operator on public.trips for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy trips_delete_operator on public.trips for delete to authenticated
  using (fly_private.is_global_operator());

-- trip_members
drop policy if exists trip_members_select_own on public.trip_members;
drop policy if exists trip_members_select_assigned on public.trip_members;
drop policy if exists trip_members_write_operator on public.trip_members;

-- `public.trip_members.trip_id` qualificado: era aqui que a politica comparava
-- `sa.trip_id` com ele mesmo e liberava a lista de participantes de qualquer
-- viagem para qualquer guia com atribuicao ativa.
create policy trip_members_select on public.trip_members for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.staff_assignments sa
               where sa.trip_id = public.trip_members.trip_id
                 and sa.user_id = (select auth.uid())
                 and sa.revoked_at is null)
    or fly_private.is_global_operator()
  );
create policy trip_members_insert_operator on public.trip_members for insert to authenticated
  with check (fly_private.is_global_operator());
create policy trip_members_update_operator on public.trip_members for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy trip_members_delete_operator on public.trip_members for delete to authenticated
  using (fly_private.is_global_operator());

-- event_categories
drop policy if exists event_categories_select_authenticated on public.event_categories;
drop policy if exists event_categories_write_operator on public.event_categories;

create policy event_categories_select on public.event_categories for select to authenticated
  using (true);
create policy event_categories_insert_operator on public.event_categories for insert to authenticated
  with check (fly_private.is_global_operator());
create policy event_categories_update_operator on public.event_categories for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy event_categories_delete_operator on public.event_categories for delete to authenticated
  using (fly_private.is_global_operator());

-- events
drop policy if exists events_select_published on public.events;
drop policy if exists events_select_operator on public.events;
drop policy if exists events_write_operator on public.events;

create policy events_select on public.events for select to authenticated
  using (is_published or fly_private.is_global_operator());
create policy events_insert_operator on public.events for insert to authenticated
  with check (fly_private.is_global_operator());
create policy events_update_operator on public.events for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy events_delete_operator on public.events for delete to authenticated
  using (fly_private.is_global_operator());

-- Filhos do evento: mesma visibilidade do pai, escrita so do operador.
--
-- Aqui `event_id` esta qualificado pelo mesmo motivo das viagens. Hoje
-- `events` nao tem coluna com esse nome e o nome resolveria para fora, mas
-- depender disso e depender de uma coincidencia de schema.
drop policy if exists event_participants_select on public.event_participants;
drop policy if exists event_participants_write_operator on public.event_participants;

create policy event_participants_select on public.event_participants for select to authenticated
  using (
    exists (select 1 from public.events e
            where e.id = public.event_participants.event_id
              and (e.is_published or fly_private.is_global_operator()))
  );
create policy event_participants_insert_operator on public.event_participants for insert to authenticated
  with check (fly_private.is_global_operator());
create policy event_participants_update_operator on public.event_participants for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy event_participants_delete_operator on public.event_participants for delete to authenticated
  using (fly_private.is_global_operator());

drop policy if exists event_ctas_select on public.event_ctas;
drop policy if exists event_ctas_write_operator on public.event_ctas;

create policy event_ctas_select on public.event_ctas for select to authenticated
  using (
    exists (select 1 from public.events e
            where e.id = public.event_ctas.event_id
              and (e.is_published or fly_private.is_global_operator()))
  );
create policy event_ctas_insert_operator on public.event_ctas for insert to authenticated
  with check (fly_private.is_global_operator());
create policy event_ctas_update_operator on public.event_ctas for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy event_ctas_delete_operator on public.event_ctas for delete to authenticated
  using (fly_private.is_global_operator());

drop policy if exists event_media_select on public.event_media;
drop policy if exists event_media_write_operator on public.event_media;

create policy event_media_select on public.event_media for select to authenticated
  using (
    exists (select 1 from public.events e
            where e.id = public.event_media.event_id
              and (e.is_published or fly_private.is_global_operator()))
  );
create policy event_media_insert_operator on public.event_media for insert to authenticated
  with check (fly_private.is_global_operator());
create policy event_media_update_operator on public.event_media for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy event_media_delete_operator on public.event_media for delete to authenticated
  using (fly_private.is_global_operator());

-- event_interests
drop policy if exists event_interests_all_own on public.event_interests;
drop policy if exists event_interests_select_operator on public.event_interests;

create policy event_interests_select on public.event_interests for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_global_operator());
create policy event_interests_insert_own on public.event_interests for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy event_interests_delete_own on public.event_interests for delete to authenticated
  using ((select auth.uid()) = user_id);

-- notification_categories
drop policy if exists notification_categories_select_authenticated on public.notification_categories;
drop policy if exists notification_categories_write_operator on public.notification_categories;

create policy notification_categories_select on public.notification_categories for select to authenticated
  using (true);
create policy notification_categories_insert_operator on public.notification_categories for insert to authenticated
  with check (fly_private.is_global_operator());
create policy notification_categories_update_operator on public.notification_categories for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy notification_categories_delete_operator on public.notification_categories for delete to authenticated
  using (fly_private.is_global_operator());

-- notification_preferences
drop policy if exists notification_preferences_all_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notification_preferences_delete_own on public.notification_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 3. Índices nas chaves estrangeiras
--
-- As colunas `*_by` não são consultadas por si, mas são varridas quando o
-- usuário referenciado é excluído. Sem índice, cada exclusão de conta faz
-- varredura completa em todas estas tabelas.
-- -----------------------------------------------------------------------------
create index if not exists app_config_updated_by_idx on public.app_config (updated_by);
create index if not exists feature_flags_updated_by_idx on public.feature_flags (updated_by);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists invitations_invited_by_idx on public.invitations (invited_by);
create index if not exists invitations_accepted_by_idx on public.invitations (accepted_by);
create index if not exists staff_assignments_assigned_by_idx on public.staff_assignments (assigned_by);
create index if not exists companionships_authorized_by_idx on public.companionships (authorized_by);

-- Estas são consultadas de verdade, em junção.
create index if not exists consents_purpose_idx on public.consents (purpose_key);
create index if not exists events_category_idx on public.events (category_key);
create index if not exists event_media_event_idx on public.event_media (event_id, sort_order);
create index if not exists notifications_category_idx on public.notifications (category_key);
create index if not exists notification_preferences_category_idx on public.notification_preferences (category_key);
create index if not exists push_tokens_device_idx on public.push_tokens (device_id);
create index if not exists trips_destination_idx on public.trips (destination_id);
