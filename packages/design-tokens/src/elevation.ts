/**
 * Sombra e brilho.
 *
 * Em fundo quase preto, sombra escura quase nao aparece — a separacao vem da
 * borda de 1 px e da linha de luz interna (ver `geometry.material`). A sombra
 * abaixo serve so ao que realmente flutua: barra inferior, sheet e o botao
 * central.
 *
 * O brilho dourado e o unico uso decorativo do dourado permitido, e apenas no
 * anel do botao central (ver GOLD_ALLOWED_USES).
 */

export interface Shadow {
  /** Cor com alpha. */
  color: string;
  offsetX: number;
  offsetY: number;
  /** Raio de desfoque. No RN, `shadowRadius`. */
  blur: number;
  /** Elevation do Android, que nao aceita os campos acima. */
  androidElevation: number;
}

export const shadow = {
  /** Cartao apoiado na tela. Quase imperceptivel, de proposito. */
  card: {
    color: 'rgba(0,0,0,.4)',
    offsetX: 0,
    offsetY: 2,
    blur: 8,
    androidElevation: 2,
  },
  /** Barra inferior e elementos ancorados. */
  bar: {
    color: 'rgba(0,0,0,.6)',
    offsetX: 0,
    offsetY: -4,
    blur: 20,
    androidElevation: 8,
  },
  /** Bottom sheet. */
  sheet: {
    color: 'rgba(0,0,0,.7)',
    offsetX: 0,
    offsetY: -8,
    blur: 32,
    androidElevation: 16,
  },
  /** Botao central elevado. */
  floating: {
    color: 'rgba(0,0,0,.8)',
    offsetX: 0,
    offsetY: 6,
    blur: 24,
    androidElevation: 12,
  },
} as const satisfies Record<string, Shadow>;

export type ShadowToken = keyof typeof shadow;

/**
 * Brilho dourado. Discreto por decisao de marca: o design pede
 * "brilho dourado discreto", nao neon.
 */
export const glow = {
  /** Anel do botao central em repouso. */
  subtle: {
    color: 'rgba(223,201,138,.3)',
    blur: 18,
  },
  /** Anel do botao central pressionado ou com alerta ativo. */
  strong: {
    color: 'rgba(223,201,138,.5)',
    blur: 26,
  },
} as const;

export type GlowToken = keyof typeof glow;

export const elevation = { shadow, glow } as const;
