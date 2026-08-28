import { type FlyPackage } from '@fly/design-tokens';

/**
 * Pacote adquirido — Standard, Black, Billionaire.
 *
 * **Nao e nivel de pontos** (D95): pacote se compra, nivel se conquista. Esta
 * distincao ja virou bug uma vez, entao `ehPacote` recusa explicitamente os
 * nomes de nivel.
 *
 * Modulo puro, sem React: os testes do app nao conseguem importar de um
 * arquivo que arrasta o `react-native` junto.
 */

export const ROTULO_PACOTE: Record<FlyPackage, string> = {
  standard: 'STANDARD',
  black: 'FLY BLACK',
  billionaire: 'BILLIONAIRE',
};

export function ehPacote(valor: string | null | undefined): valor is FlyPackage {
  return valor === 'standard' || valor === 'black' || valor === 'billionaire';
}

export type { FlyPackage };
