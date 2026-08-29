-- =============================================================================
-- Os documentos do cliente sao visiveis para a equipe que o atende.
--
-- Decisao do dono em 29/08/2026. A migration 20260825220000 ja tinha feito
-- isso para o **passaporte**; `documents` — voucher, autorizacao, seguro —
-- tinha ficado de fora, visivel so para o dono.
--
-- O par que mais importa e o **negativo**: um guia de OUTRA viagem nao pode
-- ver. "A equipe ve" nao pode virar "qualquer cracha ve".
-- =============================================================================

begin;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('d1110000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doc.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('d2220000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doc.guia.mesma@teste.fly','',now(),now(),'','','','','','','',''),
  ('d3330000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doc.guia.outra@teste.fly','',now(),now(),'','','','','','','',''),
  ('d4440000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doc.admin@teste.fly','',now(),now(),'','','','','','','',''),
  ('d5550000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doc.estranho@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('d1110000-0000-0000-0000-0000000000d1','customer'),
  ('d2220000-0000-0000-0000-0000000000d2','guide'),
  ('d3330000-0000-0000-0000-0000000000d3','guide'),
  ('d4440000-0000-0000-0000-0000000000d4','admin'),
  ('d5550000-0000-0000-0000-0000000000d5','customer');

insert into public.destinations (slug, name, country, timezone)
values ('doc-dubai', 'Dubai Documentos', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'da000000-0000-0000-0000-0000000000da', d.id, 'Viagem do cliente', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'doc-dubai';

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'db000000-0000-0000-0000-0000000000db', d.id, 'Outra viagem', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'doc-dubai';

insert into public.trip_members (trip_id, user_id)
values ('da000000-0000-0000-0000-0000000000da', 'd1110000-0000-0000-0000-0000000000d1');

insert into public.staff_assignments (user_id, trip_id, role) values
  ('d2220000-0000-0000-0000-0000000000d2', 'da000000-0000-0000-0000-0000000000da', 'guide'),
  ('d3330000-0000-0000-0000-0000000000d3', 'db000000-0000-0000-0000-0000000000db', 'guide');

insert into public.documents (id, owner_id, trip_id, kind, title, storage_path)
values (
  'dc000000-0000-0000-0000-0000000000dc',
  'd1110000-0000-0000-0000-0000000000d1',
  'da000000-0000-0000-0000-0000000000da',
  'voucher',
  'Voucher do hotel',
  'd1110000-0000-0000-0000-0000000000d1/dc000000-0000-0000-0000-0000000000dc.pdf'
);

set local role authenticated;

set local request.jwt.claims to '{"sub":"d1110000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from public.documents), 1, 'o dono ve o proprio documento');

set local request.jwt.claims to '{"sub":"d2220000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select count(*)::int from public.documents), 1,
  'o guia DAQUELA viagem ve: e o que a decisao do dono pediu');

-- O par negativo. Sem ele, "a equipe ve" viraria "qualquer cracha ve".
set local request.jwt.claims to '{"sub":"d3330000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select is((select count(*)::int from public.documents), 0,
  'o guia de OUTRA viagem NAO ve: acesso e minimo, nao geral');

set local request.jwt.claims to '{"sub":"d4440000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select is((select count(*)::int from public.documents), 1, 'a operacao global ve');

set local request.jwt.claims to '{"sub":"d5550000-0000-0000-0000-0000000000d5","role":"authenticated"}';
select is((select count(*)::int from public.documents), 0,
  'outro cliente NAO ve o documento de ninguem');

-- A equipe le, e nao escreve. Isto nao mudou.
set local request.jwt.claims to '{"sub":"d2220000-0000-0000-0000-0000000000d2","role":"authenticated"}';
update public.documents set title = 'Mexido pelo guia'
where id = 'dc000000-0000-0000-0000-0000000000dc';

select is(
  (select title from public.documents where id = 'dc000000-0000-0000-0000-0000000000dc'),
  'Voucher do hotel',
  'a equipe NAO edita o documento: UPDATE barrado por RLS filtra zero linhas');

delete from public.documents where id = 'dc000000-0000-0000-0000-0000000000dc';
select is(
  (select count(*)::int from public.documents where id = 'dc000000-0000-0000-0000-0000000000dc'),
  1,
  'a equipe NAO apaga o documento');

select * from finish();
rollback;
