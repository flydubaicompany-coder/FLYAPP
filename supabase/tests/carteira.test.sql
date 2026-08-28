-- =============================================================================
-- Fase 6 — fundacao da Carteira (§8 e §41)
--
-- As duas asercoes que mais importam, e por que:
--
--   "nunca UPDATE destrutivo em lancamento"
--     Provado por gatilho, nao por ausencia de GRANT. GRANT protege o cliente;
--     o gatilho protege tambem um bug no painel e uma funcao `security
--     definer` distraida. O teste roda como **postgres**, que passa por cima
--     de RLS e GRANT — se ainda assim falhar, a tranca e real.
--
--   "papel/pacote nao pode ser auto-atribuido"
--     `profiles_update_own` deixa o cliente editar a propria linha. Se o
--     pacote morasse la, ele se promoveria a Billionaire sozinho. Aqui o
--     cliente tenta escrever em `customer_packages` e e recusado.
-- =============================================================================

begin;

select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('cc110000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','carteira.cli1@teste.fly','',now(),now(),'','','','','','','',''),
  ('cc220000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','carteira.cli2@teste.fly','',now(),now(),'','','','','','','',''),
  ('aa330000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','carteira.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('cc110000-0000-0000-0000-0000000000c1','customer'),
  ('cc220000-0000-0000-0000-0000000000c2','customer'),
  ('aa330000-0000-0000-0000-0000000000a3','admin');

-- -----------------------------------------------------------------------------
-- Configuracao: os limiares nascem nulos de proposito (P12).
-- -----------------------------------------------------------------------------
select is(
  (select value -> 'prime' from public.app_config where key = 'points.level_thresholds'),
  'null'::jsonb,
  'o limiar de prime nasce nulo: a formula e decisao do dono, nao do codigo');

select is(
  (select value -> 'elite' from public.app_config where key = 'points.level_thresholds'),
  'null'::jsonb,
  'o limiar de elite tambem nasce nulo');

select is(
  (select value from public.app_config where key = 'wallet.financial_balance_enabled'),
  'false'::jsonb,
  'o saldo financeiro nasce desligado: nao ha parceiro de pagamento (§41)');

-- -----------------------------------------------------------------------------
-- Lancamentos, como operador.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aa330000-0000-0000-0000-0000000000a3","role":"authenticated"}';

insert into public.points_ledger (id, user_id, kind, amount, source, reference, idempotency_key, rule_version)
values
  ('11110000-0000-0000-0000-000000001111','cc110000-0000-0000-0000-0000000000c1','earn',2480,'order','pedido-1','order:pedido-1:v1','v1'),
  ('22220000-0000-0000-0000-000000002222','cc110000-0000-0000-0000-0000000000c1','earn',1000,'event','evento-1','event:evento-1:v1','v1');

select is(
  (select balance from public.points_balance where user_id = 'cc110000-0000-0000-0000-0000000000c1'),
  3480,
  'o saldo e a soma do ledger, nao um campo guardado');

select throws_ok(
  $$insert into public.points_ledger (user_id, kind, amount, source, idempotency_key)
    values ('cc110000-0000-0000-0000-0000000000c1','earn',2480,'order','order:pedido-1:v1')$$,
  '23505',
  null,
  'webhook repetido nao pontua duas vezes: a idempotency key e unica');

select throws_ok(
  $$insert into public.points_ledger (user_id, kind, amount, source, idempotency_key)
    values ('cc110000-0000-0000-0000-0000000000c1','earn',-50,'order','order:negativo')$$,
  '23514',
  null,
  'ganho com valor negativo e recusado');

select throws_ok(
  $$insert into public.points_ledger (user_id, kind, amount, source, idempotency_key, reason)
    values ('cc110000-0000-0000-0000-0000000000c1','adjust',100,'ops','ops:sem-motivo',null)$$,
  '23514',
  null,
  'ajuste sem motivo e recusado: ajuste que ninguem audita nao e ajuste');

select throws_ok(
  $$insert into public.points_ledger (user_id, kind, amount, source, idempotency_key)
    values ('cc110000-0000-0000-0000-0000000000c1','reverse',-100,'ops','ops:estorno-solto')$$,
  '23514',
  null,
  'estorno sem alvo e recusado: seria um lancamento solto');

-- Reembolso vira reversao, e o saldo fecha.
insert into public.points_ledger (user_id, kind, amount, source, idempotency_key, reverses_id, reason)
values ('cc110000-0000-0000-0000-0000000000c1','reverse',-2480,'order','order:pedido-1:reembolso',
        '11110000-0000-0000-0000-000000001111','Pedido reembolsado');

select is(
  (select balance from public.points_balance where user_id = 'cc110000-0000-0000-0000-0000000000c1'),
  1000,
  'reembolso cria reversao e o saldo fecha com o extrato');

select is(
  (select count(*)::int from public.points_ledger where user_id = 'cc110000-0000-0000-0000-0000000000c1'),
  3,
  'a reversao NAO apaga o lancamento original: o extrato mantem os tres');

-- -----------------------------------------------------------------------------
-- O cliente le o proprio extrato e nada do vizinho.
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cc110000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is(
  (select count(*)::int from public.points_ledger),
  3,
  'o cliente ve o proprio extrato');

select is(
  (select count(*)::int from public.points_ledger where user_id = 'cc220000-0000-0000-0000-0000000000c2'),
  0,
  'o cliente NAO ve o extrato do vizinho');

select throws_ok(
  $$insert into public.points_ledger (user_id, kind, amount, source, idempotency_key)
    values ('cc110000-0000-0000-0000-0000000000c1','earn',999999,'ops','ops:auto-presente')$$,
  '42501',
  null,
  'o cliente NAO lanca pontos para si mesmo');

-- -----------------------------------------------------------------------------
-- Pacote: so operador concede.
-- -----------------------------------------------------------------------------
select throws_ok(
  $$insert into public.customer_packages (user_id, package)
    values ('cc110000-0000-0000-0000-0000000000c1','billionaire')$$,
  '42501',
  null,
  'o cliente NAO se promove de pacote sozinho');

set local request.jwt.claims to '{"sub":"aa330000-0000-0000-0000-0000000000a3","role":"authenticated"}';
insert into public.customer_packages (user_id, package, granted_by)
values ('cc110000-0000-0000-0000-0000000000c1','black','aa330000-0000-0000-0000-0000000000a3');

set local request.jwt.claims to '{"sub":"cc110000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is(
  (select package::text from public.customer_packages where user_id = 'cc110000-0000-0000-0000-0000000000c1'),
  'black',
  'o cliente le o proprio pacote');

set local request.jwt.claims to '{"sub":"cc220000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is(
  (select count(*)::int from public.customer_packages),
  0,
  'o cliente NAO ve o pacote do vizinho');

-- -----------------------------------------------------------------------------
-- Append-only: provado como `postgres`, que ignora RLS e GRANT.
-- Se a tranca so existisse no GRANT, estas duas passariam.
-- -----------------------------------------------------------------------------
reset role;

select throws_ok(
  $$update public.points_ledger set amount = 999999 where id = '22220000-0000-0000-0000-000000002222'$$,
  '2F004',
  null,
  'UPDATE em lancamento e recusado ate para o dono do banco');

select throws_ok(
  $$delete from public.points_ledger where id = '22220000-0000-0000-0000-000000002222'$$,
  '2F004',
  null,
  'DELETE em lancamento e recusado ate para o dono do banco');

select is(
  (select amount from public.points_ledger where id = '22220000-0000-0000-0000-000000002222'),
  1000,
  'depois das duas tentativas o lancamento continua intacto');

-- -----------------------------------------------------------------------------
-- GRANT e RLS sao controles diferentes, e o projeto exige os dois.
--
-- O Supabase concede tudo a `anon` e `authenticated` por padrao em toda tabela
-- nova. A migration 20260828010000 revoga. Sem estas tres asercoes a regressao
-- passaria em silencio — foi assim que a armadilha mordeu quatro vezes.
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.points_ledger', 'SELECT'),
  'anon NAO tem privilegio de leitura no ledger, alem da RLS');

select ok(
  not has_table_privilege('anon', 'public.customer_packages', 'SELECT'),
  'anon NAO tem privilegio de leitura nos pacotes');

select ok(
  not has_table_privilege('authenticated', 'public.points_ledger', 'UPDATE'),
  'nem authenticated tem privilegio de UPDATE no ledger: append-only tambem no GRANT');

select * from finish();
rollback;
