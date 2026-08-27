import { Pressable, StyleSheet, View } from 'react-native';
import { hitSlopFor, palette, radius, space, touchTarget } from '@/theme';
import { Text } from './Text';

/**
 * Aviso dentro do conteudo.
 *
 * `severity` nunca e comunicada **apenas** por cor (§25.4): cada nivel tem
 * rotulo textual proprio, que o leitor de tela anuncia.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

const SEVERITY = {
  info: { color: palette.textMuted, label: 'Aviso' },
  warning: { color: palette.warning, label: 'Atenção' },
  critical: { color: palette.danger, label: 'Crítico' },
} as const;

export interface AlertBannerProps {
  severity?: AlertSeverity;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function AlertBanner({
  severity = 'info',
  title,
  description,
  actionLabel,
  onAction,
}: AlertBannerProps) {
  const { color, label } = SEVERITY[severity];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`${label}: ${title}`}
      style={[styles.container, { borderLeftColor: color }]}
      testID={`alert-${severity}`}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="caption" style={{ color }}>
          {label.toUpperCase()}
        </Text>
      </View>

      <Text variant="body" tone="primary" style={styles.title}>
        {title}
      </Text>

      {description ? (
        <Text variant="body" tone="muted">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={hitSlopFor(touchTarget.min)}
          style={styles.action}
        >
          <Text variant="body" tone="gold">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.block,
    borderLeftWidth: 3,
    backgroundColor: palette.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  title: {
    fontWeight: '600',
  },
  action: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
  },
});
