-- =============================================================================
-- Isolamento entre viagens (§9 e §12).
--
-- Este arquivo existe por causa de um bug real, encontrado na auditoria das
-- Fases 0 a 3. A política de `trip_members` dizia:
--
--     exists (select 1 from staff_assignments sa where sa.trip_id = trip_id ...)
--
-- Como `staff_assignments` também tem uma coluna `trip_id`, o Postgres resolveu
-- o nome no escopo mais interno. A condição virou `sa.trip_id = sa.trip_id` —
-- sempre verdadeira. Qualquer guia com uma atribuição ativa lia a lista de
-- participantes de **todas** as viagens.
--
-- O teste da Fase 2 não pegou porque só verificava o caso positivo: o guia
-- via a própria viagem, e passava. Um caso positivo não distingue "a política
-- funciona" de "a política é sempre verdadeira" — só o negativo distingue.
--
-- Por isso, tudo aqui é em pares: quem pode E quem não pode.
-- =============================================================================

begin;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  -- Guia atribuído somente à viagem A.
  ('a1110000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guia.a@teste.fly', '', now(), now()),
  -- Guia cuja atribuição foi revogada.
  ('a2220000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guia.revogado@teste.fly', '', now(), now()),
  -- Cliente da viagem A.
  ('c1110000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.a@teste.fly', '', now(), now()),
  -- Cliente da viagem B.
  ('c2220000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.b@teste.fly', '', now(), now());

insert into public.user_roles (user_id, role) values
  ('a1110000-0000-0000-0000-0000000000a1', 'guide'),
  ('a2220000-0000-0000-0000-0000000000a2', 'guide'),
  ('c1110000-0000-0000-0000-0000000000c1', 'customer'),
  ('c2220000-0000-0000-0000-0000000000c2', 'customer');

insert into public.destinations (slug, name, country, timezone)
values ('iso-destino', 'Destino Isolamento', 'EAU', 'Asia/Dubai')
on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'aaaa1111-0000-0000-0000-00000000aaaa', d.id, 'Viagem A', 'published',
       current_date + 10, current_date + 17
from public.destinations d where d.slug = 'iso-destino';

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'bbbb2222-0000-0000-0000-00000000bbbb', d.id, 'Viagem B', 'published',
       current_date + 30, current_date + 37
from public.destinations d where d.slug = 'iso-destino';

insert into public.trip_members (trip_id, user_id) values
  ('aaaa1111-0000-0000-0000-00000000aaaa', 'c1110000-0000-0000-0000-0000000000c1'),
  ('bbbb2222-0000-0000-0000-00000000bbbb', 'c2220000-0000-0000-0000-0000000000c2');

-- O guia A só na viagem A. O outro teve a atribuição revogada ontem.
insert into public.staff_assignments (user_id, trip_id, role, revoked_at) values
  ('a1110000-0000-0000-0000-0000000000a1', 'aaaa1111-0000-0000-0000-00000000aaaa', 'guide', null),
  ('a2220000-0000-0000-0000-0000000000a2', 'aaaa1111-0000-0000-0000-00000000aaaa', 'guide', now() - interval '1 day');

-- -----------------------------------------------------------------------------
-- Guia atribuído à viagem A
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1110000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is(
  (select count(*)::int from public.trips where id = 'aaaa1111-0000-0000-0000-00000000aaaa'),
  1,
  'guia enxerga a viagem a que foi atribuido'
);

-- Este é o caso que estava quebrado para o outro lado: `sa.trip_id = sa.id`
-- nunca era verdadeiro, e o guia não via viagem nenhuma.
select is(
  (select count(*)::int from public.trips where id = 'bbbb2222-0000-0000-0000-00000000bbbb'),
  0,
  'guia NAO enxerga viagem a que nao foi atribuido'
);

select is(
  (select count(*)::int from public.trip_members
   where trip_id = 'aaaa1111-0000-0000-0000-00000000aaaa'),
  1,
  'guia enxerga os participantes da propria viagem'
);

-- A asserção que falhava antes da correção: sem ela, a política sempre
-- verdadeira passava despercebida.
select is(
  (select count(*)::int from public.trip_members
   where trip_id = 'bbbb2222-0000-0000-0000-00000000bbbb'),
  0,
  'guia NAO enxerga os participantes de outra viagem'
);

-- -----------------------------------------------------------------------------
-- Guia com atribuição revogada
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a2220000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is(
  (select count(*)::int from public.trips where id = 'aaaa1111-0000-0000-0000-00000000aaaa'),
  0,
  'atribuicao revogada perde acesso a viagem'
);

select is(
  (select count(*)::int from public.trip_members
   where trip_id = 'aaaa1111-0000-0000-0000-00000000aaaa'),
  0,
  'atribuicao revogada perde acesso aos participantes'
);

-- -----------------------------------------------------------------------------
-- Cliente
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is(
  (select count(*)::int from public.trips where id = 'aaaa1111-0000-0000-0000-00000000aaaa'),
  1,
  'cliente enxerga a propria viagem'
);

select is(
  (select count(*)::int from public.trips where id = 'bbbb2222-0000-0000-0000-00000000bbbb'),
  0,
  'cliente NAO enxerga viagem de outro'
);

-- Um cliente vê a própria linha de participação. As dos companheiros de
-- viagem não são dele — a §12 trata a lista de participantes como dado
-- operacional, não social.
select is(
  (select count(*)::int from public.trip_members
   where trip_id = 'aaaa1111-0000-0000-0000-00000000aaaa'),
  1,
  'cliente enxerga apenas a propria participacao'
);

select is(
  (select count(*)::int from public.trip_members
   where trip_id = 'bbbb2222-0000-0000-0000-00000000bbbb'),
  0,
  'cliente NAO enxerga participacao em viagem alheia'
);

select * from finish();
rollback;
