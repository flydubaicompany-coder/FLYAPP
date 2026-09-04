-- =============================================================================
-- Fase 9 — Galeria e autorizacao de imagem (§13.5 e §44, entregas 8, 9 e 10).
--
-- O criterio central da §44 aqui e **"revogacao de imagem afeta
-- acesso/publicacao"**, e ele so vale alguma coisa se o teste percorrer os
-- tres estados na ordem: sem resposta -> autorizado -> revogado. A foto tem
-- que sumir no primeiro e no terceiro, e aparecer so no segundo.
--
-- A asercao mais facil de esquecer e a primeira: **quem nunca respondeu nao
-- autorizou**. Tratar silencio como sim inverteria o unico jeito honesto de
-- perguntar — e passaria despercebido, porque a foto apareceria.
-- =============================================================================

begin;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('9a110000-0000-0000-0000-000000009a11','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gal.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('9a220000-0000-0000-0000-000000009a22','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gal.outro@teste.fly','',now(),now(),'','','','','','','',''),
  ('9a330000-0000-0000-0000-000000009a33','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gal.midia@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('9a110000-0000-0000-0000-000000009a11','customer'),
  ('9a220000-0000-0000-0000-000000009a22','customer'),
  ('9a330000-0000-0000-0000-000000009a33','media');

insert into public.destinations (slug, name, country, timezone)
values ('gal-dubai', 'Dubai Galeria', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'ea000000-0000-0000-0000-0000000000ea', d.id, 'Viagem da galeria', 'ongoing',
       (now() at time zone d.timezone)::date - 1,
       (now() at time zone d.timezone)::date + 5
from public.destinations d where d.slug = 'gal-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('ea000000-0000-0000-0000-0000000000ea','9a110000-0000-0000-0000-000000009a11');

insert into public.staff_assignments (user_id, trip_id, role) values
  ('9a330000-0000-0000-0000-000000009a33','ea000000-0000-0000-0000-0000000000ea','media');

-- Uma foto liberada, com o cliente marcado. Ele ainda nao respondeu nada
-- sobre uso de imagem — e e esse o primeiro estado que interessa.
insert into public.trip_media (id, trip_id, storage_path, caption, credit, is_released, released_at)
values ('fa000000-0000-0000-0000-0000000000fa','ea000000-0000-0000-0000-0000000000ea',
        'ea000000-0000-0000-0000-0000000000ea/duna.jpg', 'No alto da duna', 'Equipe Fly', true, now());

-- Uma foto liberada sem ninguem marcado: ninguem identificavel reivindicou.
insert into public.trip_media (id, trip_id, storage_path, is_released, released_at)
values ('fb000000-0000-0000-0000-0000000000fb','ea000000-0000-0000-0000-0000000000ea',
        'ea000000-0000-0000-0000-0000000000ea/paisagem.jpg', true, now());

-- Uma foto ainda em curadoria.
insert into public.trip_media (id, trip_id, storage_path, is_released)
values ('fc000000-0000-0000-0000-0000000000fc','ea000000-0000-0000-0000-0000000000ea',
        'ea000000-0000-0000-0000-0000000000ea/bruta.jpg', false);

insert into public.media_tags (media_id, user_id, tagged_by) values
  ('fa000000-0000-0000-0000-0000000000fa','9a110000-0000-0000-0000-000000009a11',
   '9a330000-0000-0000-0000-000000009a33');

-- =============================================================================
-- A finalidade existe, e e sensivel.
-- =============================================================================
select is(
  (select is_sensitive from public.consent_purposes where key = 'image_use'),
  true,
  'uso de imagem e finalidade sensivel — consentimento separado e explicito (§23.1)');

select is(
  (select is_required from public.consent_purposes where key = 'image_use'),
  false,
  'e NAO e obrigatoria: viajar nao pode depender de autorizar a propria imagem');

-- =============================================================================
-- Estado 1 — quem nunca respondeu NAO autorizou.
-- =============================================================================
select ok(
  fly_private.midia_tem_revogacao('fa000000-0000-0000-0000-0000000000fa'),
  'sem consentimento registrado, a midia conta como NAO autorizada');

set local role authenticated;
set local request.jwt.claims to '{"sub":"9a110000-0000-0000-0000-000000009a11","role":"authenticated"}';

select is(
  (select count(*)::int from public.trip_media where id = 'fa000000-0000-0000-0000-0000000000fa'),
  0,
  'e a foto NAO aparece para o cliente, mesmo liberada e mesmo sendo dele');

select is(
  (select count(*)::int from public.trip_media where id = 'fb000000-0000-0000-0000-0000000000fb'),
  1,
  'a foto sem ninguem marcado aparece — nao ha imagem de pessoa para autorizar');

select is(
  (select count(*)::int from public.trip_media where id = 'fc000000-0000-0000-0000-0000000000fc'),
  0,
  'a foto em curadoria NAO aparece: o cliente ve somente midia liberada (§44)');

-- O cliente sabe em que fotos esta marcado. E o que torna a revogacao uma
-- escolha informada.
select is(
  (select count(*)::int from public.media_tags),
  1,
  'o cliente ve a propria marcacao');

-- =============================================================================
-- Estado 2 — autorizado.
-- =============================================================================
insert into public.consents (user_id, purpose_key, granted, version, source)
values ('9a110000-0000-0000-0000-000000009a11', 'image_use', true, 1, 'app');

select is(
  (select count(*)::int from public.trip_media where id = 'fa000000-0000-0000-0000-0000000000fa'),
  1,
  'autorizada a imagem, a foto aparece');

-- =============================================================================
-- Estado 3 — revogado. O consentimento e append-only: revogar e uma linha nova.
-- =============================================================================
insert into public.consents (user_id, purpose_key, granted, version, source)
values ('9a110000-0000-0000-0000-000000009a11', 'image_use', false, 1, 'app');

select is(
  (select count(*)::int from public.trip_media where id = 'fa000000-0000-0000-0000-0000000000fa'),
  0,
  'revogada, a foto some — "revogacao de imagem afeta acesso/publicacao" (§44)');

select is(
  (select count(*)::int from public.trip_media where id = 'fb000000-0000-0000-0000-0000000000fb'),
  1,
  'e a foto sem marcacao continua, porque a revogacao e dela e nao da viagem');

-- =============================================================================
-- Viagem alheia e escrita.
-- =============================================================================
set local request.jwt.claims to '{"sub":"9a220000-0000-0000-0000-000000009a22","role":"authenticated"}';

select is(
  (select count(*)::int from public.trip_media),
  0,
  'quem nao esta na viagem nao ve galeria nenhuma');

set local request.jwt.claims to '{"sub":"9a110000-0000-0000-0000-000000009a11","role":"authenticated"}';

update public.trip_media set is_released = true
where id = 'fc000000-0000-0000-0000-0000000000fc';

select is(
  (select is_released from public.trip_media where id = 'fc000000-0000-0000-0000-0000000000fc'),
  false,
  'o cliente NAO libera midia: a RLS filtra a linha em vez de lancar');

select throws_ok(
  $$insert into public.media_tags (media_id, user_id)
    values ('fb000000-0000-0000-0000-0000000000fb','9a110000-0000-0000-0000-000000009a11')$$,
  '42501',
  null,
  'nem se marca numa foto: marcacao e ato de quem opera a viagem');

-- =============================================================================
-- A equipe de midia libera, e o carimbo sai sozinho.
-- =============================================================================
set local request.jwt.claims to '{"sub":"9a330000-0000-0000-0000-000000009a33","role":"authenticated"}';

update public.trip_media set is_released = true
where id = 'fc000000-0000-0000-0000-0000000000fc';

select isnt(
  (select released_at from public.trip_media where id = 'fc000000-0000-0000-0000-0000000000fc'),
  null,
  'liberar carimba a hora sem ninguem lembrar');

select is(
  (select released_by from public.trip_media where id = 'fc000000-0000-0000-0000-0000000000fc'),
  '9a330000-0000-0000-0000-000000009a33'::uuid,
  'e carimba quem liberou');

-- =============================================================================
-- GRANT (D128).
-- =============================================================================
select ok(
  not has_table_privilege('anon', 'public.trip_media', 'SELECT'),
  'anon NAO le a galeria de ninguem');

select * from finish();
rollback;
