/**
 * Tipos compartilhados do analytics.
 *
 * `HomeState` é reexportado daqui, e não importado do app, porque o pacote
 * de analytics não pode depender de um aplicativo — a dependência anda no
 * outro sentido.
 */

export type HomeState = 'no_trip' | 'pre_trip' | 'during_trip' | 'post_trip';

/** Um evento já pronto para sair. */
export interface EventoRegistrado {
  nome: string;
  props: Record<string, unknown>;
  /** ISO 8601, em UTC. */
  em: string;
}

/**
 * Para onde os eventos vão.
 *
 * Não há fornecedor contratado. A §33 proíbe declarar integração sem
 * contrato e homologação, então o pacote define a interface e entrega dois
 * destinos honestos — memória e console. O adapter do fornecedor entra
 * quando existir contrato, e nada mais no código precisa mudar.
 */
export interface Destino {
  nome: string;
  enviar(eventos: readonly EventoRegistrado[]): void | Promise<void>;
}
