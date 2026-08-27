import { color, typography } from '@fly/design-tokens';

/**
 * Converte os tokens em custom properties CSS.
 *
 * Isto existe para que o CSS nao repita valores de cor: os hex vivem so em
 * @fly/design-tokens, que por sua vez e conferido contra o arquivo do Claude
 * Design nos testes daquele package.
 */
export function themeVariables(): Record<string, string> {
  return {
    '--fly-bg': color.surface.base,
    '--fly-graphite': color.surface.graphite,
    '--fly-text': color.text.primary,
    '--fly-text-muted': color.text.secondary,
    '--fly-gold': color.gold.base,
    '--fly-gold-hover': color.gold.hover,
    '--fly-stroke': color.stroke.base,
    // Estados. Estavam repetidos como hex no CSS, contra a regra deste
    // arquivo — agora vêm dos tokens, como todo o resto.
    '--fly-warning': color.status.warning,
    '--fly-success': color.status.success,
    '--fly-danger': color.status.danger,
    '--fly-font': typography.fontFamily,
  };
}

/** Aplica as variaveis no elemento raiz. Chamado uma vez no bootstrap. */
export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(themeVariables())) {
    root.style.setProperty(name, value);
  }
}
