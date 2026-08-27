/**
 * Destinos de analytics.
 *
 * Nenhum fornecedor está contratado (§33: não declarar integração sem
 * contrato, homologação e teste). Estes dois destinos são reais e honestos:
 * um guarda em memória, para teste; o outro escreve no log estruturado, para
 * desenvolvimento. O adapter do fornecedor entra ao lado deles quando houver
 * contrato, e nada mais precisa mudar.
 */

import { createLogger } from '@fly/config';
import type { Destino, EventoRegistrado } from './tipos';

/** Guarda o que recebeu. É o destino dos testes. */
export class DestinoMemoria implements Destino {
  readonly nome = 'memoria';
  readonly recebidos: EventoRegistrado[] = [];

  enviar(eventos: readonly EventoRegistrado[]): void {
    this.recebidos.push(...eventos);
  }

  limpar(): void {
    this.recebidos.length = 0;
  }
}

/** Escreve no log estruturado. É o destino de desenvolvimento. */
export class DestinoLog implements Destino {
  readonly nome = 'log';
  private readonly logger = createLogger({ service: 'analytics' });

  enviar(eventos: readonly EventoRegistrado[]): void {
    for (const e of eventos) {
      this.logger.info(`analytics:${e.nome}`, e.props);
    }
  }
}

/**
 * Não faz nada.
 *
 * É o destino de produção enquanto não houver fornecedor — e é melhor que
 * não instrumentar o app: o código de chamada já está no lugar certo, e
 * ligar o fornecedor vira uma linha de configuração em vez de uma varredura
 * por toda a base.
 */
export class DestinoNulo implements Destino {
  readonly nome = 'nulo';
  enviar(): void {}
}
