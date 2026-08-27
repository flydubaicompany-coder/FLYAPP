import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildHealthReport,
  checkBackend,
  createLogger,
  type HealthReport,
  type HealthStatus,
} from '@fly/config';
import { palette, radius, textStyle } from '@/theme';
import { loadEnv } from '@/env';

/**
 * Health do Fly App para ambientes internos (spec §35.10).
 * Sem PII, sem chave, sem contagem de registros.
 */

const SERVICE_NAME = 'Fly App';

const STATUS_COLOR: Record<HealthStatus, string> = {
  ok: palette.ok,
  degraded: palette.warning,
  down: palette.danger,
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'Operacional',
  degraded: 'Degradado',
  down: 'Fora do ar',
};

const logger = createLogger({ service: SERVICE_NAME });

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; report: HealthReport }
  | { kind: 'misconfigured'; message: string };

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let env;
      try {
        env = loadEnv();
      } catch (error) {
        if (!cancelled) {
          setState({ kind: 'misconfigured', message: (error as Error).message });
        }
        return;
      }

      const backend = await checkBackend({
        supabaseUrl: env.supabaseUrl,
        supabaseKey: env.supabaseKey,
      });
      if (cancelled) return;

      const report = buildHealthReport({
        service: SERVICE_NAME,
        environment: env.environment,
        version: env.appVersion,
        commitSha: env.commitSha,
        supabaseUrl: env.supabaseUrl,
        checks: [backend],
      });
      setState({ kind: 'ready', report });
      logger.info('health verificado', { status: report.status });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const padding = { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 };

  if (state.kind === 'loading') {
    return (
      <View style={[styles.screen, styles.centered, padding]}>
        <ActivityIndicator color={palette.gold} />
      </View>
    );
  }

  if (state.kind === 'misconfigured') {
    return (
      <ScrollView contentContainerStyle={[styles.screen, padding]}>
        <Text style={styles.kicker}>CONFIGURAÇÃO</Text>
        <Text style={styles.title}>Ambiente incompleto</Text>
        <Text style={styles.body}>{state.message}</Text>
      </ScrollView>
    );
  }

  const { report } = state;

  return (
    <ScrollView contentContainerStyle={[styles.screen, padding]}>
      <Text style={styles.kicker}>HEALTH</Text>
      <Text style={styles.title}>{report.service}</Text>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: STATUS_COLOR[report.status] }]} />
        <Text style={[styles.status, { color: STATUS_COLOR[report.status] }]}>
          {STATUS_LABEL[report.status]}
        </Text>
      </View>

      <View style={styles.card}>
        <Fact label="Ambiente" value={report.environment} />
        <Fact label="Versão" value={report.version} />
        <Fact label="Commit" value={report.commitSha ?? '—'} />
        <Fact label="Backend" value={report.backendHost ?? '—'} />
        <Fact label="Verificado em" value={report.checkedAt} />
      </View>

      {report.checks.map((check) => (
        <View key={check.name} style={styles.checkRow}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[check.status] }]} />
          <Text style={styles.body}>{check.name}</Text>
          <Text style={styles.checkDetail}>{check.detail ?? STATUS_LABEL[check.status]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: palette.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    ...textStyle('caption'),
    color: palette.gold,
    marginBottom: 12,
  },
  title: {
    ...textStyle('largeTitle'),
    color: palette.text,
    marginBottom: 20,
  },
  body: {
    ...textStyle('body'),
    color: palette.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  status: textStyle('section'),
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  card: {
    padding: 20,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
    gap: 10,
    marginBottom: 24,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  factLabel: {
    ...textStyle('body'),
    color: palette.textMuted,
  },
  factValue: {
    ...textStyle('body'),
    color: palette.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
  },
  checkDetail: {
    ...textStyle('body'),
    color: palette.textMuted,
    marginLeft: 'auto',
  },
});
