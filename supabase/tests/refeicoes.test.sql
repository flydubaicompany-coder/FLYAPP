-- =============================================================================
-- Fase 7 — refeicoes da viagem (§11.1 e §42).
--
-- Os criterios da §42 que estas asercoes fecham:
--   "cliente ve apenas refeicoes elegiveis"
--   "prazo bloqueia alteracao comum"
--   "excecao exige justificativa"
--
-- O par que mais importa e o do prazo: **comum**, e nao toda. A equipe muda
-- depois, e a mudanca fica marcada. Travar para todo mundo faria a Fly ligar
-- para o fornecedor e mentir no sistema.
-- =============================================================================

begin;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('61110000-0000-0000-0000-000000006111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ref.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('62220000-0000-0000-0000-000000006222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ref.fora@teste.fly','',now(),now(),'','','','','','','',''),
  ('63330000-0000-0000-0000-000000006333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ref.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('61110000-0000-0000-0000-000000006111','customer'),
  ('62220000-0000-0000-0000-000000006222','customer'),
  ('63330000-0000-0000-0000-000000006333','admin');

insert into public.destinations (slug, name, country, timezone)
values ('ref-dubai','Dubai Refeicoes','EAU','Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select '6a000000-0000-0000-0000-00000000006a', d.id, 'Viagem das refeicoes', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'ref-dubai';

insert into public.trip_members (trip_id, user_id)
values ('6a000000-0000-0000-0000-00000000006a','61110000-0000-0000-0000-000000006111');

insert into public.trip_days (id, trip_id, day_number, day_date)
values ('6b000000-0000-0000-0000-00000000006b','6a000000-0000-0000-0000-00000000006a', 1, current_date);

-- Um jantar que ainda vai ser servido, e um almoco cujo prazo ja passou.
insert into public.meal_services (id, trip_day_id, kind, supplier_name, serves_at, status)
values
  ('6c000000-0000-0000-0000-00000000006c','6b000000-0000-0000-0000-00000000006b','dinner',
   'Cozinha Fly', now() + interval '2 days', 'draft'),
  ('6d000000-0000-0000-0000-00000000006d','6b000000-0000-0000-0000-00000000006b','lunch',
   'Cozinha Fly', now() - interval '1 hour', 'open');

update public.meal_services set choices_close_at = now() - interval '30 minutes'
where id = '6d000000-0000-0000-0000-00000000006d';

insert into public.meal_options (id, service_id, label, is_active) values
  ('6e000000-0000-0000-0000-00000000006e','6c000000-0000-0000-0000-00000000006c','Robalo grelhado', true),
  ('6f000000-0000-0000-0000-00000000006f','6c000000-0000-0000-0000-00000000006c','Risoto de funghi', true),
  ('60010000-0000-0000-0000-000000006001','6d000000-0000-0000-0000-00000000006d','Salada do dia', true);

select is(
  (select value from public.app_config where key = 'meals.deadline_hours'),
  '5'::jsonb,
  'o prazo padrao vem de configuracao, e nao do codigo (§11.1)');

set local role authenticated;

-- "cliente ve apenas refeicoes elegiveis"
set local request.jwt.claims to '{"sub":"61110000-0000-0000-0000-000000006111","role":"authenticated"}';
select is(
  (select count(*)::int from public.meal_services),
  1,
  'o cliente NAO ve a refeicao em rascunho: cardapio em construcao gera pergunta');

set local request.jwt.claims to '{"sub":"62220000-0000-0000-0000-000000006222","role":"authenticated"}';
select is(
  (select count(*)::int from public.meal_services),
  0,
  'quem nao e da viagem nao ve refeicao nenhuma');

-- O operador abre o jantar, e o prazo sai da configuracao.
set local request.jwt.claims to '{"sub":"63330000-0000-0000-0000-000000006333","role":"authenticated"}';

select is(
  (select fecha_em::date from public.abrir_refeicao('6c000000-0000-0000-0000-00000000006c')),
  (now() + interval '2 days' - interval '5 hours')::date,
  'abrir aplica o prazo configurado sobre o horario de servir');

select is(
  (select status::text from public.meal_services where id = '6c000000-0000-0000-0000-00000000006c'),
  'open',
  'a refeicao fica aberta');

-- Abrir sem opcao ativa e recusado.
insert into public.meal_services (id, trip_day_id, kind, serves_at, status)
values ('60020000-0000-0000-0000-000000006002','6b000000-0000-0000-0000-00000000006b','breakfast',
        now() + interval '1 day', 'draft');

select is(
  (select motivo from public.abrir_refeicao('60020000-0000-0000-0000-000000006002')),
  'sem opcao ativa: abrir um cardapio vazio so gera pergunta',
  'nao se abre cardapio vazio');

-- O cliente escolhe dentro do prazo.
set local request.jwt.claims to '{"sub":"61110000-0000-0000-0000-000000006111","role":"authenticated"}';

insert into public.meal_choices (service_id, user_id, option_id, customization)
values ('6c000000-0000-0000-0000-00000000006c','61110000-0000-0000-0000-000000006111',
        '6e000000-0000-0000-0000-00000000006e','Sem alcaparras');

select is(
  (select count(*)::int from public.meal_choices),
  1,
  'dentro do prazo o cliente escolhe');

-- Opcao de outra refeicao e recusada.
select throws_ok(
  $$update public.meal_choices set option_id = '60010000-0000-0000-0000-000000006001'
    where service_id = '6c000000-0000-0000-0000-00000000006c'$$,
  '23514',
  null,
  'nao da para escolher o prato de outra refeicao');

-- Trocar dentro do prazo continua valendo.
update public.meal_choices set option_id = '6f000000-0000-0000-0000-00000000006f'
where service_id = '6c000000-0000-0000-0000-00000000006c';

select is(
  (select option_id from public.meal_choices where service_id = '6c000000-0000-0000-0000-00000000006c'),
  '6f000000-0000-0000-0000-00000000006f'::uuid,
  'dentro do prazo o cliente troca de ideia');

-- "prazo bloqueia alteracao comum": o almoco ja fechou.
select throws_ok(
  $$insert into public.meal_choices (service_id, user_id, option_id)
    values ('6d000000-0000-0000-0000-00000000006d','61110000-0000-0000-0000-000000006111',
            '60010000-0000-0000-0000-000000006001')$$,
  '42501',
  null,
  'depois do prazo o cliente NAO escolhe sozinho');

-- Refeicao em rascunho tambem nao aceita escolha.
select throws_ok(
  $$insert into public.meal_choices (service_id, user_id, option_id)
    values ('60020000-0000-0000-0000-000000006002','61110000-0000-0000-0000-000000006111',
            '60010000-0000-0000-0000-000000006001')$$,
  '23514',
  null,
  'refeicao em rascunho nao aceita escolha');

-- A equipe muda depois do prazo, mas so com justificativa.
set local request.jwt.claims to '{"sub":"63330000-0000-0000-0000-000000006333","role":"authenticated"}';

select throws_ok(
  $$insert into public.meal_choices (service_id, user_id, option_id)
    values ('6d000000-0000-0000-0000-00000000006d','61110000-0000-0000-0000-000000006111',
            '60010000-0000-0000-0000-000000006001')$$,
  '23514',
  null,
  'nem a equipe muda depois do prazo sem justificativa (§42)');

insert into public.meal_choices (service_id, user_id, option_id, exception_reason, decided_by)
values ('6d000000-0000-0000-0000-00000000006d','61110000-0000-0000-0000-000000006111',
        '60010000-0000-0000-0000-000000006001',
        'Cliente ligou; cozinha aceitou', '63330000-0000-0000-0000-000000006333');

select is(
  (select exception_reason from public.meal_choices
   where service_id = '6d000000-0000-0000-0000-00000000006d'),
  'Cliente ligou; cozinha aceitou',
  'com justificativa a equipe muda, e a excecao fica registrada');

select is(
  (select count(*)::int from public.meal_choices),
  2,
  'a equipe ve as duas escolhas: e ela que consolida o total por fornecedor');

select * from finish();
rollback;
