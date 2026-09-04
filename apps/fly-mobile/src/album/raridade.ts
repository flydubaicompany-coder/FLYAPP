/**
 * Raridade de figurinha (§13.1).
 *
 * Puro de propósito — a regra que decide o que aparece coberto é a única
 * lógica do álbum que vale testar, e ela não pode arrastar `react-native`
 * junto (a armadilha que já mordeu três vezes neste projeto).
 *
 * O ouro **não** entra aqui. A regra dos usos do dourado está no CLAUDE.md e
 * a holográfica não é um dos usos registrados; ela se distingue por brilho e
 * borda, não por virar a sexta coisa dourada da tela.
 */

export const RARIDADES = ['common', 'rare', 'secret', 'holographic'] as const;

export type Raridade = (typeof RARIDADES)[number];

export const ROTULO_RARIDADE: Record<Raridade, string> = {
  common: 'Comum',
  rare: 'Rara',
  secret: 'Secreta',
  holographic: 'Holográfica',
};

/**
 * O que a grade mostra de uma figurinha que ainda não foi conquistada.
 *
 * A **secreta não revela o nome**: revelar transformaria a surpresa numa
 * lista de tarefas. Ela ocupa o lugar — some seria pior, porque o contador do
 * capítulo diria "faltam 2" e a pessoa veria uma casa só.
 */
export function comoMostrar(
  raridade: Raridade,
  desbloqueada: boolean,
): 'aberta' | 'silhueta' | 'misterio' {
  if (desbloqueada) return 'aberta';
  return raridade === 'secret' ? 'misterio' : 'silhueta';
}

/** Quantas obrigatórias faltam para o Dia Completo. Espelha a regra do banco. */
export function faltamParaODia(
  figurinhas: readonly { obrigatoria: boolean; desbloqueada: boolean }[],
): number {
  return figurinhas.filter((f) => f.obrigatoria && !f.desbloqueada).length;
}
