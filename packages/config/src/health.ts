/**
 * Payload de health/status compartilhado pelas tres aplicacoes (spec §35.10).
 *
 * A pagina de health e para ambiente interno. Ela responde "esta no ar, em que
 * versao, apontando para onde" — e nada alem disso. Sem PII, sem nome de
 * cliente, sem contagem de registros.
 */

import type { Environment } from './env';

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthReport {
  status: HealthStatus;
  service: string;
  environment: Environment;
  version: string;
  commitSha: string | undefined;
  /** Host do backend. Nunca a chave, nunca a URL completa com query. */
  backendHost: string | null;
  checkedAt: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  /** Mensagem curta e segura para exibir. Nao inclua corpo de resposta. */
  detail?: string | undefined;
}

/** Extrai so o host de uma URL. Devolve null se a URL for invalida. */
export function backendHostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** O pior status manda: down > degraded > ok. */
export function aggregateStatus(checks: readonly HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === 'down')) return 'down';
  if (checks.some((check) => check.status === 'degraded')) return 'degraded';
  return 'ok';
}

export interface BuildHealthReportInput {
  service: string;
  environment: Environment;
  version: string;
  commitSha: string | undefined;
  supabaseUrl: string;
  checks: readonly HealthCheck[];
  now?: Date;
}

export function buildHealthReport(input: BuildHealthReportInput): HealthReport {
  return {
    status: aggregateStatus(input.checks),
    service: input.service,
    environment: input.environment,
    version: input.version,
    commitSha: input.commitSha,
    backendHost: backendHostOf(input.supabaseUrl),
    checkedAt: (input.now ?? new Date()).toISOString(),
    checks: [...input.checks],
  };
}
