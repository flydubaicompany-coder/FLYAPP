import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { Text } from './Text';

/**
 * Botão.
 *
 * Extraído quando a terceira tela repetiu o mesmo `Pressable` com o mesmo
 * estilo. Três coisas ficam garantidas aqui em vez de depender de quem
 * escreve a tela:
 *
 * - altura mínima de alvo de toque (§25.2);
 * - `accessibilityState` **e** `aria-disabled`, porque o React Native Web não
 *   traduz o primeiro sozinho (§25.4);
 * - estado ocupado anunciado, e não só um rótulo que muda.
 *
 * Sem dourado. O dourado tem cinco usos definidos (§24.3) e botão não é um
 * deles.
 */

export type VarianteBotao = 'primario' | 'fantasma';

export interface BotaoProps {
  rotulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  desabilitado?: boolean;
  ocupado?: boolean;
  /** Quando o rótulo visível não basta para quem usa leitor de tela. */
  rotuloAcessivel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Botao({
  rotulo,
  onPress,
  variante = 'primario',
  desabilitado = false,
  ocupado = false,
  rotuloAcessivel,
  style,
  testID,
}: BotaoProps) {
  const inativo = desabilitado || ocupado;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      accessibilityState={{ disabled: inativo, busy: ocupado }}
      aria-disabled={inativo}
      aria-busy={ocupado}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variante === 'primario' ? styles.primario : styles.fantasma,
        inativo && styles.inativo,
        pressed && styles.pressionado,
        style,
      ]}
      testID={testID}
    >
      <Text
        variant="body"
        style={variante === 'primario' ? styles.rotuloPrimario : styles.rotuloFantasma}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min + space.xs,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
  },
  primario: { backgroundColor: palette.text },
  fantasma: {
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  inativo: { opacity: 0.4 },
  pressionado: { opacity: 0.8 },
  rotuloPrimario: { color: palette.background, fontWeight: '600' },
  rotuloFantasma: { color: palette.text },
});
