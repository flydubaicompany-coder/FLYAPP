import { Pressable, StyleSheet, View } from 'react-native';
import { palette, space, touchTarget } from '@/theme';
import { Text } from './Text';

/**
 * Interruptor.
 *
 * Usa `accessibilityRole="switch"` e `checked`, e nao um Pressable generico:
 * e a diferenca entre o leitor de tela anunciar "ligado" ou apenas ler o
 * rotulo e deixar o usuario adivinhar o estado.
 *
 * O estado tambem nao depende so da cor (§25.4): o pino se move.
 */
export interface ToggleProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

export function Toggle({ label, hint, value, onChange, disabled = false, testID }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      // `accessibilityState` serve iOS e Android; o React Native Web desta
      // versao nao o traduz para `aria-checked`, entao o leitor de tela na web
      // anunciaria o rotulo sem dizer se esta ligado. As duas props juntas
      // cobrem as tres plataformas.
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      aria-disabled={disabled}
      accessibilityLabel={label}
      {...(hint ? { accessibilityHint: hint } : {})}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.linha, disabled && styles.desativado]}
      testID={testID}
    >
      <View style={styles.textos}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="body" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>

      <View style={[styles.trilho, value && styles.trilhoAtivo]}>
        <View style={[styles.pino, value && styles.pinoAtivo]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: touchTarget.min + space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  desativado: { opacity: 0.5 },
  textos: { flex: 1, gap: space.xxs },
  trilho: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
    backgroundColor: palette.fillStrong,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  trilhoAtivo: {
    backgroundColor: palette.goldFill,
    borderColor: palette.goldBorder,
  },
  pino: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.textFaint,
  },
  pinoAtivo: {
    backgroundColor: palette.gold,
    alignSelf: 'flex-end',
  },
});
