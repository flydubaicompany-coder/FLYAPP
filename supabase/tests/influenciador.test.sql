-- =============================================================================
-- Fase 9 — Modo Influenciador (§13.6 e §44, entrega 15).
--
-- Duas asercoes carregam este arquivo:
--
--   "modo Influenciador aparece so para habilitados" — e a prova e que quem
--   nao esta habilitado recebe **zero linhas**, e nao que a tela esconde o
--   botao. Esconder botao nao e controle de acesso.
--
--   O criador **nao aprova o proprio conteudo**. RLS decide qual linha, e nao
--   qual coluna: com `update` direto na tabela, ele mudaria o proprio status
--   para `aprovado`. Por isso o envio passa por funcao.
-- =============================================================================

begin;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('c1110000-0000-0000-0000-00000000c111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inf.criador@teste.fly','',now(),now(),'','','','','','','',''),
  ('c2220000-0000-0000-0000-00000000c222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inf.comum@teste.fly','',now(),now(),'','','','','','','',''),
  ('c3330000-0000-0000-0000-00000000c333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inf.gestor@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('c1110000-0000-0000-0000-00000000c111','creator'),
  ('c2220000-0000-0000-0000-00000000c222','customer'),
  ('c3330000-0000-0000-0000-00000000c333','trip_manager');

insert into public.destinations (slug, name, country, timezone)
values ('inf-dubai', 'Dubai Criadores', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'cf000000-0000-0000-0000-0000000000cf', d.id, 'Viagem de creators', 'ongoing',
       (now() at time zone d.timezone)::date - 1,
       (now() at time zone d.timezone)::date + 5
from public.destinations d where d.slug = 'inf-dubai';

insert into public.trip_members (trip_id, user_id) values
  ('cf000000-0000-0000-0000-0000000000cf','c1110000-0000-0000-0000-00000000c111'),
  ('cf000000-0000-0000-0000-0000000000cf','c2220000-0000-0000-0000-00000000c222');

-- O perfil nasce DESLIGADO. "Ativado por perfil e viagem" (§13.6) e um ato.
insert into public.influencer_profiles (id, user_id, trip_id, briefing)
values ('c9000000-0000-0000-0000-00000000c900','c1110000-0000-0000-0000-00000000c111',
        'cf000000-0000-0000-0000-0000000000cf', 'Tres stories por dia.');

insert into public.influencer_deliverables (id, profile_id, title)
values ('ca000000-0000-0000-0000-00000000ca00','c9000000-0000-0000-0000-00000000c900',
        'Story do deserto');

select is(
  (select is_active from public.influencer_profiles
   where id = 'c9000000-0000-0000-0000-00000000c900'),
  false,
  'o perfil de criador nasce desligado: habilitar e um ato, e ele fica carimbado');

select ok(
  not has_table_privilege('anon', 'public.influencer_profiles', 'SELECT'),
  'anon NAO le perfil de criador');

set local role authenticated;

-- =============================================================================
-- Desligado = nao existe, para quem seria o criador.
-- =============================================================================
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.influencer_profiles),
  0,
  'perfil desligado nao aparece nem para o proprio criador — o modo some por falta de dado');

select is(
  (select count(*)::int from public.influencer_deliverables),
  0,
  'e os entregaveis somem junto');

select throws_ok(
  $$select * from public.enviar_entregavel(
      'ca000000-0000-0000-0000-00000000ca00', 'https://exemplo/story')$$,
  'P0002',
  null,
  'nem da para enviar entregavel de um perfil desligado');

-- =============================================================================
-- A operacao habilita.
-- =============================================================================
set local request.jwt.claims to '{"sub":"c3330000-0000-0000-0000-00000000c333","role":"authenticated"}';

update public.influencer_profiles set is_active = true
where id = 'c9000000-0000-0000-0000-00000000c900';

select isnt(
  (select enabled_at from public.influencer_profiles
   where id = 'c9000000-0000-0000-0000-00000000c900'),
  null,
  'habilitar carimba a hora sem ninguem lembrar');

select is(
  (select enabled_by from public.influencer_profiles
   where id = 'c9000000-0000-0000-0000-00000000c900'),
  'c3330000-0000-0000-0000-00000000c333'::uuid,
  'e carimba quem habilitou');

-- =============================================================================
-- Habilitado, o criador ve o proprio briefing — e so o proprio.
-- =============================================================================
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.influencer_profiles),
  1,
  'habilitado, o criador ve o proprio perfil');

select is(
  (select ok from public.enviar_entregavel(
     'ca000000-0000-0000-0000-00000000ca00', 'https://exemplo/story', 12000, 900)),
  true,
  'e envia o entregavel, com as metricas que ele mesmo declara');

select is(
  (select status::text from public.influencer_deliverables
   where id = 'ca000000-0000-0000-0000-00000000ca00'),
  'enviado',
  'o envio para em "enviado" — quem aprova e a operacao');

select is(
  (select reach_declared from public.influencer_deliverables
   where id = 'ca000000-0000-0000-0000-00000000ca00'),
  12000::bigint,
  'o alcance declarado fica gravado como declarado, e nao como medido');

-- O criador NAO aprova o proprio conteudo. A RLS filtra a linha em vez de
-- lancar, entao sem esta asercao a falha seria silenciosa.
update public.influencer_deliverables set status = 'aprovado'
where id = 'ca000000-0000-0000-0000-00000000ca00';

select is(
  (select status::text from public.influencer_deliverables
   where id = 'ca000000-0000-0000-0000-00000000ca00'),
  'enviado',
  'o criador NAO aprova o proprio conteudo');

-- =============================================================================
-- Viajante comum da mesma viagem nao ve nada disso.
-- =============================================================================
set local request.jwt.claims to '{"sub":"c2220000-0000-0000-0000-00000000c222","role":"authenticated"}';

select is(
  (select count(*)::int from public.influencer_profiles),
  0,
  'viajante comum da mesma viagem nao ve o modo Influenciador de ninguem');

select throws_ok(
  $$select * from public.enviar_entregavel(
      'ca000000-0000-0000-0000-00000000ca00', 'https://exemplo/meu')$$,
  '42501',
  null,
  'e nao envia entregavel alheio');

select * from finish();
rollback;
