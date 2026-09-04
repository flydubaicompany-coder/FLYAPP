-- =============================================================================
-- Fase 10 — Assistente Fly (§15.1 e §45).
--
-- A asercao central deste arquivo e a do **GRANT de insert em
-- `assistant_runs`**: ele nao existe. Se o cliente pudesse inserir ali, ele
-- escreveria a propria medicao de custo, e a auditoria de gasto viraria
-- ficcao. Quem grava e a Edge Function, com `service_role`.
--
-- A segunda e a do assistente nascer **desligado**: a §45 fecha com
-- "integracao nao homologada permanece desligada", e nao ha credencial de
-- modelo neste projeto.
-- =============================================================================

begin;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('b1110000-0000-0000-0000-00000000b111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ia.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('b2220000-0000-0000-0000-00000000b222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ia.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('b3330000-0000-0000-0000-00000000b333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ia.suporte@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('b1110000-0000-0000-0000-00000000b111','customer'),
  ('b2220000-0000-0000-0000-00000000b222','customer'),
  ('b3330000-0000-0000-0000-00000000b333','support');

-- Uma conversa que a Edge Function teria gravado.
insert into public.assistant_runs (id, user_id, pergunta, resposta, provedor, resultado,
                                   tokens_entrada, tokens_saida, custo_estimado_centavos)
values ('b9000000-0000-0000-0000-00000000b900','b1110000-0000-0000-0000-00000000b111',
        'A que horas sai o transfer amanha?', 'As 8h, do lobby.', 'claude', 'respondeu',
        4200, 180, 7);

insert into public.assistant_tool_calls (run_id, ferramenta, autorizada, linhas)
values
  ('b9000000-0000-0000-0000-00000000b900','roteiro_do_dia', true, 4),
  -- A recusada tambem fica. Uma sequencia delas e o sinal de que alguem esta
  -- tentando alcancar dado alheio pelo assistente.
  ('b9000000-0000-0000-0000-00000000b900','passaporte', false, null);

-- =============================================================================
-- Nasce desligado (§45, entrega 10).
-- =============================================================================
select is(
  (select is_enabled from public.feature_flags where key = 'assistant.enabled'),
  false,
  'o assistente nasce desligado: integracao nao homologada permanece desligada (§45)');

select is(
  (select value from public.app_config where key = 'assistant.provider'),
  '"PENDENTE"'::jsonb,
  'e sem provedor: nao ha credencial de modelo, e a §33 nao deixa declarar integracao sem ela');

select is(
  (select is_public from public.app_config where key = 'assistant.pricing_usd_per_million'),
  false,
  'o preco do fornecedor NAO e publico — e custo da Fly, nao taxa do cliente');

-- =============================================================================
-- GRANT: ninguem escreve a propria medicao de custo.
-- =============================================================================
select ok(
  not has_table_privilege('authenticated', 'public.assistant_runs', 'INSERT'),
  'authenticated NAO insere em assistant_runs — quem grava e a Edge Function');

select ok(
  not has_table_privilege('authenticated', 'public.assistant_runs', 'UPDATE'),
  'nem edita: medicao de custo que o medido pode reescrever nao e medicao');

select ok(
  not has_table_privilege('authenticated', 'public.assistant_tool_calls', 'INSERT'),
  'nem escreve a propria auditoria de ferramenta');

select ok(
  not has_table_privilege('anon', 'public.assistant_runs', 'SELECT'),
  'anon NAO le conversa de ninguem');

select ok(
  not has_table_privilege('authenticated', 'public.assistant_feedback', 'UPDATE'),
  'feedback nao se reescreve: a opiniao de ontem e um dado, e nao um rascunho');

set local role authenticated;

-- =============================================================================
-- O cliente le a propria conversa, e so a propria.
-- =============================================================================
set local request.jwt.claims to '{"sub":"b1110000-0000-0000-0000-00000000b111","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_runs),
  1,
  'o cliente le a propria conversa — diferente da anotacao interna, ele mesmo a escreveu');

select is(
  (select count(*)::int from public.assistant_tool_calls),
  2,
  'e ve quais ferramentas foram consultadas em nome dele, inclusive a recusada');

-- =============================================================================
-- O feedback e a unica coisa que o cliente escreve — e so sobre a conversa dele.
-- =============================================================================
insert into public.assistant_feedback (run_id, user_id, util, motivo)
values ('b9000000-0000-0000-0000-00000000b900','b1110000-0000-0000-0000-00000000b111',
        false, 'O horario estava certo, mas o ponto de encontro nao.');

select is(
  (select util from public.assistant_feedback
   where run_id = 'b9000000-0000-0000-0000-00000000b900'),
  false,
  'o cliente recusa a resposta — "recomendacao pode ser recusada" (§45, entrega 4)');

-- =============================================================================
-- Conversa alheia.
-- =============================================================================
set local request.jwt.claims to '{"sub":"b2220000-0000-0000-0000-00000000b222","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_runs),
  0,
  'o estranho nao ve conversa de ninguem');

select is(
  (select count(*)::int from public.assistant_tool_calls),
  0,
  'nem a auditoria de ferramenta dela');

select throws_ok(
  $$insert into public.assistant_feedback (run_id, user_id, util)
    values ('b9000000-0000-0000-0000-00000000b900','b2220000-0000-0000-0000-00000000b222', true)$$,
  '42501',
  null,
  'e nao opina sobre conversa alheia');

-- =============================================================================
-- A equipe le, porque o handoff precisa levar contexto (§45, entrega 3).
-- =============================================================================
set local request.jwt.claims to '{"sub":"b3330000-0000-0000-0000-00000000b333","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_runs),
  1,
  'o suporte le a conversa: sem isso, o handoff chegaria sem contexto');

select * from finish();
rollback;
