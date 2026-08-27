-- =============================================================================
-- Fase 4 — Minha Viagem (§7 e §39)
--
-- Os critérios da §39 viram asserção aqui, e cada acesso vem em par: quem
-- pode e quem não pode (D37).
--
-- Os dois que mais importam:
--
--   "documento sem grant é negado"  — inclusive para a equipe da viagem.
--   "QR expirado/usado é recusado"  — cada motivo distinto do outro.
-- =============================================================================

begin;

select plan(52);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('11aa0000-0000-0000-0000-0000000011aa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mv.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('22bb0000-0000-0000-0000-0000000022bb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mv.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('33cc0000-0000-0000-0000-0000000033cc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mv.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('44dd0000-0000-0000-0000-0000000044dd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mv.guia.outra@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('11aa0000-0000-0000-0000-0000000011aa','customer'),
  ('22bb0000-0000-0000-0000-0000000022bb','customer'),
  ('33cc0000-0000-0000-0000-0000000033cc','guide'),
  ('44dd0000-0000-0000-0000-0000000044dd','guide');

insert into public.destinations (slug, name, country, timezone)
values ('mv-dubai', 'Dubai MV', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

-- Duas viagens: A, com o cliente e o guia; B, com o outro cliente e o outro guia.
insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'aa000000-0000-0000-0000-0000000000aa', d.id, 'Viagem A', 'ongoing',
       (now() at time zone d.timezone)::date - 1,
       (now() at time zone d.timezone)::date + 5
from public.destinations d where d.slug = 'mv-dubai';

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'bb000000-0000-0000-0000-0000000000bb', d.id, 'Viagem B', 'published',
       (now() at time zone d.timezone)::date + 30,
       (now() at time zone d.timezone)::date + 37
from public.destinations d where d.slug = 'mv-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('aa000000-0000-0000-0000-0000000000aa','11aa0000-0000-0000-0000-0000000011aa'),
  ('bb000000-0000-0000-0000-0000000000bb','22bb0000-0000-0000-0000-0000000022bb');

insert into public.staff_assignments (user_id, trip_id, role) values
  ('33cc0000-0000-0000-0000-0000000033cc','aa000000-0000-0000-0000-0000000000aa','guide'),
  ('44dd0000-0000-0000-0000-0000000044dd','bb000000-0000-0000-0000-0000000000bb','guide');

insert into public.trip_days (id, trip_id, day_number, day_date)
select 'd1000000-0000-0000-0000-0000000000d1', 'aa000000-0000-0000-0000-0000000000aa', 1,
       (now() at time zone d.timezone)::date - 1
from public.destinations d where d.slug = 'mv-dubai';

insert into public.trip_days (id, trip_id, day_number, day_date)
select 'd2000000-0000-0000-0000-0000000000d2', 'bb000000-0000-0000-0000-0000000000bb', 1,
       (now() at time zone d.timezone)::date + 30
from public.destinations d where d.slug = 'mv-dubai';

-- Uma acontecendo agora, uma daqui a pouco, uma na viagem B.
insert into public.activities (id, trip_day_id, title, status, starts_at, ends_at, departure_at, meeting_point)
values
  ('ac100000-0000-0000-0000-0000000000a1','d1000000-0000-0000-0000-0000000000d1','Deserto agora','in_progress',
   now() - interval '30 minutes', now() + interval '2 hours', null, 'Lobby'),
  ('ac200000-0000-0000-0000-0000000000a2','d1000000-0000-0000-0000-0000000000d1','Jantar depois','confirmed',
   now() + interval '5 hours', now() + interval '7 hours', now() + interval '4 hours', 'Portaria'),
  ('ac300000-0000-0000-0000-0000000000a3','d2000000-0000-0000-0000-0000000000d2','Passeio da B','scheduled',
   now() + interval '31 days', now() + interval '31 days 2 hours', null, 'Hall B');

-- =============================================================================
-- 1. O cliente vê somente a viagem correta (§39)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

select is((select count(*)::int from public.trip_days), 1,
  'cliente enxerga so os dias da propria viagem');

select is((select count(*)::int from public.activities), 2,
  'cliente enxerga so as atividades da propria viagem');

select is((select count(*)::int from public.activities
           where id = 'ac300000-0000-0000-0000-0000000000a3'), 0,
  'cliente NAO enxerga atividade de viagem alheia');

-- =============================================================================
-- 2. "Agora / Próximo" no fuso certo (§7.1 e §39)
-- =============================================================================
select is((select agora_titulo from public.viagem_atual()), 'Deserto agora',
  'agora e a atividade que ja comecou e nao terminou');

select is((select proximo_titulo from public.viagem_atual()), 'Jantar depois',
  'proximo e a primeira que ainda nao comecou');

select is((select proximo_saida from public.viagem_atual()),
          (select departure_at from public.activities where id = 'ac200000-0000-0000-0000-0000000000a2'),
  'horario de saida vem separado do de inicio');

select is((select day_number from public.viagem_atual()), 2,
  'dia da viagem contado no fuso do destino');

select is((select total_days from public.viagem_atual()), 7,
  'total de dias da viagem');

-- =============================================================================
-- 3. Guia atribuído opera; guia de outra viagem não
-- =============================================================================
set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select count(*)::int from public.activities
           where trip_day_id = 'd1000000-0000-0000-0000-0000000000d1'), 2,
  'guia atribuido enxerga o roteiro da viagem dele');

select lives_ok(
  $$update public.activities set instructions = 'levar agua'
    where id = 'ac100000-0000-0000-0000-0000000000a1'$$,
  'guia atribuido edita atividade da propria viagem');

set local request.jwt.claims to '{"sub":"44dd0000-0000-0000-0000-0000000044dd","role":"authenticated"}';

select is((select count(*)::int from public.activities
           where trip_day_id = 'd1000000-0000-0000-0000-0000000000d1'), 0,
  'guia de OUTRA viagem nao enxerga este roteiro');

-- RLS em UPDATE filtra linhas, nao lanca excecao. A pergunta certa e quantas
-- linhas mudaram — e a resposta tem que ser nenhuma.
update public.activities set title = 'invadido'
where id = 'ac100000-0000-0000-0000-0000000000a1';

set local role postgres;
select is((select title from public.activities where id = 'ac100000-0000-0000-0000-0000000000a1'),
          'Deserto agora',
  'guia de outra viagem NAO altera atividade alheia');

-- =============================================================================
-- 4. Mudança de horário marca alteração sozinha (§7.3)
-- =============================================================================
update public.activities
set starts_at = now() + interval '6 hours', requires_ack = true
where id = 'ac200000-0000-0000-0000-0000000000a2';

select is((select status::text from public.activities where id = 'ac200000-0000-0000-0000-0000000000a2'),
          'changed',
  'mudar horario marca a atividade como alterada');

select isnt((select changed_at from public.activities where id = 'ac200000-0000-0000-0000-0000000000a2'),
            null,
  'alteracao carimba a data');

-- Corrigir a descrição não é alteração de roteiro.
update public.activities set status = 'confirmed', changed_at = null
where id = 'ac100000-0000-0000-0000-0000000000a1';
update public.activities set description = 'texto novo'
where id = 'ac100000-0000-0000-0000-0000000000a1';

select is((select status::text from public.activities where id = 'ac100000-0000-0000-0000-0000000000a1'),
          'confirmed',
  'editar descricao NAO marca alteracao — o destaque so vale se for raro');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

select is((select alteracoes_sem_confirmacao from public.viagem_atual()), 1,
  'a viagem sinaliza a alteracao pendente de confirmacao');

insert into public.activity_acks (activity_id, user_id, changed_at)
select 'ac200000-0000-0000-0000-0000000000a2', '11aa0000-0000-0000-0000-0000000011aa', a.changed_at
from public.activities a where a.id = 'ac200000-0000-0000-0000-0000000000a2';

select is((select alteracoes_sem_confirmacao from public.viagem_atual()), 0,
  'confirmar leitura zera a pendencia');

-- =============================================================================
-- 5. Cofre: documento sem grant é negado (§39)
--
-- O ponto duro: **nem a equipe da viagem** vê o passaporte sem uma concessão
-- explícita. Ser guia da viagem não é credencial de acesso a documento.
-- =============================================================================
set local role postgres;

insert into public.documents (id, owner_id, trip_id, kind, title, storage_path, requires_biometric)
values
  ('d0c10000-0000-0000-0000-00000000d001','11aa0000-0000-0000-0000-0000000011aa',
   'aa000000-0000-0000-0000-0000000000aa','passport','Passaporte',
   '11aa0000-0000-0000-0000-0000000011aa/d0c10000-0000-0000-0000-00000000d001.jpg', true),
  ('d0c20000-0000-0000-0000-00000000d002','11aa0000-0000-0000-0000-0000000011aa',
   'aa000000-0000-0000-0000-0000000000aa','voucher','Voucher do hotel',
   '11aa0000-0000-0000-0000-0000000011aa/d0c20000-0000-0000-0000-00000000d002.pdf', false);

set local role authenticated;
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

select is((select count(*)::int from public.documents), 2,
  'dono enxerga os proprios documentos');

set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select count(*)::int from public.documents), 0,
  'guia da viagem NAO enxerga documento do cliente sem grant');

-- A negativa vem em `permitido`, e nao como excecao: `raise` desfaria o
-- registro da tentativa, que e justamente o que se quer guardar.
select is(
  (select permitido from public.abrir_documento('d0c10000-0000-0000-0000-00000000d001')),
  false,
  'abrir documento sem grant e negado'
);

select is(
  (select storage_path from public.abrir_documento('d0c10000-0000-0000-0000-00000000d001')),
  null,
  'e o caminho no Storage nao sai junto com a negativa'
);

-- Concedido pelo dono, com motivo.
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';
insert into public.document_grants (document_id, grantee_id, reason, granted_by)
values ('d0c20000-0000-0000-0000-00000000d002','33cc0000-0000-0000-0000-0000000033cc',
        'Conferencia do check-in do hotel','11aa0000-0000-0000-0000-0000000011aa');

set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select count(*)::int from public.documents), 1,
  'com grant, o guia enxerga o documento concedido');

select is((select count(*)::int from public.documents
           where id = 'd0c10000-0000-0000-0000-00000000d001'), 0,
  'e continua sem enxergar o passaporte, que nao foi concedido');

select is(
  (select permitido from public.abrir_documento('d0c20000-0000-0000-0000-00000000d002')),
  true,
  'com grant, abrir o documento funciona'
);

-- O log e do DONO, nao de quem acessou. Quem abriu nao le a propria linha:
-- se lesse, poderia conferir se o acesso dele foi notado.
select is((select count(*)::int from public.document_access_log
           where document_id = 'd0c20000-0000-0000-0000-00000000d002'), 0,
  'quem acessou NAO le o log de acesso');

select is((select count(*)::int from public.documents), 1,
  'e continua enxergando o documento concedido');

set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

select is((select count(*)::int from public.document_access_log
           where document_id = 'd0c20000-0000-0000-0000-00000000d002'), 1,
  'o DONO le o log e sabe que o documento foi aberto');

select is((select via from public.document_access_log
           where document_id = 'd0c20000-0000-0000-0000-00000000d002'), 'grant',
  'o registro diz por que o acesso foi permitido');

select is((select accessed_by from public.document_access_log
           where document_id = 'd0c20000-0000-0000-0000-00000000d002'),
          '33cc0000-0000-0000-0000-0000000033cc'::uuid,
  'e diz quem abriu');

-- Revogar o grant fecha a porta.
update public.document_grants set revoked_at = now()
where document_id = 'd0c20000-0000-0000-0000-00000000d002';

set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select count(*)::int from public.documents), 0,
  'grant revogado fecha o acesso');

-- Passaporte carrega duas garantias no schema, e não em código de tela.
set local role postgres;

select throws_ok(
  $$insert into public.documents (owner_id, kind, title, storage_path, requires_biometric)
    values ('11aa0000-0000-0000-0000-0000000011aa','passport','X','x/y.jpg', false)$$,
  '23514',
  null,
  'passaporte sem biometria e recusado pelo banco'
);

select throws_ok(
  $$insert into public.documents (owner_id, kind, title, storage_path, requires_biometric, cacheable_offline)
    values ('11aa0000-0000-0000-0000-0000000011aa','passport','X','x/y.jpg', true, true)$$,
  '23514',
  null,
  'passaporte nunca fica em cache no aparelho'
);

-- =============================================================================
-- 6. QR: expirado, revogado, duplicado e fora de escopo (§7.8 e §39)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

-- Emitir check-in da atividade de que participa.
select isnt(
  (select token from public.emitir_qr('activity_checkin', 'ac100000-0000-0000-0000-0000000000a1',
                                      null, null, 60, 1)),
  null,
  'cliente emite QR de check-in da propria atividade'
);

-- Pedir de novo devolve o mesmo: token novo a cada toque encheria a tabela
-- de códigos válidos que ninguém revoga.
select is(
  (select token from public.emitir_qr('activity_checkin','ac100000-0000-0000-0000-0000000000a1',
                                      null, null, 60, 1)),
  (select q.token from public.qr_tokens q
   where q.activity_id = 'ac100000-0000-0000-0000-0000000000a1'
     and q.user_id = '11aa0000-0000-0000-0000-0000000011aa'),
  'emitir de novo devolve o mesmo codigo, em vez de criar outro'
);

-- Atividade de outra viagem: não participa, não emite.
select throws_ok(
  $$select * from public.emitir_qr('activity_checkin','ac300000-0000-0000-0000-0000000000a3')$$,
  '42501',
  'nao participa desta atividade',
  'nao emite QR de atividade de que nao participa'
);

-- --- A leitura, pelo guia -----------------------------------------------
set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is(
  (select resultado::text from public.ler_qr(
     (select q.token from public.qr_tokens q
      where q.activity_id = 'ac100000-0000-0000-0000-0000000000a1'), 'activity_checkin')),
  'ok',
  'guia da viagem le o QR e o resultado e ok'
);

select is(
  (select count(*)::int from public.activity_checkins
   where activity_id = 'ac100000-0000-0000-0000-0000000000a1'
     and user_id = '11aa0000-0000-0000-0000-0000000011aa'),
  1,
  'check-in por QR registra presenca'
);

-- O mesmo código de novo: é o print circulando no grupo.
select is(
  (select resultado::text from public.ler_qr(
     (select q.token from public.qr_tokens q
      where q.activity_id = 'ac100000-0000-0000-0000-0000000000a1'), 'activity_checkin')),
  'already_used',
  'segundo uso do mesmo QR e recusado'
);

select is(
  (select count(*)::int from public.qr_scans where result = 'already_used'),
  1,
  'a recusa por uso duplicado fica registrada — e o sinal de print circulando'
);

-- Tipo errado.
select is(
  (select resultado::text from public.ler_qr(
     (select q.token from public.qr_tokens q
      where q.activity_id = 'ac100000-0000-0000-0000-0000000000a1'), 'ticket')),
  'wrong_scope',
  'QR de check-in lido como ingresso e recusado por escopo'
);

-- Token inexistente: registra e não diz mais que isso.
select is(
  (select resultado::text from public.ler_qr('token-que-nunca-existiu')),
  'unknown',
  'token inexistente e recusado sem revelar nada'
);

select is(
  (select count(*)::int from public.qr_scans where result = 'unknown'),
  1,
  'tentativa com token inexistente tambem fica registrada'
);

-- Expirado.
set local role postgres;
insert into public.qr_tokens (token, kind, user_id, trip_id, activity_id, expires_at, max_uses)
values ('token-vencido', 'activity_checkin', '11aa0000-0000-0000-0000-0000000011aa',
        'aa000000-0000-0000-0000-0000000000aa', 'ac200000-0000-0000-0000-0000000000a2',
        now() - interval '1 hour', 1);

set local role authenticated;
set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select resultado::text from public.ler_qr('token-vencido')), 'expired',
  'QR expirado e recusado, e o motivo e distinto de usado');

-- Revogado.
set local role postgres;
insert into public.qr_tokens (token, kind, user_id, trip_id, revoked_at)
values ('token-revogado', 'ticket', '11aa0000-0000-0000-0000-0000000011aa',
        'aa000000-0000-0000-0000-0000000000aa', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select resultado::text from public.ler_qr('token-revogado')), 'revoked',
  'QR revogado e recusado, e o motivo e distinto de expirado');

-- Guia de outra viagem lendo um código desta.
set local request.jwt.claims to '{"sub":"44dd0000-0000-0000-0000-0000000044dd","role":"authenticated"}';

select throws_ok(
  $$select * from public.ler_qr('token-revogado')$$,
  '42501',
  'nao opera esta viagem',
  'guia de outra viagem nao le codigo desta'
);

-- O cliente não escreve na tabela de códigos: emitir e revogar são RPC.
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

select throws_ok(
  $$insert into public.qr_tokens (token, kind, user_id) values ('escolhido-por-mim','ticket','11aa0000-0000-0000-0000-0000000011aa')$$,
  '42501',
  null,
  'cliente nao escolhe o proprio token'
);

/**
 * Zerar `uses` reusaria um codigo gasto.
 *
 * Este caso ensinou a diferenca, e vale escrita: com o GRANT aberto, a RLS
 * **filtra** o UPDATE e ele volta em silencio, sem excecao. Com o GRANT
 * revogado, o Postgres lanca 42501 antes de a RLS ser consultada.
 *
 * As duas asserçoes abaixo cobrem as duas camadas: a excecao prova o GRANT,
 * e o valor intacto prova que nada passou.
 */
select throws_ok(
  $$update public.qr_tokens set uses = 0 where token = 'token-vencido'$$,
  '42501',
  null,
  'GRANT recusa o update em qr_tokens antes mesmo da RLS'
);

set local role postgres;
select is((select uses from public.qr_tokens where token = 'token-vencido'), 0,
  'e o contador de usos continua intacto');
set local role authenticated;
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

-- =============================================================================
-- 7. Ready Check: a operação vê o painel, o cliente não vê os outros (§7.9)
-- =============================================================================
--
-- Montagem do cenario, nao asserção: abre o Ready Check e responde por duas
-- pessoas diferentes. Como `postgres`, porque a RLS — corretamente — recusa
-- que um cliente abra Ready Check ou responda pelo outro.
set local role postgres;

insert into public.ready_checks (id, activity_id, opened_by)
values ('0c000000-0000-0000-0000-0000000000cc', 'ac200000-0000-0000-0000-0000000000a2',
        '33cc0000-0000-0000-0000-0000000033cc');

insert into public.trip_members (trip_id, user_id)
values ('aa000000-0000-0000-0000-0000000000aa','22bb0000-0000-0000-0000-0000000022bb');

insert into public.ready_check_responses (ready_check_id, user_id, state) values
  ('0c000000-0000-0000-0000-0000000000cc','11aa0000-0000-0000-0000-0000000011aa','ready'),
  ('0c000000-0000-0000-0000-0000000000cc','22bb0000-0000-0000-0000-0000000022bb','late');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11aa0000-0000-0000-0000-0000000011aa","role":"authenticated"}';

select is((select count(*)::int from public.ready_check_responses), 1,
  'cliente ve so a propria resposta — quem se atrasou nao vira assunto do grupo');

set local request.jwt.claims to '{"sub":"33cc0000-0000-0000-0000-0000000033cc","role":"authenticated"}';

select is((select count(*)::int from public.ready_check_responses), 2,
  'a operacao ve o painel inteiro');

-- =============================================================================
-- 8. Check-in manual exige justificativa (§39)
-- =============================================================================
select throws_ok(
  $$insert into public.activity_checkins (activity_id, user_id, method)
    values ('ac200000-0000-0000-0000-0000000000a2','11aa0000-0000-0000-0000-0000000011aa','manual')$$,
  '23514',
  null,
  'check-in manual sem justificativa e recusado'
);

select lives_ok(
  $$insert into public.activity_checkins (activity_id, user_id, checked_in_by, method, justification)
    values ('ac200000-0000-0000-0000-0000000000a2','11aa0000-0000-0000-0000-0000000011aa',
            '33cc0000-0000-0000-0000-0000000033cc','manual','Celular sem bateria no embarque')$$,
  'check-in manual com justificativa e aceito'
);

select * from finish();
rollback;
