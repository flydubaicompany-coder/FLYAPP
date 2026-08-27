-- =============================================================================
-- Avanço do onboarding.
--
-- O que importa aqui não é o caminho feliz: é que a função **recuse** pular a
-- etapa de privacidade. Um deep link, um retry ou um cliente adulterado não
-- podem levar alguém para dentro do app sem ter decidido sobre os próprios
-- dados.
-- =============================================================================

begin;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'onboarding@teste.fly', '', now(), now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"99999999-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select onboarding_step from public.profiles where id = '99999999-0000-0000-0000-000000000001'),
  'invited',
  'perfil novo comeca em invited'
);

select throws_ok(
  $$ update public.profiles set onboarding_step = 'done'
     where id = '99999999-0000-0000-0000-000000000001' $$,
  null, null,
  'NEGATIVO: cliente nao tem grant para escrever onboarding_step direto'
);

select throws_ok(
  $$ select public.advance_onboarding('done') $$,
  '22023', null,
  'NEGATIVO: a funcao recusa pular de invited direto para done'
);

select throws_ok(
  $$ select public.advance_onboarding('preferences') $$,
  '22023', null,
  'NEGATIVO: a funcao recusa pular a etapa de identidade'
);

select throws_ok(
  $$ select public.advance_onboarding('inventada') $$,
  '22023', null,
  'NEGATIVO: etapa que nao existe e recusada'
);

select lives_ok(
  $$ select public.advance_onboarding('account') $$,
  'POSITIVO: avanca uma etapa'
);

select lives_ok(
  $$ select public.advance_onboarding('account') $$,
  'POSITIVO: repetir a etapa atual e idempotente, nao erro'
);

-- Percorrer ate o fim, uma etapa por vez.
select lives_ok(
  $$ select public.advance_onboarding('identity');
     select public.advance_onboarding('preferences');
     select public.advance_onboarding('consents');
     select public.advance_onboarding('done'); $$,
  'POSITIVO: o caminho completo funciona etapa a etapa'
);

select isnt(
  (select onboarding_completed_at from public.profiles
   where id = '99999999-0000-0000-0000-000000000001'),
  null,
  'POSITIVO: chegar em done carimba a data de conclusao'
);

reset role;

select * from finish();

rollback;
