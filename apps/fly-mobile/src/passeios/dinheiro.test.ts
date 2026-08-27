import { describe, expect, it } from 'vitest';
import {
  descontoPercentual,
  formatar,
  reservaExpirou,
  somar,
  subtrair,
  tempoRestante,
  totalDaLinha,
  type Dinheiro,
} from './dinheiro';

const brl = (c: number): Dinheiro => ({ centavos: c, moeda: 'BRL' });
const aed = (c: number): Dinheiro => ({ centavos: c, moeda: 'AED' });

describe('formatação', () => {
  it('mostra a moeda junto do valor', () => {
    expect(formatar(brl(123450))).toContain('1.234,50');
    expect(formatar(brl(123450))).toContain('R$');
  });

  it('AED sai com o proprio codigo, nao convertido', () => {
    const texto = formatar(aed(200000));
    expect(texto).toMatch(/AED|د\.إ/);
    expect(texto).toContain('2.000,00');
  });
});

describe('soma', () => {
  it('soma valores da mesma moeda', () => {
    const r = somar([brl(45000), brl(45000)]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total).toEqual(brl(90000));
  });

  // O ponto inteiro: converter exigiria uma taxa, e a taxa que o app
  // inventasse seria diferente da que o cliente paga no cartão.
  it('RECUSA somar moedas diferentes em vez de converter', () => {
    const r = somar([brl(45000), aed(200000)]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe('moedas_diferentes');
      expect(r.moedas).toEqual(['BRL', 'AED']);
    }
  });

  it('lista vazia soma zero', () => {
    const r = somar([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total.centavos).toBe(0);
  });
});

describe('total da linha', () => {
  it('multiplica por pessoa quando o preco e por cabeca', () => {
    expect(totalDaLinha(brl(45000), 3)).toEqual(brl(135000));
  });

  // Um privativo de quatro custa por barco. Multiplicar cobraria quatro
  // barcos.
  it('NAO multiplica quando a variante cobre um grupo', () => {
    expect(totalDaLinha(brl(200000), 4, 4)).toEqual(brl(200000));
  });
});

describe('desconto', () => {
  it('aplica percentual', () => {
    expect(descontoPercentual(brl(90000), 10)).toEqual(brl(9000));
  });

  // O Postgres faz divisão inteira. Se a tela arredondasse para cima, ela
  // mostraria um total e o servidor cobraria outro — por um centavo, que é o
  // bastante para o cliente desconfiar.
  it('arredonda para baixo, como o servidor', () => {
    expect(descontoPercentual(brl(999), 10)).toEqual(brl(99));
    expect(descontoPercentual(brl(45001), 33)).toEqual(brl(14850));
  });
});

describe('subtração', () => {
  it('subtrai da mesma moeda', () => {
    const r = subtrair(brl(90000), brl(9000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total).toEqual(brl(81000));
  });

  it('recusa moedas diferentes', () => {
    expect(subtrair(brl(90000), aed(1000)).ok).toBe(false);
  });
});

describe('reserva', () => {
  const agora = new Date('2026-08-27T12:00:00Z');

  it('conta o tempo que resta', () => {
    expect(tempoRestante('2026-08-27T12:14:30Z', agora)).toBe('14:30');
    expect(tempoRestante('2026-08-27T12:00:05Z', agora)).toBe('0:05');
  });

  it('reserva vencida nao mostra contagem', () => {
    expect(tempoRestante('2026-08-27T11:59:00Z', agora)).toBeNull();
    expect(reservaExpirou('2026-08-27T11:59:00Z', agora)).toBe(true);
  });

  it('reserva viva nao esta expirada', () => {
    expect(reservaExpirou('2026-08-27T12:10:00Z', agora)).toBe(false);
  });
});
