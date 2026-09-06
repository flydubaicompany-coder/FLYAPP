-- =============================================================================
-- Fase 11 — relatórios (§46, entrega 6).
--
-- O critério que manda é "relatório reconcilia com ledgers". Um relatório que
-- sempre fecha é um relatório que não confere nada — então o teste central
-- aqui é o do pedido que **não** fecha: total de 100,00, captura de 90,00, e o
-- relatório tem que devolver 10,00 de diferença e apontar qual pedido é.
--
-- O resto guarda os papéis: cada relatório tem um papel mínimo, e o de ao lado
-- não passa.
-- =============================================================================

begin;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('c1000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rel.financeiro@teste.fly','',now(),now(),'','','','','','','',''),
  ('c2000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rel.suporte@teste.fly','',now(),now(),'','','','','','','',''),
  ('c3000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rel.gerente@teste.fly','',now(),now(),'','','','','','','',''),
  ('c4000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rel.cliente@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('c1000000-0000-0000-0000-0000000000c1','finance'),
  ('c2000000-0000-0000-0000-0000000000c2','support'),
  ('c3000000-0000-0000-0000-0000000000c3','trip_manager'),
  ('c4000000-0000-0000-0000-0000000000c4','customer');

insert into public.destinations (slug, name, country, timezone)
values ('rel-dubai', 'Dubai Relatorio', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'ca000000-0000-0000-0000-0000000000ca', d.id, 'Viagem do relatorio', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'rel-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('ca000000-0000-0000-0000-0000000000ca','c4000000-0000-0000-0000-0000000000c4');

-- Um pedido que fecha e um que não fecha.
insert into public.orders (id, user_id, trip_id, reference, status, currency,
                           subtotal_cents, discount_cents, total_cents)
values
  ('cb000000-0000-0000-0000-0000000000cb','c4000000-0000-0000-0000-0000000000c4',
   'ca000000-0000-0000-0000-0000000000ca','REL-0001','paid','AED', 10000, 0, 10000),
  ('cc000000-0000-0000-0000-0000000000cc','c4000000-0000-0000-0000-0000000000c4',
   'ca000000-0000-0000-0000-0000000000ca','REL-0002','paid','AED', 5000, 0, 5000);

insert into public.payments (order_id, provider, provider_ref, status, amount_cents, currency)
values
  ('cb000000-0000-0000-0000-0000000000cb','sandbox','rel-1','captured', 9000, 'AED'),
  ('cc000000-0000-0000-0000-0000000000cc','sandbox','rel-2','captured', 5000, 'AED');

insert into public.support_cases (id, user_id, trip_id, level, subject, status,
                                  opened_at, accepted_at, accepted_by, first_response_at)
values
  ('cd000000-0000-0000-0000-0000000000cd','c4000000-0000-0000-0000-0000000000c4',
   'ca000000-0000-0000-0000-0000000000ca','sos','Perdi o grupo','resolved',
   now() - interval '60 minutes', now() - interval '50 minutes',
   'c2000000-0000-0000-0000-0000000000c2', now() - interval '48 minutes');

-- Resolvido é quem e quando, sempre juntos: a constraint
-- `support_cases_resolucao_completa` não aceita metade preenchida.
update public.support_cases
set resolved_at = now() - interval '20 minutes',
    resolved_by = 'c2000000-0000-0000-0000-0000000000c2'
where id = 'cd000000-0000-0000-0000-0000000000cd';

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Papel mínimo, e nada além
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select throws_ok(
  $$select * from public.relatorio_comercio(now() - interval '1 day', now() + interval '1 day')$$,
  '42501',
  null,
  'suporte nao le o relatorio de comercio');

select throws_ok(
  $$select * from public.relatorio_experiencia('ca000000-0000-0000-0000-0000000000ca')$$,
  '42501',
  null,
  'nem o de experiencia');

select is(
  (select abertos from public.relatorio_suporte(
    now() - interval '1 day', now() + interval '1 day') where level = 'sos'),
  1,
  'mas le o proprio: um caso de SOS na janela');

select is(
  (select resolvidos from public.relatorio_suporte(
    now() - interval '1 day', now() + interval '1 day') where level = 'sos'),
  1,
  'e ele foi resolvido');

select cmp_ok(
  (select aceite_medio_min from public.relatorio_suporte(
    now() - interval '1 day', now() + interval '1 day') where level = 'sos'),
  '=',
  10.0::numeric,
  'dez minutos ate alguem aceitar');

set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select throws_ok(
  $$select * from public.relatorio_suporte(now() - interval '1 day', now() + interval '1 day')$$,
  '42501',
  null,
  'e o financeiro nao le o de suporte: papel minimo, e nada alem');

-- -----------------------------------------------------------------------------
-- A reconciliação
-- -----------------------------------------------------------------------------
select is(
  (select pedidos from public.relatorio_comercio(
    now() - interval '1 day', now() + interval '1 day')),
  2,
  'dois pedidos na janela');

select is(
  (select liquido_cents from public.relatorio_comercio(
    now() - interval '1 day', now() + interval '1 day')),
  15000::bigint,
  'somando 150,00');

select is(
  (select capturado_cents from public.relatorio_comercio(
    now() - interval '1 day', now() + interval '1 day')),
  14000::bigint,
  'e 140,00 capturados');

select is(
  (select divergencia_cents from public.relatorio_comercio(
    now() - interval '1 day', now() + interval '1 day')),
  1000::bigint,
  'a diferenca de 10,00 aparece no relatorio em vez de sumir na soma');

select is(
  (select pedidos_divergentes from public.relatorio_comercio(
    now() - interval '1 day', now() + interval '1 day')),
  1,
  'e diz que e um pedido só');

select is(
  (select reference from public.comercio_divergencias(
    now() - interval '1 day', now() + interval '1 day')),
  'REL-0001',
  'e diz qual: numero agregado que nao chega na linha nao serve para agir');

-- -----------------------------------------------------------------------------
-- Escopo da viagem
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"c3000000-0000-0000-0000-0000000000c3","role":"authenticated"}';

select is(
  (select participantes from public.relatorio_viagem('ca000000-0000-0000-0000-0000000000ca')),
  1,
  'o gerente le a foto da viagem');

set local request.jwt.claims to '{"sub":"c4000000-0000-0000-0000-0000000000c4","role":"authenticated"}';

select throws_ok(
  $$select * from public.relatorio_viagem('ca000000-0000-0000-0000-0000000000ca')$$,
  '42501',
  null,
  'o cliente nao le relatorio da propria viagem — participar nao e operar');

select * from finish();
rollback;
