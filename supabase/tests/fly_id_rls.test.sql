-- =============================================================================
-- RLS do Fly ID (migration 20260824120000_fly_id).
--
-- A §37.5 pede teste positivo E negativo de cada politica. O criterio da §37
-- e mais especifico ainda, e cada linha dele vira asserçao aqui:
--   • cliente A nao le cliente B;
--   • guia SEM atribuicao nao le cliente;
--   • responsavel acessa somente dependentes autorizados;
--   • mudanca de consentimento afeta o acesso.
--
-- Rodar: supabase test db
-- =============================================================================

begin;

select plan(39);

-- -----------------------------------------------------------------------------
-- Elenco
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.a@teste.fly', '', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.b@teste.fly', '', now(), now()),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guia.sem@teste.fly', '', now(), now()),
  ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guia.com@teste.fly', '', now(), now()),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dependente@teste.fly', '', now(), now()),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@teste.fly', '', now(), now());

insert into public.user_roles (user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'customer'),
  ('b0000000-0000-0000-0000-000000000002', 'customer'),
  ('c0000000-0000-0000-0000-000000000003', 'guide'),
  ('d0000000-0000-0000-0000-000000000004', 'guide'),
  ('e0000000-0000-0000-0000-000000000005', 'customer'),
  ('f0000000-0000-0000-0000-000000000006', 'admin');

-- A Fase 3 deu chave estrangeira a `staff_assignments.trip_id`, entao a viagem
-- precisa existir de verdade. Antes, um id inventado passava — e essa
-- possibilidade era justamente o que a FK veio fechar.
insert into public.destinations (slug, name, country, timezone)
values ('teste-fly-id', 'Destino Teste', 'Brasil', 'America/Sao_Paulo')
on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select '11111111-2222-3333-4444-555555555555', d.id, 'Viagem de teste', 'published',
       current_date + 30, current_date + 37
from public.destinations d where d.slug = 'teste-fly-id';

-- Só o guia "com" tem atribuição ativa. O outro é guia sem viagem.
insert into public.staff_assignments (user_id, trip_id, role) values
  ('d0000000-0000-0000-0000-000000000004', '11111111-2222-3333-4444-555555555555', 'guide');

-- Cliente A é responsável pelo dependente, com escopo de refeição — e nada mais.
insert into public.companionships (responsible_id, dependent_id, kind, scopes) values
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005',
   'guardian', array['itinerary', 'meals']::text[]);

insert into public.consent_purposes (key, label, description, is_sensitive) values
  ('health_data', 'Dados de saúde', 'Alergias e restrições para a equipe cuidar de você.', true);

-- Preferência comum e preferência sensível do cliente B.
insert into public.preference_items (user_id, key, value, is_sensitive) values
  ('b0000000-0000-0000-0000-000000000002', 'snack.favorito', '"chocolate"'::jsonb, false),
  ('b0000000-0000-0000-0000-000000000002', 'saude.alergia', '"amendoim"'::jsonb, true);

-- Preferência do dependente, para testar o escopo do responsável.
insert into public.preference_items (user_id, key, value, is_sensitive) values
  ('e0000000-0000-0000-0000-000000000005', 'comida.favorita', '"lasanha"'::jsonb, false),
  ('e0000000-0000-0000-0000-000000000005', 'saude.condicao', '"asma"'::jsonb, true);

insert into public.invitations (email, role, token_hash, expires_at) values
  ('convidado@teste.fly', 'customer', 'hash-de-teste', now() + interval '7 days');

-- -----------------------------------------------------------------------------
-- 1. Estrutura
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass),
  format('RLS ligada em public.%s', t)
)
from unnest(array[
  'invitations', 'staff_assignments', 'companionships', 'consents',
  'emergency_contacts', 'devices', 'customer_preferences', 'preference_items'
]) as t;

select isnt(
  (select public_id from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001',
  'QR pessoal usa identificador opaco, nao o uuid do usuario'
);

select matches(
  (select public_id from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  '^[2-9A-HJ-NP-Z]{10}$',
  'o identificador opaco evita caracteres ambiguos'
);

select is(
  (select count(distinct public_id)::int from public.profiles),
  (select count(*)::int from public.profiles),
  'identificadores opacos sao unicos entre perfis'
);

-- -----------------------------------------------------------------------------
-- 2. Cliente A: o proprio, o dependente, e nada alem
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'POSITIVO: cliente A le o proprio perfil'
);

select is(
  (select count(*)::int from public.profiles where id = 'b0000000-0000-0000-0000-000000000002'),
  0,
  'NEGATIVO: cliente A nao le o perfil do cliente B'
);

select is(
  (select count(*)::int from public.profiles where id = 'e0000000-0000-0000-0000-000000000005'),
  1,
  'POSITIVO: responsavel le o perfil do dependente vinculado'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'e0000000-0000-0000-0000-000000000005' and not is_sensitive),
  1,
  'POSITIVO: responsavel com escopo meals le preferencia comum do dependente'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'e0000000-0000-0000-0000-000000000005' and is_sensitive),
  0,
  'NEGATIVO: escopo meals nao alcanca dado de saude do dependente'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'b0000000-0000-0000-0000-000000000002'),
  0,
  'NEGATIVO: cliente A nao le preferencia do cliente B'
);

select is(
  (select count(*)::int from public.invitations),
  0,
  'NEGATIVO: cliente nao le convites — nem o hash do token'
);

select is(
  (select count(*)::int from public.companionships
   where responsible_id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'POSITIVO: responsavel enxerga o proprio vinculo'
);

-- Tentar criar vinculo: sem policy de INSERT, o banco recusa. Engolimos a
-- excecao aqui e conferimos o efeito na asserçao seguinte.
do $$ begin
  begin
    insert into public.companionships (responsible_id, dependent_id, kind)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'guardian');
  exception when others then null;
  end;
end $$;

select is(
  (select count(*)::int from public.companionships
   where dependent_id = 'b0000000-0000-0000-0000-000000000002'),
  0,
  'NEGATIVO: cliente nao cria vinculo para se tornar responsavel por outro'
);

select lives_ok(
  $$ insert into public.consents (user_id, purpose_key, granted, version)
     values ('a0000000-0000-0000-0000-000000000001', 'health_data', true, 1) $$,
  'POSITIVO: cliente registra o proprio consentimento'
);

select throws_ok(
  $$ insert into public.consents (user_id, purpose_key, granted, version)
     values ('b0000000-0000-0000-0000-000000000002', 'health_data', true, 1) $$,
  null, null,
  'NEGATIVO: cliente nao registra consentimento em nome de outro'
);

select throws_ok(
  $$ update public.consents set granted = false
     where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  null, null,
  'NEGATIVO: consentimento e append-only — nao se edita o passado'
);

-- -----------------------------------------------------------------------------
-- 3. Guia SEM atribuicao: o criterio explicito da §37
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles
   where id <> 'c0000000-0000-0000-0000-000000000003'),
  0,
  'NEGATIVO: guia sem atribuicao nao le nenhum cliente'
);

select is(
  (select count(*)::int from public.preference_items),
  0,
  'NEGATIVO: guia sem atribuicao nao le preferencia alguma'
);

select is(
  (select count(*)::int from public.emergency_contacts),
  0,
  'NEGATIVO: guia sem atribuicao nao le contato de emergencia'
);

-- -----------------------------------------------------------------------------
-- 4. Guia COM atribuicao, e o consentimento como terceira camada
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select cmp_ok(
  (select count(*)::int from public.profiles),
  '>=',
  5,
  'POSITIVO: guia atribuido le perfis de clientes'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'b0000000-0000-0000-0000-000000000002' and not is_sensitive),
  1,
  'POSITIVO: guia atribuido le preferencia comum'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'b0000000-0000-0000-0000-000000000002' and is_sensitive),
  0,
  'NEGATIVO: sem consentimento, dado de saude some para a equipe atribuida'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'a0000000-0000-0000-0000-000000000001' and is_sensitive),
  0,
  'NEGATIVO: consentimento de A nao libera dado sensivel que A nao tem'
);

select throws_ok(
  $$ insert into public.staff_assignments (user_id, trip_id, role)
     values ('c0000000-0000-0000-0000-000000000003', '99999999-9999-9999-9999-999999999999', 'guide') $$,
  null, null,
  'NEGATIVO: equipe nao se auto-atribui a uma viagem'
);

-- -----------------------------------------------------------------------------
-- 5. Consentimento muda o acesso — o criterio "mudanca de consentimento afeta"
-- -----------------------------------------------------------------------------
reset role;
insert into public.consents (user_id, purpose_key, granted, version)
values ('b0000000-0000-0000-0000-000000000002', 'health_data', true, 1);

set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'b0000000-0000-0000-0000-000000000002' and is_sensitive),
  1,
  'POSITIVO: com consentimento, a equipe atribuida passa a ler o dado de saude'
);

reset role;
-- Revogar e um evento novo, nao um update.
insert into public.consents (user_id, purpose_key, granted, version)
values ('b0000000-0000-0000-0000-000000000002', 'health_data', false, 1);

set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'b0000000-0000-0000-0000-000000000002' and is_sensitive),
  0,
  'POSITIVO: revogar o consentimento fecha o acesso na hora'
);

-- -----------------------------------------------------------------------------
-- 6. Admin
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"f0000000-0000-0000-0000-000000000006","role":"authenticated"}';

select is(
  (select count(*)::int from public.invitations),
  1,
  'POSITIVO: operador global le convites'
);

select cmp_ok(
  (select count(*)::int from public.companionships),
  '>=',
  1,
  'POSITIVO: operador global enxerga vinculos'
);

select is(
  (select count(*)::int from public.consents
   where user_id = 'b0000000-0000-0000-0000-000000000002'),
  2,
  'POSITIVO: a trilha de consentimento guarda conceder E revogar'
);

-- -----------------------------------------------------------------------------
-- 7. Anonimo
-- -----------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select count(*) from public.invitations $$, '42501', null,
  'NEGATIVO: anon nao le convites'
);

select throws_ok(
  $$ select count(*) from public.preference_items $$, '42501', null,
  'NEGATIVO: anon nao le preferencias'
);

select throws_ok(
  $$ select count(*) from public.emergency_contacts $$, '42501', null,
  'NEGATIVO: anon nao le contato de emergencia'
);

reset role;

select * from finish();

rollback;
