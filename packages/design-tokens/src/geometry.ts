/**
 * Geometria, material e acessibilidade.
 *
 * FONTE DE VERDADE: `Fly Phone.dc.html` (docs/design/canvas/).
 *
 * O design enuncia a regra: "Curvas continuas de 16 a 34 px, sempre
 * concentricas." Concentrico significa que o raio de um filho e o raio do pai
 * menos o espacamento entre eles — nao um valor escolhido a esmo.
 */

export const radius = {
  /** Bottom sheet. */
  sheet: 34,
  /** Cartao. */
  card: 30,
  /** Bloco de conteudo. */
  block: 24,
  /** Chip e pill. */
  chip: 17,
} as const;

export type RadiusName = keyof typeof radius;

/**
 * Raio concentrico: o filho acompanha a curva do pai.
 * Ex.: um bloco com 12 px de padding dentro de um cartao de raio 30
 * usa `concentricRadius(radius.card, 12)` = 18.
 */
export function concentricRadius(parentRadius: number, inset: number): number {
  return Math.max(0, parentRadius - inset);
}

/**
 * Material de vidro. O design especifica blur 20, saturate 180% e uma linha
 * de luz de 1 px no topo de cada superficie — e a linha que faz o material
 * parecer solido em vez de um retangulo translucido.
 */
export const material = {
  blurRadius: 20,
  saturation: 1.8,
  background: 'rgba(20,20,24,.5)',
  border: 'rgba(255,255,255,.18)',
  /** A linha de luz de 1 px. */
  innerHighlight: 'inset 0 1px 0 rgba(255,255,255,.14)',
} as const;

/**
 * Acessibilidade.
 *
 * 44 px e o minimo do design e tambem o minimo das Human Interface Guidelines.
 * `centralButton` cobre o botao Minha Viagem, cujo alvo a §4.1 da spec fixa
 * entre 68 e 76 dp.
 */
export const touchTarget = {
  min: 44,
  centralButtonMin: 68,
  centralButtonMax: 76,
} as const;

/** Safe areas do aparelho de referencia (iPhone 15 Pro, 393 x 852 pt). */
export const safeArea = {
  top: 59,
  bottom: 34,
} as const;

/**
 * Barra inferior e botao central, medidos no prototipo.
 *
 * Sobre o tamanho do botao central: a §4.1 da spec pede "area visual
 * aproximada entre 68 e 76 dp". O design usa um nucleo de 62 dp mais um anel
 * de 6 dp (o `0 0 0 6px` da sombra), o que da **74 dp de area visual** — dentro
 * da faixa. O alvo tocavel de 62 dp fica acima do minimo de 44.
 */
export const bottomBar = {
  /** Altura total da barra, sem contar a safe area. */
  height: 86,
  /** Altura da faixa de itens dentro da barra. */
  itemsHeight: 56,
  itemsPaddingTop: 9,
  /** Tamanho do icone de aba. */
  iconSize: 23,
  iconStrokeWidth: 1.7,
  /** Espaco entre icone e rotulo. */
  itemGap: 5,
  /** Corpo do rotulo de aba. */
  labelSize: 9.5,

  /**
   * Cor do item de aba. **Nao e dourado.** A aba selecionada nunca esteve
   * entre os usos permitidos do dourado, e estava dourada no codigo por
   * engano — o handoff de 28/08 fecha em `#F5F5F7`.
   */
  labelActive: '#F5F5F7',
  labelInactive: 'rgba(245,245,247,.4)',
  colorTransitionMs: 250,

  /** Material: gradiente vertical sobre o blur, nao uma camada chapada. */
  materialTop: 'rgba(17,17,20,.7)',
  materialBottom: 'rgba(9,9,11,.9)',
  blur: 36,
  saturate: 1.9,
  /** A linha de luz de 1 px que faz o vidro parecer fisico. */
  topHighlight: 'rgba(255,255,255,.09)',
  shadow: { color: 'rgba(0,0,0,.85)', offsetY: -22, blur: 44, spread: -22 },

  /** Home indicator, desenhado pelo proprio app. */
  homeIndicator: { width: 140, height: 5, radius: 3, bottom: 9 },
} as const;

/**
 * As duas acoes flutuantes (§4.2 da spec, secao 2 do handoff).
 *
 * O design pede que elas parecam **materiais opostos**, e por isso ficam em
 * lados opostos da tela: o carrinho e vidro grafite a direita; o SOS e branco
 * solido a esquerda. Ate 28/08/2026 as duas eram escuras e ficavam empilhadas
 * do mesmo lado, o que apagava justamente a diferenca que a §4.2 exige.
 */
export const floating = {
  cart: {
    size: 56,
    radius: 28,
    right: 20,
    bottom: 102,
    /** Gradiente a 165 graus. */
    gradient: ['rgba(40,40,45,.8)', 'rgba(13,13,15,.92)'],
    border: 'rgba(223,201,138,.3)',
    blur: 28,
    shadow: { color: 'rgba(0,0,0,.88)', offsetY: 16, blur: 36 },
    goldGlow: { color: 'rgba(223,201,138,.1)', blur: 24 },
    innerHighlight: 'rgba(255,255,255,.1)',
    badge: {
      minWidth: 22,
      height: 22,
      radius: 11,
      top: -3,
      right: -3,
      textColor: '#0A0A0B',
      fontSize: 12,
      /** O pulo ao somar item. Unico lugar que usa a curva `overshoot`. */
      popScale: 1.22,
      popMs: 380,
    },
  },
  sos: {
    size: 50,
    radius: 25,
    left: 20,
    bottom: 104,
    background: '#F2F2F5',
    glyph: '#0A0A0B',
    ringWidth: 1.5,
    ringColor: 'rgba(242,242,245,.5)',
    pulseMs: 2800,
    pulseScale: 1.6,
    pulseOpacity: 0.55,
    shadow: { color: 'rgba(0,0,0,.75)', offsetY: 12, blur: 28 },
    panel: { width: 242, radius: 24, background: 'rgba(22,22,26,.84)', blur: 34 },
  },
} as const;

export const centralButton = {
  /** Diametro do circulo. */
  core: 62,
  /** Anel escuro que separa o botao da barra. */
  ring: 6,
  /** Quanto o botao sobe acima da barra. */
  offsetTop: -30,
  /** Largura do icone de asa dentro do botao. */
  iconWidth: 30,
  /** Distancia do topo do botao ate o rotulo. */
  labelTop: 37,

  /**
   * Nucleo: gradiente radial de 118% ancorado no topo, nao um cinza chapado.
   * E o que da volume ao circulo — sem ele o botao vira um disco morto.
   */
  coreGradient: [
    { offset: 0, color: '#2E2E34' },
    { offset: 0.56, color: '#16161A' },
    { offset: 1, color: '#0B0B0D' },
  ],
  coreGradientRadius: 1.18,

  /** Borda dourada: repouso e selecionado. Este e um uso permitido. */
  borderRest: 'rgba(223,201,138,.28)',
  borderSelected: 'rgba(223,201,138,.75)',
  borderTransitionMs: 350,

  /** O recorte que separa o botao da barra. */
  cutout: 'rgba(9,9,11,.94)',
  /** Sombra de elevacao do botao. */
  dropShadow: { color: 'rgba(0,0,0,.9)', offsetY: 14, blur: 32, spread: -6 },
  /** Linha de luz interna no topo do nucleo. */
  innerHighlight: 'rgba(255,255,255,.12)',
  /** Brilho dourado difuso ao redor. */
  goldGlow: { color: 'rgba(223,201,138,.13)', blur: 26 },

  /** A asa e sempre dourada; o que muda com a selecao e a opacidade. */
  wingGlow: { color: 'rgba(223,201,138,.4)', blur: 7 },
  wingOpacityRest: 0.72,
  wingOpacitySelected: 1,
} as const;

/** Area visual do botao central: nucleo mais os dois lados do anel. */
export const centralButtonVisualSize = centralButton.core + centralButton.ring * 2;

/** Aparelho de referencia do prototipo. */
export const referenceDevice = {
  name: 'iPhone 15 Pro',
  width: 393,
  height: 852,
} as const;

export const geometry = {
  radius,
  concentricRadius,
  material,
  touchTarget,
  safeArea,
  bottomBar,
  floating,
  centralButton,
  centralButtonVisualSize,
  referenceDevice,
} as const;
