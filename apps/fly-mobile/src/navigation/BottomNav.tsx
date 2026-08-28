import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBar, space, touchTarget } from '@/theme';
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
  // Branco, nunca dourado: aba selecionada nao esta entre os usos permitidos
  // do dourado, e estava dourada aqui por engano ate 28/08/2026.
  const color = active ? bottomBar.labelActive : bottomBar.labelInactive;

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
      <View style={styles.material} pointerEvents="none">
        <BlurView intensity={bottomBar.blur} tint="dark" style={StyleSheet.absoluteFill} />
        {/* O gradiente vertical do material, sobre o blur. Uma camada chapada
          nao produz a mesma leitura: o topo precisa ser mais claro que a base
          para a barra parecer vidro apoiado, e nao um retangulo pintado. */}
        <LinearGradient
          colors={[bottomBar.materialTop, bottomBar.materialBottom]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* A linha de luz de 1 px no topo. No React Native nao existe
          `inset box-shadow`, entao ela e uma View de 1 px — mesmo resultado
          visual, tecnica diferente. */}
        <View style={styles.topHighlight} />
      </View>

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

      {/* Home indicator. Desenhado quando o aparelho nao reserva a faixa —
          num iPhone com gesto o sistema ja desenha o dele, e dois seria
          esquisito. */}
      {insets.bottom === 0 ? <View style={styles.homeIndicator} pointerEvents="none" /> : null}
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
    // NUNCA `overflow: 'hidden'` aqui: o botao central sobe 30 dp para fora da
    // barra, e o clip corta ele pela metade. O material fica numa camada
    // propria, abaixo.
    shadowColor: bottomBar.shadow.color,
    shadowOffset: { width: 0, height: bottomBar.shadow.offsetY },
    shadowOpacity: 1,
    shadowRadius: bottomBar.shadow.blur,
    elevation: 8,
  },
  material: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: bottomBar.topHighlight,
  },
  homeIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: bottomBar.homeIndicator.bottom,
    width: bottomBar.homeIndicator.width,
    height: bottomBar.homeIndicator.height,
    borderRadius: bottomBar.homeIndicator.radius,
    backgroundColor: 'rgba(245,245,247,.3)',
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
