-- =============================================================================
-- Fase 11 — simulação de um dia completo de operação (§46, entrega 13).
--
-- A §46 pede uma simulação, e o critério dela é "simulação encontra e resolve
-- bloqueadores". Uma simulação escrita em documento não encontra nada: ela
-- descreve o que deveria acontecer, e quem a lê concorda.
--
-- Então ela é um teste. Um dia inteiro, na ordem em que a operação o vive, com
-- os papéis de verdade e a RLS ligada:
--
--   1. chega um guia — papel, atribuição e turno;
--   2. a operação avisa a viagem;
--   3. o guia registra presença;
--   4. o cliente abre um SOS, e alguém assume e resolve;
--   5. a equipe ouve algo e vira surpresa aprovada;
--   6. entrega um press kit;
--   7. o pedido do dia fecha com o pagamento;
--   8. o turno é passado e alguém assume;
--   9. o relatório conta o dia;
--  10. a trilha registra quem fez o quê.
--
-- Cada passo depende do anterior. Se o passo 1 estiver errado, o 3 não roda —
-- que é exatamente o que uma simulação deve fazer.
-- =============================================================================

begin;

select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('da000000-0000-0000-0000-0000000000da','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dia.admin@teste.fly','',now(),now(),'','','','','','','',''),
  ('db000000-0000-0000-0000-0000000000db','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dia.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('dc000000-0000-0000-0000-0000000000dc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dia.guia2@teste.fly','',now(),now(),'','','','','','','',''),
  ('dd000000-0000-0000-0000-0000000000dd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dia.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('de000000-0000-0000-0000-0000000000de','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dia.experiencia@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('da000000-0000-0000-0000-0000000000da','admin'),
  ('dd000000-0000-0000-0000-0000000000dd','customer'),
  ('de000000-0000-0000-0000-0000000000de','experience');

insert into public.destinations (slug, name, country, timezone)
values ('dia-dubai', 'Dubai do dia', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'd0000000-0000-0000-0000-0000000000d0', d.id, 'Viagem do dia completo', 'ongoing',
       current_date, current_date + 3
from public.destinations d where d.slug = 'dia-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('d0000000-0000-0000-0000-0000000000d0','dd000000-0000-0000-0000-0000000000dd');

insert into public.trip_days (id, trip_id, day_number, day_date, title)
values ('d1000000-0000-0000-0000-0000000000d1','d0000000-0000-0000-0000-0000000000d0',
        1, current_date, 'Dia 1');

insert into public.activities (id, trip_day_id, title, starts_at, meeting_point)
values ('d2000000-0000-0000-0000-0000000000d2','d1000000-0000-0000-0000-0000000000d1',
        'Marina ao pôr do sol', now() + interval '2 hours', 'Lobby');

insert into public.activity_participants (activity_id, user_id)
values ('d2000000-0000-0000-0000-0000000000d2','dd000000-0000-0000-0000-0000000000dd');

insert into public.notification_categories (key, label, description, is_critical, sort_order)
values ('dia_critico', 'Alerta do dia', 'Nao se silencia.', true, 10)
on conflict (key) do nothing;

-- O pedido e o pagamento do dia entram no preparo, e nao no meio da narrativa:
-- `orders` so tem policy de SELECT para `authenticated`, e `payments` nao tem
-- policy de escrita nenhuma. Quem cria pedido e a RPC `criar_pedido`, com o
-- cliente; quem captura e o webhook, com `service_role`. Os dois caminhos tem
-- teste proprio — aqui interessa o que a operacao ve depois deles.
insert into public.orders (id, user_id, trip_id, reference, status, currency,
                           subtotal_cents, discount_cents, total_cents)
values ('d5000000-0000-0000-0000-0000000000d5','dd000000-0000-0000-0000-0000000000dd',
        'd0000000-0000-0000-0000-0000000000d0','DIA-0001','paid','AED', 40000, 0, 40000);

insert into public.payments (order_id, provider, provider_ref, status, amount_cents, currency)
values ('d5000000-0000-0000-0000-0000000000d5','sandbox','dia-1','captured', 40000, 'AED');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- 1. Chega um guia
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"da000000-0000-0000-0000-0000000000da","role":"authenticated"}';

select is(
  (select ok from public.conceder_papel('db000000-0000-0000-0000-0000000000db', 'guide')),
  true,
  '08h00 — o guia recebe o papel');

select is(
  (select ok from public.conceder_papel('dc000000-0000-0000-0000-0000000000dc', 'guide')),
  true,
  'e o guia do turno da tarde também');

select is(
  (select ok from public.atribuir_a_viagem(
    'db000000-0000-0000-0000-0000000000db', 'd0000000-0000-0000-0000-0000000000d0', 'guide')),
  true,
  '08h05 — e entra na viagem de hoje');

insert into public.staff_shifts (user_id, trip_id, role, starts_at, ends_at)
values ('db000000-0000-0000-0000-0000000000db','d0000000-0000-0000-0000-0000000000d0','guide',
        now() - interval '1 hour', now() + interval '7 hours');

select is(
  (select count(*)::int from public.staff_shifts s
    where s.starts_at <= now() and s.ends_at >= now()),
  1,
  '08h10 — e aparece como quem esta de plantao agora');

-- -----------------------------------------------------------------------------
-- 2. A operação avisa a viagem
-- -----------------------------------------------------------------------------
select is(
  (select enviados from public.enviar_aviso(
    'd0000000-0000-0000-0000-0000000000d0', 'dia_critico',
    'Ponto de encontro mudou para o lobby')),
  1,
  '08h30 — o aviso chega a quem esta na viagem');

set local request.jwt.claims to '{"sub":"dd000000-0000-0000-0000-0000000000dd","role":"authenticated"}';

select is(
  (select count(*)::int from public.notifications n
    where n.user_id = 'dd000000-0000-0000-0000-0000000000dd'),
  1,
  'e o cliente ve o aviso na caixa dele — que ate a Fase 11 ninguem conseguia encher');

-- -----------------------------------------------------------------------------
-- 3. O guia registra presença
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"db000000-0000-0000-0000-0000000000db","role":"authenticated"}';

insert into public.activity_checkins (activity_id, user_id, method)
values ('d2000000-0000-0000-0000-0000000000d2','dd000000-0000-0000-0000-0000000000dd','qr');

select is(
  (select count(*)::int from public.activity_checkins),
  1,
  '17h00 — presenca registrada pelo guia atribuido a viagem');

-- -----------------------------------------------------------------------------
-- 4. O cliente abre um SOS
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"dd000000-0000-0000-0000-0000000000dd","role":"authenticated"}';

select is(
  (select count(*)::int from public.abrir_atendimento(
    'sos', 'Perdi o grupo na Marina', 'd0000000-0000-0000-0000-0000000000d0')),
  1,
  '19h20 — o cliente abre um SOS');

set local request.jwt.claims to '{"sub":"db000000-0000-0000-0000-0000000000db","role":"authenticated"}';

update public.support_cases c
set assigned_to = 'db000000-0000-0000-0000-0000000000db',
    status = 'accepted',
    accepted_by = 'db000000-0000-0000-0000-0000000000db'
where c.trip_id = 'd0000000-0000-0000-0000-0000000000d0';

select is(
  (select count(*)::int from public.support_cases c where c.assigned_at is not null),
  1,
  '19h22 — o guia assume, e a hora do dono e carimbada pelo gatilho');

insert into public.support_messages (case_id, author_id, body)
select c.id, 'db000000-0000-0000-0000-0000000000db', 'Estou indo até você. Fique onde está.'
from public.support_cases c where c.trip_id = 'd0000000-0000-0000-0000-0000000000d0';

select isnt(
  (select first_response_at from public.support_cases c
    where c.trip_id = 'd0000000-0000-0000-0000-0000000000d0'),
  null,
  'e a primeira resposta carimba o caso sem ninguem calcular nada');

update public.support_cases c
set status = 'resolved', resolved_by = 'db000000-0000-0000-0000-0000000000db'
where c.trip_id = 'd0000000-0000-0000-0000-0000000000d0';

select isnt(
  (select resolved_at from public.support_cases c
    where c.trip_id = 'd0000000-0000-0000-0000-0000000000d0'),
  null,
  '19h48 — resolvido');

-- -----------------------------------------------------------------------------
-- 5. A equipe ouve algo, e vira surpresa
-- -----------------------------------------------------------------------------
insert into public.guest_insights (user_id, trip_id, category, urgency, note, created_by)
values ('dd000000-0000-0000-0000-0000000000dd','d0000000-0000-0000-0000-0000000000d0',
        'celebracao','normal','Falou que está comemorando o aniversário de casamento.',
        'db000000-0000-0000-0000-0000000000db');

select is(
  (select count(*)::int from public.guest_insights),
  1,
  '20h00 — o guia anota o que ouviu no corredor');

set local request.jwt.claims to '{"sub":"dd000000-0000-0000-0000-0000000000dd","role":"authenticated"}';

select is(
  (select count(*)::int from public.guest_insights),
  0,
  'e o cliente NAO le a anotacao — §13.4, e a RLS que garante');

set local request.jwt.claims to '{"sub":"de000000-0000-0000-0000-0000000000de","role":"authenticated"}';

insert into public.surprise_tasks (id, user_id, trip_id, title, sponsor)
values ('d3000000-0000-0000-0000-0000000000d3','dd000000-0000-0000-0000-0000000000dd',
        'd0000000-0000-0000-0000-0000000000d0','Bolo e taça no quarto','Hotel');

select is(
  (select ok from public.aprovar_surpresa(
    'd3000000-0000-0000-0000-0000000000d3', 12000, 'AED')),
  true,
  '20h15 — a gerencia da experiencia aprova o gasto; guia e midia nao aprovariam');

set local request.jwt.claims to '{"sub":"dd000000-0000-0000-0000-0000000000dd","role":"authenticated"}';

select is(
  public.tem_surpresa_a_caminho(),
  true,
  'e o cliente ve so o teaser: ha algo a caminho, e nada alem disso');

-- -----------------------------------------------------------------------------
-- 6. Entrega de press kit
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"da000000-0000-0000-0000-0000000000da","role":"authenticated"}';

insert into public.inventory_items (id, kind, name, trip_id, low_stock_at)
values ('d4000000-0000-0000-0000-0000000000d4','press_kit','Kit do dia',
        'd0000000-0000-0000-0000-0000000000d0', 2);

select is(
  (select saldo from public.movimentar_estoque(
    'd4000000-0000-0000-0000-0000000000d4', 3, 'entrada')),
  3,
  '20h30 — chegam tres kits');

set local request.jwt.claims to '{"sub":"db000000-0000-0000-0000-0000000000db","role":"authenticated"}';

select is(
  (select saldo from public.movimentar_estoque(
    'd4000000-0000-0000-0000-0000000000d4', -1, 'entrega',
    'dd000000-0000-0000-0000-0000000000dd')),
  2,
  '20h40 — o guia entrega um, no campo, na hora');

select is(
  (select motivo from public.movimentar_estoque(
    'd4000000-0000-0000-0000-0000000000d4', -5, 'entrega')),
  'Não há tanto em estoque: restam 2.',
  'e entregar cinco havendo dois e recusado antes de virar problema de contagem');

-- -----------------------------------------------------------------------------
-- 7. O pedido do dia fecha
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"da000000-0000-0000-0000-0000000000da","role":"authenticated"}';

select is(
  (select divergencia_cents from public.relatorio_comercio(
    now() - interval '1 day', now() + interval '1 day',
    'd0000000-0000-0000-0000-0000000000d0')),
  0::bigint,
  '21h00 — o dia fecha: o que o pedido diz bate com o que foi capturado');

-- -----------------------------------------------------------------------------
-- 8. Passagem de turno
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"db000000-0000-0000-0000-0000000000db","role":"authenticated"}';

insert into public.shift_handoffs (trip_id, from_user, summary, open_items)
values ('d0000000-0000-0000-0000-0000000000d0','db000000-0000-0000-0000-0000000000db',
        'SOS resolvido às 19h48. Grupo inteiro no hotel.',
        'A surpresa de aniversário está aprovada e ainda não foi entregue.');

set local request.jwt.claims to '{"sub":"dc000000-0000-0000-0000-0000000000dc","role":"authenticated"}';

select is(
  (select ok from public.aceitar_passagem((select id from public.shift_handoffs limit 1))),
  true,
  '22h00 — o turno da noite assume, e assumir e um ato');

-- -----------------------------------------------------------------------------
-- 9. O relatório conta o dia
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"da000000-0000-0000-0000-0000000000da","role":"authenticated"}';

select is(
  (select presencas from public.relatorio_viagem('d0000000-0000-0000-0000-0000000000d0')),
  1,
  '23h00 — o relatorio da viagem conta a presenca');

select is(
  (select casos_abertos from public.relatorio_viagem('d0000000-0000-0000-0000-0000000000d0')),
  0,
  'e nenhum caso ficou aberto');

select is(
  (select entregues from public.relatorio_patrocinio(
    now() - interval '1 day', now() + interval '1 day')),
  0,
  'a surpresa patrocinada foi aprovada e ainda nao entregue — o relatorio diz isso, e nao arredonda');

-- -----------------------------------------------------------------------------
-- 10. A trilha
-- -----------------------------------------------------------------------------
select is(
  (select count(distinct l.action)::int from public.audit_logs l
    where l.action in ('papel.concedido', 'atribuicao.criada', 'aviso.enviado',
                       'estoque.movimento', 'passagem.aceita')),
  5,
  'e o dia inteiro deixou rastro: papel, atribuicao, aviso, estoque e passagem');

select * from finish();
rollback;
