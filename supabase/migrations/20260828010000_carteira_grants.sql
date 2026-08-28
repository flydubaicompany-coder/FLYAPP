-- =============================================================================
-- Carteira: revogar o que o Supabase concede por padrao.
--
-- Mesma armadilha da 20260825200000, e a **quarta** vez que ela morde aqui: o
-- Supabase tem `alter default privileges ... grant all on tables to anon,
-- authenticated, service_role`, entao toda tabela nova nasce com tudo aberto
-- para os dois papeis. O `grant select` que a migration anterior escreveu nao
-- restringiu nada — apenas repetiu o que ja estava la.
--
-- Achado testando pela API do cliente: com a chave publicavel e sem sessao,
-- `points_ledger` respondeu `[]` e `customer_packages` respondeu 200. Deviam
-- ter respondido 42501. Nao houve exposicao — a RLS nega o que nao tem
-- politica, e ela estava certa. O que faltava era a segunda camada, que a
-- regra do projeto exige ("RLS e GRANT sao controles diferentes").
--
-- A diferenca importa no dia em que alguem acrescenta uma politica permissiva
-- sem reparar que o GRANT ja estava aberto.
-- =============================================================================

-- `anon` nao tem nada a fazer na Carteira. Nenhuma das tres e publica.
revoke all on public.customer_packages from anon;
revoke all on public.points_ledger     from anon;
revoke all on public.points_balance    from anon;

-- Append-only de verdade: sem policy **e** sem privilegio. O gatilho
-- `points_ledger_no_update` e a terceira tranca, e vale ate para o dono do
-- banco, que passa por cima das outras duas.
revoke update, delete on public.points_ledger from authenticated;
