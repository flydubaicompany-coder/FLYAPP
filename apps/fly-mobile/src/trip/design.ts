import asaDouradaPng from '../../assets/brand/fly-wing-gold.png';
import logotipoPng from '../../assets/brand/fly-wordmark.png';
import burjAlArabMarJpg from '../../assets/trip/opt-burj-al-arab-mar.jpg';
import burjAlArabPraiaJpg from '../../assets/trip/opt-burj-al-arab-praia.jpg';
import burjNoiteJpg from '../../assets/trip/opt-burj-khalifa-noite.jpg';
import downtownCrepusculoJpg from '../../assets/trip/opt-downtown-crepusculo.jpg';
import dubaiFrameJpg from '../../assets/trip/opt-dubai-frame.jpg';

/**
 * Valores exatos do `Fly Trip Mode.dc.html`.
 *
 * ## Por que este arquivo existe
 *
 * O handoff do Claude Design tem duas partes, e elas não valem a mesma coisa.
 * A prosa descreve; o `.dc.html` **especifica** — são 508 blocos de `style=`
 * com o valor de cada elemento. O ESTADO já registra que confundir os dois
 * custou um redesenho inteiro em agosto.
 *
 * Então nada aqui é arredondado "para ficar bonito". `13.5px` é 13.5, `.022em`
 * é 0.022, e o raio da barra é 33 porque a altura é 66. Onde eu tiver mudado
 * um valor, o comentário diz por quê.
 *
 * ## O que muda em relação ao tema geral
 *
 * O Trip Mode usa a mesma paleta de `@fly/design-tokens` — `#08080A`,
 * `#F5F5F7`, `#DFC98A` são idênticos. O que ele acrescenta é **material de
 * vidro** (superfícies translúcidas com blur) e dois acentos que o app
 * completo não tinha: o verde do WhatsApp e o âmbar do aviso.
 */

/** Cores literais do arquivo de design. */
export const cor = {
  fundo: '#08080A',
  fundoCartao: '#101013',
  texto: '#F5F5F7',
  textoBranco: '#FFFFFF',

  /** Os quatro níveis de opacidade que o design usa em texto secundário. */
  m68: 'rgba(255,255,255,.68)',
  m62: 'rgba(245,245,247,.62)',
  m55: 'rgba(245,245,247,.55)',
  m50: 'rgba(245,245,247,.5)',
  m45: 'rgba(245,245,247,.45)',
  m40: 'rgba(245,245,247,.4)',
  m35: 'rgba(245,245,247,.35)',
  m30: 'rgba(245,245,247,.3)',
  m20: 'rgba(245,245,247,.2)',

  ouro: '#DFC98A',
  ouroClaro: '#EFE0B4',
  ouroFundo: '#D9C081',
  ouroTinta12: 'rgba(223,201,138,.12)',
  ouroTinta16: 'rgba(223,201,138,.16)',
  ouroTinta26: 'rgba(223,201,138,.26)',
  ouroBorda30: 'rgba(223,201,138,.3)',
  ouroBorda34: 'rgba(223,201,138,.34)',
  ouroBorda60: 'rgba(223,201,138,.6)',

  /** Vidro: as superfícies translúcidas sobre o fundo. */
  vidro022: 'rgba(255,255,255,.022)',
  vidro035: 'rgba(255,255,255,.035)',
  vidro05: 'rgba(255,255,255,.05)',
  vidro055: 'rgba(255,255,255,.055)',
  vidro06: 'rgba(255,255,255,.06)',
  vidro07: 'rgba(255,255,255,.07)',
  vidro075: 'rgba(255,255,255,.075)',
  vidro10: 'rgba(255,255,255,.1)',
  vidro16: 'rgba(255,255,255,.16)',

  /** Barra inferior: material próprio, mais opaco que o resto. */
  barra: 'rgba(18,18,22,.72)',
  barraBorda: 'rgba(255,255,255,.09)',

  /** WhatsApp. O verde é o da marca deles, e é o único verde do produto. */
  zapTopo: '#2FE472',
  zapBase: '#1DB954',
  zapTexto: '#06280F',
  zapMarca: '#25D366',
  zapTinta: 'rgba(37,211,102,.13)',
  zapBorda: 'rgba(37,211,102,.3)',

  /** Verde de estado: "viagem em andamento". Diferente do verde do WhatsApp. */
  ativo: '#7BE49A',

  /** Âmbar do aviso importante. */
  aviso: '#F0B45A',
  avisoTinta: 'rgba(240,180,90,.14)',
  avisoBorda: 'rgba(240,180,90,.3)',
} as const;

/** Raios, na medida do arquivo. */
export const raio = {
  banner: 30,
  cartao: 26,
  bloco: 24,
  caixa: 20,
  pilula: 18,
  chip: 14,
  icone: 16,
  iconePequeno: 11,
  barra: 33,
  folha: 34,
} as const;

/**
 * Tipografia, em px, com o `letter-spacing` do design em em.
 *
 * O `letterSpacing` do React Native é em **pontos**, não em em — a conversão é
 * `em * fontSize`, e é feita em `tipo()` abaixo. Copiar o número do CSS direto
 * produziria um espaçamento vinte vezes maior.
 */
export const fonte = {
  destaque: { tamanho: 40, peso: '700', altura: 0.98, espaco: -0.042 },
  titulo: { tamanho: 34, peso: '700', altura: 1.03, espaco: -0.04 },
  secao: { tamanho: 18, peso: '650', altura: 1.2, espaco: -0.024 },
  cartaoTitulo: { tamanho: 17, peso: '650', altura: 1.2, espaco: -0.022 },
  corpo: { tamanho: 14, peso: '400', altura: 1.5, espaco: -0.012 },
  corpoForte: { tamanho: 14, peso: '600', altura: 1.4, espaco: -0.012 },
  apoio: { tamanho: 13.5, peso: '400', altura: 1.45, espaco: -0.008 },
  legenda: { tamanho: 12.5, peso: '600', altura: 1.4, espaco: -0.01 },
  miudo: { tamanho: 12, peso: '400', altura: 1.4, espaco: -0.005 },
  /** O kicker dourado: 9.5px, peso 700, e o espaçamento POSITIVO que o define. */
  kicker: { tamanho: 9.5, peso: '700', altura: 1.2, espaco: 0.145 },
  aba: { tamanho: 9.5, peso: '600', altura: 1.2, espaco: -0.005 },
} as const;

export type NomeDeFonte = keyof typeof fonte;

/**
 * O peso 650 do design não existe no React Native.
 *
 * O CSS aceita qualquer número porque a SF Pro é fonte variável; o
 * `fontWeight` do React Native aceita só centenas. Então 650 tem de virar 600
 * ou 700, e a escolha muda a tela.
 *
 * Vai para **600**. O arquivo de design usa 700 explicitamente onde quer peso
 * cheio — no kicker, no destaque de "Dubai", no botão do WhatsApp. Onde
 * escreveu 650 ele estava pedindo *um pouco acima* de semibold, não bold.
 * Arredondar para cima deixaria os títulos de 17 e 18px mais pesados do que o
 * desenho, e a diferença aparece justamente nos títulos, que é onde se olha.
 */
const PESO: Record<string, '400' | '600' | '700'> = {
  '400': '400',
  '600': '600',
  '650': '600',
  '700': '700',
};

/** Converte um item de `fonte` para estilo do React Native. */
export function tipo(nome: NomeDeFonte): {
  fontSize: number;
  fontWeight: '400' | '600' | '700';
  lineHeight: number;
  letterSpacing: number;
} {
  const f = fonte[nome];
  return {
    fontSize: f.tamanho,
    fontWeight: PESO[f.peso] ?? '400',
    lineHeight: Math.round(f.tamanho * f.altura * 100) / 100,
    letterSpacing: Math.round(f.espaco * f.tamanho * 100) / 100,
  };
}

/** Medidas da casca: barra inferior, botão flutuante e respiros. */
export const casca = {
  barraAltura: 66,
  barraMargem: 14,
  barraInferior: 14,
  /** O véu que apaga o conteúdo atrás da barra. */
  veuAltura: 96,
  /** O botão do WhatsApp fica acima da barra, não ao lado dela. */
  zapDireita: 18,
  zapDeBaixo: 104,
  zapAltura: 48,
  /** O respiro que cada tela precisa deixar embaixo para a barra não cobrir. */
  respiroInferior: 124,
  margemTela: 16,
  margemTexto: 20,
} as const;

/** Sombras do design, já no formato do React Native. */
export const sombra = {
  banner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.95,
    shadowRadius: 62,
    elevation: 16,
  },
  barra: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.9,
    shadowRadius: 44,
    elevation: 20,
  },
  zap: {
    shadowColor: 'rgba(37,211,102,.6)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 38,
    elevation: 12,
  },
  ouro: {
    shadowColor: 'rgba(223,201,138,.75)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 12,
  },
} as const;

/**
 * As imagens do handoff que entraram no app.
 *
 * Por `import`, e nao por `require`: o projeto declara `*.png` e `*.jpg` em
 * `types/assets.d.ts`, o Metro resolve os dois igual, e o `require` esbarra na
 * regra `no-require-imports` do ESLint.
 */
export const foto = {
  burjNoite: burjNoiteJpg,
  downtownCrepusculo: downtownCrepusculoJpg,
  burjAlArabMar: burjAlArabMarJpg,
  burjAlArabPraia: burjAlArabPraiaJpg,
  dubaiFrame: dubaiFrameJpg,
} as const;

export const marca = {
  asaDourada: asaDouradaPng,
  logotipo: logotipoPng,
} as const;
