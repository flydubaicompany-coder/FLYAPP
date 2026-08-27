import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { concentricRadius } from '@fly/design-tokens';
import { palette, radius, shadowStyle, space } from '@/theme';

/**
 * Superficie elevada.
 *
 * `innerRadius` devolve o raio que um filho deve usar para ficar concentrico
 * com o cartao — o design exige curvas concentricas, e calcular a olho e
 * exatamente o que produz aquele encaixe torto que ninguem sabe nomear.
 */
export interface CardProps {
  children: ReactNode;
  padding?: number;
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, padding = space.xl, style, testID }: CardProps) {
  return (
    <View style={[styles.card, { padding }, shadowStyle('card'), style]} testID={testID}>
      {children}
    </View>
  );
}

/** Raio concentrico para um filho, dado o padding usado no cartao. */
export function innerRadius(padding: number = space.xl): number {
  return concentricRadius(radius.card, padding);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
});
