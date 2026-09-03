-- =============================================================================
-- Fase 8 — a fila em tempo real (§43, entrega 11).
--
-- `support_messages` ja estava na publicacao desde `20260902000000`; o caso
-- em si nao estava. Sem ele, um SOS que chega enquanto a operacao olha a tela
-- so aparece quando alguem recarrega — e o SOS e exatamente o evento que nao
-- pode esperar por isso.
--
-- **O canal continua privado.** O Realtime do Postgres Changes aplica a RLS
-- da tabela para cada assinante: a equipe recebe a fila inteira porque
-- `support_cases_select` deixa, e o cliente recebe so o caso dele pela mesma
-- policy. Nao ha nada aqui alem de por a tabela na publicacao.
-- =============================================================================

alter publication supabase_realtime add table public.support_cases;
