-- =============================================================================
-- Trip Mode — release da viagem Dubai, setembro de 2026
--
-- Migration pequena e **independente das Fases 10 e 11**, de propósito: o
-- release da viagem não pode depender de sete migrations que ainda não foram
-- aplicadas. São duas coisas, e as duas cabem em segundos.
--
-- 1. O documento para dirigir ganha valor próprio no enum. Já dava para
--    guardá-lo como `other` com o título escrito à mão, e é justamente por
--    isso que o valor precisa existir: `other` com título "CNH" transforma o
--    tipo do documento numa string livre, e a primeira busca por documento de
--    habilitação teria de casar texto.
--
-- 2. O WhatsApp da operação entra em `app_config`, e não no código. O número
--    veio do dono do produto em 06/09/2026 — contato está na lista da §33 do
--    que nunca se inventa, e este não foi inventado.
-- =============================================================================

-- `add value` não pode aparecer na mesma transação que usa o valor novo. Aqui
-- ninguém o usa: quem usa é o aplicativo, depois.
alter type public.document_kind add value if not exists 'driver_license';

insert into public.app_config (key, value, description, is_public) values
  (
    'support.whatsapp',
    '"+5521983238650"'::jsonb,
    'WhatsApp da operacao Fly. Usado pelo Trip Mode para suporte e pedido de experiencia. Informado pelo dono do produto em 06/09/2026.',
    true
  ),
  (
    'trip.support_hours_note',
    '"PENDENTE"'::jsonb,
    'Horario de atendimento do WhatsApp, em texto. PENDENTE ate o dono definir — enquanto for, a tela nao promete horario nenhum.',
    true
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();

comment on column public.documents.kind is
  'Tipo do documento. driver_license entrou no Trip Mode (set/2026) para a CNH nao virar `other` com titulo livre.';
