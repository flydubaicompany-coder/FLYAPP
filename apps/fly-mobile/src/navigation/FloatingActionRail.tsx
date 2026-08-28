import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { easing, floating } from '@/theme';
import { Text } from '@/ui';
import { CartIcon, ScopeIcon } from './TabIcons';

/**
 * As duas acoes flutuantes (spec §4.2, secao 2 do handoff).
 *
 * O design pede que elas parecam **materiais opostos**, e por isso elas nao
 * sao mais uma coluna: o carrinho e vidro grafite a **direita**, o SOS e
 * branco solido a **esquerda**. Ate 28/08/2026 as duas eram escuras e ficavam
 * empilhadas do mesmo lado — o que apagava justamente a distincao que a §4.2
 * exige ("o botao de emergencia nunca deve ter a mesma cor ou icone do
 * carrinho").
 *
 * As duas ficam acima da barra por medida do design (102 e 104), e nao por
 * conta calculada: e a distancia que o desenho fixa.
 */
export interface FloatingActionRailProps {
  /** Itens no carrinho. 0 esconde o badge, nao o botao. */
  cartCount?: number;
  onOpenCart: () => void;
  onOpenAssist: () => void;
  /** Minha Viagem nao tem carrinho — e a unica tela assim. */
  showCart?: boolean;
}

const [ENTER_X1, ENTER_Y1, ENTER_X2, ENTER_Y2] = easing.continuous;
const [POP_X1, POP_Y1, POP_X2, POP_Y2] = easing.overshoot;

/**
 * O anel que pulsa em volta do SOS: 2,8 s, infinito, de `scale(1) opacity .55`
 * ate `scale(1.6) opacity 0`. E o unico movimento continuo da tela, e existe
 * para o botao ser achado sem procurar.
 */
function PulseRing() {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: floating.sos.pulseMs,
        easing: Easing.bezier(ENTER_X1, ENTER_Y1, ENTER_X2, ENTER_Y2),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          opacity: t.interpolate({
            inputRange: [0, 1],
            outputRange: [floating.sos.pulseOpacity, 0],
          }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 1],
                outputRange: [1, floating.sos.pulseScale],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/** O badge do carrinho, que pula ao somar item. */
function CartBadge({ count }: { count: number }) {
  const pop = useRef(new Animated.Value(1)).current;
  const anterior = useRef(count);

  useEffect(() => {
    if (count <= anterior.current) {
      anterior.current = count;
      return;
    }
    anterior.current = count;
    Animated.sequence([
      Animated.timing(pop, {
        toValue: floating.cart.badge.popScale,
        duration: floating.cart.badge.popMs / 2,
        easing: Easing.bezier(POP_X1, POP_Y1, POP_X2, POP_Y2),
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: floating.cart.badge.popMs / 2,
        easing: Easing.bezier(POP_X1, POP_Y1, POP_X2, POP_Y2),
        useNativeDriver: true,
      }),
    ]).start();
  }, [count, pop]);

  return (
    <Animated.View
      style={[styles.badge, { transform: [{ scale: pop }] }]}
      testID="floating-cart-badge"
    >
      <Text variant="caption" style={styles.badgeLabel}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </Animated.View>
  );
}

export function FloatingActionRail({
  cartCount = 0,
  onOpenCart,
  onOpenAssist,
  showCart = true,
}: FloatingActionRailProps) {
  return (
    <>
      {showCart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            cartCount > 0
              ? `Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`
              : 'Carrinho vazio'
          }
          onPress={onOpenCart}
          style={({ pressed }) => [styles.cart, pressed && styles.pressed]}
          testID="floating-cart"
        >
          {/* Vidro: blur, gradiente, borda de 1 px e a linha de luz no topo. */}
          <BlurView intensity={floating.cart.blur} tint="dark" style={styles.fillRound} />
          <LinearGradient
            colors={[floating.cart.gradient[0], floating.cart.gradient[1]]}
            // 165 graus: quase vertical, inclinado para a esquerda.
            start={{ x: 0.87, y: 0 }}
            end={{ x: 0.13, y: 1 }}
            style={styles.fillRound}
            pointerEvents="none"
          />
          <View style={styles.cartHighlight} pointerEvents="none" />

          {/* O conteudo precisa de `zIndex`: no React Native Web um irmao
              `position: absolute` pinta por cima de um estatico, mesmo vindo
              antes no JSX — sem isto o gradiente cobre o icone. */}
          <View style={styles.cartContent}>
            <CartIcon color="#F5F5F7" />
          </View>
          {cartCount > 0 ? <CartBadge count={cartCount} /> : null}
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fly Assist e emergência"
        accessibilityHint="Falar com a Fly, pedir ajuda agora ou acionar SOS"
        onPress={onOpenAssist}
        style={({ pressed }) => [styles.sos, pressed && styles.pressed]}
        testID="floating-assist"
      >
        <PulseRing />
        <View style={styles.cartContent}>
          <ScopeIcon color={floating.sos.glyph} size={22} />
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.92 }],
  },

  // --- Carrinho: vidro grafite, a direita ------------------------------------
  cart: {
    position: 'absolute',
    right: floating.cart.right,
    bottom: floating.cart.bottom,
    width: floating.cart.size,
    height: floating.cart.size,
    borderRadius: floating.cart.radius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: floating.cart.border,
    zIndex: 75,
    shadowColor: floating.cart.shadow.color,
    shadowOffset: { width: 0, height: floating.cart.shadow.offsetY },
    shadowOpacity: 1,
    shadowRadius: floating.cart.shadow.blur,
    elevation: 10,
  },
  fillRound: {
    ...StyleSheet.absoluteFill,
    borderRadius: floating.cart.radius,
    overflow: 'hidden',
  },
  cartContent: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartHighlight: {
    position: 'absolute',
    top: 0,
    left: floating.cart.radius / 2,
    right: floating.cart.radius / 2,
    height: 1,
    backgroundColor: floating.cart.innerHighlight,
  },
  badge: {
    position: 'absolute',
    top: floating.cart.badge.top,
    right: floating.cart.badge.right,
    minWidth: floating.cart.badge.minWidth,
    height: floating.cart.badge.height,
    paddingHorizontal: 5,
    borderRadius: floating.cart.badge.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFC98A',
    zIndex: 2,
  },
  badgeLabel: {
    color: floating.cart.badge.textColor,
    fontSize: floating.cart.badge.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
  },

  // --- SOS: branco solido, a esquerda ----------------------------------------
  sos: {
    position: 'absolute',
    left: floating.sos.left,
    bottom: floating.sos.bottom,
    width: floating.sos.size,
    height: floating.sos.size,
    borderRadius: floating.sos.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: floating.sos.background,
    zIndex: 75,
    shadowColor: floating.sos.shadow.color,
    shadowOffset: { width: 0, height: floating.sos.shadow.offsetY },
    shadowOpacity: 1,
    shadowRadius: floating.sos.shadow.blur,
    elevation: 10,
  },
  pulse: {
    position: 'absolute',
    width: floating.sos.size,
    height: floating.sos.size,
    borderRadius: floating.sos.radius,
    borderWidth: floating.sos.ringWidth,
    borderColor: floating.sos.ringColor,
  },
});
