import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, space } from '@/theme';
import { Text } from './Text';

/**
 * Faixa fina de "dados desatualizados" (§24).
 *
 * Diferente de `OfflineState`, esta **mantem o conteudo em tela**. E o caso
 * comum em viagem: o roteiro em cache serve, o usuario so precisa saber de
 * quando ele e.
 */
export interface OfflineBannerProps {
  /** Ja formatado, por exemplo "há 12 min". */
  lastSyncedLabel?: string;
  /** Fixa no topo, sobre o conteudo. */
  floating?: boolean;
}

export function OfflineBanner({ lastSyncedLabel, floating = false }: OfflineBannerProps) {
  const insets = useSafeAreaInsets();
  const texto = lastSyncedLabel
    ? `Offline · sincronizado ${lastSyncedLabel}`
    : 'Offline · mostrando dados salvos';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={texto}
      style={[styles.container, floating && [styles.floating, { top: insets.top + space.sm }]]}
      testID="offline-banner"
    >
      <View style={styles.dot} />
      <Text variant="caption" tone="warning">
        {texto.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: 'rgba(233,162,59,.3)',
    backgroundColor: 'rgba(233,162,59,.1)',
  },
  floating: {
    position: 'absolute',
    left: space.xxl,
    right: space.xxl,
    zIndex: 70,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.warning,
  },
});
