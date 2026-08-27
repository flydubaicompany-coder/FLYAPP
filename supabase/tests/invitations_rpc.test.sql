-- =============================================================================
-- Criação de convite.
--
-- O que importa: **quem** pode convidar. Se um cliente conseguir criar convite
-- com papel `admin`, a autorização inteira do produto cai por ali.
-- =============================================================================

begin;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('aa000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin.conv@teste.fly', '', now(), now()),
  ('bb000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.conv@teste.fly', '', now(), now()),
  ('cc000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guia.conv@teste.fly', '', now(), now());

insert into public.user_roles (user_id, role) values
  ('aa000000-0000-0000-0000-000000000001', 'admin'),
  ('bb000000-0000-0000-0000-000000000002', 'customer'),
  ('cc000000-0000-0000-0000-000000000003', 'guide');

set local role authenticated;

-- ---- Cliente comum ----
set local request.jwt.claims to '{"sub":"bb000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.create_invitation('invasor@teste.fly', 'admin', 7) $$,
  '42501', null,
  'NEGATIVO: cliente nao convida ninguem, muito menos como admin'
);

select throws_ok(
  $$ select public.revoke_invitation(gen_random_uuid()) $$,
  '42501', null,
  'NEGATIVO: cliente nao revoga convite'
);

-- ---- Guia ----
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$ select public.create_invitation('alguem@teste.fly', 'customer', 7) $$,
  '42501', null,
  'NEGATIVO: guia nao convida — atribuicao nao da poder de criar acesso'
);

-- ---- Admin ----
set local request.jwt.claims to '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.create_invitation('convidado.a@teste.fly', 'customer', 7) $$,
  'POSITIVO: admin convida'
);

select throws_ok(
  $$ select public.create_invitation('sem-arroba', 'customer', 7) $$,
  '22023', null,
  'NEGATIVO: e-mail invalido e recusado'
);

select throws_ok(
  $$ select public.create_invitation('convidado.b@teste.fly', 'customer', 90) $$,
  '22023', null,
  'NEGATIVO: validade fora da faixa e recusada'
);

-- Convidar o mesmo e-mail de novo revoga o pendente anterior.
select lives_ok(
  $$ select public.create_invitation('convidado.a@teste.fly', 'customer', 7) $$,
  'POSITIVO: convidar de novo funciona'
);

select is(
  (select count(*)::int from public.invitations
   where email = 'convidado.a@teste.fly' and accepted_at is null and revoked_at is null),
  1,
  'POSITIVO: so um convite pendente por e-mail — o anterior foi revogado'
);

reset role;

select * from finish();

rollback;
