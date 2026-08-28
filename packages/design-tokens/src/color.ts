/**
 * Cores do Fly App.
 *
 * FONTE DE VERDADE: o projeto Claude Design "Fly App mobile premium",
 * arquivo `Fly Phone.dc.html` (copia versionada em docs/design/canvas/).
 *
 * A §25.2 da especificacao mestre lista uma paleta anterior (#050505 / #D4AF37).
 * A divergencia foi decidida a favor do design em ADR 0009 — nao "corrija"
 * estes valores para os da spec sem passar por um novo ADR.
 */

/** Fundos. `base` e a cor de tela; `graphite` e a superficie elevada. */
export const surface = {
  /** Fundo da aplicacao. */
  base: '#08080A',
  /** Cartoes, blocos e superficies elevadas. */
  graphite: '#16161A',
  /** Fundo do canvas de apresentacao do design (nao usado no app). */
  canvas: '#070709',
} as const;

/** Texto. Hierarquia por opacidade, nunca por matiz. */
export const text = {
  primary: '#F5F5F7',
  /**
   * Subtitulos e metadados — 45%, **4,21:1** sobre `surface.base`.
   *
   * Abaixo dos 4,5:1 que a WCAG AA pede para texto normal. O valor vem do
   * handoff de 28/08/2026 e foi mantido **por decisao explicita do dono**,
   * que escolheu fidelidade ao design sobre o limiar de contraste depois de
   * a medicao ser apresentada. Era `.66` (8,08:1) ate entao. Ver D111 e P44.
   */
  secondary: 'rgba(245,245,247,.45)',
  /** Rotulos auxiliares — 36%, 3,06:1. So texto grande e UI. */
  tertiary: 'rgba(245,245,247,.36)',
  /** Chevrons e estados desligados — 28%, 2,28:1. So controle inativo. */
  disabled: 'rgba(245,245,247,.28)',
} as const;

/**
 * O dourado Fly.
 *
 * REGRA NORMATIVA do design, citada textualmente:
 * "Aparece em cinco lugares e em nenhum outro: kicker do evento, selo
 * Exclusivo Fly, chip selecionado, progresso para Billionaire e o anel do
 * botao central. E o que separa luxo de cassino."
 *
 * Qualquer sexto uso precisa de aprovacao registrada no decision log.
 */
export const gold = {
  base: '#DFC98A',
  /** Fim escuro dos gradientes dourados. */
  deep: '#C9A96B',
  /** Estado hover/pressed em superficies claras. */
  hover: '#EBD9AC',
  /** Preenchimento de chip selecionado. */
  fill: 'rgba(223,201,138,.15)',
  /** Borda de elemento selecionado. */
  border: 'rgba(223,201,138,.44)',
  /** Brilho difuso atras de indicadores. */
  glow: 'rgba(223,201,138,.3)',
} as const;

/**
 * Os usos permitidos do dourado, para checagem em revisao de codigo.
 *
 * Eram cinco ate 27/08/2026. O handoff de 28/08 ampliou para **sete**,
 * acrescentando o chip de dia selecionado (na tela Minha Viagem) e os detalhes
 * do cartao Fly Black. Aprovado pelo dono do produto e registrado em D106 —
 * o `CLAUDE.md` exige decisao registrada para qualquer uso alem dos cinco
 * originais, e e o que esta linha documenta.
 *
 * O que continua **proibido**, e ja estava errado no codigo: rotulo e icone de
 * aba selecionada. A aba ativa e `#F5F5F7`.
 */
export const GOLD_ALLOWED_USES = [
  'event-kicker',
  'exclusive-fly-badge',
  'selected-chip',
  'selected-day-chip',
  'billionaire-progress',
  'central-button-ring',
  'fly-black-card-detail',
  // Fase 6: o cartao de Fly Points da Carteira. O canvas o desenha com fundo
  // e borda douradas, e ele e o unico bloco dourado da tela — o que mantem o
  // dourado como sinal, e nao como cor de fundo.
  'fly-points-card',
] as const;

export type GoldUse = (typeof GOLD_ALLOWED_USES)[number];

/**
 * Estados.
 *
 * O ambar e reservado a alerta e pendencia — nao e uma segunda cor de marca.
 * `success` e `danger` NAO constam do protótipo: os valores abaixo vem da
 * §25.2 da spec e estao marcados como provisorios ate o manual da marca
 * (decisao pendente §50.2).
 */
export const status = {
  /** Alertas e pendencias. Definido pelo design. */
  warning: '#E9A23B',
  /** PROVISORIO — origem §25.2, ainda sem contrapartida no design. */
  success: '#35C76F',
  /** PROVISORIO — origem §25.2, ainda sem contrapartida no design. */
  danger: '#F05454',
} as const;

/**
 * Pacote Fly — Standard, Black e Billionaire.
 *
 * **Isto e o pacote que o cliente adquiriu, e nao o nivel de Fly Points.**
 * Sao duas escalas diferentes e por muito tempo estiveram misturadas: o canvas
 * rotula estas tres cores como "FLY STATUS", a spec chama de nivel na §851 e
 * de pacote na §694, e este arquivo chamava de `flyStatus`. O dono do produto
 * desfez a ambiguidade em 27/08/2026:
 *
 *   pacote adquirido  -> Standard, Black, Billionaire   (aqui)
 *   nivel de pontos   -> basic, prime, elite            (`flyPointsLevel`)
 *
 * A cor de cada pacote e desenhada. Preco, elegibilidade e o que cada um da
 * direito continuam sendo decisao do dono e vem do Fly Ops, nunca do codigo.
 */
export const flyPackage = {
  standard: {
    dot: '#5B8CFF',
    label: '#8FADFF',
    fill: 'rgba(91,140,255,.09)',
    border: 'rgba(91,140,255,.3)',
  },
  black: {
    dot: '#F5F5F7',
    label: '#F5F5F7',
    fill: 'rgba(255,255,255,.07)',
    border: 'rgba(255,255,255,.2)',
  },
  billionaire: {
    dot: '#DFC98A',
    label: '#DFC98A',
    fill: 'rgba(223,201,138,.1)',
    border: 'rgba(223,201,138,.38)',
  },
} as const;

export type FlyPackage = keyof typeof flyPackage;

/**
 * Nivel de Fly Points — basic, prime, elite.
 *
 * **Sem paleta propria, de proposito.** O canvas nao desenhou estes niveis, e
 * a §33 proibe inventar. Ate o design existir, o nivel se le por texto e
 * progresso, com o dourado reservado ao topo — que e o mesmo dourado do
 * "progresso para o proximo nivel" ja permitido pela regra dos cinco usos.
 *
 * A formula que faz alguem subir de nivel e a P12, e continua aberta.
 */
export const FLY_POINTS_LEVELS = ['basic', 'prime', 'elite'] as const;

export type FlyPointsLevel = (typeof FLY_POINTS_LEVELS)[number];

/** Bordas e divisores neutros. */
export const stroke = {
  subtle: 'rgba(255,255,255,.075)',
  base: 'rgba(255,255,255,.09)',
  strong: 'rgba(255,255,255,.18)',
} as const;

/** Preenchimentos neutros para chips e blocos nao selecionados. */
export const fill = {
  subtle: 'rgba(255,255,255,.05)',
  base: 'rgba(255,255,255,.07)',
} as const;

/**
 * Para que serve cada cor de texto, segundo o contraste MEDIDO sobre
 * `surface.base` e `surface.graphite` (ver contrast.test.ts).
 *
 * Isto nao e recomendacao: e o resultado do calculo WCAG, travado por teste.
 * Usar `tertiary` em texto pequeno essencial reprova acessibilidade.
 */
export const textContrastUse = {
  /** 18.4:1 — livre para qualquer uso. */
  primary: ['normalText', 'largeText', 'uiComponent'],
  /**
   * 4.21:1 — **NAO passa em texto normal.** O design pede este valor e o dono
   * escolheu segui-lo (D111). O contrato diz a verdade sobre o que ele
   * aguenta, em vez de fingir que passa: texto grande e elemento de UI.
   */
  secondary: ['largeText', 'uiComponent'],
  /** 3.06:1 — SOMENTE texto grande (>=18pt) e elementos de UI. */
  tertiary: ['largeText', 'uiComponent'],
  /**
   * 2.5:1 — abaixo de qualquer limiar. Permitido apenas em controle
   * desabilitado, que a WCAG 1.4.3 isenta por ser componente inativo.
   * Nunca use para informacao que o usuario precisa ler.
   */
  disabled: [],
} as const satisfies Record<keyof typeof text, readonly string[]>;

export const color = {
  surface,
  text,
  gold,
  status,
  flyPackage,
  stroke,
  fill,
} as const;
