/**
 * Cliente de analytics (§38.11).
 *
 * Três regras governam este arquivo, nesta ordem:
 *
 * 1. **Sem consentimento, nada sai.** Medir comportamento é tratamento de
 *    dado pessoal. O padrão é não enviar, e o padrão vale enquanto o
 *    consentimento não for conhecido.
 * 2. **Sem dado pessoal**, mesmo com consentimento (`./pii`).
 * 3. **Sem fornecedor inventado.** A §33 proíbe declarar integração sem
 *    contrato. O cliente fala com uma interface `Destino`; qual destino é
 *    decisão de configuração, não de código.
 *
 * O caso chato é o começo do app: `home_vista` acontece antes de o
 * consentimento carregar do servidor. Descartar perderia sempre o primeiro
 * evento da sessão; enviar seria tratar dado antes da permissão. A saída é
 * uma fila de espera limitada, que só vira envio se o consentimento chegar
 * positivo — e é jogada fora inteira se chegar negativo.
 */

import { limpar } from './pii';
import type { Destino, EventoRegistrado } from './tipos';
import type { EventosFly, NomeEvento } from './taxonomia';

export type EstadoConsentimento = 'desconhecido' | 'concedido' | 'negado';

export interface OpcoesCliente {
  destino: Destino;
  /**
   * Teto da fila de espera. Passou disso, os mais antigos caem: uma fila que
   * cresce sem limite num app offline vira consumo de memória.
   */
  maxEspera?: number;
  /** Injetável para o teste não depender do relógio. */
  agora?: () => Date;
  /** Chamado quando a barreira de PII redige algo. Útil em desenvolvimento. */
  aoRedigir?: (nome: string, motivos: readonly string[]) => void;
}

export class Analytics {
  private consentimento: EstadoConsentimento = 'desconhecido';
  private espera: EventoRegistrado[] = [];
  private readonly destino: Destino;
  private readonly maxEspera: number;
  private readonly agora: () => Date;
  private readonly aoRedigir: ((nome: string, motivos: readonly string[]) => void) | undefined;

  constructor(opcoes: OpcoesCliente) {
    this.destino = opcoes.destino;
    this.maxEspera = opcoes.maxEspera ?? 50;
    this.agora = opcoes.agora ?? (() => new Date());
    this.aoRedigir = opcoes.aoRedigir;
  }

  /**
   * Informa o consentimento.
   *
   * `concedido` libera a fila de espera. `negado` a descarta — e descartar é
   * o comportamento correto, não uma simplificação: aqueles eventos foram
   * coletados sob permissão que não veio.
   */
  definirConsentimento(estado: EstadoConsentimento): void {
    this.consentimento = estado;

    if (estado === 'concedido' && this.espera.length > 0) {
      const pendentes = this.espera;
      this.espera = [];
      void this.destino.enviar(pendentes);
      return;
    }

    if (estado === 'negado') this.espera = [];
  }

  estadoAtual(): EstadoConsentimento {
    return this.consentimento;
  }

  /** Quantos eventos aguardam decisão. Existe para o teste poder afirmar. */
  aguardando(): number {
    return this.espera.length;
  }

  /**
   * Registra um evento.
   *
   * A assinatura amarra nome e propriedades: `registrar('home_vista', ...)`
   * só aceita as propriedades de `home_vista`.
   */
  registrar<N extends NomeEvento>(nome: N, props: EventosFly[N]): void {
    if (this.consentimento === 'negado') return;

    const { props: limpo, redacoes, motivos } = limpar(props as Record<string, unknown>);
    if (redacoes > 0) this.aoRedigir?.(nome, motivos);

    const evento: EventoRegistrado = {
      nome,
      props: limpo,
      em: this.agora().toISOString(),
    };

    if (this.consentimento === 'concedido') {
      void this.destino.enviar([evento]);
      return;
    }

    // Ainda desconhecido: segura, sem enviar.
    this.espera.push(evento);
    if (this.espera.length > this.maxEspera) this.espera.shift();
  }
}
