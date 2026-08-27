-- =============================================================================
-- Consentimento para analytics de produto (§38.11)
--
-- Medir como alguém usa o app é tratamento de dado pessoal, e a §33 proíbe
-- inventar base legal. Então a escolha aqui é a conservadora: analytics é uma
-- finalidade **opcional e explícita**, ao lado de marketing, e o app não envia
-- nada sem consentimento vigente.
--
-- Se o jurídico concluir que legítimo interesse basta, isto vira uma linha de
-- configuração e nenhuma mudança de código — o cliente de analytics lê o
-- estado do consentimento, não a base legal. A decisão fica registrada como
-- pendente no decision log.
--
-- Não há função nova aqui: `current_consents` já resolve "qual é a escolha
-- vigente" sobre o ledger append-only de `consents`, e duplicar essa conta
-- seria criar uma segunda fonte de verdade sobre permissão.
-- =============================================================================

insert into public.consent_purposes (key, label, description, is_required, is_sensitive)
values (
  'product_analytics',
  'Melhorias do aplicativo',
  'Permite à Fly entender quais telas e recursos são usados, para melhorar o app. Nunca inclui dados que identifiquem você.',
  false,
  false
)
on conflict (key) do nothing;
