-- =============================================================================
-- Fase 5 — Passeios, carrinho e pedidos (§6 e §40)
--
-- Os critérios da §40 viram asserção aqui. Os três que mais importam, e por quê:
--
--   "concorrência não ultrapassa inventário"
--     O `select … for update` em `reservar_no_carrinho` é o que segura. Aqui o
--     teste é sequencial, então ele prova a **regra** (vaga segurada não é
--     oferecida a outro), não o bloqueio. Duas sessões de verdade competindo
--     não cabem num arquivo pgTAP; o que cabe é garantir que a conta de
--     disponibilidade desconta hold, venda e expiração.
--
--   "repetição do webhook continua em um pedido"
--     Prova pela unicidade de `(provider, provider_event_id)`. É o mecanismo,
--     não a boa vontade do provedor.
--
--   "reembolso gera evento e não apaga histórico"
--     Depois de reembolsar tudo, os itens do pedido continuam lá.
-- =============================================================================

begin;

select plan(67);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('c1110000-0000-0000-0000-00000000c111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','passeio.cli1@teste.fly','',now(),now(),'','','','','','','',''),
  ('c2220000-0000-0000-0000-00000000c222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','passeio.cli2@teste.fly','',now(),now(),'','','','','','','',''),
  ('a3330000-0000-0000-0000-00000000a333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','passeio.admin@teste.fly','',now(),now(),'','','','','','','','');

insert into public.user_roles (user_id, role) values
  ('c1110000-0000-0000-0000-00000000c111','customer'),
  ('c2220000-0000-0000-0000-00000000c222','customer'),
  ('a3330000-0000-0000-0000-00000000a333','admin');

insert into public.cancellation_policies (id, key, version, label, description, rules)
values ('cbcb0000-0000-0000-0000-0000000000cb','padrao',1,'Padrão Fly',
        'Cancelamento gratuito ate 48h antes.',
        '[{"ate_horas":48,"reembolso_pct":100}]'::jsonb);

insert into public.tour_categories (key, label) values ('deserto','Deserto')
on conflict (key) do nothing;

insert into public.tours (id, slug, category_key, title, status, cancellation_policy_id, city)
values ('70170000-0000-0000-0000-000000007017','safari-teste','deserto','Safári',
        'published','cbcb0000-0000-0000-0000-0000000000cb','Dubai');

-- Um rascunho, para o par negativo da vitrine existir.
insert into public.tours (id, slug, category_key, title, status)
values ('70270000-0000-0000-0000-000000007027','rascunho-teste','deserto','Em preparo','draft');

insert into public.tour_variants (id, tour_id, label, price_cents, currency, max_people)
values ('7a170000-0000-0000-0000-0000000071a7','70170000-0000-0000-0000-000000007017',
        'Grupo', 45000, 'BRL', 8);

-- Segunda moeda, para o carrinho misturado ser recusado.
insert into public.tour_variants (id, tour_id, label, price_cents, currency)
values ('7a270000-0000-0000-0000-0000000072a7','70170000-0000-0000-0000-000000007017',
        'Privativo', 200000, 'AED');

insert into public.tour_slots (id, variant_id, starts_at, timezone, capacity) values
  ('51170000-0000-0000-0000-000000005117','7a170000-0000-0000-0000-0000000071a7',
   now() + interval '10 days','Asia/Dubai', 4),
  ('51270000-0000-0000-0000-000000005127','7a270000-0000-0000-0000-0000000072a7',
   now() + interval '11 days','Asia/Dubai', 2);

insert into public.coupons (code, label, percent_off) values ('FLY10','Dez por cento',10);

-- =============================================================================
-- 1. Vitrine: rascunho não vaza (§6.1)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is((select count(*)::int from public.tours), 1,
  'cliente enxerga so o passeio publicado');

select is((select count(*)::int from public.tours
           where id = '70270000-0000-0000-0000-000000007027'), 0,
  'rascunho NAO vaza preco provisorio para o cliente');

set local request.jwt.claims to '{"sub":"a3330000-0000-0000-0000-00000000a333","role":"authenticated"}';

select is((select count(*)::int from public.tours), 2,
  'a operacao enxerga rascunho e publicado');

-- =============================================================================
-- 2. Estoque: hold, expiração e "slot esgotado não vende" (§40)
-- =============================================================================
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(public.vagas_livres('51170000-0000-0000-0000-000000005117'), 4,
  'slot comeca com a capacidade inteira livre');

select is(
  (select ok from public.reservar_no_carrinho('51170000-0000-0000-0000-000000005117', 3)),
  true,
  'cliente segura 3 vagas');

select is(public.vagas_livres('51170000-0000-0000-0000-000000005117'), 1,
  'a reserva desconta da disponibilidade de todo mundo');

set local request.jwt.claims to '{"sub":"c2220000-0000-0000-0000-00000000c222","role":"authenticated"}';

-- O critério "slot esgotado não vende", visto do outro lado do balcão.
select is(
  (select motivo from public.reservar_no_carrinho('51170000-0000-0000-0000-000000005117', 2)),
  'sem vagas',
  'outro cliente NAO leva vaga que ja esta segurada');

select is(
  (select ok from public.reservar_no_carrinho('51170000-0000-0000-0000-000000005117', 1)),
  true,
  'mas leva a que sobrou');

select is(public.vagas_livres('51170000-0000-0000-0000-000000005117'), 0,
  'e agora esgotou');

-- O hold expira sozinho. Sem isso, um carrinho abandonado tiraria a vaga do
-- catálogo para sempre.
set local role postgres;
update public.cart_items set hold_expires_at = now() - interval '1 minute'
where cart_id = (select id from public.carts
                 where user_id = 'c2220000-0000-0000-0000-00000000c222');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(public.vagas_livres('51170000-0000-0000-0000-000000005117'), 1,
  'hold expirado devolve a vaga ao catalogo, sem ninguem precisar lembrar');

-- Limpa o cenário para a compra.
set local role postgres;
delete from public.cart_items;

-- =============================================================================
-- 3. Moeda: sem câmbio inventado (§6.5)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select lives_ok(
  $$select public.reservar_no_carrinho('51170000-0000-0000-0000-000000005117', 2)$$,
  'reserva em BRL');
select lives_ok(
  $$select public.reservar_no_carrinho('51270000-0000-0000-0000-000000005127', 1)$$,
  'reserva em AED');

select is(
  (select motivo from public.criar_pedido('chave-de-teste-moedas')),
  'carrinho com moedas diferentes',
  'somar BRL com AED exigiria cambio, e a §33 proibe inventar cambio');

delete from public.cart_items where slot_id = '51270000-0000-0000-0000-000000005127';

-- =============================================================================
-- 4. Pedido: preço vem do servidor (§40)
-- =============================================================================
select is(
  (select ok from public.criar_pedido('chave-de-teste-pedido-1', 'FLY10')),
  true,
  'pedido criado');

set local role postgres;

-- 2 x R$ 450,00. O cliente não mandou valor nenhum; o servidor foi ao catálogo.
select is((select subtotal_cents from public.orders limit 1), 90000::bigint,
  'subtotal calculado no servidor, a partir do catalogo');

select is((select discount_cents from public.orders limit 1), 9000::bigint,
  'cupom de 10% aplicado no servidor');

select is((select total_cents from public.orders limit 1), 81000::bigint,
  'total confere');

select is((select currency::text from public.orders limit 1), 'BRL',
  'moeda explicita no pedido');

-- A §40 exige a política "versionada com o pedido". Referência não bastaria:
-- editar a política mudaria retroativamente o que o cliente aceitou.
select is((select cancellation_policy_text from public.orders limit 1),
  'Cancelamento gratuito ate 48h antes.',
  'politica de cancelamento copiada para dentro do pedido');

select is((select cancellation_policy_version from public.orders limit 1), 1,
  'com a versao junto');

select is((select sold from public.tour_slots where id = '51170000-0000-0000-0000-000000005117'),
  2, 'a vaga virou venda');

select is((select count(*)::int from public.cart_items), 0,
  'e o carrinho esvaziou');

-- =============================================================================
-- 5. Idempotência (§40)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select motivo from public.criar_pedido('chave-de-teste-pedido-1', 'FLY10')),
  'ja processado',
  'a mesma chave devolve o pedido, em vez de criar outro');

set local role postgres;
select is((select count(*)::int from public.orders), 1,
  'e continua existindo um pedido so');

-- =============================================================================
-- 6. Pagamento e webhook (§40)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select ok from public.iniciar_pagamento(
     (select id from public.orders limit 1), 'sandbox', 'ref-teste-1')),
  true,
  'pagamento iniciado');

select is(
  (select motivo from public.iniciar_pagamento(
     (select id from public.orders limit 1), 'sandbox', 'ref-teste-1')),
  'ja iniciado',
  'repetir a referencia nao gera segunda cobranca');

set local role postgres;

select is(
  (select resultado from public.registrar_evento_pagamento('sandbox','evt-teste-1',
     'payment.succeeded',
     '{"provider_ref":"ref-teste-1","card_brand":"visa","card_last4":"4242"}'::jsonb, true)),
  'processado',
  'webhook assinado confirma o pedido');

select is((select status::text from public.orders limit 1), 'confirmed',
  'pedido confirmado');

-- O critério literal da §40.
select is(
  (select resultado from public.registrar_evento_pagamento('sandbox','evt-teste-1',
     'payment.succeeded', '{"provider_ref":"ref-teste-1"}'::jsonb, true)),
  'duplicado',
  'o MESMO evento de novo e recusado pela unicidade, nao reprocessado');

select is((select count(*)::int from public.orders), 1,
  'e a repeticao continua em um pedido so');

-- Assinatura inválida entra no registro e para. Descartar em silêncio
-- esconderia uma tentativa de forjar pagamento.
select is(
  (select resultado from public.registrar_evento_pagamento('sandbox','evt-forjado',
     'payment.succeeded', '{"provider_ref":"ref-teste-1"}'::jsonb, false)),
  'assinatura_invalida',
  'evento sem assinatura valida e registrado, nao processado');

select is((select card_last4 from public.payments limit 1), '4242'::char(4),
  'do cartao, so os quatro ultimos digitos');

-- =============================================================================
-- 6b. O que só a Edge Function pode fazer (§40.10)
--
-- Esta é a asserção que sustenta a existência da função Edge. Se o cliente
-- pudesse chamar `registrar_evento_pagamento()`, ele confirmaria o próprio
-- pedido passando `p_signature_valid => true` — não haveria pagamento nenhum,
-- só um `insert` bem-formatado. O grant ausente é o que fecha isso, e grant
-- ausente lança **antes** da RLS.
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select throws_ok(
  $$ select public.registrar_evento_pagamento('sandbox','evt-forjado-pelo-cliente',
       'payment.succeeded', '{"provider_ref":"ref-teste-1"}'::jsonb, true) $$,
  '42501', null,
  'NEGATIVO: o cliente NAO chama o webhook — confirmaria o proprio pedido'
);

-- E o mesmo vale para o admin. O papel não é o controle aqui: a conferência
-- da assinatura é, e ela só acontece na Edge Function.
set local request.jwt.claims to '{"sub":"a3330000-0000-0000-0000-00000000a333","role":"authenticated"}';

select throws_ok(
  $$ select public.registrar_evento_pagamento('sandbox','evt-forjado-pelo-admin',
       'payment.succeeded', '{"provider_ref":"ref-teste-1"}'::jsonb, true) $$,
  '42501', null,
  'NEGATIVO: nem o admin chama o webhook pela API'
);

-- -----------------------------------------------------------------------------
-- O interruptor do checkout (§40.9)
--
-- Nasce desligado e o provedor nasce PENDENTE. Um seed que ligasse o checkout
-- por engano faria o app cobrar num ambiente sem PSP contratado (P09).
-- -----------------------------------------------------------------------------
select is(
  (select is_enabled from public.feature_flags where key = 'payments.checkout'),
  false,
  'o checkout nasce desligado');

select is(
  (select value from public.app_config where key = 'payments.provider'),
  '"PENDENTE"'::jsonb,
  'e nenhum provedor esta declarado — §33 proibe inventar parceiro de pagamento');

-- O app precisa ler o nome do provedor para escolher o adapter; a chave que
-- assina o webhook nao esta no banco, e sim no ambiente da Edge Function.
select is(
  (select is_public from public.app_config where key = 'payments.provider'),
  true,
  'o nome do provedor e legivel pelo app; o segredo nao mora aqui');

-- =============================================================================
-- 6c. Participantes: quem vai, e quantos cabem (§40.5, §6.5 passo 5)
--
-- A lista de embarque maior que a vaga vendida é uma discussão no portão do
-- passeio, com o guia no meio. O limite é `order_items.people`, que veio do
-- servidor — e não um número que o cliente manda junto.
-- =============================================================================
-- O id do item fica guardado numa config da transação, e não relido a cada
-- asserção. Motivo, que custou uma rodada de esteira: **um subquery dentro do
-- teste roda sob a RLS do papel atual.** Lido como `c222`, que não enxerga o
-- pedido de `c111`, `(select id from order_items limit 1)` devolve NULL — e a
-- função recebia NULL, respondia "item nao encontrado" e nunca chegava a
-- lançar. O teste do acesso negado testava outra coisa.
set local role postgres;
-- Num bloco `do` porque `select set_config(...)` devolveria uma linha no meio
-- da saída TAP, e quem lê a saída é o pg_prove.
do $$
begin
  perform set_config('teste.item', (select id::text from public.order_items limit 1), true);
end $$;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select gravados from public.definir_participantes(
     current_setting('teste.item')::uuid,
     array['Ana Souza', '   ', 'Bruno Lima'])),
  2,
  'nome em branco nao conta como participante');

-- O item do pedido foi comprado para 3 pessoas (a reserva do carrinho).
select is(
  (select ok from public.definir_participantes(
     current_setting('teste.item')::uuid,
     array['Ana', 'Bruno', 'Carla', 'Diego'])),
  false,
  'NEGATIVO: mais nomes do que vagas e recusado');

-- E o mais importante da recusa: ela não destrói o que já estava lá. A função
-- apaga e reinsere; se a checagem viesse depois do `delete`, o cliente
-- perderia a lista boa ao tentar uma inválida.
select is(
  (select count(*)::int from public.order_participants),
  2,
  'a lista anterior sobrevive a uma tentativa recusada');

select is(
  (select gravados from public.definir_participantes(
     current_setting('teste.item')::uuid, array['Ana Souza'])),
  1,
  'substituir a lista deixa so o que foi enviado');

select is(
  (select count(*)::int from public.order_participants),
  1,
  'e a tabela reflete a substituicao, nao a soma');

-- Pedido de outra pessoa.
set local request.jwt.claims to '{"sub":"c2220000-0000-0000-0000-00000000c222","role":"authenticated"}';

select throws_ok(
  $$ select public.definir_participantes(
       current_setting('teste.item')::uuid, array['Invasor']) $$,
  '42501', null,
  'NEGATIVO: nao se escreve a lista de embarque do pedido alheio'
);

-- =============================================================================
-- 6d. Incluir o pedido na viagem (§40.11)
--
-- Roda antes do reembolso de propósito: depois dele o pedido está encerrado, e
-- pedido encerrado não entra em roteiro.
-- =============================================================================
set local role postgres;

insert into public.destinations (id, slug, name, country, timezone)
values ('dedd0000-0000-0000-0000-0000000000de', 'dubai-teste', 'Dubai', 'AE', 'Asia/Dubai')
on conflict (id) do nothing;

insert into public.trips (id, destination_id, name, status, starts_on, ends_on) values
  ('7a1a0000-0000-0000-0000-000000007a1a', 'dedd0000-0000-0000-0000-0000000000de',
   'Viagem do cliente 1', 'published', current_date + 5, current_date + 10),
  ('7b1b0000-0000-0000-0000-000000007b1b', 'dedd0000-0000-0000-0000-0000000000de',
   'Viagem do cliente 2', 'published', current_date + 5, current_date + 10);

insert into public.trip_members (trip_id, user_id) values
  ('7a1a0000-0000-0000-0000-000000007a1a', 'c1110000-0000-0000-0000-00000000c111'),
  ('7b1b0000-0000-0000-0000-000000007b1b', 'c2220000-0000-0000-0000-00000000c222');

do $$
begin
  perform set_config('teste.pedido', (select id::text from public.orders limit 1), true);
end $$;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select ok from public.incluir_pedido_na_viagem(
     current_setting('teste.pedido')::uuid, '7a1a0000-0000-0000-0000-000000007a1a')),
  true,
  'o cliente inclui o proprio pedido na propria viagem');

-- A viagem tem que ser de quem pede. Sem esta checagem, alguem anexaria o
-- proprio pedido ao roteiro de outra pessoa, e o passeio apareceria la.
select is(
  (select motivo from public.incluir_pedido_na_viagem(
     current_setting('teste.pedido')::uuid, '7b1b0000-0000-0000-0000-000000007b1b')),
  'voce nao esta nesta viagem',
  'NEGATIVO: nao se anexa pedido a viagem de outro');

select is(
  (select trip_id from public.orders where id = current_setting('teste.pedido')::uuid),
  '7a1a0000-0000-0000-0000-000000007a1a'::uuid,
  'e a recusa nao desfez o vinculo que ja existia');

-- O mesmo botao no outro sentido. Chamado com UM argumento, que e como o app
-- chama: o gerador de tipos transforma parametro com default em opcional, e
-- `exactOptionalPropertyTypes` proibe mandar `undefined` explicito. Testar a
-- forma de dois argumentos testaria um caminho que a tela nao usa.
select is(
  (select ok from public.incluir_pedido_na_viagem(
     current_setting('teste.pedido')::uuid)),
  true,
  'omitir a viagem tira o pedido dela');

select is(
  (select trip_id from public.orders where id = current_setting('teste.pedido')::uuid),
  null::uuid,
  'e o vinculo sumiu de verdade');

set local request.jwt.claims to '{"sub":"c2220000-0000-0000-0000-00000000c222","role":"authenticated"}';

select throws_ok(
  $$ select public.incluir_pedido_na_viagem(
       current_setting('teste.pedido')::uuid, '7b1b0000-0000-0000-0000-000000007b1b') $$,
  '42501', null,
  'NEGATIVO: nao se mexe no pedido dos outros'
);

-- =============================================================================
-- 7. Reembolso: gera evento, não apaga histórico (§40)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a3330000-0000-0000-0000-00000000a333","role":"authenticated"}';

select is(
  (select status::text from public.reembolsar_pedido(
     (select id from public.orders limit 1), 30000, 'Cliente desistiu de uma vaga')),
  'partially_refunded',
  'reembolso parcial');

select is(
  (select motivo from public.reembolsar_pedido(
     (select id from public.orders limit 1), 999999, 'tentativa')),
  'valor acima do total do pedido',
  'nao se reembolsa mais do que foi pago');

select is(
  (select status::text from public.reembolsar_pedido(
     (select id from public.orders limit 1), 51000, 'Cancelamento total')),
  'refunded',
  'o resto completa o reembolso');

set local role postgres;

select is((select count(*)::int from public.order_items), 1,
  'o historico do pedido continua la depois do reembolso');

select is((select count(*)::int from public.refunds), 2,
  'e cada reembolso deixou o proprio evento');

-- =============================================================================
-- 8. Seções da vitrine (§40.1 e §6.1)
--
-- A afirmação que mais importa aqui é a negativa: **seção publicada e vazia
-- não aparece.** Uma prateleira "A Fly recomenda" com nada dentro é pior do
-- que prateleira nenhuma, e é o estado natural de uma seção curada recém
-- criada no painel.
-- =============================================================================
set local role postgres;

-- Selo no passeio publicado e no rascunho. O rascunho existe no teste para
-- provar que a vitrine nao o mostra: seria vender o que nao esta a venda.
update public.tours set badge = 'trending'
where id in ('70170000-0000-0000-0000-000000007017','70270000-0000-0000-0000-000000007027');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.vitrine_de_passeios()),
  0,
  'as seis secoes nascem despublicadas: vitrine vazia');

set local role postgres;
update public.tour_sections set is_published = true where key in ('trend', 'fly_recomenda');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.vitrine_de_passeios() where section_key = 'trend'),
  1,
  'a secao por selo pega o passeio publicado');

-- O rascunho tem o mesmo selo e nao entra.
select is(
  (select count(*)::int from public.vitrine_de_passeios()
   where tour_id = '70270000-0000-0000-0000-000000007027'),
  0,
  'NEGATIVO: rascunho com selo nao aparece na vitrine');

select is(
  (select count(*)::int from public.vitrine_de_passeios() where section_key = 'fly_recomenda'),
  0,
  'NEGATIVO: secao curada publicada e VAZIA nao aparece');

set local role postgres;
insert into public.tour_section_items (section_key, tour_id, sort_order)
values ('fly_recomenda', '70170000-0000-0000-0000-000000007017', 1);

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.vitrine_de_passeios() where section_key = 'fly_recomenda'),
  1,
  'com item curado, a secao aparece');

-- "No seu destino" some sem viagem ativa, em vez de virar o catalogo inteiro
-- sob um rotulo que promete proximidade.
set local role postgres;
update public.tour_sections set is_published = true where key = 'perto';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.vitrine_de_passeios() where section_key = 'perto'),
  0,
  'sem viagem ativa, "No seu destino" nao aparece');

-- E o cliente nao mexe na vitrine: curadoria e do painel.
select throws_ok(
  $$ insert into public.tour_sections (key, label, source, badge)
     values ('pirata', 'Minha secao', 'selo', 'trending') $$,
  '42501', null,
  'NEGATIVO: cliente nao cria secao na vitrine'
);

-- =============================================================================
-- 9. Fornecedor (§40.13)
--
-- Fornecedor é dado de operação, não de vitrine: o nome e o telefone de quem
-- opera não são informação de quem compra, e expor a cadeia de fornecedores é
-- entregar a lista de contatos da Fly.
-- =============================================================================
set local role postgres;

insert into public.tour_suppliers (id, name, contact_name, contact_email)
values ('f0f00000-0000-0000-0000-0000000000f0', 'Deserto Tours', 'Khalid', 'ops@deserto.example');

update public.tours set supplier_id = 'f0f00000-0000-0000-0000-0000000000f0'
where id = '70170000-0000-0000-0000-000000007017';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1110000-0000-0000-0000-00000000c111","role":"authenticated"}';

select is(
  (select count(*)::int from public.tour_suppliers),
  0,
  'NEGATIVO: o cliente nao le a lista de fornecedores');

select throws_ok(
  $$ insert into public.tour_suppliers (name) values ('Fornecedor pirata') $$,
  '42501', null,
  'NEGATIVO: o cliente nao cria fornecedor'
);

set local request.jwt.claims to '{"sub":"a3330000-0000-0000-0000-00000000a333","role":"authenticated"}';

select is(
  (select count(*)::int from public.tour_suppliers),
  1,
  'a operacao le');

set local role postgres;

select throws_ok(
  $$ insert into public.tour_suppliers (name, contact_email) values ('Teste', 'sem-arroba') $$,
  '23514', null,
  'NEGATIVO: e-mail sem formato de e-mail e recusado'
);

-- `on delete set null`, e nao cascade: perder o fornecedor nao pode apagar o
-- passeio do catalogo. Quem vendeu continua tendo vendido.
delete from public.tour_suppliers where id = 'f0f00000-0000-0000-0000-0000000000f0';

select is(
  (select count(*)::int from public.tours where id = '70170000-0000-0000-0000-000000007017'),
  1,
  'apagar o fornecedor NAO apaga o passeio');

select is(
  (select supplier_id from public.tours where id = '70170000-0000-0000-0000-000000007017'),
  null::uuid,
  'o passeio so fica sem fornecedor');

select * from finish();
rollback;
