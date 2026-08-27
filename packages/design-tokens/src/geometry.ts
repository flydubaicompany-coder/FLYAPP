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
  centralButton,
  centralButtonVisualSize,
  referenceDevice,
} as const;
