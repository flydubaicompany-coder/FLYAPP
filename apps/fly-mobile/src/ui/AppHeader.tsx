import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Kicker, Text } from './Text';

/**
 * Cabecalho de tela: kicker, titulo e um slot a direita.
 *
 * O `kicker` e onde o dourado aparece de forma legitima em varias telas.
 * `accessibilityRole="header"` faz o leitor de tela oferecer navegacao por
 * cabecalho, o que economiza dezenas de toques em telas longas.
 */
export interface AppHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Sino de notificacao, avatar, acao secundaria. */
  trailing?: ReactNode;
}

export function AppHeader({ kicker, title, subtitle, trailing }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Text variant="largeTitle" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    marginBottom: space.xl,
  },
  texts: {
    flex: 1,
    gap: space.sm,
  },
  trailing: {
    paddingTop: space.xs,
  },
});
