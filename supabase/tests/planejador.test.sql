-- =============================================================================
-- Fase 10 — planejador financeiro (§15.4 e §45, entrega 7).
--
-- A asercao central: **nem a equipe le o gasto anotado**.
--
-- Todo o resto do projeto segue "a propria pessoa, mais a equipe". Aqui a
-- equipe fica de fora de proposito: o que a pessoa gastou por conta dela, no
-- proprio dinheiro, anotado num caderno digital, nao e operacao da Fly. A Fly
-- ve o que a Fly cobrou — `orders` e `wallet_entries` continuam visiveis.
--
-- A §9.3 ja tinha estabelecido essa linha ao proibir expor gasto exato no
-- ranking. Aqui ela vale contra a propria equipe.
-- =============================================================================

begin;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('d1110000-0000-0000-0000-00000000d111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pl.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('d2220000-0000-0000-0000-00000000d222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pl.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('d3330000-0000-0000-0000-00000000d333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pl.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('d1110000-0000-0000-0000-00000000d111','customer'),
  ('d2220000-0000-0000-0000-00000000d222','customer'),
  ('d3330000-0000-0000-0000-00000000d333','admin');

insert into public.destinations (slug, name, country, timezone)
values ('pl-dubai', 'Dubai Planejador', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'df000000-0000-0000-0000-0000000000df', d.id, 'Viagem do planejador', 'ongoing',
       (now() at time zone d.timezone)::date - 1,
       (now() at time zone d.timezone)::date + 5
from public.destinations d where d.slug = 'pl-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('df000000-0000-0000-0000-0000000000df','d1110000-0000-0000-0000-00000000d111');

select ok(
  not has_table_privilege('anon', 'public.manual_expenses', 'SELECT'),
  'anon NAO le gasto anotado de ninguem');

select ok(
  not has_table_privilege('anon', 'public.trip_budgets', 'SELECT'),
  'nem o orcamento de ninguem');

set local role authenticated;
set local request.jwt.claims to '{"sub":"d1110000-0000-0000-0000-00000000d111","role":"authenticated"}';

insert into public.manual_expenses (user_id, trip_id, amount_cents, currency, category, note)
values ('d1110000-0000-0000-0000-00000000d111','df000000-0000-0000-0000-0000000000df',
        4500, 'AED', 'alimentacao', 'Cafe na Marina');

select is(
  (select count(*)::int from public.manual_expenses),
  1,
  'o cliente anota o proprio gasto');

insert into public.trip_budgets (user_id, trip_id, daily_limit_cents, currency)
values ('d1110000-0000-0000-0000-00000000d111','df000000-0000-0000-0000-0000000000df',
        30000, 'AED');

select is(
  (select daily_limit_cents from public.trip_budgets),
  30000::bigint,
  'e define o proprio limite diario — e o dinheiro dele, e a escolha e dele');

-- Valor e moeda tem que fazer sentido.
select throws_ok(
  $$insert into public.manual_expenses (user_id, amount_cents, currency)
    values ('d1110000-0000-0000-0000-00000000d111', 0, 'AED')$$,
  '23514',
  null,
  'gasto de zero e recusado');

select throws_ok(
  $$insert into public.manual_expenses (user_id, amount_cents, currency)
    values ('d1110000-0000-0000-0000-00000000d111', 100, 'XXX')$$,
  '23514',
  null,
  'moeda desconhecida e recusada: dinheiro sem moeda ja causou bug aqui');

-- Anotacao do proprio bolso se apaga. E o caderno da pessoa, e nao registro
-- operacional da Fly.
select ok(
  has_table_privilege('authenticated', 'public.manual_expenses', 'DELETE'),
  'o gasto anotado se apaga, ao contrario de tudo o mais neste projeto');

-- =============================================================================
-- Nem a equipe le. Esta e a asercao que carrega o arquivo.
-- =============================================================================
set local request.jwt.claims to '{"sub":"d3330000-0000-0000-0000-00000000d333","role":"authenticated"}';

select is(
  (select count(*)::int from public.manual_expenses),
  0,
  'o ADMIN nao le o gasto que o cliente anotou (§15.4)');

select is(
  (select count(*)::int from public.trip_budgets),
  0,
  'nem o orcamento pessoal dele');

set local request.jwt.claims to '{"sub":"d2220000-0000-0000-0000-00000000d222","role":"authenticated"}';

select is(
  (select count(*)::int from public.manual_expenses),
  0,
  'e outro cliente muito menos');

select throws_ok(
  $$insert into public.manual_expenses (user_id, amount_cents, currency)
    values ('d1110000-0000-0000-0000-00000000d111', 999, 'AED')$$,
  '42501',
  null,
  'ninguem anota gasto no nome de outra pessoa');

-- O extrato oficial continua onde estava, e nao virou gasto anotado.
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'wallet_entries'
     and column_name in ('is_manual', 'origem', 'manual')),
  0,
  'wallet_entries NAO ganhou coluna de origem: o gasto manual e tabela separada (§15.4)');

select * from finish();
rollback;
