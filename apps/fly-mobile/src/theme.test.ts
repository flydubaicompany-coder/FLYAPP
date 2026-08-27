import { describe, expect, it } from 'vitest';
import { color, geometry, typography } from '@fly/design-tokens';
import {
  MAX_FONT_SCALE,
  bottomBar,
  centralButton,
  centralButtonVisualSize,
  clampFontScale,
  hitSlopFor,
  palette,
  radius,
  shadowStyle,
  textStyle,
  touchTarget,
} from './theme';

describe('ponte de tema do mobile', () => {
  it('converte letterSpacing de em para pontos', () => {
    const step = typography.textStyle.largeTitle;
    expect(textStyle('largeTitle').letterSpacing).toBeCloseTo(step.letterSpacing * step.fontSize);
  });

  it('converte lineHeight de multiplicador para pontos', () => {
    const step = typography.textStyle.body;
    expect(textStyle('body').lineHeight).toBeCloseTo(step.lineHeight * step.fontSize);
  });

  it('mantem o fontSize identico ao do design quando a escala e 1', () => {
    for (const name of Object.keys(typography.textStyle) as Array<
      keyof typeof typography.textStyle
    >) {
      expect(textStyle(name).fontSize).toBe(typography.textStyle[name].fontSize);
    }
  });

  it('escala o tracking junto com o tamanho, para a proporcao nao quebrar', () => {
    const normal = textStyle('largeTitle', 1);
    const grande = textStyle('largeTitle', 1.5);
    expect(grande.fontSize / normal.fontSize).toBeCloseTo(1.5);
    expect(grande.letterSpacing / normal.letterSpacing).toBeCloseTo(1.5);
  });

  it('nao inventa cor: toda entrada da paleta vem dos tokens', () => {
    expect(palette.background).toBe(color.surface.base);
    expect(palette.gold).toBe(color.gold.base);
    expect(palette.text).toBe(color.text.primary);
  });

  it('reexporta raios e alvos de toque sem alterar valores', () => {
    expect(radius.card).toBe(geometry.radius.card);
    expect(touchTarget.min).toBe(44);
  });
});

describe('texto dinamico', () => {
  it('respeita a escala do sistema abaixo do teto', () => {
    expect(clampFontScale(1.3)).toBe(1.3);
  });

  it('limita no teto, para a tab bar nao sair da tela', () => {
    expect(clampFontScale(3.2)).toBe(MAX_FONT_SCALE);
  });

  it('cai em 1 para valor invalido, em vez de zerar o texto', () => {
    expect(clampFontScale(0)).toBe(1);
    expect(clampFontScale(Number.NaN)).toBe(1);
    expect(clampFontScale(-2)).toBe(1);
  });
});

describe('areas de toque (§25.4 e criterio da §32)', () => {
  it('completa o alvo minimo para elementos visuais pequenos', () => {
    // Um ponto de 10 dp precisa de 17 de folga em cada lado para chegar a 44.
    expect(hitSlopFor(10)).toBe(17);
    expect(10 + hitSlopFor(10) * 2).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('nao pede folga quando o visual ja e grande o bastante', () => {
    expect(hitSlopFor(touchTarget.min)).toBe(0);
    expect(hitSlopFor(60)).toBe(0);
  });

  it('a faixa de itens da barra acomoda o alvo minimo', () => {
    expect(bottomBar.itemsHeight).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('o nucleo do botao central supera o alvo minimo', () => {
    expect(centralButton.core).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('a area visual do botao central respeita a faixa de 68 a 76 da §4.1', () => {
    expect(centralButtonVisualSize).toBe(74);
    expect(centralButtonVisualSize).toBeGreaterThanOrEqual(touchTarget.centralButtonMin);
    expect(centralButtonVisualSize).toBeLessThanOrEqual(touchTarget.centralButtonMax);
  });

  it('o botao central sobe o suficiente para nao encostar na faixa de itens', () => {
    expect(Math.abs(centralButton.offsetTop)).toBeGreaterThan(0);
    expect(Math.abs(centralButton.offsetTop)).toBeLessThan(bottomBar.height);
  });
});

describe('sombras', () => {
  it('traduz o token para as props do iOS e do Android juntas', () => {
    const s = shadowStyle('floating');
    expect(s.shadowRadius).toBeGreaterThan(0);
    expect(s.shadowOffset).toEqual({ width: 0, height: 6 });
    expect(s.elevation).toBeGreaterThan(0);
  });

  it('da mais elevacao ao que flutua mais alto', () => {
    expect(shadowStyle('sheet').elevation).toBeGreaterThan(shadowStyle('card').elevation ?? 0);
  });
});
