/**
 * O provedor de pagamento em sandbox (§40.9).
 *
 * Esta função **faz o papel do PSP**, não o papel da Fly. Ela existe porque a
 * §40 pede "checkout com provedor em sandbox por adapter" e nenhum provedor
 * está contratado (P09). Em vez de simular a cobrança dentro do app — o que
 * não provaria nada —, o sandbox se comporta como um provedor de verdade:
 * recebe a intenção, devolve uma referência e **depois** chama o nosso webhook
 * com um evento assinado.
 *
 * O que isso compra: o caminho exercitado é o caminho de produção. Trocar o
 * sandbox por um PSP real muda um adapter e uma linha de `app_config`; não
 * muda tela, nem RPC, nem webhook.
 *
 * O que isso **não** é: uma cobrança. Nada de dinheiro se move. O app diz isso
 * na tela, porque `ProvedorSandbox.ehProducao` é `false`.
 *
 * `verify_jwt` fica **ligado** aqui: o sandbox chama `iniciar_pagamento()` em
 * nome do usuário, e é a RPC que confere se o pedido é dele. Um sandbox que
 * aceitasse qualquer chamada anônima deixaria qualquer pessoa criar pagamento
 * no pedido dos outros.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assinar, CABECALHO_ASSINATURA } from '../_shared/assinatura.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Os mesmos tokens de `@fly/payments`. Nenhum parece número de cartão. */
const TOKEN_APROVAR = 'tok_sandbox_aprovar';
const TOKEN_RECUSAR = 'tok_sandbox_recusar';

interface Corpo {
  pedido?: string;
  instrumento?: string;
}

function responder(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder(405, { motivo: 'metodo nao permitido' });

  const segredo = Deno.env.get('FLY_PAYMENTS_WEBHOOK_SECRET');
  if (!segredo) {
    return responder(503, { motivo: 'sandbox nao configurado' });
  }

  const autorizacao = req.headers.get('Authorization');
  if (!autorizacao) return responder(401, { motivo: 'sem sessao' });

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return responder(400, { motivo: 'corpo invalido' });
  }

  const { pedido, instrumento } = corpo;
  if (!pedido || !instrumento) {
    return responder(400, { motivo: 'pedido e instrumento sao obrigatorios' });
  }

  if (instrumento !== TOKEN_APROVAR && instrumento !== TOKEN_RECUSAR) {
    // Um provedor real recusaria um token que ele não emitiu. Aceitar
    // qualquer string aqui esconderia o erro até a integração de verdade.
    return responder(400, { motivo: 'instrumento nao reconhecido' });
  }

  // Cliente com o JWT do usuário: `iniciar_pagamento()` resolve `auth.uid()`
  // e recusa pedido que não é dele. A conferência de dono não é feita aqui.
  const comoUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: autorizacao } },
    },
  );

  /**
   * Referência derivada do pedido, não aleatória.
   *
   * Um `random()` a cada toque criaria uma linha nova em `payments` por
   * tentativa — e a segunda tentativa depois de uma rede ruim viraria uma
   * segunda cobrança. Derivando do pedido, repetir cai no `ja iniciado` que a
   * RPC já sabe devolver. PSPs reais resolvem o mesmo problema com
   * idempotency key.
   */
  const referencia = `sbx_${pedido.replace(/-/g, '')}`;

  const { data, error } = await comoUsuario.rpc('iniciar_pagamento', {
    p_order: pedido,
    p_provider: 'sandbox',
    p_provider_ref: referencia,
  });

  if (error) {
    console.error('iniciar_pagamento falhou', { pedido, erro: error.message });
    return responder(403, { motivo: 'nao foi possivel iniciar o pagamento' });
  }

  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha?.ok) {
    return responder(409, {
      status: 'recusado',
      motivo: linha?.motivo ?? 'pedido nao aceita pagamento',
    });
  }

  const aprovado = instrumento === TOKEN_APROVAR;
  const tipo = aprovado ? 'payment.succeeded' : 'payment.failed';

  /**
   * O id do evento é estável, e é isso que torna a idempotência demonstrável:
   * chamar o sandbox duas vezes entrega o mesmo `event_id`, e o segundo
   * esbarra na unicidade de `(provider, provider_event_id)`. É o critério
   * literal da §40 — "repetição do webhook continua em um pedido".
   */
  const evento = {
    id: `evt_${referencia}_${aprovado ? 'ok' : 'nok'}`,
    type: tipo,
    provider: 'sandbox',
    data: {
      provider_ref: referencia,
      // Bandeira e últimos quatro dígitos são o que um provedor real devolve
      // para o cliente reconhecer a cobrança. Fictícios, e nunca um cartão.
      ...(aprovado ? { card_brand: 'sandbox', card_last4: '0000' } : {}),
    },
  };

  const corpoCru = JSON.stringify(evento);
  const assinatura = await assinar(corpoCru, segredo);

  // O provedor chama o webhook pela rede, como um PSP chamaria. Chamar a RPC
  // direto daqui seria mais curto e provaria menos: pularia a conferência de
  // assinatura, que é a parte que protege o endpoint.
  const entrega = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagamento-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [CABECALHO_ASSINATURA]: assinatura,
    },
    body: corpoCru,
  }).catch((e: unknown) => {
    console.error('sandbox nao conseguiu entregar o webhook', { erro: String(e) });
    return null;
  });

  if (!entrega) {
    // O pagamento foi iniciado, mas o evento não chegou. O pedido fica em
    // `pending_payment`, que é o estado honesto: ninguém confirmou nada.
    return responder(502, { motivo: 'o provedor nao conseguiu notificar' });
  }

  const resposta = (await entrega.json().catch(() => ({}))) as { resultado?: string };

  return responder(200, {
    status: aprovado ? 'pendente' : 'recusado',
    referencia,
    ...(aprovado ? {} : { motivo: 'o provedor recusou o instrumento de teste' }),
    // Devolvido para quem estiver testando pela linha de comando enxergar a
    // idempotência funcionando: a segunda chamada volta `duplicado`.
    webhook: resposta.resultado ?? 'sem resposta',
  });
});
