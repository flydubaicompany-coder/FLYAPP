/**
 * Espacamento e tamanhos de icone.
 *
 * Escala de 4 pt. O design usa alguns valores impares (9, 11, 14, 22) em
 * ajustes finos de composicao; a escala abaixo cobre a estrutura, e desvios
 * pontuais devem ser justificados no proprio componente, nao normalizados aqui.
 */

export const space = {
  /** 2 — separacao otica entre glifo e texto. */
  xxs: 2,
  /** 4 */
  xs: 4,
  /** 8 */
  sm: 8,
  /** 12 */
  md: 12,
  /** 16 */
  lg: 16,
  /** 20 */
  xl: 20,
  /** 24 — respiro horizontal padrao das telas. */
  xxl: 24,
  /** 32 */
  xxxl: 32,
  /** 48 — separacao entre secoes. */
  section: 48,
} as const;

export type SpaceToken = keyof typeof space;

/** Respiro horizontal das telas, igual ao do prototipo. */
export const screenPadding = space.xxl;

/** Tamanhos de icone. `md` e o padrao de barra e lista. */
export const iconSize = {
  sm: 16,
  md: 24,
  lg: 28,
  xl: 32,
} as const;

export type IconSizeToken = keyof typeof iconSize;

export const spacing = { space, screenPadding, iconSize } as const;
