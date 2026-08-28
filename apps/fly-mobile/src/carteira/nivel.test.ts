import { describe, expect, it } from 'vitest';
import { LIMIARES_DESCONHECIDOS, nivelDoSaldo, progressoDoSaldo } from './nivel';

const REAIS = { prime: 25_000, elite: 100_000 };

describe('nivelDoSaldo', () => {
  it('comeca em basic', () => {
    expect(nivelDoSaldo(0, REAIS)).toBe('basic');
    expect(nivelDoSaldo(24_999, REAIS)).toBe('basic');
  });

  it('sobe exatamente no limiar, nao um ponto depois', () => {
    expect(nivelDoSaldo(25_000, REAIS)).toBe('prime');
    expect(nivelDoSaldo(100_000, REAIS)).toBe('elite');
  });

  it('com limiar desconhecido todo mundo fica em basic', () => {
    // E o unico nivel que nao afirma nada sobre quanto o cliente acumulou.
    expect(nivelDoSaldo(999_999, LIMIARES_DESCONHECIDOS)).toBe('basic');
  });
});

describe('progressoDoSaldo', () => {
  it('mede a fracao dentro da faixa atual, e nao desde o zero', () => {
    // 30.000 esta em prime. Do zero seriam 30% de 100.000; o certo e 6,7% do
    // caminho entre 25.000 e 100.000.
    const p = progressoDoSaldo(30_000, REAIS);
    expect(p.nivel).toBe('prime');
    expect(p.proximo).toBe('elite');
    expect(p.faltam).toBe(70_000);
    expect(p.fracao).toBeCloseTo(5_000 / 75_000, 5);
  });

  it('em basic a faixa vai de zero ao limiar de prime', () => {
    const p = progressoDoSaldo(5_000, REAIS);
    expect(p.proximo).toBe('prime');
    expect(p.faltam).toBe(20_000);
    expect(p.fracao).toBeCloseTo(0.2, 5);
  });

  it('elite nao tem proximo', () => {
    const p = progressoDoSaldo(120_000, REAIS);
    expect(p).toEqual({ nivel: 'elite', proximo: null, faltam: null, fracao: null });
  });

  it('sem limiar nao inventa progresso', () => {
    const p = progressoDoSaldo(48_250, LIMIARES_DESCONHECIDOS);
    expect(p.proximo).toBeNull();
    expect(p.faltam).toBeNull();
    expect(p.fracao).toBeNull();
  });

  it('nao passa de 1 nem fica negativo', () => {
    expect(progressoDoSaldo(99_999, REAIS).fracao).toBeLessThanOrEqual(1);
    expect(progressoDoSaldo(0, REAIS).fracao).toBe(0);
  });

  it('limiar invertido nao quebra a conta', () => {
    // Configuracao errada no painel (elite abaixo de prime) nao pode produzir
    // NaN nem barra fora da trilha. Aqui o saldo ja passou de elite.
    const p = progressoDoSaldo(60, { prime: 100, elite: 50 });
    expect(p.nivel).toBe('elite');
    expect(p.fracao).toBeNull();
  });

  it('a fracao fica sempre entre 0 e 1, em qualquer saldo', () => {
    for (const saldo of [0, 1, 24_999, 25_000, 25_001, 99_999, 100_000, 500_000]) {
      const f = progressoDoSaldo(saldo, REAIS).fracao;
      if (f === null) continue;
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
