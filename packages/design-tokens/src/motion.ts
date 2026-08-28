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
/**
 * Tres curvas, e **so** estas tres (regra 7 do handoff de 28/08/2026).
 *
 * As anteriores eram as do Material e nunca chegaram a ser usadas — a troca
 * nao mexeu em nenhuma animacao existente.
 *
 * `overshoot` tem uso unico e declarado: o pulo do badge do carrinho. Nao e
 * curva de proposito geral, e espalha-la deixa a interface saltitante.
 */
export const easing = {
  /** Entradas e revelacoes. */
  enter: [0.22, 1, 0.36, 1],
  /** Movimento continuo: carrossel, knob de toggle, arraste. */
  continuous: [0.32, 0.9, 0.28, 1],
  /** So o pulo do badge do carrinho. */
  overshoot: [0.34, 1.56, 0.64, 1],
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
