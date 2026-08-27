/**
 * Tipografia do Fly App.
 *
 * FONTE DE VERDADE: `Fly Phone.dc.html` (docs/design/canvas/).
 * A escala do design usa meio ponto em varios degraus — os valores abaixo
 * sao literais, nao arredondados.
 */

/**
 * Pilha de fontes do sistema. O design especifica "SF Pro Display / Text",
 * que no iOS vem de `-apple-system`. Nao ha webfont a carregar.
 */
export const fontFamily = [
  '-apple-system',
  'BlinkMacSystemFont',
  "'SF Pro Display'",
  "'SF Pro Text'",
  "'Helvetica Neue'",
  "'Segoe UI'",
  'system-ui',
  'sans-serif',
].join(',');

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** O RN tipa fontWeight como uniao literal, nao como string. */
export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

/**
 * Degraus de texto. `letterSpacing` esta em em, como no design.
 * Valores negativos apertam o texto — e o que da a leitura "premium".
 */
export const textStyle = {
  /** Titulo de tela. */
  largeTitle: {
    fontSize: 33,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.038,
    lineHeight: 1,
  },
  /** Cabecalho de secao. */
  section: {
    fontSize: 20,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.028,
    lineHeight: 1.2,
  },
  /** Corpo de texto. */
  body: {
    fontSize: 15,
    fontWeight: fontWeight.regular,
    letterSpacing: 0,
    lineHeight: 1.5,
  },
  /**
   * Kicker/caption em caixa alta. E aqui que o dourado aparece no kicker de
   * evento — um dos cinco usos permitidos (ver GOLD_ALLOWED_USES).
   */
  caption: {
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.15,
    lineHeight: 1.2,
  },
  /**
   * Rotulo de aba.
   *
   * Mesmo tamanho da caption, mas **sem tracking** e com peso 600, nao 700.
   * Nao e detalhe: o tracking do kicker estica "Passeios" e "Carteira" o
   * suficiente para desalinhar a grade de cinco colunas. O design usa
   * `font-size:9.5px;font-weight:600` puro nas abas.
   */
  tabLabel: {
    fontSize: 9.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0,
    lineHeight: 1.2,
  },
} as const;

export type TextStyleName = keyof typeof textStyle;

export const typography = { fontFamily, fontWeight, textStyle } as const;
