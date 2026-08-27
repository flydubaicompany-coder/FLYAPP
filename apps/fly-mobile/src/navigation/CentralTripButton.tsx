import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { centralButton, glow, palette, shadowStyle, touchTarget } from '@/theme';
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
          <Image
            source={wing}
            style={styles.wing}
            contentFit="contain"
            tintColor={focused ? palette.gold : palette.textMuted}
            accessible={false}
          />
        </View>

        {hasAlert ? <View style={styles.alertDot} testID="central-trip-alert" /> : null}
      </Pressable>

      <Text
        variant="tabLabel"
        tone={focused ? 'gold' : 'faint'}
        numberOfLines={1}
        style={styles.label}
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
    // O anel escuro que separa o botao da barra.
    backgroundColor: 'rgba(9,9,11,.94)',
    ...shadowStyle('floating'),
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
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.28)',
    backgroundColor: '#16161A',
    shadowColor: glow.subtle.color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: glow.subtle.blur,
  },
  coreFocused: {
    borderColor: palette.goldBorder,
    shadowColor: glow.strong.color,
    shadowRadius: glow.strong.blur,
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
