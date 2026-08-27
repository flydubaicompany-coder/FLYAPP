import { useEffect, useState } from 'react';
import {
  buildHealthReport,
  checkBackend,
  createLogger,
  type HealthReport,
  type HealthStatus,
  type PublicEnv,
} from '@fly/config';
import { color } from '@fly/design-tokens';
import { SERVICE_NAME } from './service';

/**
 * Pagina de health para ambientes internos (spec §35.10).
 *
 * O que ela mostra: servico, ambiente, versao, commit, host do backend e o
 * resultado das sondas. O que ela NAO mostra, por regra: chave, PII, contagem
 * de registros, nome de cliente.
 */

const STATUS_COLOR: Record<HealthStatus, string> = {
  ok: color.status.success,
  degraded: color.status.warning,
  down: color.status.danger,
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'Operacional',
  degraded: 'Degradado',
  down: 'Fora do ar',
};

const logger = createLogger({ service: SERVICE_NAME });

export function HealthPage({ env }: { env: PublicEnv }) {
  const [report, setReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const backend = await checkBackend({
        supabaseUrl: env.supabaseUrl,
        supabaseKey: env.supabaseKey,
      });
      if (cancelled) return;

      const next = buildHealthReport({
        service: SERVICE_NAME,
        environment: env.environment,
        version: env.appVersion,
        commitSha: env.commitSha,
        supabaseUrl: env.supabaseUrl,
        checks: [backend],
      });
      setReport(next);
      logger.info('health verificado', { status: next.status });
    })();

    return () => {
      cancelled = true;
    };
  }, [env]);

  if (!report) {
    return (
      <main className="page">
        <p className="muted">Verificando…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <p className="kicker">Health</p>
      <h1>{report.service}</h1>

      <p className="status" style={{ color: STATUS_COLOR[report.status] }}>
        <span className="dot" style={{ background: STATUS_COLOR[report.status] }} />
        {STATUS_LABEL[report.status]}
      </p>

      <dl className="facts">
        <dt>Ambiente</dt>
        <dd>{report.environment}</dd>
        <dt>Versão</dt>
        <dd>{report.version}</dd>
        <dt>Commit</dt>
        <dd>{report.commitSha ?? '—'}</dd>
        <dt>Backend</dt>
        <dd>{report.backendHost ?? '—'}</dd>
        <dt>Verificado em</dt>
        <dd>{report.checkedAt}</dd>
      </dl>

      <ul className="checks">
        {report.checks.map((check) => (
          <li key={check.name}>
            <span className="dot" style={{ background: STATUS_COLOR[check.status] }} />
            <span>{check.name}</span>
            <span className="muted">{check.detail ?? STATUS_LABEL[check.status]}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
