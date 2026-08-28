-- =============================================================================
-- Fase 6 — a regra de Fly Points, decidida pelo dono em 28/08/2026.
--
-- Encerra a P12, que estava aberta desde o inicio do projeto. Ate hoje a
-- §33 obrigava o app a dizer "a definir"; agora ha regra, e ela vive em
-- configuracao — nao em codigo — porque mudar limiar e ato de operacao, nao
-- de release.
--
-- **Escala:** 10 pontos por unidade de moeda gasta. Uma viagem de casal com
-- cinco experiencias (~2.500 AED) rende ~25.000 pontos, que e exatamente o
-- degrau de prime. Foi assim que os limiares foram calibrados: prime a uma
-- viagem, elite a quatro.
--
-- **A moeda continua sendo a P43.** O dono deu os numeros do catalogo
-- (199/250) e nao a moeda; AED e a suposicao registrada, por ser a do destino.
-- A regra guarda a moeda junto para que um lancamento antigo continue
-- explicavel se ela mudar.
-- =============================================================================

update public.app_config
set value = '{"prime": 25000, "elite": 100000}'::jsonb,
    description = 'Pontos para prime e elite. Decidido pelo dono em 28/08/2026 (D129). Calibrado em uma viagem de casal com cinco experiencias = ~25.000 pontos.',
    updated_at = now()
where key = 'points.level_thresholds';

update public.app_config
set value = jsonb_build_object(
      'version', 'v1',
      'currency', 'AED',
      'spend_points_per_unit', 10,
      'event_checkin_points', 2000,
      'referral_purchase_points', 5000,
      'description',
        'Misto: 10 pontos por unidade de moeda gasta em experiencias elegiveis, '
        || '2.000 por check-in em evento Fly, 5.000 por indicacao que comprar. '
        || 'Fontes da §8.3 nao listadas aqui (desafio, conteudo aprovado, campanha, Fly Cup) '
        || 'continuam sem regra e nao pontuam automaticamente.'
    ),
    description = 'Como se ganha ponto. Decidido pelo dono em 28/08/2026 (D129). `version` entra em cada lancamento para o passado continuar explicavel.',
    updated_at = now()
where key = 'points.earning_rule';

-- A validade e um dado por lancamento (`points_ledger.expires_on`), mas o
-- prazo e configuracao: mudar de 24 para 36 meses nao pode exigir release.
insert into public.app_config (key, value, description, is_public) values
  (
    'points.validity_months',
    '24'::jsonb,
    'Meses ate um lancamento de ganho vencer. Decidido pelo dono em 28/08/2026 (D129). Nulo = nunca vence.',
    true
  )
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description,
      is_public = excluded.is_public,
      updated_at = now();
