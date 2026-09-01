-- =============================================================================
-- Notas fiscais (§41, entrega 11) — sem scanner, por decisao do dono.
--
-- A pessoa manda a foto e a Fly revisa. A **unica** coisa que o sistema decide
-- sozinho e duplicidade, e e disso que estas asercoes tratam.
--
-- O caso que mais importa e o **falso positivo**: valor diferente nao pode ser
-- marcado como duplicado. Marcar errado faz o cliente perder uma nota
-- legitima, e ele so descobre quando o tax-free vier menor.
-- =============================================================================

begin;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('e1110000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','nota.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('e2220000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','nota.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('e3330000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','nota.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('e1110000-0000-0000-0000-0000000000e1','customer'),
  ('e2220000-0000-0000-0000-0000000000e2','customer'),
  ('e3330000-0000-0000-0000-0000000000e3','admin');

select is(
  (select value from public.app_config where key = 'taxfree.rule'),
  'null'::jsonb,
  'a regra de tax-free nasce nula: a §33 proibe inventar');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1110000-0000-0000-0000-0000000000e1","role":"authenticated"}';

insert into public.receipts (id, user_id, storage_path, merchant, amount_cents, currency, issued_on)
values ('f1110000-0000-0000-0000-0000000000f1','e1110000-0000-0000-0000-0000000000e1',
        'e1110000-0000-0000-0000-0000000000e1/f1.jpg','Galeries Lafayette', 45000, 'AED', current_date - 3);

select is(
  (select status::text from public.receipts where id = 'f1110000-0000-0000-0000-0000000000f1'),
  'received',
  'a primeira nota entra como recebida');

-- A mesma nota de novo, com caixa e acento diferentes.
insert into public.receipts (id, user_id, storage_path, merchant, amount_cents, currency, issued_on)
values ('f2220000-0000-0000-0000-0000000000f2','e1110000-0000-0000-0000-0000000000e1',
        'e1110000-0000-0000-0000-0000000000e1/f2.jpg','  galeries  LAFAYETTE ', 45000, 'AED', current_date - 3);

select is(
  (select status::text from public.receipts where id = 'f2220000-0000-0000-0000-0000000000f2'),
  'duplicate',
  'caixa e espaco a mais nao escondem que e a mesma nota');

select is(
  (select duplicate_of from public.receipts where id = 'f2220000-0000-0000-0000-0000000000f2'),
  'f1110000-0000-0000-0000-0000000000f1'::uuid,
  'a duplicada aponta para a original');

-- O falso positivo: valor diferente NAO e duplicata.
insert into public.receipts (id, user_id, storage_path, merchant, amount_cents, currency, issued_on)
values ('f3330000-0000-0000-0000-0000000000f3','e1110000-0000-0000-0000-0000000000e1',
        'e1110000-0000-0000-0000-0000000000e1/f3.jpg','Galeries Lafayette', 45001, 'AED', current_date - 3);

select is(
  (select status::text from public.receipts where id = 'f3330000-0000-0000-0000-0000000000f3'),
  'received',
  'valor diferente NAO e duplicata: marcar errado custa uma nota legitima');

-- Nota de outra pessoa com os mesmos dados nao e duplicata.
set local request.jwt.claims to '{"sub":"e2220000-0000-0000-0000-0000000000e2","role":"authenticated"}';
insert into public.receipts (id, user_id, storage_path, merchant, amount_cents, currency, issued_on)
values ('f4440000-0000-0000-0000-0000000000f4','e2220000-0000-0000-0000-0000000000e2',
        'e2220000-0000-0000-0000-0000000000e2/f4.jpg','Galeries Lafayette', 45000, 'AED', current_date - 3);

select is(
  (select status::text from public.receipts where id = 'f4440000-0000-0000-0000-0000000000f4'),
  'received',
  'duas pessoas comprando o mesmo no mesmo dia nao e duplicidade');

select is(
  (select count(*)::int from public.receipts),
  1,
  'o cliente ve so as proprias notas');

-- Sem os quatro campos nao se afirma nada.
set local request.jwt.claims to '{"sub":"e1110000-0000-0000-0000-0000000000e1","role":"authenticated"}';
insert into public.receipts (id, user_id, storage_path, merchant)
values ('f5550000-0000-0000-0000-0000000000f5','e1110000-0000-0000-0000-0000000000e1',
        'e1110000-0000-0000-0000-0000000000e1/f5.jpg','Galeries Lafayette');

select is(
  (select status::text from public.receipts where id = 'f5550000-0000-0000-0000-0000000000f5'),
  'received',
  'sem valor e data nao se afirma duplicidade: vai para revisao humana');

-- O cliente nao decide se a propria nota vale.
update public.receipts set status = 'approved'
where id = 'f1110000-0000-0000-0000-0000000000f1';

select is(
  (select status::text from public.receipts where id = 'f1110000-0000-0000-0000-0000000000f1'),
  'received',
  'o cliente NAO aprova a propria nota: UPDATE barrado filtra zero linhas');

-- A equipe revisa, e recusar exige motivo.
set local request.jwt.claims to '{"sub":"e3330000-0000-0000-0000-0000000000e3","role":"authenticated"}';

select throws_ok(
  $$update public.receipts set status = 'rejected'
    where id = 'f1110000-0000-0000-0000-0000000000f1'$$,
  '23514',
  null,
  'recusar sem motivo e recusado: o cliente precisa saber o que corrigir');

update public.receipts
set status = 'approved', reviewed_by = 'e3330000-0000-0000-0000-0000000000e3', reviewed_at = now()
where id = 'f1110000-0000-0000-0000-0000000000f1';

select is(
  (select status::text from public.receipts where id = 'f1110000-0000-0000-0000-0000000000f1'),
  'approved',
  'a equipe aprova');

select * from finish();
rollback;
