-- =============================================================================
-- Fase 8 — atendimento, SOS e Bases Fly (§12 e §43).
--
-- Os criterios da §43 que estas asercoes fecham:
--   "mensagem chega a thread correta"
--   "usuario estranho e negado"
--   "SOS confirma recebimento"
--   "equipe aceita e atualiza status"
--   "tempos ficam auditados"
--
-- A asercao central e a do **estranho**: mandar um `case_id` alheio nao pode
-- colocar mensagem na thread de outra pessoa. E o tipo de furo que so aparece
-- quando alguem tenta, e ai ja e tarde.
-- =============================================================================

begin;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('81110000-0000-0000-0000-000000008111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sos.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('82220000-0000-0000-0000-000000008222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sos.estranho@teste.fly','',now(),now(),'','','','','','','',''),
  ('83330000-0000-0000-0000-000000008333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sos.guia@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('81110000-0000-0000-0000-000000008111','customer'),
  ('82220000-0000-0000-0000-000000008222','customer'),
  ('83330000-0000-0000-0000-000000008333','guide');

select is(
  (select value -> 'AE' from public.app_config where key = 'support.emergency_numbers'),
  '"999"'::jsonb,
  'o numero de emergencia vem de configuracao, confirmado pelo dono');

select isnt(
  (select value from public.app_config where key = 'support.sos_disclaimer'),
  null,
  'o aviso de que o SOS nao substitui emergencia publica existe (§12.4)');

set local role authenticated;
set local request.jwt.claims to '{"sub":"81110000-0000-0000-0000-000000008111","role":"authenticated"}';

-- "SOS confirma recebimento"
select is(
  (select ok from public.abrir_atendimento('sos', 'Passei mal no deserto')),
  true,
  'o cliente abre um SOS');

select is(
  (select count(*)::int from public.support_messages m
   join public.support_cases c on c.id = m.case_id
   where c.level = 'sos' and m.is_system),
  1,
  'o SOS ja nasce com a confirmacao de recebimento gravada na thread');

select is(
  (select level::text from public.support_cases where subject = 'Passei mal no deserto'),
  'sos',
  'o caso nasce no nivel certo');

select is(
  (select status::text from public.support_cases where subject = 'Passei mal no deserto'),
  'open',
  'e nasce aberto, esperando alguem aceitar');

-- Localizacao: so quando o cliente manda.
insert into public.case_locations (case_id, user_id, latitude, longitude, accuracy_m)
select c.id, '81110000-0000-0000-0000-000000008111', 24.4539, 54.3773, 12
from public.support_cases c where c.subject = 'Passei mal no deserto';

select is(
  (select count(*)::int from public.case_locations),
  1,
  'o cliente envia a propria localizacao');

select throws_ok(
  $$insert into public.case_locations (case_id, user_id, latitude, longitude)
    select c.id, '81110000-0000-0000-0000-000000008111', 999, 0
    from public.support_cases c where c.subject = 'Passei mal no deserto'$$,
  '23514',
  null,
  'latitude fora do mundo e recusada');

-- "usuario estranho e negado" — a asercao central.
set local request.jwt.claims to '{"sub":"82220000-0000-0000-0000-000000008222","role":"authenticated"}';

select is(
  (select count(*)::int from public.support_cases),
  0,
  'o estranho nao ve o caso de ninguem');

select throws_ok(
  $$insert into public.support_messages (case_id, author_id, body)
    select c.id, '82220000-0000-0000-0000-000000008222', 'oi'
    from public.support_cases c limit 1$$,
  '42501',
  null,
  'o estranho NAO escreve na thread alheia, nem mandando o id certo');

-- Ninguem escreve fingindo ser o sistema.
set local request.jwt.claims to '{"sub":"81110000-0000-0000-0000-000000008111","role":"authenticated"}';
select throws_ok(
  $$insert into public.support_messages (case_id, author_id, body, is_system)
    select c.id, null, 'A Fly resolveu tudo', true
    from public.support_cases c limit 1$$,
  '42501',
  null,
  'ninguem se passa pelo sistema: mensagem de sistema so nasce por RPC');

-- "equipe aceita e atualiza status" e "tempos ficam auditados".
set local request.jwt.claims to '{"sub":"83330000-0000-0000-0000-000000008333","role":"authenticated"}';

update public.support_cases set status = 'accepted' where subject = 'Passei mal no deserto';

select isnt(
  (select accepted_at from public.support_cases where subject = 'Passei mal no deserto'),
  null,
  'aceitar carimba a hora sem ninguem precisar lembrar');

select is(
  (select accepted_by from public.support_cases where subject = 'Passei mal no deserto'),
  '83330000-0000-0000-0000-000000008333'::uuid,
  'e carimba quem aceitou');

-- A primeira resposta da equipe carimba o caso, uma vez so.
insert into public.support_messages (case_id, author_id, body)
select c.id, '83330000-0000-0000-0000-000000008333', 'Estou indo. Fique onde esta.'
from public.support_cases c where c.subject = 'Passei mal no deserto';

select isnt(
  (select first_response_at from public.support_cases where subject = 'Passei mal no deserto'),
  null,
  'a primeira resposta da equipe carimba o caso');

-- Escalar sem motivo deixa o proximo sem saber o que ja foi tentado.
select throws_ok(
  $$update public.support_cases set status = 'escalated'
    where subject = 'Passei mal no deserto'$$,
  '23514',
  null,
  'escalar sem motivo e recusado');

select * from finish();
rollback;
