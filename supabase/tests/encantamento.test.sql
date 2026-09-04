-- =============================================================================
-- Fase 9 — escuta ativa e tarefas de surpresa (§13.3, §13.4 e §44).
--
-- Duas asercoes carregam este arquivo:
--
--   "insight interno nunca chega ao app" — e o cliente **nao le nem os
--   proprios**. Toda outra tabela de cliente neste projeto e "a propria
--   pessoa, mais a equipe"; esta quebra o molde de proposito, e copiar o
--   molde por engano passaria despercebido, porque nenhuma tela do app pede
--   esta tabela.
--
--   "surpresa segue papeis e orcamento" — guia entrega, mas nao autoriza
--   dinheiro.
-- =============================================================================

begin;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('e1110000-0000-0000-0000-00000000e111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','enc.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('e2220000-0000-0000-0000-00000000e222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','enc.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('e3330000-0000-0000-0000-00000000e333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','enc.experiencia@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('e1110000-0000-0000-0000-00000000e111','customer'),
  ('e2220000-0000-0000-0000-00000000e222','guide'),
  ('e3330000-0000-0000-0000-00000000e333','experience');

insert into public.guest_insights (id, user_id, category, urgency, note, created_by)
values ('e5000000-0000-0000-0000-00000000e500','e1110000-0000-0000-0000-00000000e111',
        'desejo', 'alta', 'Falou que queria uma camisa do time.',
        'e2220000-0000-0000-0000-00000000e222');

insert into public.surprise_tasks (id, user_id, insight_id, title, created_by)
values ('e6000000-0000-0000-0000-00000000e600','e1110000-0000-0000-0000-00000000e111',
        'e5000000-0000-0000-0000-00000000e500', 'Camisa do time no quarto',
        'e3330000-0000-0000-0000-00000000e333');

-- =============================================================================
-- O teto nasce PENDENTE (§33).
-- =============================================================================
select is(
  (select value from public.app_config where key = 'encantamento.budget_cap'),
  '"PENDENTE"'::jsonb,
  'o teto de orcamento nasce PENDENTE: "orcamento de encantamento" e da lista da §33');

select ok(
  not has_table_privilege('anon', 'public.guest_insights', 'SELECT'),
  'anon NAO le anotacao interna nenhuma');

select ok(
  not has_table_privilege('authenticated', 'public.guest_insights', 'UPDATE'),
  'anotacao nao se edita: o registro do que se ouviu e o valor');

select ok(
  not has_table_privilege('authenticated', 'public.guest_insights', 'DELETE'),
  'nem se apaga');

select ok(
  not has_table_privilege('authenticated', 'public.surprise_tasks', 'DELETE'),
  'tarefa de surpresa nao se apaga: cancelar e mudanca de estado');

set local role authenticated;

-- =============================================================================
-- O CLIENTE NAO LE — nem as proprias anotacoes (§13.4).
-- =============================================================================
set local request.jwt.claims to '{"sub":"e1110000-0000-0000-0000-00000000e111","role":"authenticated"}';

select is(
  (select count(*)::int from public.guest_insights),
  0,
  'o cliente NAO le a anotacao interna sobre ele mesmo (§13.4)');

select is(
  (select count(*)::int from public.surprise_tasks),
  0,
  'nem a tarefa de surpresa: revelar antes da entrega mata a surpresa (§13.3)');

-- O unico bit que atravessa a parede. Ainda nao foi aprovada, entao e falso.
select is(
  (select public.tem_surpresa_a_caminho()),
  false,
  'sem surpresa aprovada, o teaser nao aparece');

-- =============================================================================
-- Papeis: quem registra, quem aprova.
-- =============================================================================
set local request.jwt.claims to '{"sub":"e2220000-0000-0000-0000-00000000e222","role":"authenticated"}';

select is(
  (select count(*)::int from public.guest_insights),
  1,
  'a equipe de campo le a fila de insights');

insert into public.guest_insights (user_id, category, note, created_by)
values ('e1110000-0000-0000-0000-00000000e111', 'incomodo',
        'Sentiu falta de agua com gas no quarto.', 'e2220000-0000-0000-0000-00000000e222');

select is(
  (select count(*)::int from public.guest_insights),
  2,
  'e o guia registra outra — escuta ativa e trabalho de campo (§13.4)');

-- Guia entrega surpresa, mas nao autoriza dinheiro.
select throws_ok(
  $$select * from public.aprovar_surpresa(
      'e6000000-0000-0000-0000-00000000e600', 12000, 'AED')$$,
  '42501',
  null,
  'o guia NAO aprova gasto: aprovacao e da Gerencia da Experiencia (§13.3)');

-- =============================================================================
-- A Gerencia da Experiencia aprova, com orcamento.
-- =============================================================================
set local request.jwt.claims to '{"sub":"e3330000-0000-0000-0000-00000000e333","role":"authenticated"}';

select is(
  (select ok from public.aprovar_surpresa(
     'e6000000-0000-0000-0000-00000000e600', null, 'AED')),
  false,
  'aprovar sem orcamento e recusado — "surpresa segue papeis e orcamento" (§44)');

select is(
  (select ok from public.aprovar_surpresa(
     'e6000000-0000-0000-0000-00000000e600', 12000, 'AED')),
  true,
  'com orcamento e moeda, a Gerencia da Experiencia aprova');

select is(
  (select approved_by from public.surprise_tasks
   where id = 'e6000000-0000-0000-0000-00000000e600'),
  'e3330000-0000-0000-0000-00000000e333'::uuid,
  'e fica registrado quem aprovou');

-- =============================================================================
-- Agora o cliente ve o bit — e continua sem ver o resto.
-- =============================================================================
set local request.jwt.claims to '{"sub":"e1110000-0000-0000-0000-00000000e111","role":"authenticated"}';

select is(
  (select public.tem_surpresa_a_caminho()),
  true,
  'aprovada, o teaser aparece: "seu proximo capitulo ja esta sendo preparado" (§13.3)');

select * from finish();
rollback;
