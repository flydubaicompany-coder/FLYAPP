import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBar, centralButton, palette, screenPadding, space } from '@/theme';

/**
 * Casca de tela: fundo, respiro e safe areas.
 *
 * O `paddingBottom` merece explicacao: a barra inferior tem 86 dp e o botao
 * central sobe 30 dp acima dela. Sem folga, o ultimo item de qualquer lista
 * fica escondido atras do botao — o tipo de bug que so aparece no aparelho.
 */
export interface ScreenProps {
  children: ReactNode;
  /** Rola o conteudo. Desligue em telas de altura fixa. */
  scroll?: boolean;
  /** Desconta a barra inferior. Ligado dentro das abas. */
  withBottomNav?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Screen({
  children,
  scroll = true,
  withBottomNav = true,
  style,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: insets.top + space.lg,
    paddingBottom: withBottomNav
      ? bottomBar.height + Math.abs(centralButton.offsetTop) + insets.bottom + space.lg
      : insets.bottom + space.xxl,
  };

  if (!scroll) {
    return (
      <View style={[styles.base, padding, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.base}
      contentContainerStyle={[padding, style]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: screenPadding,
  },
});
