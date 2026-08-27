-- =============================================================================
-- Append-only de verdade: revogar o que o Supabase concede por padrão
--
-- Achado ao rodar a suíte da Fase 4 contra o banco. Uma asserção esperava
-- `42501` num `update public.qr_tokens set uses = 0` e recebeu "no exception".
--
-- A causa não era a política. É que **o Supabase concede todos os privilégios
-- de `public` a `anon` e `authenticated` por padrão**, e um `grant select`
-- adicional não restringe nada — só repete o que já estava lá. As seis tabelas
-- abaixo tinham DELETE e UPDATE abertos.
--
-- A RLS continuava protegendo: tabela com RLS ligada e **sem** política para
-- um comando nega aquele comando. Não houve exposição. O que não existia era a
-- segunda camada que eu havia documentado — e a diferença aparece no dia em
-- que alguém acrescenta uma política permissiva sem perceber que o GRANT já
-- estava aberto.
--
-- E há a diferença de comportamento que a asserção revelou, que vale anotar
-- porque é a terceira vez que ela morde neste repositório:
--
--   INSERT barrado por RLS  → lança 42501 ("new row violates policy")
--   UPDATE barrado por RLS  → filtra zero linhas, e volta em silêncio
--
-- Por isso o teste do UPDATE afirma o efeito, e não a exceção.
-- =============================================================================

-- Somente leitura: emitir, resgatar e revogar passam por RPC. Um INSERT direto
-- deixaria o cliente escolher o próprio token; um UPDATE deixaria zerar `uses`
-- e reusar um código gasto.
revoke insert, update, delete on public.qr_tokens from authenticated, anon;
revoke insert, update, delete on public.qr_scans from authenticated, anon;

-- Append-only: escreve-se uma vez, e ninguém apaga depois. `insert` continua,
-- `update` e `delete` saem.
revoke update, delete on public.consents from authenticated, anon;
revoke update, delete on public.activity_acks from authenticated, anon;
revoke update, delete on public.document_access_log from authenticated, anon;
revoke update, delete on public.activity_checkins from authenticated, anon;

-- `anon` não tem o que fazer em nenhuma delas.
revoke all on public.qr_tokens from anon;
revoke all on public.qr_scans from anon;
revoke all on public.consents from anon;
revoke all on public.activity_acks from anon;
revoke all on public.document_access_log from anon;
revoke all on public.activity_checkins from anon;
