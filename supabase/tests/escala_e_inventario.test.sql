-- =============================================================================
-- Fase 11 — escala, passagem de turno e inventário (§46, entregas 7 e 8).
--
-- O que este arquivo guarda:
--
--   • a escala é da equipe, e o cliente não a lê. Onde está um funcionário é
--     dado da lista da §33 — não se inventa, e também não se expõe;
--   • o movimento de estoque é append-only, e a única porta é a RPC. Um
--     insert direto passaria por cima da conferência de saldo, que é a única
--     razão de a RPC existir;
--   • aceitar passagem de turno é diferente de deixar bilhete.
-- =============================================================================

begin;

select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('e1000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','es.admin@teste.fly','',now(),now(),'','','','','','','',''),
  ('e2000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','es.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('e3000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','es.guia2@teste.fly','',now(),now(),'','','','','','','',''),
  ('e4000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','es.cliente@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('e1000000-0000-0000-0000-0000000000e1','admin'),
  ('e2000000-0000-0000-0000-0000000000e2','guide'),
  ('e3000000-0000-0000-0000-0000000000e3','guide'),
  ('e4000000-0000-0000-0000-0000000000e4','customer');

insert into public.destinations (slug, name, country, timezone)
values ('es-dubai', 'Dubai Escala', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'ea000000-0000-0000-0000-0000000000ea', d.id, 'Viagem da escala', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'es-dubai';

-- -----------------------------------------------------------------------------
-- GRANT
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.staff_shifts', 'SELECT'),
  'anon nao le a escala');

select ok(
  not has_table_privilege('authenticated', 'public.inventory_movements', 'INSERT'),
  'authenticated NAO insere movimento de estoque: a unica porta e a RPC, que confere o saldo');

select ok(
  not has_table_privilege('authenticated', 'public.inventory_movements', 'UPDATE'),
  'e nem edita — o ledger e append-only');

select ok(
  not has_table_privilege('authenticated', 'public.shift_handoffs', 'UPDATE'),
  'a passagem de turno nao se reescreve depois de escrita');

select ok(
  not has_table_privilege('authenticated', 'public.inventory_items', 'DELETE'),
  'item com movimento e historico: desativa, nao apaga');

-- -----------------------------------------------------------------------------
-- A escala, e quem a lê
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

insert into public.staff_shifts (user_id, trip_id, role, starts_at, ends_at, notes)
values ('e2000000-0000-0000-0000-0000000000e2','ea000000-0000-0000-0000-0000000000ea','guide',
        now() - interval '1 hour', now() + interval '7 hours', 'Plantao da manha');

select is(
  (select count(*)::int from public.staff_shifts),
  1,
  'o operador global monta a escala');

select throws_ok(
  $$insert into public.staff_shifts (user_id, role, starts_at, ends_at)
    values ('e2000000-0000-0000-0000-0000000000e2','guide', now(), now() - interval '1 hour')$$,
  '23514',
  null,
  'turno que termina antes de comecar e recusado');

set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000e4","role":"authenticated"}';

select is(
  (select count(*)::int from public.staff_shifts),
  0,
  'o cliente NAO le a escala: onde esta um funcionario nao se expoe');

-- -----------------------------------------------------------------------------
-- Passagem de turno
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-0000000000e2","role":"authenticated"}';

insert into public.shift_handoffs (trip_id, from_user, summary, open_items)
values ('ea000000-0000-0000-0000-0000000000ea','e2000000-0000-0000-0000-0000000000e2',
        'Dia tranquilo.', 'Confirmar o transfer das 19h.');

select is(
  (select count(*)::int from public.shift_handoffs where accepted_at is null),
  1,
  'quem sai deixa o bilhete');

select throws_ok(
  $$insert into public.shift_handoffs (from_user, summary)
    values ('e3000000-0000-0000-0000-0000000000e3', 'Assinando por outro')$$,
  '42501',
  null,
  'ninguem assina passagem no nome de outra pessoa');

set local request.jwt.claims to '{"sub":"e3000000-0000-0000-0000-0000000000e3","role":"authenticated"}';

select is(
  (select ok from public.aceitar_passagem((select id from public.shift_handoffs limit 1))),
  true,
  'quem entra assume — e assumir e um ato, nao uma suposicao');

select is(
  (select accepted_by from public.shift_handoffs limit 1),
  'e3000000-0000-0000-0000-0000000000e3'::uuid,
  'e fica registrado quem assumiu de fato, e nao quem foi nomeado');

select is(
  (select motivo from public.aceitar_passagem((select id from public.shift_handoffs limit 1))),
  'Alguém já assumiu esta passagem.',
  'duas pessoas nao assumem a mesma passagem');

-- -----------------------------------------------------------------------------
-- Inventário
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

insert into public.inventory_items (id, kind, name, trip_id, low_stock_at)
values ('eb000000-0000-0000-0000-0000000000eb', 'press_kit', 'Kit de imprensa Dubai',
        'ea000000-0000-0000-0000-0000000000ea', 5);

select is(
  (select saldo from public.inventory_balance where item_id = 'eb000000-0000-0000-0000-0000000000eb'),
  0,
  'item novo nasce com saldo zero — o saldo e a soma do ledger, e nao uma coluna');

select is(
  (select saldo from public.movimentar_estoque(
    'eb000000-0000-0000-0000-0000000000eb', 10, 'entrada')),
  10,
  'chegaram dez');

select is(
  (select motivo from public.movimentar_estoque(
    'eb000000-0000-0000-0000-0000000000eb', -30, 'entrega',
    'e4000000-0000-0000-0000-0000000000e4')),
  'Não há tanto em estoque: restam 10.',
  'entregar trinta havendo dez e recusado — o erro apareceria na contagem fisica, depois da viagem');

select is(
  (select saldo from public.movimentar_estoque(
    'eb000000-0000-0000-0000-0000000000eb', -3, 'entrega',
    'e4000000-0000-0000-0000-0000000000e4')),
  7,
  'entregar tres, havendo dez, funciona');

select is(
  (select entregues from public.inventory_balance
    where item_id = 'eb000000-0000-0000-0000-0000000000eb'),
  3,
  'e o relatorio sabe quantos sairam');

-- O ajuste e a excecao deliberada: contagem fisica que achou menos tem que
-- poder registrar o que achou.
select is(
  (select saldo from public.movimentar_estoque(
    'eb000000-0000-0000-0000-0000000000eb', -7, 'ajuste', null, 'Contagem fisica')),
  0,
  'o ajuste passa por onde a entrega nao passa');

select throws_ok(
  $$update public.inventory_movements set delta = 99$$,
  '42501',
  null,
  'e o movimento nao se edita nem por quem tem papel');

select throws_ok(
  $$insert into public.inventory_movements (item_id, delta, reason)
    values ('eb000000-0000-0000-0000-0000000000eb', 5, 'entrada')$$,
  '42501',
  null,
  'nem se insere por fora da RPC');

select * from finish();
rollback;
