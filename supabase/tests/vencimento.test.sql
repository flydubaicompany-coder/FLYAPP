-- =============================================================================
-- Fase 6 — vencimento de Fly Points em lotes FIFO.
--
-- A Carteira promete ao cliente "cada ponto vale por 24 meses". Ate 28/08 nada
-- cumpria essa promessa: `expires_on` era gravado e ninguem olhava. Estas
-- asercoes existem para que a conta que passou a cumprir nao escorregue.
--
-- O caso que mais importa e o **lote parcialmente gasto**: um lote de 10.000
-- do qual 7.000 ja sairam deve vencer 3.000, e nao 10.000. Errar isso tira
-- pontos que o cliente ja tinha gasto — cobrando duas vezes pela mesma coisa.
-- =============================================================================

begin;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('50010000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','venc.a@teste.fly','',now(),now(),'','','','','','','',''),
  ('50020000-0000-0000-0000-000000005002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','venc.b@teste.fly','',now(),now(),'','','','','','','',''),
  ('50030000-0000-0000-0000-000000005003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','venc.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('50010000-0000-0000-0000-000000005001','customer'),
  ('50020000-0000-0000-0000-000000005002','customer'),
  ('50030000-0000-0000-0000-000000005003','admin');

-- Cliente A: um lote vencido inteiro, e um que ainda vale.
insert into public.points_ledger
  (id, user_id, kind, amount, source, occurred_at, expires_on, idempotency_key)
values
  ('a1110000-0000-0000-0000-00000000a111','50010000-0000-0000-0000-000000005001','earn',5000,'order',
   now() - interval '30 months', (current_date - 10), 'venc:a:antigo'),
  ('a2220000-0000-0000-0000-00000000a222','50010000-0000-0000-0000-000000005001','earn',3000,'order',
   now() - interval '1 month', (current_date + 400), 'venc:a:novo');

-- Cliente B: lote vencido de 10.000, do qual 7.000 ja foram gastos.
insert into public.points_ledger
  (id, user_id, kind, amount, source, occurred_at, expires_on, idempotency_key)
values
  ('b1110000-0000-0000-0000-00000000b111','50020000-0000-0000-0000-000000005002','earn',10000,'order',
   now() - interval '30 months', (current_date - 5), 'venc:b:antigo');
insert into public.points_ledger
  (user_id, kind, amount, source, occurred_at, idempotency_key, reason)
values
  ('50020000-0000-0000-0000-000000005002','redeem',-7000,'benefit', now() - interval '1 month',
   'venc:b:gasto', null);

select is(
  (select balance from public.points_balance where user_id = '50010000-0000-0000-0000-000000005001'),
  8000, 'saldo de partida do cliente A');
select is(
  (select balance from public.points_balance where user_id = '50020000-0000-0000-0000-000000005002'),
  3000, 'saldo de partida do cliente B');

-- Cliente comum nao pode disparar vencimento.
set local role authenticated;
set local request.jwt.claims to '{"sub":"50010000-0000-0000-0000-000000005001","role":"authenticated"}';
select throws_ok(
  $$select * from public.vencer_pontos()$$,
  '42501', null,
  'cliente comum NAO dispara o vencimento');

set local request.jwt.claims to '{"sub":"50030000-0000-0000-0000-000000005003","role":"authenticated"}';
select ok(
  (select ok from public.vencer_pontos()),
  'o operador dispara o vencimento');

select is(
  (select balance from public.points_balance where user_id = '50010000-0000-0000-0000-000000005001'),
  3000,
  'o lote vencido do cliente A saiu inteiro; o que ainda vale ficou');

-- O caso que mais importa.
select is(
  (select balance from public.points_balance where user_id = '50020000-0000-0000-0000-000000005002'),
  0,
  'do lote de 10.000 com 7.000 ja gastos, vence so o resto: 3.000');

select is(
  (select -amount from public.points_ledger
   where user_id = '50020000-0000-0000-0000-000000005002' and kind = 'expire'),
  3000,
  'o lancamento de vencimento e de 3.000, e nao de 10.000: nao se cobra duas vezes');

-- Rodar de novo nao pode tirar mais nada.
select is(
  (select lotes from public.vencer_pontos()),
  0,
  'a segunda passada nao vence nada: a chave e por lote');

select is(
  (select balance from public.points_balance where user_id = '50020000-0000-0000-0000-000000005002'),
  0,
  'e o saldo continua o mesmo depois da segunda passada');

select * from finish();
rollback;
