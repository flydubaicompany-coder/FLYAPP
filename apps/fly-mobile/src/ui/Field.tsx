import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { palette, radius, space, textStyle, touchTarget } from '@/theme';
import { Text } from './Text';

/**
 * Campo de texto com rotulo.
 *
 * O rotulo e um `<Text>` de verdade e nao um placeholder: placeholder some
 * quando o usuario comeca a digitar, e quem voltar ao formulario depois nao
 * sabe mais o que aquele campo pedia.
 */
export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, ...rest }: FieldProps) {
  return (
    <View style={styles.campo}>
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        {...(hint ? { accessibilityHint: hint } : {})}
        placeholderTextColor={palette.textDisabled}
        style={[styles.input, error ? styles.inputErro : null]}
        {...rest}
      />
      {error ? (
        <Text variant="body" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="body" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: space.sm },
  input: {
    ...textStyle('body'),
    color: palette.text,
    minHeight: touchTarget.min + space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  inputErro: {
    borderColor: palette.danger,
  },
});
