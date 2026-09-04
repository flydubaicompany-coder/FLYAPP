/**
 * Planejador financeiro (§15.4).
 *
 * A regra que decide tudo aqui é uma linha da spec: **"não misturar gasto
 * manual com extrato financeiro oficial"**.
 *
 * Por isso `Resumo` não tem um campo `total`. Ele tem `oficial` e `manual`,
 * lado a lado, e quem quiser o somado que some — explicitamente, com rótulo.
 * Um campo `total` neste tipo seria o atalho que, em três meses, apareceria
 * num relatório como se fosse o extrato da Fly.
 *
 * E não há conversão de moeda. Cada moeda tem o seu total, porque taxa de
 * câmbio está na lista da §33 do que nunca se inventa — e um número
 * convertido por uma taxa chutada é pior do que dois números separados.
 *
 * Puro de propósito: nada de `react-native` nem de Supabase.
 */

export type Moeda = 'BRL' | 'AED' | 'USD' | 'EUR';

export type CategoriaDeGasto =
  'alimentacao' | 'transporte' | 'compras' | 'lazer' | 'saude' | 'outro';

export const ROTULO_CATEGORIA: Record<CategoriaDeGasto, string> = {
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  compras: 'Compras',
  lazer: 'Lazer',
  saude: 'Saúde',
  outro: 'Outro',
};

export interface Lancamento {
  centavos: number;
  moeda: Moeda;
  /** ISO `YYYY-MM-DD`. */
  dia: string;
}

export interface GastoManual extends Lancamento {
  categoria: CategoriaDeGasto;
}

/** Totais por moeda. Nunca um número só. */
export type PorMoeda = Partial<Record<Moeda, number>>;

export interface Resumo {
  /** O que a Fly cobrou: pedidos e carteira. */
  oficial: PorMoeda;
  /** O que a pessoa anotou. Não é extrato da Fly, e não vira. */
  manual: PorMoeda;
  porCategoria: Partial<Record<CategoriaDeGasto, PorMoeda>>;
}

function somar(destino: PorMoeda, l: Lancamento): void {
  destino[l.moeda] = (destino[l.moeda] ?? 0) + l.centavos;
}

export function resumir(oficiais: readonly Lancamento[], manuais: readonly GastoManual[]): Resumo {
  const resumo: Resumo = { oficial: {}, manual: {}, porCategoria: {} };

  for (const o of oficiais) somar(resumo.oficial, o);

  for (const m of manuais) {
    somar(resumo.manual, m);
    const cat = (resumo.porCategoria[m.categoria] ??= {});
    somar(cat, m);
  }

  return resumo;
}

export interface Orcamento {
  diarioCentavos: number;
  moeda: Moeda;
}

export interface EstadoDoDia {
  gastoNoDia: number;
  limite: number;
  /** Quanto sobrou. Negativo quando estourou. */
  sobra: number;
  estourou: boolean;
}

/**
 * O dia contra o limite (§15.4, "alerta de limite").
 *
 * Conta **só o gasto manual**, e é a decisão mais importante desta função. O
 * orçamento diário é o dinheiro que a pessoa decidiu gastar por conta dela; a
 * compra que ela fez na Fly já foi paga à Fly e não disputa esse limite. Somar
 * as duas coisas faria o app avisar "você estourou" no dia em que a pessoa
 * comprou um passeio caro — o oposto de ajudar.
 */
export function estadoDoDia(
  manuais: readonly GastoManual[],
  dia: string,
  orcamento: Orcamento,
): EstadoDoDia {
  const gastoNoDia = manuais
    .filter((m) => m.dia === dia && m.moeda === orcamento.moeda)
    .reduce((soma, m) => soma + m.centavos, 0);

  return {
    gastoNoDia,
    limite: orcamento.diarioCentavos,
    sobra: orcamento.diarioCentavos - gastoNoDia,
    estourou: gastoNoDia > orcamento.diarioCentavos,
  };
}

/**
 * Previsão até o fim da viagem (§15.4, "previsão").
 *
 * Média dos dias em que houve gasto, vezes os dias que faltam. **Dos dias em
 * que houve gasto**, e não de todos os dias corridos: quem chegou hoje tem um
 * dia de dado, e dividir por sete daria uma previsão de nada.
 *
 * `null` quando não há do que projetar. Projeção sem base é chute com casas
 * decimais.
 */
export function previsaoCentavos(
  manuais: readonly GastoManual[],
  moeda: Moeda,
  diasRestantes: number,
): number | null {
  const doTipo = manuais.filter((m) => m.moeda === moeda);
  if (doTipo.length === 0 || diasRestantes <= 0) return null;

  const dias = new Set(doTipo.map((m) => m.dia));
  const total = doTipo.reduce((soma, m) => soma + m.centavos, 0);
  return Math.round((total / dias.size) * diasRestantes);
}
