import {
  color,
  elevation,
  geometry,
  motion,
  spacing,
  typography,
  type FontWeight,
  type Shadow,
} from '@fly/design-tokens';
import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Ponte entre @fly/design-tokens e os estilos do React Native.
 *
 * Modulo puro de proposito: nada aqui importa componentes do react-native,
 * apenas os seus tipos. Assim os testes rodam no vitest sem o runtime do RN.
 */

export interface TextStyleRN {
  fontSize: number;
  fontWeight: FontWeight;
  letterSpacing: number;
  lineHeight: number;
}

/**
 * Converte um degrau tipografico do design para estilo do RN.
 *
 * Duas conversoes acontecem aqui: `letterSpacing` do design esta em em e o RN
 * espera pontos absolutos; `lineHeight` esta em multiplicador e o RN espera
 * pontos. Ambas dependem do fontSize.
 *
 * `scale` aplica o tamanho de texto dinamico do sistema (§25.4). Ele multiplica
 * tudo junto para a proporcao nao quebrar.
 */
export function textStyle(name: keyof typeof typography.textStyle, scale = 1): TextStyleRN {
  const step = typography.textStyle[name];
  const fontSize = step.fontSize * scale;
  return {
    fontSize,
    fontWeight: step.fontWeight,
    letterSpacing: step.letterSpacing * fontSize,
    lineHeight: step.lineHeight * fontSize,
  };
}

/**
 * Limite do texto dinamico.
 *
 * Sem teto, um usuario em acessibilidade maxima empurra a tab bar para fora da
 * tela. 1.6 e o ponto em que o rotulo de aba ainda cabe em uma linha no
 * aparelho de referencia.
 */
export const MAX_FONT_SCALE = 1.6;

export function clampFontScale(systemScale: number): number {
  if (!Number.isFinite(systemScale) || systemScale <= 0) return 1;
  return Math.min(systemScale, MAX_FONT_SCALE);
}

/** Paleta achatada, no formato que o StyleSheet do RN consome. */
export const palette = {
  background: color.surface.base,
  surface: color.surface.graphite,
  text: color.text.primary,
  textMuted: color.text.secondary,
  textFaint: color.text.tertiary,
  textDisabled: color.text.disabled,
  gold: color.gold.base,
  goldFill: color.gold.fill,
  goldBorder: color.gold.border,
  stroke: color.stroke.base,
  strokeSubtle: color.stroke.subtle,
  strokeStrong: color.stroke.strong,
  fill: color.fill.subtle,
  fillStrong: color.fill.base,
  ok: color.status.success,
  warning: color.status.warning,
  danger: color.status.danger,
} as const;

/** Converte um token de sombra para as props do RN, iOS e Android juntos. */
export function shadowStyle(name: keyof typeof elevation.shadow): ViewStyle {
  const s: Shadow = elevation.shadow[name];
  return {
    shadowColor: s.color,
    shadowOffset: { width: s.offsetX, height: s.offsetY },
    shadowOpacity: 1,
    shadowRadius: s.blur,
    elevation: s.androidElevation,
  };
}

export const floating = geometry.floating;
export const easing = motion.easing;
export const radius = geometry.radius;
export const touchTarget = geometry.touchTarget;
export const bottomBar = geometry.bottomBar;
export const centralButton = geometry.centralButton;
export const centralButtonVisualSize = geometry.centralButtonVisualSize;
export const material = geometry.material;
export const space = spacing.space;
export const screenPadding = spacing.screenPadding;
export const iconSize = spacing.iconSize;
export const glow = elevation.glow;
export const duration = motion.duration;
export const effectiveDuration = motion.effectiveDuration;

/**
 * Garante que um alvo de toque atinja o minimo de 44 dp, devolvendo o hitSlop
 * necessario quando o visual e menor. Componentes pequenos por design (um
 * ponto de status, um X de fechar) usam isto em vez de crescer.
 */
export function hitSlopFor(visualSize: number): number {
  const missing = touchTarget.min - visualSize;
  return missing > 0 ? Math.ceil(missing / 2) : 0;
}

/** Estilo de texto acessivel: usa o degrau e o teto de escala juntos. */
export function accessibleText(
  name: keyof typeof typography.textStyle,
  systemScale: number,
): TextStyle {
  return textStyle(name, clampFontScale(systemScale));
}
