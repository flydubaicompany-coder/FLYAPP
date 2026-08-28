import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { bottomBar, centralButton, palette, touchTarget } from '@/theme';
import { Text } from '@/ui';
import wing from '../../assets/brand/fly-wing.png';

/**
 * O botao Minha Viagem (spec §4.1).
 *
 * Medidas do prototipo: nucleo de 62 dp, anel escuro de 6 dp, subindo 30 dp
 * acima da barra. Nucleo mais anel dao 74 dp de area visual, dentro da faixa
 * de 68 a 76 que a §4.1 pede.
 *
 * O anel dourado e um dos cinco usos permitidos do dourado.
 *
 * Tres estados que a §4.1 exige e que sao faceis de esquecer:
 *   • `hasAlert` — indicador de alteracao importante na viagem;
 *   • `progress` — anel de progresso durante a viagem;
 *   • sem viagem ativa — o rotulo permanece e o destino passa a ser historico
 *     e planejamento. O botao nunca desaparece.
 */
export interface CentralTripButtonProps {
  focused: boolean;
  onPress: () => void;
  /** Ha alteracao importante que o cliente ainda nao viu. */
  hasAlert?: boolean;
  /** Progresso do dia, de 0 a 1. Ausente = sem viagem ativa. */
  progress?: number | undefined;
  label?: string;
}

const RING_SIZE = centralButton.core + centralButton.ring * 2;
const PROGRESS_STROKE = 2.5;
const PROGRESS_RADIUS = (RING_SIZE - PROGRESS_STROKE) / 2;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

export function CentralTripButton({
  focused,
  onPress,
  hasAlert = false,
  progress,
  label = 'Minha Viagem',
}: CentralTripButtonProps) {
  const hasTrip = progress !== undefined;
  const clamped = hasTrip ? Math.min(1, Math.max(0, progress)) : 0;

  const accessibilityHint = hasTrip
    ? `Comando da viagem ativa. ${Math.round(clamped * 100)}% do dia concluído.`
    : 'Sem viagem ativa. Abre histórico e planejamento.';

  return (
    <View style={styles.slot} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        aria-selected={focused}
        accessibilityLabel={hasAlert ? `${label}, com alteração` : label}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        // O nucleo de 62 dp ja passa o minimo de 44; o hitSlop cobre a borda
        // do anel, para que tocar na moldura tambem funcione.
        hitSlop={centralButton.ring}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        testID="central-trip-button"
      >
        {hasTrip ? (
          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.progressRing}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={PROGRESS_RADIUS}
              stroke={palette.goldBorder}
              strokeWidth={PROGRESS_STROKE}
              strokeDasharray={PROGRESS_CIRCUMFERENCE}
              strokeDashoffset={PROGRESS_CIRCUMFERENCE * (1 - clamped)}
              strokeLinecap="round"
              fill="none"
              // Comeca no topo, e nao na direita.
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
        ) : null}

        <View style={[styles.core, focused && styles.coreFocused]}>
          {/* O gradiente radial de 118% ancorado no topo. E ele que da volume
              ao circulo; um cinza chapado deixa o botao com cara de disco. */}
          <Svg
            width={centralButton.core}
            height={centralButton.core}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <RadialGradient id="nucleo" cx="50%" cy="0%" r="118%">
                {centralButton.coreGradient.map((parada) => (
                  <Stop key={parada.offset} offset={parada.offset} stopColor={parada.color} />
                ))}
              </RadialGradient>
            </Defs>
            <Circle
              cx={centralButton.core / 2}
              cy={centralButton.core / 2}
              r={centralButton.core / 2}
              fill="url(#nucleo)"
            />
          </Svg>

          {/* Linha de luz de 1 px no topo. `inset box-shadow` nao existe no
              React Native; a View entrega o mesmo resultado. */}
          <View style={styles.innerHighlight} pointerEvents="none" />

          <Image
            source={wing}
            style={[
              styles.wing,
              {
                opacity: focused
                  ? centralButton.wingOpacitySelected
                  : centralButton.wingOpacityRest,
              },
            ]}
            contentFit="contain"
            // A asa e **sempre** dourada — o que muda com a selecao e so a
            // opacidade. Antes ela ficava cinza fora do foco, o que apagava a
            // unica marca da Fly na barra.
            tintColor={palette.gold}
            accessible={false}
          />
        </View>

        {hasAlert ? <View style={styles.alertDot} testID="central-trip-alert" /> : null}
      </Pressable>

      <Text
        variant="tabLabel"
        numberOfLines={1}
        style={[styles.label, { color: focused ? bottomBar.labelActive : bottomBar.labelInactive }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
  },
  button: {
    position: 'absolute',
    top: centralButton.offsetTop,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra 1 da ordem do design: o recorte que separa o botao da barra.
    backgroundColor: centralButton.cutout,
    // Sombra 2: a elevacao.
    shadowColor: centralButton.dropShadow.color,
    shadowOffset: { width: 0, height: centralButton.dropShadow.offsetY },
    shadowOpacity: 1,
    shadowRadius: centralButton.dropShadow.blur,
    elevation: 12,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  progressRing: {
    position: 'absolute',
  },
  core: {
    width: centralButton.core,
    height: centralButton.core,
    borderRadius: centralButton.core / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: centralButton.borderRest,
    // Sombra 4: o brilho dourado difuso.
    shadowColor: centralButton.goldGlow.color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: centralButton.goldGlow.blur,
  },
  coreFocused: {
    borderColor: centralButton.borderSelected,
  },
  // Sombra 3 da ordem: a linha de luz interna, no topo do nucleo.
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: centralButton.innerHighlight,
  },
  wing: {
    width: centralButton.iconWidth,
    height: centralButton.iconWidth * 0.43,
  },
  alertDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.warning,
    borderWidth: 2,
    borderColor: '#09090B',
  },
  label: {
    position: 'absolute',
    top: centralButton.labelTop,
    minWidth: touchTarget.min * 2,
    textAlign: 'center',
  },
});
