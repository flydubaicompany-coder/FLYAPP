-- =============================================================================
-- Home dinâmica, eventos e notificações (§38).
--
-- Os critérios da §38 viram asserção aqui. O mais importante deles é o último:
-- **marketing não substitui alerta crítico** — e isso é garantido por gatilho
-- no banco, não pela boa vontade da tela.
-- =============================================================================

begin;

select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11110000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'home.pre@teste.fly', '', now(), now()),
  ('22220000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'home.durante@teste.fly', '', now(), now()),
  ('33330000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'home.sem@teste.fly', '', now(), now());

insert into public.user_roles (user_id, role) values
  ('11110000-0000-0000-0000-000000000001', 'customer'),
  ('22220000-0000-0000-0000-000000000002', 'customer'),
  ('33330000-0000-0000-0000-000000000003', 'customer');

insert into public.destinations (slug, name, country, timezone)
values ('teste-dubai', 'Dubai Teste', 'EAU', 'Asia/Dubai')
on conflict (slug) do nothing;

-- Datas relativas ao HOJE NO DESTINO, não ao hoje do servidor. É o ponto
-- inteiro do teste: se a função usasse o fuso do servidor, estas viagens
-- cairiam no estado errado durante as 4 horas em que Dubai e UTC discordam.
insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'aaaa0000-0000-0000-0000-00000000000a', d.id, 'Futura', 'published',
       (now() at time zone d.timezone)::date + 20,
       (now() at time zone d.timezone)::date + 27
from public.destinations d where d.slug = 'teste-dubai';

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'bbbb0000-0000-0000-0000-00000000000b', d.id, 'Acontecendo', 'ongoing',
       (now() at time zone d.timezone)::date - 2,
       (now() at time zone d.timezone)::date + 3
from public.destinations d where d.slug = 'teste-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('aaaa0000-0000-0000-0000-00000000000a', '11110000-0000-0000-0000-000000000001'),
  ('bbbb0000-0000-0000-0000-00000000000b', '22220000-0000-0000-0000-000000000002');

insert into public.event_categories (key, label) values ('teste-cat', 'Teste')
on conflict (key) do nothing;

insert into public.events (slug, category_key, title, status, is_published, published_at, home_order)
values
  ('evento-destaque', 'teste-cat', 'Em destaque', 'announced', true, now(), 1),
  ('evento-rascunho', 'teste-cat', 'Rascunho', 'announced', false, null, 2);

insert into public.events (slug, category_key, title, status, is_published, published_at, home_order, ends_at)
values ('evento-antigo', 'teste-cat', 'Encerrado ha tempo', 'finished', true, now(), 3,
        now() - interval '60 days');

insert into public.notification_categories (key, label, description, is_critical) values
  ('teste_critico', 'Critico', 'Nao silenciavel', true),
  ('teste_marketing', 'Marketing', 'Silenciavel', false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 1. Estado da Home
-- -----------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claims to '{"sub":"33330000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select state from public.home_state()), 'no_trip',
  'POSITIVO: sem viagem, a Home entra em no_trip'
);

set local request.jwt.claims to '{"sub":"11110000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select state from public.home_state()), 'pre_trip',
  'POSITIVO: viagem no futuro coloca a Home em pre_trip'
);

select is(
  (select days_until from public.home_state()), 20,
  'POSITIVO: a contagem regressiva bate com o hoje NO DESTINO'
);

select is(
  (select total_days from public.home_state()), 8,
  'POSITIVO: o total de dias conta os dois extremos'
);

select is(
  (select day_number from public.home_state()), null,
  'NEGATIVO: antes de comecar, nao ha "dia N da viagem"'
);

set local request.jwt.claims to '{"sub":"22220000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select state from public.home_state()), 'during_trip',
  'POSITIVO: viagem em curso coloca a Home em during_trip'
);

select is(
  (select day_number from public.home_state()), 3,
  'POSITIVO: hoje e o terceiro dia de uma viagem que comecou ha dois'
);

select is(
  (select destination_timezone from public.home_state()), 'Asia/Dubai',
  'POSITIVO: a Home devolve o fuso do destino, para o app nao recalcular'
);

-- -----------------------------------------------------------------------------
-- 2. Eventos
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.events where slug = 'evento-rascunho'),
  0,
  'NEGATIVO: cliente nao enxerga evento nao publicado'
);

select is(
  (select count(*)::int from public.home_events(5) where slug = 'evento-destaque'),
  1,
  'POSITIVO: evento publicado com ordem aparece na Home'
);

select is(
  (select count(*)::int from public.home_events(5) where slug = 'evento-antigo'),
  0,
  'POSITIVO: evento encerrado ha muito sai do destaque da Home'
);

select cmp_ok(
  (select count(*)::int from public.home_events(3)),
  '<=', 3,
  'POSITIVO: a Home respeita o limite de tres'
);

-- Mesma armadilha de sempre: RLS em UPDATE filtra linhas em vez de lancar.
-- O que prova o bloqueio e o efeito, nao a excecao.
select lives_ok(
  $$ update public.events set title = 'adulterado' where slug = 'evento-destaque' $$,
  'cliente pode tentar o UPDATE — o RLS filtra em silencio'
);

select is(
  (select title from public.events where slug = 'evento-destaque'),
  'Em destaque',
  'NEGATIVO: o UPDATE do cliente nao alterou o evento'
);

-- -----------------------------------------------------------------------------
-- 3. Notificacoes — o criterio "marketing nao substitui alerta critico"
-- -----------------------------------------------------------------------------
-- Voltar para o usuario dono das preferencias: sem isso, a RLS recusa a
-- escrita e o teste falharia pelo motivo errado.
set local request.jwt.claims to '{"sub":"11110000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.notification_preferences (user_id, category_key, is_enabled)
     values ('11110000-0000-0000-0000-000000000001', 'teste_marketing', false) $$,
  'POSITIVO: cliente desliga marketing'
);

select throws_ok(
  $$ insert into public.notification_preferences (user_id, category_key, is_enabled)
     values ('11110000-0000-0000-0000-000000000001', 'teste_critico', false) $$,
  '22023', null,
  'NEGATIVO: categoria critica NAO pode ser silenciada — nem pela API direta'
);

-- Ligar a categoria critica e permitido — o que nao pode e desligar.
select lives_ok(
  $$ insert into public.notification_preferences (user_id, category_key, is_enabled)
     values ('11110000-0000-0000-0000-000000000001', 'teste_critico', true) $$,
  'POSITIVO: a categoria critica pode existir na tabela, ligada'
);

-- Agora existe uma linha critica. Um update em massa esbarra no gatilho.
select throws_ok(
  $$ update public.notification_preferences set is_enabled = false
     where user_id = '11110000-0000-0000-0000-000000000001' $$,
  '22023', null,
  'NEGATIVO: nem um update em massa consegue silenciar a critica'
);

select is(
  (select is_enabled from public.notification_preferences
   where user_id = '11110000-0000-0000-0000-000000000001' and category_key = 'teste_critico'),
  true,
  'POSITIVO: depois da tentativa, a critica segue ligada'
);

-- -----------------------------------------------------------------------------
-- 4. Isolamento — como o cliente da viagem "Futura", que nao participa da outra
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"11110000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.trips where id = 'bbbb0000-0000-0000-0000-00000000000b'),
  0,
  'NEGATIVO: cliente nao enxerga viagem em que nao esta'
);

select throws_ok(
  $$ insert into public.notifications (category_key, user_id, title)
     values ('teste_critico', '11110000-0000-0000-0000-000000000001', 'forjada') $$,
  null, null,
  'NEGATIVO: cliente nao cria a propria notificacao'
);

reset role;

select * from finish();

rollback;
