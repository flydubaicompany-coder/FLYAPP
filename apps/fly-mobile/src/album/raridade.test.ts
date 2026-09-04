import { describe, expect, it } from 'vitest';
import { comoMostrar, faltamParaODia, RARIDADES } from './raridade';

describe('comoMostrar', () => {
  it('conquistada aparece inteira, qualquer que seja a raridade', () => {
    for (const r of RARIDADES) {
      expect(comoMostrar(r, true)).toBe('aberta');
    }
  });

  it('a secreta não entrega nem o nome', () => {
    expect(comoMostrar('secret', false)).toBe('misterio');
  });

  it('as outras aparecem em silhueta — ocupam o lugar', () => {
    expect(comoMostrar('common', false)).toBe('silhueta');
    expect(comoMostrar('rare', false)).toBe('silhueta');
    expect(comoMostrar('holographic', false)).toBe('silhueta');
  });
});

describe('faltamParaODia', () => {
  it('conta só as obrigatórias que faltam', () => {
    expect(
      faltamParaODia([
        { obrigatoria: true, desbloqueada: true },
        { obrigatoria: true, desbloqueada: false },
        { obrigatoria: false, desbloqueada: false },
      ]),
    ).toBe(1);
  });

  it('capítulo inteiro conquistado não falta nada', () => {
    expect(faltamParaODia([{ obrigatoria: true, desbloqueada: true }])).toBe(0);
  });

  // Espelha o gatilho: capítulo sem obrigatória nenhuma não fecha por conta
  // disso — quem decide é o servidor, e a tela só não pode dizer "0 de 0".
  it('sem obrigatórias, não falta nada — e o dia não fecha por isso', () => {
    expect(faltamParaODia([{ obrigatoria: false, desbloqueada: false }])).toBe(0);
  });
});
