-- =============================================================================
-- Testes de RLS e privilegios da migration 20260824000000_foundation.
--
-- A DoD §31.5 exige teste positivo E negativo para cada papel. Testar só o
-- caminho feliz prova que a feature funciona; é o caminho negado que prova
-- que a segurança funciona.
--
-- Rodar:  supabase test db
-- =============================================================================

begin;

select plan(31);

-- -----------------------------------------------------------------------------
-- Usuários de teste
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.a@teste.fly', '', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.b@teste.fly', '', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guia@teste.fly', '', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@teste.fly', '', now(), now());

insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'customer'),
  ('22222222-2222-2222-2222-222222222222', 'customer'),
  ('33333333-3333-3333-3333-333333333333', 'guide'),
  ('44444444-4444-4444-4444-444444444444', 'admin');

insert into public.app_config (key, value, description, is_public) values
  ('teste.publico', '"visivel"'::jsonb, 'config publica', true),
  ('teste.interno', '"segredo_operacional"'::jsonb, 'config interna', false);

-- -----------------------------------------------------------------------------
-- 1. RLS ligada em toda tabela exposta
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass),
  format('RLS ligada em public.%s', t)
)
from unnest(array[
  'profiles', 'user_roles', 'app_config',
  'feature_flags', 'audit_logs', 'idempotency_keys'
]) as t;

-- -----------------------------------------------------------------------------
-- 2. Isolamento entre clientes — o teste que mais importa
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'POSITIVO: cliente A enxerga o proprio perfil'
);

select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'NEGATIVO: cliente A nao enxerga o perfil do cliente B'
);

select is(
  (select count(*)::int from public.user_roles where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'NEGATIVO: cliente A nao enxerga os papeis do cliente B'
);

-- -----------------------------------------------------------------------------
-- 3. Escalada de privilégio
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('11111111-1111-1111-1111-111111111111', 'admin') $$,
  null,
  null,
  'NEGATIVO: cliente nao consegue se promover a admin'
);

select throws_ok(
  $$ update public.user_roles set role = 'admin'
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  null,
  'NEGATIVO: cliente nao consegue alterar o proprio papel'
);

select throws_ok(
  $$ update public.profiles set id = '22222222-2222-2222-2222-222222222222'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  null,
  'NEGATIVO: WITH CHECK impede o cliente de reatribuir o proprio perfil'
);

-- -----------------------------------------------------------------------------
-- 4. Trilha de auditoria é append-only
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.audit_logs (action, entity_type) values ('forjado', 'teste') $$,
  null,
  null,
  'NEGATIVO: cliente nao escreve na trilha de auditoria'
);

select is(
  (select count(*)::int from public.audit_logs),
  0,
  'NEGATIVO: cliente nao le a trilha de auditoria'
);

-- -----------------------------------------------------------------------------
-- 5. Configuração pública x interna
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.app_config where key = 'teste.publico'),
  1,
  'POSITIVO: cliente le config marcada como publica'
);

select is(
  (select count(*)::int from public.app_config where key = 'teste.interno'),
  0,
  'NEGATIVO: cliente nao le config interna'
);

-- ATENCAO: RLS em UPDATE **filtra linhas**, nao lanca excecao. `throws_ok`
-- daria falso negativo aqui e alguem poderia "consertar" a policy por engano.
-- O que prova o bloqueio e o efeito: zero linhas afetadas e valor intacto.
select lives_ok(
  $$ update public.app_config set value = '"adulterado"'::jsonb where key = 'teste.publico' $$,
  'cliente pode tentar o UPDATE — o RLS filtra em silencio'
);

select is(
  (select value::text from public.app_config where key = 'teste.publico'),
  '"visivel"',
  'NEGATIVO: o UPDATE do cliente nao alterou app_config'
);

-- INSERT, ao contrario, esbarra em WITH CHECK e no GRANT — e lanca.
select throws_ok(
  $$ insert into public.app_config (key, value) values ('teste.injetado', '"x"'::jsonb) $$,
  null,
  null,
  'NEGATIVO: cliente nao insere em app_config'
);

-- -----------------------------------------------------------------------------
-- 6. Tabela exclusiva de servidor
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ select count(*) from public.idempotency_keys $$,
  '42501',
  null,
  'NEGATIVO: idempotency_keys e inacessivel ao cliente (sem GRANT)'
);

-- -----------------------------------------------------------------------------
-- 7. Equipe (guia) — vê perfis, mas não administra
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- A Fase 2 apertou esta regra. Antes, qualquer membro da equipe lia qualquer
-- perfil; agora e preciso atribuicao ativa. O guia deste elenco nao tem
-- nenhuma, entao enxerga apenas o proprio perfil. A cobertura do caso com
-- atribuicao vive em fly_id_rls.test.sql.
select is(
  (select count(*)::int from public.profiles),
  1,
  'NEGATIVO: guia sem atribuicao enxerga so o proprio perfil'
);

select is(
  (select count(*)::int from public.app_config where key = 'teste.interno'),
  1,
  'POSITIVO: equipe le config interna'
);

select lives_ok(
  $$ update public.app_config set value = '"adulterado"'::jsonb where key = 'teste.interno' $$,
  'guia pode tentar o UPDATE — o RLS filtra em silencio'
);

select is(
  (select value::text from public.app_config where key = 'teste.interno'),
  '"segredo_operacional"',
  'NEGATIVO: o UPDATE do guia nao alterou app_config'
);

select is(
  (select count(*)::int from public.user_roles where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'NEGATIVO: guia nao enxerga papeis de outro usuario'
);

-- -----------------------------------------------------------------------------
-- 8. Admin
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select lives_ok(
  $$ update public.app_config set value = '"novo"'::jsonb where key = 'teste.interno' $$,
  'POSITIVO: admin escreve em app_config'
);

select cmp_ok(
  (select count(*)::int from public.user_roles),
  '>=',
  4,
  'POSITIVO: admin enxerga todos os papeis'
);

select throws_ok(
  $$ delete from public.audit_logs $$,
  null,
  null,
  'NEGATIVO: nem admin apaga a trilha de auditoria'
);

-- -----------------------------------------------------------------------------
-- 9. Anônimo não tem nada
-- -----------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501',
  null,
  'NEGATIVO: anon nao le profiles'
);

select throws_ok(
  $$ select count(*) from public.app_config $$,
  '42501',
  null,
  'NEGATIVO: anon nao le app_config nem o que e publico'
);

select throws_ok(
  $$ select count(*) from public.feature_flags $$,
  '42501',
  null,
  'NEGATIVO: anon nao le feature_flags'
);

reset role;

select * from finish();

rollback;
