/**
 * Webhook de pagamento (§40.10).
 *
 * **Por que esta função existe.**
 *
 * `registrar_evento_pagamento()` é `security definer` e não tem grant para
 * `authenticated` — de propósito. Ela recebe `signature_valid` já resolvido, e
 * quem resolve precisa da chave secreta do provedor. Chave secreta não entra
 * em app. Se o cliente pudesse chamar a RPC, qualquer pessoa confirmaria o
 * próprio pedido passando `true`.
 *
 * Então o desenho é: só esta função chama a RPC, e ela usa `service_role` —
 * que só existe dentro da Edge Function.
 *
 * **Os códigos HTTP importam mais do que parece.** Um PSP reenvia o evento
 * enquanto não receber 2xx. Devolver erro para um evento que já foi
 * processado, ou para um que não reconhecemos, gera reenvio eterno. A regra
 * aqui: 200 sempre que a mensagem foi *entendida*, mesmo que não tenha gerado
 * efeito. 401 só para assinatura inválida — aí o reenvio é bem-vindo, porque
 * o problema pode ser configuração nossa. 5xx só quando o erro é nosso e
 * tentar de novo pode dar certo.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CABECALHO_ASSINATURA, conferir } from '../_shared/assinatura.ts';

interface Evento {
  id?: string;
  type?: string;
  provider?: string;
  data?: Record<string, unknown>;
}

function responder(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { erro: 'metodo nao permitido' });

  const segredo = Deno.env.get('FLY_PAYMENTS_WEBHOOK_SECRET');
  if (!segredo) {
    // Sem segredo não há como distinguir evento do provedor de evento forjado.
    // Aceitar "por enquanto" seria abrir um endpoint que confirma pedidos.
    console.error('FLY_PAYMENTS_WEBHOOK_SECRET ausente; webhook recusando tudo');
    return responder(503, { erro: 'webhook nao configurado' });
  }

  // O corpo é lido como texto **antes** de qualquer parse: a assinatura é
  // sobre estes bytes, exatamente como chegaram.
  const corpoCru = await req.text();

  const conferencia = await conferir(corpoCru, req.headers.get(CABECALHO_ASSINATURA), segredo);

  let evento: Evento;
  try {
    evento = JSON.parse(corpoCru) as Evento;
  } catch {
    return responder(400, { erro: 'corpo invalido' });
  }

  const provider = evento.provider ?? 'desconhecido';
  const eventId = evento.id;
  const eventType = evento.type;

  if (!eventId || !eventType) {
    return responder(400, { erro: 'evento sem id ou type' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Assinatura inválida também é registrada — a RPC grava a tentativa com
  // `signature_valid = false` e não processa nada. Descartar em silêncio
  // esconderia justamente a tentativa de forjar pagamento.
  const { data, error } = await admin.rpc('registrar_evento_pagamento', {
    p_provider: provider,
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: evento.data ?? {},
    p_signature_valid: conferencia.valida,
  });

  if (error) {
    console.error('registrar_evento_pagamento falhou', { evento: eventId, erro: error.message });
    // 5xx: o erro é nosso, e o reenvio do provedor é o que salva o pedido.
    return responder(500, { erro: 'nao foi possivel registrar o evento' });
  }

  if (!conferencia.valida) {
    console.error('webhook com assinatura invalida', {
      provider,
      evento: eventId,
      motivo: conferencia.motivo,
    });
    return responder(401, { erro: 'assinatura invalida' });
  }

  const linha = Array.isArray(data) ? data[0] : data;
  const resultado = linha?.resultado ?? 'desconhecido';

  // `duplicado` e `pagamento_desconhecido` são 200 de propósito: a mensagem
  // chegou e foi entendida. Devolver erro faria o provedor reenviar para
  // sempre um evento que nunca vai mudar de resposta.
  return responder(200, {
    resultado,
    pedido: linha?.order_id ?? null,
    status: linha?.order_status ?? null,
  });
});
