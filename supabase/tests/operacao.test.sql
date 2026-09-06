-- =============================================================================
-- Fase 11 — a operação sem SQL (§46, entregas 5, 10 e 11).
--
-- Duas asserções são a razão deste arquivo existir:
--
--   1. `authenticated` perdeu INSERT/UPDATE/DELETE em `app_config` e
--      `feature_flags`. RLS e GRANT são controles diferentes, e este arquivo
--      confere o GRANT — a policy sozinha nunca foi o controle.
--
--   2. O último admin não sai. Sem essa trava, uma pessoa cansada tira o
--      próprio papel e a única saída é abrir o banco.
-- =============================================================================

begin;

select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('f1000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.admin@teste.fly','',now(),now(),'','','','','','','',''),
  ('f2000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.gerente@teste.fly','',now(),now(),'','','','','','','',''),
  ('f3000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.suporte@teste.fly','',now(),now(),'','','','','','','',''),
  ('f4000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('f5000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('f6000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.admin2@teste.fly','',now(),now(),'','','','','','','',''),
  ('f7000000-0000-0000-0000-0000000000f7','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op.cliente2@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('f1000000-0000-0000-0000-0000000000f1','admin'),
  ('f2000000-0000-0000-0000-0000000000f2','trip_manager'),
  ('f3000000-0000-0000-0000-0000000000f3','support'),
  ('f4000000-0000-0000-0000-0000000000f4','customer'),
  ('f7000000-0000-0000-0000-0000000000f7','customer');

insert into public.destinations (slug, name, country, timezone)
values ('op-dubai', 'Dubai Operacao', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'fa000000-0000-0000-0000-0000000000fa', d.id, 'Viagem da operacao', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'op-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('fa000000-0000-0000-0000-0000000000fa','f4000000-0000-0000-0000-0000000000f4'),
  ('fa000000-0000-0000-0000-0000000000fa','f7000000-0000-0000-0000-0000000000f7');

insert into public.notification_categories (key, label, description, is_critical, sort_order) values
  ('op_critico', 'Alerta da viagem', 'Nao se silencia.', true, 10),
  ('op_comum',   'Recado',           'Da para silenciar.', false, 20)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- GRANT — o controle que a policy não faz
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.app_config', 'UPDATE'),
  'authenticated NAO tem UPDATE em app_config: a unica porta e a RPC, e a RPC grava a trilha');

select ok(
  not has_table_privilege('authenticated', 'public.app_config', 'INSERT'),
  'nem INSERT');

select ok(
  not has_table_privilege('authenticated', 'public.feature_flags', 'UPDATE'),
  'nem em feature_flags');

select ok(
  has_table_privilege('authenticated', 'public.app_config', 'SELECT'),
  'ler continua liberado — o app resolve a propria configuracao');

select ok(
  not has_table_privilege('anon', 'public.trip_feature_flags', 'SELECT'),
  'anon nao le flag de viagem nenhuma');

select ok(
  not has_table_privilege('authenticated', 'public.trip_feature_flags', 'INSERT'),
  'e nem authenticated escreve sobreposicao de flag direto');

-- -----------------------------------------------------------------------------
-- Papéis
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"f3000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select throws_ok(
  $$select * from public.conceder_papel('f5000000-0000-0000-0000-0000000000f5', 'guide')$$,
  '42501',
  null,
  'support nao concede papel: conceder e do admin');

set local request.jwt.claims to '{"sub":"f1000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select is(
  (select ok from public.conceder_papel('f5000000-0000-0000-0000-0000000000f5', 'guide')),
  true,
  'o admin concede o papel de guia');

select is(
  (select count(*)::int from public.user_roles ur
    where ur.user_id = 'f5000000-0000-0000-0000-0000000000f5' and ur.role = 'guide'),
  1,
  'e a linha existe');

-- O papel gravado na trilha e o MAIOR de quem agiu. A ordem do enum fly_role
-- foi declarada do menor para o maior privilegio, e e por isso que max() serve.
select is(
  (select actor_role from public.audit_logs
    where action = 'papel.concedido' order by occurred_at desc limit 1),
  'admin'::public.fly_role,
  'a trilha registra quem agiu, e com que papel');

select is(
  (select motivo from public.conceder_papel('f4000000-0000-0000-0000-0000000000f4', 'customer')),
  'Este papel vem do convite aceito, não do painel.',
  'customer nao se concede pelo painel: viraria um segundo caminho para virar cliente, sem convite');

select is(
  (select motivo from public.revogar_papel('f1000000-0000-0000-0000-0000000000f1', 'admin')),
  'Este é o último admin. Conceda o papel a outra pessoa antes de tirar este.',
  'o ultimo admin nao sai — sem essa trava a saida seria abrir o banco');

select is(
  (select ok from public.conceder_papel('f6000000-0000-0000-0000-0000000000f6', 'admin')),
  true,
  'havendo um segundo admin…');

select is(
  (select ok from public.revogar_papel('f1000000-0000-0000-0000-0000000000f1', 'admin')),
  true,
  '…o primeiro pode sair');

-- Quem devolve o papel e o SEGUNDO admin: f1 acabou de perder o dele, e a
-- sessao continua sendo a dele. E exatamente o beco que a trava evita.
set local request.jwt.claims to '{"sub":"f6000000-0000-0000-0000-0000000000f6","role":"authenticated"}';

select is(
  (select ok from public.conceder_papel('f1000000-0000-0000-0000-0000000000f1', 'admin')),
  true,
  'e volta quando o outro admin concede — quem perdeu o papel nao se devolve sozinho');

-- -----------------------------------------------------------------------------
-- Atribuição
-- -----------------------------------------------------------------------------
select is(
  (select motivo from public.atribuir_a_viagem(
    'f3000000-0000-0000-0000-0000000000f3', 'fa000000-0000-0000-0000-0000000000fa', 'guide')),
  'Conceda o papel antes de atribuir à viagem.',
  'atribuir sem o papel e recusado: a pessoa ficaria dentro da viagem sem poder fazer nada');

select is(
  (select ok from public.atribuir_a_viagem(
    'f5000000-0000-0000-0000-0000000000f5', 'fa000000-0000-0000-0000-0000000000fa', 'guide')),
  true,
  'com o papel, atribui');

select is(
  (select ok from public.revogar_atribuicao(
    (select id from public.staff_assignments
      where user_id = 'f5000000-0000-0000-0000-0000000000f5' limit 1))),
  true,
  'e revoga');

select is(
  (select ok from public.atribuir_a_viagem(
    'f5000000-0000-0000-0000-0000000000f5', 'fa000000-0000-0000-0000-0000000000fa', 'guide')),
  true,
  'reatribuir o mesmo trio reabre a linha em vez de esbarrar no unique');

select is(
  (select count(*)::int from public.staff_assignments
    where user_id = 'f5000000-0000-0000-0000-0000000000f5'
      and trip_id = 'fa000000-0000-0000-0000-0000000000fa'),
  1,
  'e continua sendo uma linha só');

-- O suporte precisa estar na viagem para avisar quem esta nela. `support` nao
-- e operador global: sem atribuicao, `can_operate_trip` diz nao — e diz certo.
select is(
  (select ok from public.atribuir_a_viagem(
    'f3000000-0000-0000-0000-0000000000f3', 'fa000000-0000-0000-0000-0000000000fa', 'support')),
  true,
  'e o suporte entra na viagem para poder operar nela');

-- -----------------------------------------------------------------------------
-- Configuração e flags
-- -----------------------------------------------------------------------------
select is(
  (select ok from public.definir_config('op.teste', '"valor"'::jsonb, 'Teste', false)),
  true,
  'o admin muda configuracao pela RPC');

select is(
  (select l.metadata ->> 'depois' from public.audit_logs l
    where l.action = 'config.criada' and l.entity_id = 'op.teste' limit 1),
  '"valor"',
  'e o valor novo fica na trilha — a pergunta "quem mudou isso?" passa a ter resposta');

select is(
  (select ok from public.definir_flag('op.flag', true, 'Teste')),
  true,
  'liga a flag global');

select is(
  (select ok from public.definir_flag_da_viagem(
    'fa000000-0000-0000-0000-0000000000fa', 'op.flag', false)),
  true,
  'e desliga só naquela viagem');

select is(
  public.flag_da_viagem('op.flag', 'fa000000-0000-0000-0000-0000000000fa'),
  false,
  'a sobreposicao vence a global');

-- -----------------------------------------------------------------------------
-- Avisos — a caixa que ninguém conseguia encher
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"f4000000-0000-0000-0000-0000000000f4","role":"authenticated"}';

insert into public.notification_preferences (user_id, category_key, is_enabled)
values ('f4000000-0000-0000-0000-0000000000f4', 'op_comum', false);

set local request.jwt.claims to '{"sub":"f3000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select is(
  (select silenciados from public.enviar_aviso(
    'fa000000-0000-0000-0000-0000000000fa', 'op_comum', 'Recado do dia')),
  1,
  'quem desligou a categoria nao recebe — e o painel diz quantos foram, ou o operador acha que avisou todo mundo');

select is(
  (select enviados from public.enviar_aviso(
    'fa000000-0000-0000-0000-0000000000fa', 'op_critico', 'Mudou o ponto de encontro')),
  2,
  'alerta critico chega a todos: a §26 nao deixa silenciar');

-- -----------------------------------------------------------------------------
-- Trilha e exportação
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"f4000000-0000-0000-0000-0000000000f4","role":"authenticated"}';

select is(
  (select count(*)::int from public.audit_logs),
  0,
  'o cliente nao le a trilha de auditoria');

select throws_ok(
  $$select public.registrar_exportacao('clientes', '{}'::jsonb, 10)$$,
  '42501',
  null,
  'nem registra exportacao');

select * from finish();
rollback;
