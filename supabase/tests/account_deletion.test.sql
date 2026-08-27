-- =============================================================================
-- Exclusão de conta: o que sobrevive e o que some.
--
-- Este arquivo existe por causa de um bug real. A constraint
-- `invitations_accepted_pair` exigia `accepted_at` e `accepted_by` nulos
-- juntos, e isso abortava a exclusão de qualquer conta que tivesse nascido de
-- um convite — ou seja, todas.
-- =============================================================================

begin;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('dd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'excluir@teste.fly', '', now(), now());

insert into public.user_roles (user_id, role)
values ('dd000000-0000-0000-0000-000000000001', 'customer');

insert into public.invitations (email, role, token_hash, expires_at, accepted_at, accepted_by)
values ('excluir@teste.fly', 'customer', 'hash-exclusao', now() + interval '7 days',
        now(), 'dd000000-0000-0000-0000-000000000001');

insert into public.preference_items (user_id, key, value)
values ('dd000000-0000-0000-0000-000000000001', 'gosto.snacks', '"chocolate"'::jsonb);

insert into public.emergency_contacts (user_id, name, phone)
values ('dd000000-0000-0000-0000-000000000001', 'Contato', '+5511999999999');

-- O cerne: apagar o usuário não pode esbarrar em constraint.
select lives_ok(
  $$ delete from auth.users where id = 'dd000000-0000-0000-0000-000000000001' $$,
  'POSITIVO: excluir conta que nasceu de convite nao esbarra em constraint'
);

select is(
  (select count(*)::int from auth.users where id = 'dd000000-0000-0000-0000-000000000001'),
  0,
  'POSITIVO: a conta some'
);

select is(
  (select count(*)::int from public.profiles where id = 'dd000000-0000-0000-0000-000000000001'),
  0,
  'POSITIVO: o perfil some junto'
);

select is(
  (select count(*)::int from public.preference_items
   where user_id = 'dd000000-0000-0000-0000-000000000001'),
  0,
  'POSITIVO: preferencias somem'
);

select is(
  (select count(*)::int from public.emergency_contacts
   where user_id = 'dd000000-0000-0000-0000-000000000001'),
  0,
  'POSITIVO: contato de emergencia some'
);

select isnt(
  (select accepted_at from public.invitations where token_hash = 'hash-exclusao'),
  null,
  'POSITIVO: o convite continua marcado como aceito — isso segue sendo verdade'
);

select is(
  (select accepted_by from public.invitations where token_hash = 'hash-exclusao'),
  null,
  'POSITIVO: mas nao se sabe mais quem aceitou'
);

select * from finish();

rollback;
