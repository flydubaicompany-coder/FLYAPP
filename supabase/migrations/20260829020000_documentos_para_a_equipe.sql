-- =============================================================================
-- Os documentos do cliente sao visiveis para a equipe que o atende.
--
-- Decisao do dono em 29/08/2026: "a equipe tem que ter acesso a todos os dados
-- do cliente, menos cartao de credito".
--
-- ## O que estava errado
--
-- A migration 20260825220000 ja tinha corrigido isso para o **passaporte**, e
-- pelo motivo certo: emitir a passagem e o servico contratado, e travar o dado
-- atras de consentimento opcional impedia a Fly de fazer aquilo pelo que foi
-- paga.
--
-- Mas a correcao parou no passaporte. `documents` e o bucket `documentos` —
-- onde vivem voucher, autorizacao, seguro, comprovante — continuaram visiveis
-- **so para o dono**, ou por concessao avulsa. Na pratica: o concierge que
-- precisa conferir um voucher tinha de pedir ao cliente que compartilhasse.
--
-- ## A forma, que e a mesma da decisao anterior
--
--   - **acesso minimo**: quem opera a viagem DAQUELA pessoa, e a operacao
--     global. Um guia de outra viagem continua sem ver.
--   - **auditavel**: `document_access_log` ja registra toda abertura.
--   - **a equipe le, nao escreve**: update e delete continuam so do dono.
--
-- ## O que NAO entra, nem agora nem depois
--
-- Dado de cartao de credito. Nao ha tabela para ele e nao havera: quando o
-- parceiro de pagamento existir, o que se guarda e **token**, nunca numero.
-- =============================================================================

drop policy if exists documents_select on public.documents;

create policy documents_select on public.documents for select to authenticated
  using (
    (select auth.uid()) = public.documents.owner_id
    or fly_private.has_document_grant(public.documents.id)
    or fly_private.is_guardian_of_owner(public.documents.id)
    -- A equipe que compartilha viagem com o dono, e a operacao global.
    or fly_private.shares_trip_with(public.documents.owner_id)
    or fly_private.is_global_operator()
  );

-- O arquivo segue a mesma regra da linha. Sem isto a equipe veria o nome do
-- documento e nao conseguiria abrir — que e pior do que nao ver.
drop policy if exists documentos_select_proprio on storage.objects;

create policy documentos_select_proprio on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.documents d
        join public.document_grants g on g.document_id = d.id
        where d.storage_path = storage.objects.name
          and g.grantee_id = (select auth.uid())
          and g.revoked_at is null
          and (g.expires_at is null or g.expires_at > now())
      )
      or exists (
        select 1
        from public.documents d
        where d.storage_path = storage.objects.name
          and (
            fly_private.shares_trip_with(d.owner_id)
            or fly_private.is_global_operator()
          )
      )
    )
  );

comment on policy documents_select on public.documents is
  'Dono, concessao, responsavel, equipe da viagem daquela pessoa, e operacao global. Toda abertura fica em document_access_log.';
