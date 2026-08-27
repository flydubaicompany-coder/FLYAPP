/**
 * O contrato de um provedor de pagamento (§40.9).
 *
 * Nenhum PSP está contratado — P09 no decision log — e a §33 proíbe declarar
 * integração sem contrato, credencial e homologação. O que existe aqui é a
 * **forma do buraco**: a interface que o provedor real vai preencher, e um
 * sandbox que a preenche de verdade para o fluxo poder ser provado de ponta a
 * ponta antes de haver contrato.
 *
 * Três coisas que a interface deliberadamente **não** tem:
 *
 * - **Nada de cartão.** Nem número, nem validade, nem CVV. O provedor
 *   tokeniza antes; o que circula por aqui é a referência opaca. A tabela
 *   `payments` também não tem coluna onde esse dado caberia.
 * - **Nada de "pago com sucesso" no retorno da autorização.** Quem confirma
 *   pagamento é o webhook, no servidor. Uma resposta de autorização é uma
 *   promessa do provedor, não um fato — e tratá-la como fato é como se
 *   confirma pedido que nunca foi cobrado.
 * - **Nada de segredo.** Este código roda no app. A chave que assina e confere
 *   evento vive só na Edge Function.
 */

import type { Moeda } from '@fly/domain-types';

/** O que o app pede ao provedor. Valor e moeda vêm do pedido, do servidor. */
export interface IntencaoDePagamento {
  /** `orders.id`. O provedor não conhece carrinho, só pedido. */
  readonly pedidoId: string;
  /** Em centavos inteiros. Nunca ponto flutuante — ver `dinheiro.ts`. */
  readonly totalCentavos: number;
  readonly moeda: Moeda;
  /**
   * O instrumento **já tokenizado**. No sandbox é um token de teste; num
   * provedor real é o token que o SDK dele devolve depois de coletar o cartão
   * numa tela que não é nossa.
   */
  readonly instrumento: string;
}

/**
 * O desfecho de uma tentativa de autorizar.
 *
 * `pendente` é o caminho normal, não a exceção: o provedor aceita a intenção e
 * o resultado chega depois, por webhook. Quem espera `aprovado` no retorno
 * síncrono escreve um checkout que mente em produção.
 */
export type Autorizacao =
  | {
      readonly status: 'pendente';
      /** `payments.provider_ref`. É por ela que o webhook acha o pedido. */
      readonly referencia: string;
    }
  | {
      readonly status: 'recusado';
      readonly motivo: string;
    }
  | {
      /**
       * O provedor não respondeu, respondeu errado, ou não existe. A tela cai
       * no atendimento humano — que é o fallback exigido pelo CLAUDE.md para
       * toda integração externa.
       */
      readonly status: 'indisponivel';
      readonly motivo: string;
    };

/**
 * Um provedor de pagamento.
 *
 * Implementações: `ProvedorSandbox` (existe, e é honesto sobre ser sandbox) e
 * `ProvedorDesligado` (o padrão, enquanto P09 não for decidido).
 */
export interface ProvedorDePagamento {
  /** Vai para `payments.provider`. É a chave que o webhook casa. */
  readonly nome: string;
  /** `false` no sandbox. A tela usa isto para avisar que não é cobrança real. */
  readonly ehProducao: boolean;
  autorizar(intencao: IntencaoDePagamento): Promise<Autorizacao>;
}
