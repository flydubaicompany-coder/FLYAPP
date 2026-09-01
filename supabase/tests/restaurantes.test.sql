-- =============================================================================
-- Fase 7 — restaurantes e estilo de vida (§11.2, §11.3).
--
-- A asercao que mais importa: **o cliente nao confirma a propria reserva**.
-- Sem isso ele sairia do app achando que tem mesa garantida, e descobriria na
-- porta do restaurante. Pedir mesa e pedido; quem confirma e o restaurante,
-- via Fly.
-- =============================================================================

begin;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('71110000-0000-0000-0000-000000007111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rest.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('72220000-0000-0000-0000-000000007222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rest.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('73330000-0000-0000-0000-000000007333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rest.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('71110000-0000-0000-0000-000000007111','customer'),
  ('72220000-0000-0000-0000-000000007222','customer'),
  ('73330000-0000-0000-0000-000000007333','admin');

-- Curadoria sem motivo escrito e so um selo.
select throws_ok(
  $$insert into public.restaurants (name, is_curated, is_active)
    values ('Sem motivo', true, true)$$,
  '23514',
  null,
  'curadoria sem motivo escrito e recusada: selo sem porque nao e curadoria');

insert into public.restaurants (id, name, cuisine, is_curated, fly_note, is_active)
values
  ('7a000000-0000-0000-0000-00000000007a','Ossiano','Frutos do mar', true,
   'A sala fica dentro do aquario; peca a mesa junto ao vidro.', true),
  ('7b000000-0000-0000-0000-00000000007b','Em montagem','Teste', false, null, false);

insert into public.lifestyle_services (id, kind, name, is_active)
values ('7c000000-0000-0000-0000-00000000007c','laundry','Lavanderia expressa', true);

set local role authenticated;
set local request.jwt.claims to '{"sub":"71110000-0000-0000-0000-000000007111","role":"authenticated"}';

select is(
  (select count(*)::int from public.restaurants),
  1,
  'o cliente ve so o restaurante ativo: catalogo em montagem e da equipe');

insert into public.restaurant_reservations (id, user_id, restaurant_id, party_size, desired_at, occasion)
values ('7d000000-0000-0000-0000-00000000007d','71110000-0000-0000-0000-000000007111',
        '7a000000-0000-0000-0000-00000000007a', 2, now() + interval '3 days', 'Aniversario de casamento');

select is(
  (select status::text from public.restaurant_reservations
   where id = '7d000000-0000-0000-0000-00000000007d'),
  'requested',
  'a reserva nasce como PEDIDO, e nao como confirmada');

-- A asercao central.
select throws_ok(
  $$update public.restaurant_reservations set status = 'confirmed'
    where id = '7d000000-0000-0000-0000-00000000007d'$$,
  '42501',
  null,
  'o cliente NAO confirma a propria reserva: descobriria na porta do restaurante');

-- Mas desistir e direito dele.
update public.restaurant_reservations set status = 'cancelled'
where id = '7d000000-0000-0000-0000-00000000007d';

select is(
  (select status::text from public.restaurant_reservations
   where id = '7d000000-0000-0000-0000-00000000007d'),
  'cancelled',
  'o cliente cancela o proprio pedido: desistir e direito dele');

select throws_ok(
  $$insert into public.restaurant_reservations (user_id, restaurant_id, party_size, desired_at)
    values ('71110000-0000-0000-0000-000000007111','7a000000-0000-0000-0000-00000000007a',
            0, now() + interval '1 day')$$,
  '23514',
  null,
  'reserva para zero pessoas e recusada');

set local request.jwt.claims to '{"sub":"72220000-0000-0000-0000-000000007222","role":"authenticated"}';
select is(
  (select count(*)::int from public.restaurant_reservations),
  0,
  'o cliente NAO ve a reserva de outro');

-- A equipe decide, e recusar exige motivo.
set local request.jwt.claims to '{"sub":"73330000-0000-0000-0000-000000007333","role":"authenticated"}';

insert into public.restaurant_reservations (id, user_id, restaurant_id, party_size, desired_at)
values ('7e000000-0000-0000-0000-00000000007e','71110000-0000-0000-0000-000000007111',
        '7a000000-0000-0000-0000-00000000007a', 4, now() + interval '5 days');

select throws_ok(
  $$update public.restaurant_reservations set status = 'declined'
    where id = '7e000000-0000-0000-0000-00000000007e'$$,
  '23514',
  null,
  'recusar sem motivo e recusado: o cliente precisa saber se tenta outro dia');

update public.restaurant_reservations set status = 'confirmed'
where id = '7e000000-0000-0000-0000-00000000007e';

select is(
  (select status::text from public.restaurant_reservations
   where id = '7e000000-0000-0000-0000-00000000007e'),
  'confirmed',
  'a equipe confirma');

select isnt(
  (select handled_by from public.restaurant_reservations
   where id = '7e000000-0000-0000-0000-00000000007e'),
  null,
  'quem decidiu fica registrado sem ninguem precisar lembrar');

-- Pedido de estilo de vida: o mesmo desenho.
set local request.jwt.claims to '{"sub":"71110000-0000-0000-0000-000000007111","role":"authenticated"}';

insert into public.service_requests (id, user_id, service_id, details, deliver_to)
values ('7f000000-0000-0000-0000-00000000007f','71110000-0000-0000-0000-000000007111',
        '7c000000-0000-0000-0000-00000000007c','Dois ternos para passar','Quarto 1204');

select throws_ok(
  $$update public.service_requests set status = 'done'
    where id = '7f000000-0000-0000-0000-00000000007f'$$,
  '42501',
  null,
  'o cliente NAO marca o proprio pedido como resolvido');

select is(
  (select value from public.app_config where key = 'partners.delivery_enabled'),
  'false'::jsonb,
  'parceiro de entrega nasce desligado: a §11.3 exige API, contrato e termos');

select * from finish();
rollback;
