import { describe, expect, it, vi } from 'vitest';
import {
  ClientSecretLeakError,
  MissingEnvError,
  REDACTED,
  aggregateStatus,
  assertNoServerSecrets,
  backendHostOf,
  buildHealthReport,
  createLogger,
  readPublicEnv,
  redact,
  type HealthCheck,
  type LogEntry,
} from './index';

const PREFIX = 'VITE_FLY_';

function baseEnv(): Record<string, string | undefined> {
  return {
    [`${PREFIX}SUPABASE_URL`]: 'https://exemplo.supabase.co',
    [`${PREFIX}SUPABASE_PUBLISHABLE_KEY`]: 'sb_publishable_exemplo',
    [`${PREFIX}ENVIRONMENT`]: 'local',
  };
}

describe('readPublicEnv', () => {
  it('le a configuracao publica', () => {
    const env = readPublicEnv(baseEnv(), PREFIX);
    expect(env.environment).toBe('local');
    expect(env.supabaseUrl).toBe('https://exemplo.supabase.co');
    expect(env.appVersion).toBe('0.0.0');
    expect(env.commitSha).toBeUndefined();
  });

  it('lista todas as variaveis faltantes de uma vez', () => {
    expect(() => readPublicEnv({}, PREFIX)).toThrow(MissingEnvError);
    try {
      readPublicEnv({}, PREFIX);
    } catch (error) {
      expect((error as MissingEnvError).keys).toEqual([
        `${PREFIX}SUPABASE_URL`,
        `${PREFIX}SUPABASE_PUBLISHABLE_KEY`,
      ]);
    }
  });

  it('recusa um nome de ambiente que nao existe', () => {
    const env = { ...baseEnv(), [`${PREFIX}ENVIRONMENT`]: 'prod' };
    expect(() => readPublicEnv(env, PREFIX)).toThrow(/Ambiente invalido/);
  });
});

describe('assertNoServerSecrets', () => {
  it('aceita um ambiente so com chave publicavel', () => {
    expect(() => assertNoServerSecrets(baseEnv())).not.toThrow();
  });

  it.each(['SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'DB_PASSWORD', 'GITHUB_ACCESS_TOKEN'])(
    'bloqueia %s',
    (key) => {
      expect(() => assertNoServerSecrets({ ...baseEnv(), [key]: 'x' })).toThrow(
        ClientSecretLeakError,
      );
    },
  );

  it('reporta todas as chaves ofensivas, nao so a primeira', () => {
    try {
      assertNoServerSecrets({ SERVICE_ROLE: 'a', APP_SECRET: 'b' });
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as ClientSecretLeakError).keys).toHaveLength(2);
    }
  });
});

describe('redact', () => {
  it('apaga campos sensiveis mantendo os demais', () => {
    const out = redact({ nome: 'Ana', passport: 'AB123456', latitude: -23.5 }) as Record<
      string,
      unknown
    >;
    expect(out.nome).toBe('Ana');
    expect(out.passport).toBe(REDACTED);
    expect(out.latitude).toBe(REDACTED);
  });

  it('desce em objetos aninhados e arrays', () => {
    const out = redact({ viagem: { membros: [{ email: 'a@b.c', papel: 'guia' }] } }) as {
      viagem: { membros: Array<Record<string, unknown>> };
    };
    const membro = out.viagem.membros[0];
    expect(membro?.email).toBe(REDACTED);
    expect(membro?.papel).toBe('guia');
  });

  it('nao entra em recursao infinita com ciclos', () => {
    const cyclic: Record<string, unknown> = { nome: 'x' };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
  });
});

describe('createLogger', () => {
  it('redige o contexto antes de emitir', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({ service: 'fly-ops', sink: (e) => entries.push(e) });

    logger.info('checkin', { userId: 'u1', passport: 'AB123456' });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.context).toEqual({ userId: 'u1', passport: REDACTED });
    expect(entries[0]?.service).toBe('fly-ops');
  });

  it('respeita o nivel minimo', () => {
    const sink = vi.fn();
    const logger = createLogger({ service: 'fly-crew', minLevel: 'warn', sink });

    logger.debug('ignorado');
    logger.info('ignorado');
    logger.warn('emitido');
    logger.error('emitido');

    expect(sink).toHaveBeenCalledTimes(2);
  });
});

describe('health', () => {
  it('expoe so o host do backend, nunca a URL completa', () => {
    expect(backendHostOf('https://abc.supabase.co/rest/v1?apikey=segredo')).toBe('abc.supabase.co');
  });

  it('devolve null para URL invalida em vez de quebrar', () => {
    expect(backendHostOf('nao-e-url')).toBeNull();
  });

  it.each([
    [['ok', 'ok'], 'ok'],
    [['ok', 'degraded'], 'degraded'],
    [['degraded', 'down'], 'down'],
  ] as const)('agrega %s em %s', (statuses, expected) => {
    const checks: HealthCheck[] = statuses.map((status, i) => ({ name: `c${i}`, status }));
    expect(aggregateStatus(checks)).toBe(expected);
  });

  it('monta o relatorio sem vazar a chave', () => {
    const report = buildHealthReport({
      service: 'fly-ops',
      environment: 'local',
      version: '0.1.0',
      commitSha: 'abc1234',
      supabaseUrl: 'https://abc.supabase.co',
      checks: [{ name: 'backend', status: 'ok' }],
      now: new Date('2026-08-24T00:00:00.000Z'),
    });

    expect(report.status).toBe('ok');
    expect(report.backendHost).toBe('abc.supabase.co');
    expect(report.checkedAt).toBe('2026-08-24T00:00:00.000Z');
    expect(JSON.stringify(report)).not.toContain('sb_publishable');
  });
});
