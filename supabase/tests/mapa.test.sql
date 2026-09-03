-- =============================================================================
-- Fase 8 — o mapa (§12.1 e §43, entrega 1).
--
-- A asercao que importa aqui e a do **ponto sem coordenada**: um pino de
-- clinica que nao leva a lugar nenhum e pior do que nenhum pino, e a hora de
-- descobrir isso nao e a hora em que alguem precisa de uma clinica.
-- =============================================================================

begin;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('91110000-0000-0000-0000-000000009111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapa.cliente@teste.fly','',now(),now(),'','','','','','','',''),
  ('92220000-0000-0000-0000-000000009222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapa.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('93330000-0000-0000-0000-000000009333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapa.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('91110000-0000-0000-0000-000000009111','customer'),
  ('92220000-0000-0000-0000-000000009222','guide'),
  ('93330000-0000-0000-0000-000000009333','admin');

-- A tabela nasce vazia: endereco de servico de saude e conteudo operacional,
-- e a §33 nao deixa inventar dado medico.
select is(
  (select count(*)::int from public.map_places),
  0,
  'o mapa nasce vazio — nenhum lugar foi inventado pelo codigo');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Quem publica e a operacao global.
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"93330000-0000-0000-0000-000000009333","role":"authenticated"}';

insert into public.map_places (kind, name, address, latitude, longitude, is_active)
values ('hospital', 'Hospital de teste', 'Rua de teste', 25.2048, 55.2708, true);

insert into public.map_places (kind, name, is_active)
values ('attraction', 'Atracao ainda nao publicada', false);

select is(
  (select count(*)::int from public.map_places),
  2,
  'a operacao global publica lugar');

-- Publicar exige saber onde fica.
select throws_ok(
  $$insert into public.map_places (kind, name, is_active)
    values ('clinic', 'Clinica sem endereco', true)$$,
  '23514',
  null,
  'lugar ativo SEM coordenada e recusado: pino que nao leva a lugar nenhum e pior que pino nenhum');

select throws_ok(
  $$insert into public.map_places (kind, name, latitude)
    values ('pharmacy', 'Meia coordenada', 25.2)$$,
  '23514',
  null,
  'meia coordenada nao e lugar nenhum');

select throws_ok(
  $$insert into public.map_places (kind, name, latitude, longitude)
    values ('pharmacy', 'Fora do mundo', 999, 0)$$,
  '23514',
  null,
  'latitude fora do mundo e recusada');

-- -----------------------------------------------------------------------------
-- O cliente le o que esta publicado, e nada mais.
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"91110000-0000-0000-0000-000000009111","role":"authenticated"}';

select is(
  (select count(*)::int from public.map_places),
  1,
  'o cliente ve so o que esta publicado');

select throws_ok(
  $$insert into public.map_places (kind, name, latitude, longitude, is_active)
    values ('partner', 'Loja do meu primo', 25.2, 55.2, true)$$,
  '42501',
  null,
  'o cliente NAO publica lugar no mapa da Fly');

-- -----------------------------------------------------------------------------
-- Equipe de campo le tudo, e mesmo assim nao publica.
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"92220000-0000-0000-0000-000000009222","role":"authenticated"}';

select is(
  (select count(*)::int from public.map_places),
  2,
  'a equipe ve tambem o que ainda nao foi publicado');

select throws_ok(
  $$insert into public.map_places (kind, name, latitude, longitude)
    values ('clinic', 'Clinica do guia', 25.2, 55.2)$$,
  '42501',
  null,
  'guia NAO publica: quem responde pelo mapa e a operacao global');

-- -----------------------------------------------------------------------------
-- GRANT e RLS sao controles diferentes (D128).
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.map_places', 'SELECT'),
  'anon NAO tem privilegio de leitura no mapa');

select ok(
  not has_table_privilege('anon', 'public.map_places', 'INSERT'),
  'nem de escrita');

select * from finish();
rollback;
