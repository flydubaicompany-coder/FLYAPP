/**
 * Nível e situação de um caso de atendimento (§12.3 e §43).
 *
 * Mora aqui pela mesma razão que `moeda.ts`: **a ordem da fila é uma só**, e
 * ela é lida em três lugares — o Fly Ops, o Fly Crew e o app. Três cópias do
 * peso de cada nível divergem no dia em que alguém acrescentar um nível, e
 * divergir aqui não é cosmético: a migration que criou o índice
 * `support_cases_fila_idx` já registra o motivo — "uma fila que a operação lê
 * numa ordem e o banco entrega em outra vira gente atendida fora de ordem".
 *
 * O que **não** mora aqui são os rótulos. O cliente lê "A Fly recebeu" onde a
 * operação lê "Na fila", e é assim de propósito: cada superfície fala com
 * quem está do lado dela. O que se compartilha é a regra, não o texto.
 *
 * Espelha os enums `public.support_level` e `public.support_status`.
 */

/** Do mais urgente para o menos. A ordem da lista **é** a prioridade. */
export const NIVEIS_DE_ATENDIMENTO = ['sos', 'urgent', 'chat'] as const;

export type NivelDeAtendimento = (typeof NIVEIS_DE_ATENDIMENTO)[number];

export const SITUACOES_DE_ATENDIMENTO = [
  'open',
  'accepted',
  'in_progress',
  'escalated',
  'resolved',
  'closed',
] as const;

export type SituacaoDeAtendimento = (typeof SITUACOES_DE_ATENDIMENTO)[number];

/**
 * As situações que ainda pedem alguém.
 *
 * Igual ao `where` do índice `support_cases_fila_idx`. Se as duas listas
 * discordarem, a tela pede ao banco uma fila que o índice não cobre.
 */
export const SITUACOES_EM_ABERTO = [
  'open',
  'accepted',
  'in_progress',
  'escalated',
] as const satisfies readonly SituacaoDeAtendimento[];

export function estaEmAberto(situacao: SituacaoDeAtendimento): boolean {
  return (SITUACOES_EM_ABERTO as readonly SituacaoDeAtendimento[]).includes(situacao);
}

/**
 * Peso de prioridade: maior vem antes.
 *
 * Derivado da posição em `NIVEIS_DE_ATENDIMENTO`, e não escrito à mão — um
 * nível novo entra na lista e o peso sai de graça, sem ninguém lembrar de
 * atualizar um segundo mapa.
 */
export const PESO_DO_NIVEL = Object.fromEntries(
  NIVEIS_DE_ATENDIMENTO.map((nivel, i) => [nivel, NIVEIS_DE_ATENDIMENTO.length - i]),
) as Record<NivelDeAtendimento, number>;

export interface NaFila {
  nivel: NivelDeAtendimento;
  /** ISO-8601, como vem de `support_cases.opened_at`. */
  abertoEm: string;
}

/**
 * A ordem da fila: urgência primeiro, e dentro dela quem espera há mais tempo.
 *
 * Não altera o array recebido — a tela costuma ter outra lista apontando para
 * os mesmos objetos, e ordenar no lugar embaralharia as duas.
 */
export function ordenarFila<T extends NaFila>(casos: readonly T[]): T[] {
  return [...casos].sort(
    (a, b) =>
      PESO_DO_NIVEL[b.nivel] - PESO_DO_NIVEL[a.nivel] || a.abertoEm.localeCompare(b.abertoEm),
  );
}
