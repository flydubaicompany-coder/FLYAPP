/**
 * O provedor que não cobra nada — e diz isso em voz alta.
 *
 * É o **padrão**, e vai continuar sendo até P09 ser decidido. A §33 é
 * explícita: não se declara integração de pagamento sem contrato, credencial e
 * homologação. Um app que mostra "Pagar com cartão" sem PSP contratado está
 * afirmando uma coisa que não é verdade para quem está lendo a tela.
 *
 * Ele existe em vez de `null` porque `null` obriga toda tela a lembrar do caso
 * "não tem provedor". Aqui a tela chama `autorizar()` como sempre, recebe
 * `indisponivel`, e cai no atendimento humano — que é o fallback real da Fly
 * hoje, e é o que a tela do pedido já dizia antes deste pacote existir.
 */

import type { Autorizacao, ProvedorDePagamento } from './tipos';

export class ProvedorDesligado implements ProvedorDePagamento {
  readonly nome = 'desligado';
  readonly ehProducao = false;

  autorizar(): Promise<Autorizacao> {
    return Promise.resolve({
      status: 'indisponivel',
      motivo: 'sem provedor de pagamento configurado',
    });
  }
}
