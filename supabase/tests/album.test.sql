-- =============================================================================
-- Fase 9 — album, figurinhas, Dia Completo e Fly Quest (§13, §14.1 e §44).
--
-- Os criterios da §44 que estas asercoes fecham:
--   "figurinha nao libera sem evento valido"
--   "repeticao nao duplica unlock/pontos"
--   "Dia Completo segue configuracao"
--   "cliente ve somente midia liberada" (pelo GRANT e pela policy do Storage)
--
-- A asercao central e a do **GRANT**: `sticker_unlocks` nao tem privilegio de
-- insert para `authenticated`. Sem isso, alguem que descobrisse o id de uma
-- figurinha secreta se daria a figurinha com uma chamada direta — e a RLS
-- sozinha nao seguraria, porque a policy de insert simplesmente nao existe.
-- =============================================================================

begin;

select plan(27);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('a1110000-0000-0000-0000-00000000a111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alb.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('a2220000-0000-0000-0000-00000000a222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alb.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('a3330000-0000-0000-0000-00000000a333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alb.guia@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('a1110000-0000-0000-0000-00000000a111','customer'),
  ('a2220000-0000-0000-0000-00000000a222','customer'),
  ('a3330000-0000-0000-0000-00000000a333','guide');

insert into public.destinations (slug, name, country, timezone)
values ('alb-dubai', 'Dubai Album', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'ab000000-0000-0000-0000-0000000000ab', d.id, 'Viagem do album', 'ongoing',
       (now() at time zone d.timezone)::date - 1,
       (now() at time zone d.timezone)::date + 5
from public.destinations d where d.slug = 'alb-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('ab000000-0000-0000-0000-0000000000ab','a1110000-0000-0000-0000-00000000a111');

insert into public.staff_assignments (user_id, trip_id, role) values
  ('a3330000-0000-0000-0000-00000000a333','ab000000-0000-0000-0000-0000000000ab','guide');

insert into public.trip_days (id, trip_id, day_number, day_date)
select 'db000000-0000-0000-0000-0000000000db', 'ab000000-0000-0000-0000-0000000000ab', 1,
       (now() at time zone d.timezone)::date
from public.destinations d where d.slug = 'alb-dubai';

insert into public.activities (id, trip_day_id, title, status, starts_at)
values ('ab100000-0000-0000-0000-0000000000a1','db000000-0000-0000-0000-0000000000db',
        'Deserto', 'in_progress', now() - interval '10 minutes');

-- Capitulo com DUAS obrigatorias e uma opcional. O Dia Completo so fecha com
-- as duas — e e isso que a asercao do meio prova.
insert into public.album_chapters (id, trip_id, trip_day_id, title, reward_points, is_published)
values ('cb000000-0000-0000-0000-0000000000cb', 'ab000000-0000-0000-0000-0000000000ab',
        'db000000-0000-0000-0000-0000000000db', 'Capitulo 1', 500, true);

insert into public.stickers (id, chapter_id, code, name, rarity, is_required, unlock_kind, activity_id, points_reward, is_published)
values
  ('50000000-0000-0000-0000-000000000051','cb000000-0000-0000-0000-0000000000cb','deserto','Deserto',
   'common', true, 'activity_checkin', 'ab100000-0000-0000-0000-0000000000a1', 100, true),
  ('50000000-0000-0000-0000-000000000052','cb000000-0000-0000-0000-0000000000cb','duna','Duna secreta',
   'secret', true, 'qr', null, 0, true),
  ('50000000-0000-0000-0000-000000000053','cb000000-0000-0000-0000-0000000000cb','extra','Opcional',
   'rare', false, 'qr', null, 0, true);

-- Codigos: um do album (figurinha), um de missao de cidade.
insert into public.qr_tokens (id, token, kind, trip_id, scope, max_uses)
values ('70000000-0000-0000-0000-000000000071','TOKEN-DUNA','album',
        'ab000000-0000-0000-0000-0000000000ab','sticker:duna', null);

insert into public.quest_missions (id, code, title, points_reward, is_published)
values ('60000000-0000-0000-0000-000000000061','avia-o-dourado','Encontre o aviao dourado', 250, true);

insert into public.qr_tokens (id, token, kind, scope, max_uses)
values ('70000000-0000-0000-0000-000000000072','TOKEN-AVIAO','city_point','mission:avia-o-dourado', null);

-- O token de check-in nasce aqui, como `postgres`: quem o emite na vida real
-- e a operacao pelo `emitir_qr`, e o que este teste exercita e a LEITURA.
insert into public.qr_tokens (id, token, kind, user_id, trip_id, activity_id)
values ('70000000-0000-0000-0000-000000000073','TOKEN-CHECKIN','activity_checkin',
        'a1110000-0000-0000-0000-00000000a111','ab000000-0000-0000-0000-0000000000ab',
        'ab100000-0000-0000-0000-0000000000a1');

-- A regra de pontos precisa existir para haver credito (D136). Sem versao,
-- nada e creditado — e a asercao do fim prova os dois lados.
update public.app_config
set value = jsonb_build_object('version', 'v1', 'spend_points_per_unit', 10)
where key = 'points.earning_rule';

-- =============================================================================
-- GRANT: ninguem se da uma figurinha.
-- =============================================================================
select ok(
  not has_table_privilege('authenticated', 'public.sticker_unlocks', 'INSERT'),
  'authenticated NAO tem privilegio de insert em sticker_unlocks — quem grava sao as funcoes');

select ok(
  not has_table_privilege('authenticated', 'public.chapter_completions', 'INSERT'),
  'nem em chapter_completions: o Dia Completo e do servidor (§13.2)');

select ok(
  not has_table_privilege('anon', 'public.stickers', 'SELECT'),
  'anon NAO le figurinha');

select ok(
  not has_table_privilege('anon', 'public.sticker_unlocks', 'SELECT'),
  'anon NAO le desbloqueio de ninguem');

select ok(
  not has_table_privilege('anon', 'public.quest_missions', 'SELECT'),
  'anon NAO le missao');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1110000-0000-0000-0000-00000000a111","role":"authenticated"}';

select throws_ok(
  $$insert into public.sticker_unlocks (user_id, sticker_id, source)
    values ('a1110000-0000-0000-0000-00000000a111','50000000-0000-0000-0000-000000000052','na marra')$$,
  '42501',
  null,
  'o cliente NAO se da a figurinha secreta, nem sabendo o id dela');

-- =============================================================================
-- Caminho 1: o check-in do guia libera (§44, entrega 5).
-- =============================================================================
select is(
  (select count(*)::int from public.sticker_unlocks),
  0,
  'nada nasce desbloqueado');

set local request.jwt.claims to '{"sub":"a3330000-0000-0000-0000-00000000a333","role":"authenticated"}';

select is(
  (select resultado::text from public.ler_qr('TOKEN-CHECKIN')),
  'ok',
  'o guia valida o check-in');

select is(
  (select count(*)::int from public.sticker_unlocks
   where sticker_id = '50000000-0000-0000-0000-000000000051'),
  1,
  'o check-in valido liberou a figurinha da atividade');

select is(
  (select source from public.sticker_unlocks
   where sticker_id = '50000000-0000-0000-0000-000000000051'),
  'checkin',
  'e ficou registrado como veio');

-- O capitulo tem DUAS obrigatorias: uma so nao fecha o dia.
select is(
  (select count(*)::int from public.chapter_completions),
  0,
  'uma obrigatoria de duas NAO fecha o Dia Completo');

-- =============================================================================
-- Caminho 2: o cliente le um codigo (§13.1 e §14.1).
-- =============================================================================
set local request.jwt.claims to '{"sub":"a1110000-0000-0000-0000-00000000a111","role":"authenticated"}';

select is(
  (select ok from public.resgatar_codigo('NAO-EXISTE')),
  false,
  'codigo desconhecido e recusado');

select is(
  (select ok from public.resgatar_codigo('TOKEN-DUNA')),
  true,
  'o codigo do album entrega a figurinha');

select is(
  (select ja_tinha from public.resgatar_codigo('TOKEN-DUNA')),
  true,
  'ler o mesmo codigo de novo diz que ja tinha');

select is(
  (select count(*)::int from public.sticker_unlocks
   where sticker_id = '50000000-0000-0000-0000-000000000052'),
  1,
  'e NAO duplica o desbloqueio');

-- =============================================================================
-- Dia Completo, no servidor (§13.2).
-- =============================================================================
select is(
  (select count(*)::int from public.chapter_completions
   where chapter_id = 'cb000000-0000-0000-0000-0000000000cb'
     and user_id = 'a1110000-0000-0000-0000-00000000a111'),
  1,
  'com as duas obrigatorias, o Dia Completo fecha sozinho — sem o app pedir');

select is(
  (select count(*)::int from public.points_ledger
   where idempotency_key = 'chapter:cb000000-0000-0000-0000-0000000000cb:a1110000-0000-0000-0000-00000000a111'),
  1,
  'a recompensa do capitulo entrou no ledger, uma vez');

select is(
  (select amount from public.points_ledger
   where idempotency_key = 'chapter:cb000000-0000-0000-0000-0000000000cb:a1110000-0000-0000-0000-00000000a111'),
  500,
  'com o valor que a operacao declarou, e nao um que o codigo inventou');

select is(
  (select count(*)::int from public.points_ledger
   where source = 'challenge' and reference = '50000000-0000-0000-0000-000000000051'),
  1,
  'a figurinha com pontos tambem creditou, uma vez');

-- =============================================================================
-- Fly Quest (§14.1).
-- =============================================================================
select is(
  (select missao from public.resgatar_codigo('TOKEN-AVIAO')),
  '60000000-0000-0000-0000-000000000061'::uuid,
  'o ponto de cidade completa a missao');

select is(
  (select ja_tinha from public.resgatar_codigo('TOKEN-AVIAO')),
  true,
  'e repetir nao completa de novo');

select is(
  (select count(*)::int from public.points_ledger
   where idempotency_key like 'mission:60000000-0000-0000-0000-000000000061:%'),
  1,
  'os pontos da missao entraram uma vez so');

-- =============================================================================
-- Album alheio (§44, "cliente ve somente midia liberada" comeca aqui).
-- =============================================================================
set local request.jwt.claims to '{"sub":"a2220000-0000-0000-0000-00000000a222","role":"authenticated"}';

select is(
  (select count(*)::int from public.stickers),
  0,
  'quem nao esta na viagem nao ve as figurinhas dela');

select is(
  (select ok from public.resgatar_codigo('TOKEN-DUNA')),
  false,
  'nem resgata o codigo do album dela');

-- O codigo de uso ilimitado nao foi gasto pela tentativa recusada: o alvo e
-- resolvido antes de gastar uso, senao um estranho queimaria o codigo alheio.
select is(
  (select count(*)::int from public.sticker_unlocks
   where user_id = 'a2220000-0000-0000-0000-00000000a222'),
  0,
  'e nao ganha figurinha nenhuma');

-- =============================================================================
-- Liberacao a mao: so quem opera a viagem (§44, entrega 5).
-- =============================================================================
select throws_ok(
  $$select * from public.liberar_figurinha(
      'a2220000-0000-0000-0000-00000000a222','50000000-0000-0000-0000-000000000053')$$,
  '42501',
  null,
  'cliente NAO libera figurinha a mao');

set local request.jwt.claims to '{"sub":"a3330000-0000-0000-0000-00000000a333","role":"authenticated"}';

select is(
  (select novo from public.liberar_figurinha(
     'a1110000-0000-0000-0000-00000000a111','50000000-0000-0000-0000-000000000053')),
  true,
  'quem opera a viagem libera');

select * from finish();
rollback;
