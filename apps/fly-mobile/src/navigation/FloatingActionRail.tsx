import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  bottomBar,
  centralButton,
  palette,
  radius,
  shadowStyle,
  space,
  touchTarget,
} from '@/theme';
import { Text } from '@/ui';
import { AssistIcon, CartIcon } from './TabIcons';

/**
 * Coluna flutuante de acoes (spec §4.2).
 *
 * Duas acoes, na lateral direita, acima da barra inferior:
 *   1. **Carrinho** — dourado/grafite, com contador. Compacto quando vazio.
 *   2. **Fly Assist / SOS** — visual deliberadamente distinto. A §4.2 e
 *      explicita: "o botao de emergencia nunca deve ter a mesma cor ou icone
 *      do carrinho".
 *
 * O posicionamento vertical soma a altura da barra, a projecao do botao
 * central e a safe area. Sem isso a coluna encosta na barra ou, pior, fica
 * atras dela.
 */
export interface FloatingActionRailProps {
  /** Itens no carrinho. 0 deixa o botao compacto (§4.2). */
  cartCount?: number;
  onOpenCart: () => void;
  onOpenAssist: () => void;
  /** Esconde o carrinho onde ele nao faz sentido, como em Minha Viagem. */
  showCart?: boolean;
}

const BUTTON_SIZE = touchTarget.min + 4;

export function FloatingActionRail({
  cartCount = 0,
  onOpenCart,
  onOpenAssist,
  showCart = true,
}: FloatingActionRailProps) {
  const insets = useSafeAreaInsets();

  const bottom = bottomBar.height + Math.abs(centralButton.offsetTop) + insets.bottom + space.sm;

  return (
    <View style={[styles.rail, { bottom }]} pointerEvents="box-none">
      {showCart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            cartCount > 0
              ? `Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`
              : 'Carrinho vazio'
          }
          onPress={onOpenCart}
          style={({ pressed }) => [
            styles.button,
            styles.cart,
            cartCount === 0 && styles.cartEmpty,
            pressed && styles.pressed,
          ]}
          testID="floating-cart"
        >
          <CartIcon color={cartCount > 0 ? palette.gold : palette.textFaint} />
          {cartCount > 0 ? (
            <View style={styles.badge} testID="floating-cart-badge">
              <Text variant="caption" style={styles.badgeLabel}>
                {cartCount > 9 ? '9+' : String(cartCount)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fly Assist e emergência"
        accessibilityHint="Falar com a Fly, pedir ajuda agora ou acionar SOS"
        onPress={onOpenAssist}
        style={({ pressed }) => [styles.button, styles.assist, pressed && styles.pressed]}
        testID="floating-assist"
      >
        <AssistIcon color={palette.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    right: space.lg,
    gap: space.md,
    zIndex: 75,
    alignItems: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...shadowStyle('floating'),
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  cart: {
    backgroundColor: palette.surface,
    borderColor: palette.goldBorder,
  },
  cartEmpty: {
    borderColor: palette.stroke,
    opacity: 0.85,
  },
  // Forma e cor distintas do carrinho, por exigencia da §4.2.
  assist: {
    borderRadius: radius.chip,
    backgroundColor: '#2A1518',
    borderColor: 'rgba(240,84,84,.45)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gold,
    borderWidth: 2,
    borderColor: palette.background,
  },
  badgeLabel: {
    color: '#08080A',
    letterSpacing: 0,
  },
});
