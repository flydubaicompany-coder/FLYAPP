import { describe, expect, it } from 'vitest';
import { color } from '@fly/design-tokens';
import { applyTheme, themeVariables } from './theme';

describe('tema', () => {
  it('deriva as variaveis dos tokens, sem hex proprio', () => {
    const vars = themeVariables();
    expect(vars['--fly-bg']).toBe(color.surface.base);
    expect(vars['--fly-gold']).toBe(color.gold.base);
    expect(vars['--fly-text']).toBe(color.text.primary);
  });

  it('nomeia toda variavel com o prefixo --fly-', () => {
    for (const name of Object.keys(themeVariables())) {
      expect(name.startsWith('--fly-')).toBe(true);
    }
  });

  it('escreve as variaveis no elemento raiz', () => {
    const root = document.createElement('div');
    applyTheme(root);
    expect(root.style.getPropertyValue('--fly-bg')).toBe(color.surface.base);
    expect(root.style.getPropertyValue('--fly-gold')).toBe(color.gold.base);
  });
});
