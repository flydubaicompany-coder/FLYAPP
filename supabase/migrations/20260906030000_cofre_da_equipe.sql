-- =============================================================================
-- Fase 11 — a equipe deposita no cofre, e continua sem ler (lacuna 8)
--
-- A auditoria de paridade achou uma contradição entre duas migrations da Fase 4:
--
--   • `public.documents` diz, em comentário e em policy, que a equipe envia
--     documento para o cliente — "a equipe envia voucher para o cliente, e o
--     dono continua sendo o cliente", e `documents_insert` aceita quem opera a
--     viagem;
--
--   • a policy do bucket `documentos` aceita `insert` só na pasta de quem está
--     logado: `(storage.foldername(name))[1] = auth.uid()`.
--
-- Resultado: dava para criar a **linha** do voucher e não dava para subir o
-- **arquivo**. A linha apontava para um caminho vazio. Ninguém percebeu porque
-- nenhum painel tentava — não havia tela de cofre, que é a lacuna 8.
--
-- A correção é abrir o depósito, e **só** o depósito. Quem opera a viagem passa
-- a poder gravar na pasta de quem está nela; continua sem poder ler, editar ou
-- apagar. A policy de `select` não é tocada: ler documento alheio segue
-- exigindo `document_grants`, e cada leitura segue virando linha em
-- `document_access_log`.
--
-- Depositar sem poder abrir é a assimetria certa aqui. É a caixa de correio do
-- prédio: o carteiro põe dentro, e não tem a chave.
-- =============================================================================

create policy documentos_insert_equipe on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    -- A primeira pasta precisa **ser** um uuid antes de virar um: um nome de
    -- arquivo qualquer derrubaria a policy com erro de conversão, e uma policy
    -- que lança exceção é uma policy que ninguém consegue depurar.
    and (storage.foldername(name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.trip_members tm
      where tm.user_id = ((storage.foldername(name))[1])::uuid
        and fly_private.can_operate_trip(tm.trip_id)
    )
  );

comment on policy documentos_insert_equipe on storage.objects is
  'A equipe deposita na pasta de quem esta na viagem. Ler continua exigindo grant.';
