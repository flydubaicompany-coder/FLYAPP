-- Seed de desenvolvimento.
--
-- Regra da §33 da spec: o Claude não inventa regra de negócio. Nada aqui é
-- valor de produção — são chaves de configuração com valores marcados como
-- pendentes, para que a estrutura exista e o dono do produto preencha.

insert into public.feature_flags (key, is_enabled, description) values
  ('wallet.balance_topup',   false, 'Adicionar saldo financeiro. So liga com PSP/BaaS e analise juridica (spec §8.6).'),
  ('wallet.fly_card',        false, 'Fly Card virtual/fisico. Exige emissor regulado (spec §8.6).'),
  ('tax_free.partner_submit',false, 'Envio ao parceiro de tax-free. Exige contrato e homologacao (spec §8.8).'),
  ('sos.enabled',            false, 'Fluxo de SOS. So liga com responsavel e SLA definidos (decisao pendente §50.16).'),
  ('assistant.ai',           false, 'Assistente Fly. Entra na Fase 10 (spec §15.1).')
on conflict (key) do nothing;

insert into public.app_config (key, value, description, is_public) values
  ('meals.confirmation_deadline_hours',
   '"PENDENTE"'::jsonb,
   'Prazo de confirmacao de refeicao. A spec §11.1 cita 5h como valor inicial, mas proibe hardcode — o dono do produto define.',
   false),
  ('support.emergency_contacts',
   '"PENDENTE"'::jsonb,
   'Contatos oficiais de emergencia. §33 proibe inventar — preencher no Fly Ops.',
   false),
  ('points.earn_formula',
   '"PENDENTE"'::jsonb,
   'Formula de Fly Points. Decisao pendente §50.8.',
   false),
  ('status.tiers',
   '"PENDENTE"'::jsonb,
   'Niveis e validade do Fly Status. Decisao pendente §50.9.',
   false),
  ('app.min_supported_version',
   '"0.1.0"'::jsonb,
   'Versao minima suportada do app cliente.',
   true)
on conflict (key) do nothing;
