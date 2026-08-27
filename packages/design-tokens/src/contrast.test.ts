import { describe, expect, it } from 'vitest';
import {
  WCAG_AA,
  color,
  composite,
  contrastRatio,
  contrastRatioRounded,
  meetsAA,
  parseColor,
  relativeLuminance,
  textContrastUse,
} from './index';

/**
 * Estes testes sao a "validacao de contraste" que a §36.1 da spec pede.
 * Eles medem a paleta de verdade, sobre os dois fundos reais do produto.
 *
 * Se um destes quebrar, a paleta mudou e a acessibilidade regrediu. A correcao
 * e ajustar a cor ou o uso permitido — nao afrouxar o limiar.
 */

const FUNDOS = [
  ['surface.base', color.surface.base],
  ['surface.graphite', color.surface.graphite],
] as const;

describe('parseColor', () => {
  it.each([
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#08080A', { r: 8, g: 8, b: 10, a: 1 }],
    ['#0000007F', { r: 0, g: 0, b: 0, a: 127 / 255 }],
    ['rgb(10, 20, 30)', { r: 10, g: 20, b: 30, a: 1 }],
    ['rgba(245,245,247,.42)', { r: 245, g: 245, b: 247, a: 0.42 }],
  ])('interpreta %s', (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it('lanca em entrada que nao reconhece, em vez de medir errado', () => {
    expect(() => parseColor('quase-preto')).toThrow(/nao reconhecida/);
  });
});

describe('base do calculo', () => {
  it('da 21:1 entre preto e branco', () => {
    expect(contrastRatioRounded('#000000', '#FFFFFF')).toBe(21);
  });

  it('da 1:1 para a mesma cor', () => {
    expect(contrastRatioRounded('#08080A', '#08080A')).toBe(1);
  });

  it('e simetrico', () => {
    expect(contrastRatio('#DFC98A', '#08080A')).toBeCloseTo(contrastRatio('#08080A', '#DFC98A'));
  });

  it('atribui a luminancia certa a preto e branco', () => {
    expect(relativeLuminance(parseColor('#000000'))).toBe(0);
    expect(relativeLuminance(parseColor('#FFFFFF'))).toBeCloseTo(1);
  });

  it('compoe alpha antes de medir, em vez de ignorar', () => {
    const meio = composite(parseColor('rgba(255,255,255,.5)'), parseColor('#000000'));
    expect(meio.r).toBeCloseTo(127.5);
    expect(meio.a).toBe(1);
  });

  it('recusa medir contra fundo translucido', () => {
    expect(() => contrastRatio('#FFF', 'rgba(0,0,0,.5)')).toThrow(/opaco/);
  });
});

describe('paleta sobre os fundos reais', () => {
  describe.each(FUNDOS)('sobre %s', (_nome, bg) => {
    it.each([
      ['text.primary', color.text.primary],
      ['text.secondary', color.text.secondary],
      ['gold.base', color.gold.base],
      ['status.warning', color.status.warning],
      ['status.success', color.status.success],
      ['status.danger', color.status.danger],
      ['flyPackage.standard.label', color.flyPackage.standard.label],
      ['flyPackage.billionaire.label', color.flyPackage.billionaire.label],
    ])('%s passa AA para texto normal', (_token, fg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA.normalText);
    });

    it('text.tertiary passa para texto grande e UI', () => {
      expect(contrastRatio(color.text.tertiary, bg)).toBeGreaterThanOrEqual(WCAG_AA.largeText);
    });

    it('text.tertiary NAO passa para texto normal — e o contrato reflete isso', () => {
      expect(meetsAA(color.text.tertiary, bg, 'normalText')).toBe(false);
      expect(textContrastUse.tertiary).not.toContain('normalText');
    });

    it('text.disabled fica abaixo de todos os limiares — so para controle inativo', () => {
      expect(contrastRatio(color.text.disabled, bg)).toBeLessThan(WCAG_AA.uiComponent);
      expect(textContrastUse.disabled).toHaveLength(0);
    });

    it('os pontos de Fly Status passam o limiar de componente de UI', () => {
      for (const tier of Object.values(color.flyPackage)) {
        expect(contrastRatio(tier.dot, bg)).toBeGreaterThanOrEqual(WCAG_AA.uiComponent);
      }
    });
  });
});

describe('contrato de uso das cores de texto', () => {
  it('cobre todos os tokens de texto, sem sobrar nenhum', () => {
    expect(Object.keys(textContrastUse).sort()).toEqual(Object.keys(color.text).sort());
  });

  it('bate com a medicao: um uso declarado precisa realmente passar', () => {
    for (const [token, usos] of Object.entries(textContrastUse)) {
      const fg = color.text[token as keyof typeof color.text];
      for (const uso of usos) {
        expect(
          meetsAA(fg, color.surface.base, uso as 'normalText' | 'largeText' | 'uiComponent'),
        ).toBe(true);
      }
    }
  });
});
