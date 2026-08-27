import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { palette, textStyle } from '@/theme';
import { useFontScale } from './useFontScale';

export type TextVariant = 'largeTitle' | 'section' | 'body' | 'caption' | 'tabLabel';
export type TextTone = 'primary' | 'muted' | 'faint' | 'gold' | 'ok' | 'warning' | 'danger';

const TONE: Record<TextTone, string> = {
  primary: palette.text,
  muted: palette.textMuted,
  faint: palette.textFaint,
  gold: palette.gold,
  ok: palette.ok,
  warning: palette.warning,
  danger: palette.danger,
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

/**
 * Unico caminho para texto no app.
 *
 * Duas coisas ele garante e que espalhar `<RNText>` por ai nao garante:
 * o degrau tipografico vem do design, e a escala de texto do sistema e
 * aplicada com teto.
 *
 * Sobre `tone="faint"`: mede 3.8:1, o que reprova AA para texto normal. Use
 * apenas em `variant="section"` ou maior, ou em metadado nao essencial —
 * ver `textContrastUse` em @fly/design-tokens.
 */
export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const scale = useFontScale();
  return <RNText style={[textStyle(variant, scale), { color: TONE[tone] }, style]} {...rest} />;
}

/** Kicker em caixa alta. O dourado aqui e um dos cinco usos permitidos. */
export function Kicker({ children, tone = 'gold', ...rest }: TextProps) {
  return (
    <Text variant="caption" tone={tone} {...rest}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}
