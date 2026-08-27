import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBar, material, palette, shadowStyle, space, touchTarget } from '@/theme';
import { Text } from '@/ui';
import { CentralTripButton } from './CentralTripButton';
import { HomeIcon, ProfileIcon, ToursIcon, WalletIcon, type TabIconProps } from './TabIcons';

/**
 * A barra inferior definitiva (spec §4).
 *
 * Cinco destinos, nem um mais: Inicio, Passeios, Minha Viagem no centro,
 * Carteira e Perfil. A §4.3 lista o que **nao** vira aba — Album, Gastronomia,
 * Mapa, Eventos, ranking, notas — justamente para a barra nao virar menu.
 *
 * Medidas do prototipo: 86 dp de altura, faixa de itens de 56 dp com 9 dp de
 * respiro no topo, blur 36 e saturacao 190%.
 */

import { CENTRAL_ROUTE, TAB_LABELS, type TabRoute } from './routing';

export { CENTRAL_ROUTE, TAB_ORDER, type TabRoute } from './routing';

interface TabDef {
  route: TabRoute;
  label: string;
  Icon: (props: TabIconProps) => React.ReactElement;
}

/** Ordem fixa. O centro e resolvido separadamente, no meio do grid. */
export const LEFT_TABS: readonly TabDef[] = [
  { route: 'index', label: TAB_LABELS.index, Icon: HomeIcon },
  { route: 'passeios', label: TAB_LABELS.passeios, Icon: ToursIcon },
];

export const RIGHT_TABS: readonly TabDef[] = [
  { route: 'carteira', label: TAB_LABELS.carteira, Icon: WalletIcon },
  { route: 'perfil', label: TAB_LABELS.perfil, Icon: ProfileIcon },
];

export interface BottomNavProps {
  activeRoute: TabRoute;
  onNavigate: (route: TabRoute) => void;
  /** Alteracao importante na viagem que o cliente ainda nao viu. */
  tripHasAlert?: boolean;
  /** Progresso do dia, de 0 a 1. Ausente = sem viagem ativa. */
  tripProgress?: number | undefined;
}

function TabItem({ def, active, onPress }: { def: TabDef; active: boolean; onPress: () => void }) {
  const { Icon, label } = def;
  const color = active ? palette.gold : palette.textFaint;

  return (
    <Pressable
      accessibilityRole="tab"
      // Ver o comentario em ui/Toggle.tsx: nativo le `accessibilityState`,
      // web precisa de `aria-selected`.
      accessibilityState={{ selected: active }}
      aria-selected={active}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.item}
      testID={`tab-${def.route}`}
    >
      <Icon color={color} />
      <Text variant="tabLabel" numberOfLines={1} style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomNav({
  activeRoute,
  onNavigate,
  tripHasAlert = false,
  tripProgress,
}: BottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      // `box-none` deixa o toque passar na area vazia acima da barra, onde o
      // botao central se projeta — sem isso ele bloquearia o conteudo.
      pointerEvents="box-none"
      style={[styles.container, { height: bottomBar.height + insets.bottom }]}
      accessibilityRole="tablist"
    >
      <BlurView intensity={material.blurRadius * 1.8} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />

      <View style={[styles.row, { paddingBottom: insets.bottom }]}>
        {LEFT_TABS.map((def) => (
          <TabItem
            key={def.route}
            def={def}
            active={activeRoute === def.route}
            onPress={() => onNavigate(def.route)}
          />
        ))}

        <View style={styles.centerSlot} pointerEvents="box-none">
          <CentralTripButton
            focused={activeRoute === CENTRAL_ROUTE}
            onPress={() => onNavigate(CENTRAL_ROUTE)}
            hasAlert={tripHasAlert}
            progress={tripProgress}
          />
        </View>

        {RIGHT_TABS.map((def) => (
          <TabItem
            key={def.route}
            def={def}
            active={activeRoute === def.route}
            onPress={() => onNavigate(def.route)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
    ...shadowStyle('bar'),
  },
  // Gradiente do design aproximado por uma camada plana sobre o blur; um
  // gradiente real exigiria expo-linear-gradient sem ganho perceptivel aqui.
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,14,.72)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,.09)',
  },
  row: {
    flexDirection: 'row',
    height: bottomBar.itemsHeight,
    paddingTop: bottomBar.itemsPaddingTop,
  },
  item: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: bottomBar.itemGap,
    paddingHorizontal: space.xxs,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
  },
});
