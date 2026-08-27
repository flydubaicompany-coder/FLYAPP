-- =============================================================================
-- Fase 5 — o interruptor e o endereço do provedor de pagamento (§40.9)
--
-- Esta migration não cria tabela nem função: `payments`, `payment_events`,
-- `iniciar_pagamento()` e `registrar_evento_pagamento()` já existem desde
-- 20260826010000. O que falta é a parte que decide **se** e **com quem** se
-- cobra — e essa decisão nunca pode estar no código do app.
--
-- Duas chaves, de propósito, e não uma:
--
--   feature_flags['payments.checkout']  — o interruptor
--   app_config['payments.provider']     — qual adapter
--
-- Desligar um provedor com problema sem perder qual provedor era é uma
-- operação que se faz às três da manhã, e uma chave só obrigaria a apagar a
-- configuração para desligar.
--
-- O interruptor nasce **desligado** e o provedor nasce `PENDENTE`. Nenhum PSP
-- está contratado (P09), e a §33 proíbe declarar integração sem contrato,
-- credencial e homologação. Ligar isto em produção sem PSP não faz o app
-- cobrar de mentira: `escolherProvedor` cai no provedor desligado quando o
-- valor é `PENDENTE`.
-- =============================================================================

insert into public.feature_flags (key, is_enabled, description) values
  ('payments.checkout', false,
   'Checkout no app. Nasce desligada: sem PSP contratado (P09), a tela cai no atendimento humano.')
on conflict (key) do nothing;

insert into public.app_config (key, value, description, is_public) values
  ('payments.provider',
   '"PENDENTE"'::jsonb,
   'Qual adapter atende o checkout. Hoje so existe "sandbox", que nao cobra nada e serve para provar o fluxo. O valor de producao depende de P09 — §33 proibe inventar parceiro de pagamento.',
   true)
on conflict (key) do nothing;

-- O app precisa ler o nome do provedor para escolher o adapter e para avisar
-- na tela que a cobranca e de teste. Nao ha segredo nisto: o nome do provedor
-- aparece na fatura de qualquer forma. Chave secreta vive na Edge Function.
comment on column public.app_config.is_public is
  'true = o app cliente pode ler. Deixe false por padrao; abra caso a caso. '
  'payments.provider e publico porque o app escolhe o adapter por ele.';
