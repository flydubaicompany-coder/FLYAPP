-- =============================================================================
-- Passaporte digitado (§7.5 e §9)
--
-- Este arquivo existe porque o passaporte mudou de natureza no meio da Fase 4.
-- Eu o havia tratado como **arquivo** — foto do documento oficial no cofre,
-- biometria para abrir, OCR para extrair os campos. O produto é outro: a
-- pessoa digita.
--
-- Isso muda o que precisa ser protegido. Não há imagem para vazar; há um
-- número que a Fly **precisa** ler para emitir passagem, e que precisa ficar
-- restrito a quem opera aquela viagem.
-- =============================================================================

begin;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('91110000-0000-0000-0000-000000009111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pass.cli@teste.fly','',now(),now(),'','','','','','','',''),
  ('92220000-0000-0000-0000-000000009222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pass.guia@teste.fly','',now(),now(),'','','','','','','',''),
  ('93330000-0000-0000-0000-000000009333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pass.admin@teste.fly','',now(),now(),'','','','','','','',''),
  ('94440000-0000-0000-0000-000000009444','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pass.guiab@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('91110000-0000-0000-0000-000000009111','customer'),
  ('92220000-0000-0000-0000-000000009222','guide'),
  ('93330000-0000-0000-0000-000000009333','admin'),
  ('94440000-0000-0000-0000-000000009444','guide');

insert into public.destinations (slug, name, country, timezone)
values ('pass-dubai', 'Dubai Passaporte', 'EAU', 'Asia/Dubai') on conflict (slug) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'ba000000-0000-0000-0000-0000000000aa', d.id, 'Viagem Passaporte', 'ongoing',
       current_date - 1, current_date + 5
from public.destinations d where d.slug = 'pass-dubai';

insert into public.trip_members (trip_id, user_id)
values ('ba000000-0000-0000-0000-0000000000aa', '91110000-0000-0000-0000-000000009111');

-- Uma segunda viagem, para o par negativo existir.
insert into public.trips (id, destination_id, name, status, starts_on, ends_on)
select 'bb000000-0000-0000-0000-0000000000bb'::uuid, d.id, 'Outra viagem', 'published',
       current_date + 30, current_date + 37
from public.destinations d where d.slug = 'pass-dubai';

insert into public.staff_assignments (user_id, trip_id, role) values
  ('92220000-0000-0000-0000-000000009222', 'ba000000-0000-0000-0000-0000000000aa', 'guide'),
  ('94440000-0000-0000-0000-000000009444', 'bb000000-0000-0000-0000-0000000000bb', 'guide');

-- -----------------------------------------------------------------------------
-- 1. Normalização — porque gente digita sujo
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"91110000-0000-0000-0000-000000009111","role":"authenticated"}';

insert into public.passports (id, user_id, full_name, number, issuing_country, expires_on)
values ('face0000-0000-0000-0000-00000000face', '91110000-0000-0000-0000-000000009111',
        'VICTOR DA SILVA', 'ab 123-456', 'bra', current_date + 400);

select is((select number from public.passports), 'AB123456',
  'espaco, hifen e caixa saem do numero antes de gravar');

select is((select issuing_country from public.passports), 'BRA',
  'sigla do pais vai para maiuscula');

-- A duplicata é o motivo de normalizar: sem isso, a constraint de unicidade
-- não pega o mesmo documento digitado de outro jeito.
select throws_ok(
  $$insert into public.passports (user_id, full_name, number, issuing_country, expires_on)
    values ('91110000-0000-0000-0000-000000009111','VICTOR DA SILVA','AB-123-456','BRA',
            current_date + 400)$$,
  '23505',
  null,
  'o mesmo documento digitado com outra formatacao e recusado'
);

select throws_ok(
  $$insert into public.passports (user_id, full_name, number, issuing_country, expires_on)
    values ('91110000-0000-0000-0000-000000009111','X','A-1','BRA', current_date + 400)$$,
  '23514',
  null,
  'numero curto demais e recusado pelo banco, nao so pela tela'
);

select throws_ok(
  $$insert into public.passports (user_id, full_name, number, issuing_country, expires_on)
    values ('91110000-0000-0000-0000-000000009111','X','ZZ999999','Brasil', current_date + 400)$$,
  '23514',
  null,
  'pais fora do formato de tres letras e recusado'
);

-- -----------------------------------------------------------------------------
-- 2. Quem enxerga o número
--
-- **A Fly enxerga.** Emitir a passagem é o serviço que o cliente contratou —
-- execução de contrato, não consentimento. Eu tinha trancado isso atrás de um
-- consentimento opcional, o que produzia o absurdo de o cliente poder impedir
-- a Fly de fazer aquilo pelo que foi paga.
--
-- O que continua: **mínimo**. Quem opera a viagem daquela pessoa, e a operação
-- global que emite. Um guia de outra viagem não vê.
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.passports), 1,
  'o dono enxerga o proprio passaporte');

set local request.jwt.claims to '{"sub":"92220000-0000-0000-0000-000000009222","role":"authenticated"}';

select is((select count(*)::int from public.passports), 1,
  'guia da viagem enxerga o passaporte de quem ele embarca');

select is((select number from public.passports), 'AB123456',
  'e enxerga o numero, que e o que a passagem exige');

set local request.jwt.claims to '{"sub":"93330000-0000-0000-0000-000000009333","role":"authenticated"}';

select is((select count(*)::int from public.passports), 1,
  'a operacao global enxerga: e ela quem emite');

-- O par negativo: mínimo continua sendo mínimo.
set local request.jwt.claims to '{"sub":"94440000-0000-0000-0000-000000009444","role":"authenticated"}';

select is((select count(*)::int from public.passports), 0,
  'guia de OUTRA viagem NAO enxerga — precisar do dado tem escopo');

-- Enxergar não é escrever. RLS em UPDATE filtra linhas em vez de lançar: a
-- pergunta certa é se o valor mudou.
set local request.jwt.claims to '{"sub":"93330000-0000-0000-0000-000000009333","role":"authenticated"}';
update public.passports set number = 'ZZ999999';

set local role postgres;
select is((select number from public.passports), 'AB123456',
  'a Fly le, mas NAO edita o numero');

-- -----------------------------------------------------------------------------
-- 3. Abrir no painel deixa rastro; tentar sem poder, também
--
-- A negativa volta em `permitido`, e não como exceção: `raise` desfaria o
-- registro da tentativa, que é justamente o que se quer guardar.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"92220000-0000-0000-0000-000000009222","role":"authenticated"}';

select is(
  (select permitido from public.ver_passaporte(
     (select p.id from public.passports p limit 1))),
  true,
  'guia da viagem abre o passaporte pelo painel');

set local role postgres;
select is((select count(*)::int from public.audit_logs where action = 'passport.viewed'), 1,
  'a abertura pela Fly fica registrada');

set local role authenticated;
set local request.jwt.claims to '{"sub":"94440000-0000-0000-0000-000000009444","role":"authenticated"}';

select is(
  (select permitido from public.ver_passaporte('face0000-0000-0000-0000-00000000face')),
  false,
  'guia de outra viagem recebe negativa');

set local role postgres;
select is((select count(*)::int from public.audit_logs where action = 'passport.access_denied'), 1,
  'e a tentativa negada SOBREVIVE no registro — era o ponto de nao lancar');

-- -----------------------------------------------------------------------------
-- 4. Editar derruba a conferência
--
-- Sem isto, bastaria corrigir um dígito depois de conferido para a Fly emitir
-- passagem com um número que ninguém olhou.
-- -----------------------------------------------------------------------------
set local role postgres;
update public.passports
set verified_at = now(), verified_by = '93330000-0000-0000-0000-000000009333';

set local role authenticated;
set local request.jwt.claims to '{"sub":"91110000-0000-0000-0000-000000009111","role":"authenticated"}';
update public.passports set number = 'CD987654';

select is((select verified_at from public.passports), null,
  'editar o numero derruba a conferencia da Fly');

-- Mexer no que não é dado do documento não derruba.
set local role postgres;
update public.passports
set verified_at = now(), verified_by = '93330000-0000-0000-0000-000000009333';

set local role authenticated;
set local request.jwt.claims to '{"sub":"91110000-0000-0000-0000-000000009111","role":"authenticated"}';
update public.passports set nationality = 'BRA';

select isnt((select verified_at from public.passports), null,
  'mexer na nacionalidade nao derruba a conferencia');

-- -----------------------------------------------------------------------------
-- 5. Validade contra o fim da viagem
--
-- Aritmética, não política: a regra dos seis meses varia por destino e fica em
-- configuração, marcada como pendente.
-- -----------------------------------------------------------------------------
set local role postgres;
update public.passports set expires_on = current_date + 2;

set local role authenticated;
set local request.jwt.claims to '{"sub":"91110000-0000-0000-0000-000000009111","role":"authenticated"}';

select is(
  (select vence_antes_do_fim
   from public.passaporte_para_viagem('ba000000-0000-0000-0000-0000000000aa')),
  true,
  'passaporte que vence antes do fim da viagem e sinalizado'
);

select * from finish();
rollback;
