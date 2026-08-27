/**
 * Adapter do provedor sandbox (§40.9).
 *
 * **Por que o sandbox é uma Edge Function e não código deste pacote.**
 *
 * A tentação é simular a cobrança aqui: gerar uma referência, esperar um
 * segundo, devolver "aprovado". Isso não prova nada. O que a §40 pede provar é
 * que *o caminho* funciona — autorização, webhook assinado, idempotência,
 * pedido que muda de status no servidor. Um mock no cliente pula exatamente as
 * partes que quebram em produção.
 *
 * Então o sandbox é um PSP falso de verdade, do outro lado da rede
 * (`supabase/functions/pagamento-sandbox`): recebe a intenção, devolve uma
 * referência e depois chama nosso webhook com um evento assinado, como um
 * provedor real chamaria. A chave que assina fica lá. Este arquivo é só o
 * cliente HTTP dele — e, no dia em que houver PSP contratado, este é o arquivo
 * que ganha um irmão, sem que a tela mude.
 */

import { createLogger } from '@fly/config';
import type { Autorizacao, IntencaoDePagamento, ProvedorDePagamento } from './tipos';

/**
 * Tokens de teste. Nenhum é número de cartão — nem parece um, de propósito.
 *
 * Existem porque "recusado" precisa ser um caminho exercitável. Um checkout
 * testado só no caminho feliz é um checkout cujo tratamento de recusa nunca
 * rodou.
 */
export const TOKENS_SANDBOX = {
  aprovar: 'tok_sandbox_aprovar',
  recusar: 'tok_sandbox_recusar',
} as const;

/** Passados os 15s, a resposta não serve mais: a pessoa já está olhando o erro. */
const TIMEOUT_MS = 15_000;

export interface OpcoesSandbox {
  /** URL da função `pagamento-sandbox`. */
  readonly endpoint: string;
  /** JWT do usuário. O sandbox chama `iniciar_pagamento()` em nome dele. */
  readonly token: string;
  /** Chave publicável. Nunca a secreta — o `readPublicEnv` já barra isso. */
  readonly apiKey: string;
  /** Injetável para teste. */
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

interface RespostaSandbox {
  status?: string;
  referencia?: string;
  motivo?: string;
}

export class ProvedorSandbox implements ProvedorDePagamento {
  readonly nome = 'sandbox';
  readonly ehProducao = false;

  private readonly logger = createLogger({ service: 'payments' });
  // Campo declarado em vez de parameter property: `erasableSyntaxOnly` recusa
  // sintaxe que precisa ser emitida, e parameter property e uma delas.
  private readonly opcoes: OpcoesSandbox;

  constructor(opcoes: OpcoesSandbox) {
    this.opcoes = opcoes;
  }

  async autorizar(intencao: IntencaoDePagamento): Promise<Autorizacao> {
    const fetchImpl = this.opcoes.fetchImpl ?? fetch;
    const timeoutMs = this.opcoes.timeoutMs ?? TIMEOUT_MS;

    // AbortSignal.timeout em vez de um Promise.race: o race deixa a requisição
    // correndo em segundo plano, e uma cobranca que chega depois de a tela ter
    // desistido é a origem clássica da cobrança duplicada.
    const controle = AbortSignal.timeout(timeoutMs);

    try {
      const resposta = await fetchImpl(this.opcoes.endpoint, {
        method: 'POST',
        signal: controle,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.opcoes.apiKey,
          Authorization: `Bearer ${this.opcoes.token}`,
        },
        body: JSON.stringify({
          pedido: intencao.pedidoId,
          total_cents: intencao.totalCentavos,
          currency: intencao.moeda,
          instrumento: intencao.instrumento,
        }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as RespostaSandbox;

      // A recusa é lida antes do código HTTP, e não depois. "Este pedido já
      // foi pago" chega como 409 — é uma recusa que a pessoa precisa ler, não
      // uma indisponibilidade que convida a tentar de novo.
      if (corpo.status === 'recusado') {
        return { status: 'recusado', motivo: corpo.motivo ?? 'pagamento recusado' };
      }

      if (!resposta.ok) {
        // O log leva o pedido, nunca o instrumento: o logger redige campos com
        // "card"/"token", mas contar com a redação é pior do que não mandar.
        this.logger.warn('sandbox recusou a chamada', {
          pedido: intencao.pedidoId,
          http: resposta.status,
        });
        return { status: 'indisponivel', motivo: corpo.motivo ?? 'provedor respondeu com erro' };
      }

      if (corpo.status === 'pendente' && corpo.referencia) {
        this.logger.info('pagamento autorizado no sandbox', { pedido: intencao.pedidoId });
        return { status: 'pendente', referencia: corpo.referencia };
      }

      // Resposta que não é nenhum dos dois: tratar como indisponível, e não
      // adivinhar. Adivinhar aqui é confirmar pedido não pago.
      return { status: 'indisponivel', motivo: 'resposta do provedor nao reconhecida' };
    } catch (erro) {
      const expirou = erro instanceof Error && erro.name === 'TimeoutError';
      this.logger.error('sandbox indisponivel', {
        pedido: intencao.pedidoId,
        motivo: expirou ? 'timeout' : 'rede',
      });
      return {
        status: 'indisponivel',
        motivo: expirou ? 'o provedor demorou demais' : 'nao consegui falar com o provedor',
      };
    }
  }
}
