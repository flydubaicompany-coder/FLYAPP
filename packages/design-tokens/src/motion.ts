/**
 * Movimento.
 *
 * O design pede "movimentos suaves" e "interface calma nos momentos
 * operacionais". Traducao pratica: nada acima de 400 ms, nada com bounce em
 * fluxo critico, e tudo respeitando reduce motion (§25.4).
 */

export const duration = {
  /** Feedback imediato: pressionar, marcar, alternar. */
  instant: 120,
  /** Transicao padrao: aparecer, sumir, mudar de aba. */
  base: 220,
  /** Sheet subindo, tela empilhando. */
  emphasized: 320,
  /** Celebracao: Dia Completo, figurinha liberada. Nunca em fluxo operacional. */
  celebration: 400,
} as const;

export type DurationToken = keyof typeof duration;

/**
 * Curvas em formato de bezier cubico. `[x1, y1, x2, y2]`.
 */
export const easing = {
  /** Entrada de elemento: desacelera no fim. */
  decelerate: [0, 0, 0.2, 1],
  /** Saida de elemento: acelera no fim. */
  accelerate: [0.4, 0, 1, 1],
  /** Movimento de ida e volta na tela. */
  standard: [0.4, 0, 0.2, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EasingToken = keyof typeof easing;

/**
 * Duracao efetiva considerando a preferencia de reduzir movimento.
 *
 * Devolve 0 quando o usuario pediu menos movimento: o estado final continua
 * correto, so a animacao desaparece. Nunca condicione conteudo a animacao.
 */
export function effectiveDuration(token: DurationToken, prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : duration[token];
}

export const motion = { duration, easing, effectiveDuration } as const;
