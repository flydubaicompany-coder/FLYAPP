import { describe, expect, it } from 'vitest';
import { paraCentavos } from './valor';

/**
 * O valor da nota e **digitado**, e cada pessoa digita de um jeito. Errar a
 * conversao aqui manda um valor errado para a revisao — e ninguem confere o
 * que o app entendeu, so o que a pessoa escreveu.
 */
describe('paraCentavos', () => {
  it('aceita virgula, que e como se digita em portugues', () => {
    expect(paraCentavos('450,00')).toBe(45000);
    expect(paraCentavos('1.234,56')).toBe(123456);
  });

  it('aceita ponto decimal, que e como o teclado do iPhone oferece', () => {
    expect(paraCentavos('450.00')).toBe(45000);
    expect(paraCentavos('450')).toBe(45000);
  });

  it('nao se confunde com separador de milhar', () => {
    expect(paraCentavos('1.234')).toBe(123400);
    expect(paraCentavos('12.345,67')).toBe(1234567);
  });

  it('ignora espaco', () => {
    expect(paraCentavos(' 450,00 ')).toBe(45000);
  });

  it('recusa o que nao e valor', () => {
    expect(paraCentavos('')).toBeNull();
    expect(paraCentavos('abc')).toBeNull();
    expect(paraCentavos('0')).toBeNull();
    expect(paraCentavos('-10')).toBeNull();
  });
});
