-- =============================================================================
-- Fase 6 — ranking opt-in (§9.3 e §41, entregas 9 e 10).
--
-- Os dois criterios da §41, e como cada um e provado:
--
--   "usuario fora do ranking nao aparece"
--     A conferencia de `ranking_opt_in` esta na POLICY, nao na consulta da
--     tela. Aqui o teste le a tabela como um cliente comum e confere que quem
--     nao optou some — mesmo tendo linha gravada.
--
--   "ranking publico nao mostra gasto exato por padrao"
--     Provado de forma **estrutural**: a tabela nao tem coluna de dinheiro.
--     Nao se vaza o que nao se guarda, e nenhuma tela futura pode errar isso.
-- =============================================================================

begin;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('40010000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rank.dentro@teste.fly','',now(),now(),'','','','','','','',''),
  ('40020000-0000-0000-0000-000000004002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rank.fora@teste.fly','',now(),now(),'','','','','','','',''),
  ('40030000-0000-0000-0000-000000004003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rank.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('40010000-0000-0000-0000-000000004001','customer'),
  ('40020000-0000-0000-0000-000000004002','customer'),
  ('40030000-0000-0000-0000-000000004003','admin');

-- Um optou por participar, o outro nao.
insert into public.customer_preferences (user_id, ranking_opt_in)
values ('40010000-0000-0000-0000-000000004001', true),
       ('40020000-0000-0000-0000-000000004002', false)
on conflict (user_id) do update set ranking_opt_in = excluded.ranking_opt_in;

-- -----------------------------------------------------------------------------
-- A tabela publica nao guarda dinheiro. Isto e o que impede o vazamento.
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'ranking_scores'
     and (column_name like '%cents%' or column_name like '%amount%'
          or column_name like '%spend%' or column_name like '%total%')),
  0,
  'ranking_scores NAO tem coluna de dinheiro: nao se vaza o que nao se guarda');

-- -----------------------------------------------------------------------------
-- Periodo sem criterio declarado nao publica.
-- -----------------------------------------------------------------------------
select throws_ok(
  $$insert into public.ranking_periods (key, label, dimension, starts_on, ends_on, is_published)
    values ('sem-criterio','Sem criterio','semana','2026-08-01','2026-08-31', true)$$,
  '23514',
  null,
  'periodo publicado sem nota de criterio e recusado: ranking que ninguem explica gera briga');

insert into public.ranking_periods
  (id, key, label, dimension, starts_on, ends_on, basis, criteria_note, is_published)
values
  ('70010000-0000-0000-0000-000000007001','ago-2026','Agosto 2026','semana',
   '2026-08-01','2026-08-31','points_earned',
   'Soma dos Fly Points ganhos no mes, normalizada contra o primeiro colocado.', true),
  ('70020000-0000-0000-0000-000000007002','rascunho','Rascunho','engajamento',
   '2026-08-01','2026-08-31','manual', null, false);

-- -----------------------------------------------------------------------------
-- Recalculo: so operador, e so com base escolhida.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"40010000-0000-0000-0000-000000004001","role":"authenticated"}';

select throws_ok(
  $$select * from public.recalcular_ranking('70010000-0000-0000-0000-000000007001')$$,
  '42501',
  null,
  'cliente comum NAO recalcula o ranking');

set local request.jwt.claims to '{"sub":"40030000-0000-0000-0000-000000004003","role":"authenticated"}';

select is(
  (select motivo from public.recalcular_ranking('70020000-0000-0000-0000-000000007002')),
  'periodo manual: as pontuacoes sao digitadas, nao calculadas',
  'periodo manual nao aceita recalculo automatico');

-- Ganhos dentro da janela, para os dois clientes.
reset role;
insert into public.points_ledger
  (user_id, kind, amount, source, occurred_at, idempotency_key)
values
  ('40010000-0000-0000-0000-000000004001','earn', 8000,'order','2026-08-10','rank:dentro:1'),
  ('40020000-0000-0000-0000-000000004002','earn',20000,'order','2026-08-11','rank:fora:1'),
  -- Fora da janela: nao pode contar.
  ('40010000-0000-0000-0000-000000004001','earn',99999,'order','2026-07-01','rank:dentro:fora-janela');

set local role authenticated;
set local request.jwt.claims to '{"sub":"40030000-0000-0000-0000-000000004003","role":"authenticated"}';

select is(
  (select participantes from public.recalcular_ranking('70010000-0000-0000-0000-000000007001')),
  1,
  'so quem optou por participar entra no calculo: o que recusou fica de fora');

select is(
  (select public_score from public.ranking_scores
   where period_id = '70010000-0000-0000-0000-000000007001'
     and user_id = '40010000-0000-0000-0000-000000004001'),
  1000,
  'o primeiro colocado recebe 1000: a escala e relativa, nao o valor bruto');

select is(
  (select count(*)::int from public.ranking_scores
   where period_id = '70010000-0000-0000-0000-000000007001'
     and user_id = '40020000-0000-0000-0000-000000004002'),
  0,
  'quem nao optou nem linha tem, mesmo tendo ganho mais pontos');

-- -----------------------------------------------------------------------------
-- Leitura como cliente comum.
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"40010000-0000-0000-0000-000000004001","role":"authenticated"}';

select is(
  (select count(*)::int from public.ranking_scores
   where period_id = '70010000-0000-0000-0000-000000007001'),
  1,
  'o cliente ve o ranking publicado');

select is(
  (select count(*)::int from public.ranking_periods where key = 'rascunho'),
  0,
  'o cliente NAO ve periodo em rascunho');

-- Agora o dono do ranking desiste de participar: ele some da lista publica.
reset role;
update public.customer_preferences set ranking_opt_in = false
where user_id = '40010000-0000-0000-0000-000000004001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"40010000-0000-0000-0000-000000004001","role":"authenticated"}';

select is(
  (select count(*)::int from public.ranking_scores
   where period_id = '70010000-0000-0000-0000-000000007001'),
  0,
  'quem sai do opt-in some do ranking na hora, sem precisar recalcular');

set local request.jwt.claims to '{"sub":"40030000-0000-0000-0000-000000004003","role":"authenticated"}';

select is(
  (select count(*)::int from public.ranking_scores
   where period_id = '70010000-0000-0000-0000-000000007001'),
  1,
  'a equipe continua vendo, porque a §9.3 permite valor completo a funcionario autorizado');

-- =============================================================================
-- Premiacao e finalistas (§41, entrega 10).
--
-- As tres recusas importam mais que o caminho feliz. A primeira e a que
-- protege o jogo: **nao se anuncia vencedor no meio da corrida**. Publicar
-- antes do fim transforma o ranking em vitrine de quem esta na frente hoje, e
-- quem ficou para tras para de jogar.
-- =============================================================================

set local request.jwt.claims to '{"sub":"40030000-0000-0000-0000-000000004003","role":"authenticated"}';

-- O periodo de agosto termina em 31/08 e hoje e 29/08: ainda correndo.
select is(
  (select motivo from public.publicar_finalistas('70010000-0000-0000-0000-000000007001')),
  'o periodo ainda nao terminou: nao se anuncia vencedor no meio da corrida',
  'nao se publica finalista com o periodo correndo');

-- Um periodo ja encerrado, para o resto do caminho.
insert into public.ranking_periods
  (id, key, label, dimension, starts_on, ends_on, basis, criteria_note, is_published)
values
  ('70030000-0000-0000-0000-000000007003','jul-2026','Julho 2026','semana',
   '2026-07-01','2026-07-31','points_earned',
   'Soma dos Fly Points ganhos no mes.', true);

select is(
  (select motivo from public.publicar_finalistas('70030000-0000-0000-0000-000000007003')),
  'nao ha pontuacao calculada neste periodo',
  'sem pontuacao nao ha finalista para anunciar');

insert into public.ranking_scores (period_id, user_id, public_score, position, public_name)
values ('70030000-0000-0000-0000-000000007003','40010000-0000-0000-0000-000000004001',1000,1,'Cliente A');

select is(
  (select motivo from public.publicar_finalistas('70030000-0000-0000-0000-000000007003')),
  'nao ha premiacao declarada: anunciar vencedor sem dizer o que ele ganhou vira discussao',
  'sem premio declarado nao se anuncia vencedor');

insert into public.ranking_prizes (period_id, position_from, position_to, label)
values ('70030000-0000-0000-0000-000000007003', 1, 3, 'Jantar para dois');

select is(
  (select ok from public.publicar_finalistas('70030000-0000-0000-0000-000000007003')),
  true,
  'com periodo encerrado, pontuacao e premio, publica');

select is(
  (select finalistas from public.publicar_finalistas('70030000-0000-0000-0000-000000007003')),
  1,
  'conta quantos ficaram dentro de alguma faixa de premio');

-- A constraint segura mesmo por escrita direta.
select throws_ok(
  $$update public.ranking_periods
    set finalists_published_at = '2026-07-15'::timestamptz
    where id = '70030000-0000-0000-0000-000000007003'$$,
  '23514',
  null,
  'data de publicacao anterior ao fim do periodo e recusada pela constraint');

set local request.jwt.claims to '{"sub":"40010000-0000-0000-0000-000000004001","role":"authenticated"}';
select throws_ok(
  $$select * from public.publicar_finalistas('70030000-0000-0000-0000-000000007003')$$,
  '42501',
  null,
  'cliente comum NAO publica finalista');

select * from finish();
rollback;
