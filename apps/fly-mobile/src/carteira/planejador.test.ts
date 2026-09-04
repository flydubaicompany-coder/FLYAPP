import { describe, expect, it } from 'vitest';
import {
  estadoDoDia,
  previsaoCentavos,
  resumir,
  type GastoManual,
  type Lancamento,
} from './planejador';

const OFICIAIS: Lancamento[] = [
  { centavos: 19900, moeda: 'AED', dia: '2026-09-10' },
  { centavos: 25000, moeda: 'AED', dia: '2026-09-11' },
];

const MANUAIS: GastoManual[] = [
  { centavos: 4500, moeda: 'AED', dia: '2026-09-10', categoria: 'alimentacao' },
  { centavos: 3000, moeda: 'AED', dia: '2026-09-10', categoria: 'transporte' },
  { centavos: 12000, moeda: 'AED', dia: '2026-09-11', categoria: 'compras' },
  { centavos: 5000, moeda: 'BRL', dia: '2026-09-11', categoria: 'outro' },
];

describe('resumir', () => {
  /**
   * A asserção que carrega o arquivo. A §15.4 é literal: "não misturar gasto
   * manual com extrato financeiro oficial". O tipo `Resumo` não tem campo
   * `total` — este teste é o que garante que ele não ganhe um.
   */
  it('mantém oficial e manual separados, e não devolve um total somado', () => {
    const r = resumir(OFICIAIS, MANUAIS);
    expect(r.oficial).toEqual({ AED: 44900 });
    expect(r.manual).toEqual({ AED: 19500, BRL: 5000 });
    expect(r).not.toHaveProperty('total');
  });

  it('separa por moeda, sem converter nada', () => {
    // Câmbio está na lista da §33. Dois números em moedas diferentes é a
    // resposta honesta; um número convertido por taxa chutada, não.
    const r = resumir([], MANUAIS);
    expect(Object.keys(r.manual).sort()).toEqual(['AED', 'BRL']);
  });

  it('agrupa o manual por categoria, também por moeda', () => {
    const r = resumir([], MANUAIS);
    expect(r.porCategoria.alimentacao).toEqual({ AED: 4500 });
    expect(r.porCategoria.compras).toEqual({ AED: 12000 });
    expect(r.porCategoria.outro).toEqual({ BRL: 5000 });
  });

  it('sem lançamento nenhum, devolve vazio em vez de zero', () => {
    expect(resumir([], [])).toEqual({ oficial: {}, manual: {}, porCategoria: {} });
  });
});

describe('estadoDoDia', () => {
  const orcamento = { diarioCentavos: 10000, moeda: 'AED' as const };

  it('conta só o gasto do dia e da moeda do orçamento', () => {
    const e = estadoDoDia(MANUAIS, '2026-09-10', orcamento);
    expect(e.gastoNoDia).toBe(7500);
    expect(e.sobra).toBe(2500);
    expect(e.estourou).toBe(false);
  });

  it('acusa quando estourou', () => {
    const e = estadoDoDia(MANUAIS, '2026-09-11', orcamento);
    expect(e.gastoNoDia).toBe(12000);
    expect(e.sobra).toBe(-2000);
    expect(e.estourou).toBe(true);
  });

  /**
   * O passeio caro comprado na Fly não pode disparar "você estourou": ele já
   * foi pago à Fly e não disputa o dinheiro do dia.
   */
  it('não conta a compra oficial contra o limite diário', () => {
    const e = estadoDoDia(MANUAIS, '2026-09-10', orcamento);
    // O pedido de 199,00 AED do mesmo dia está em OFICIAIS e não entra.
    expect(e.gastoNoDia).toBe(7500);
  });

  it('dia sem gasto tem o limite inteiro de sobra', () => {
    expect(estadoDoDia(MANUAIS, '2026-09-12', orcamento).sobra).toBe(10000);
  });
});

describe('previsaoCentavos', () => {
  it('projeta pela média dos dias em que houve gasto', () => {
    // AED: 7500 no dia 10 e 12000 no dia 11 = 19500 em 2 dias = 9750/dia.
    expect(previsaoCentavos(MANUAIS, 'AED', 3)).toBe(29250);
  });

  // Quem chegou hoje tem um dia de dado. Dividir por sete daria previsão de
  // nada, e uma previsão de nada com casas decimais parece informação.
  it('não dilui por dias em que a pessoa não gastou', () => {
    const umDia: GastoManual[] = [
      { centavos: 10000, moeda: 'AED', dia: '2026-09-10', categoria: 'outro' },
    ];
    expect(previsaoCentavos(umDia, 'AED', 2)).toBe(20000);
  });

  it('sem base, não projeta', () => {
    expect(previsaoCentavos([], 'AED', 5)).toBeNull();
    expect(previsaoCentavos(MANUAIS, 'USD', 5)).toBeNull();
    expect(previsaoCentavos(MANUAIS, 'AED', 0)).toBeNull();
  });
});
