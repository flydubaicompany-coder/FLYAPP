/**
 * Log estruturado — observabilidade minima da Fase 0 (spec §35.10).
 *
 * Regra dura (spec §23.2): "logs sem conteudo sensivel". O logger redige
 * campos suspeitos antes de emitir, para que um `logger.info('...', user)`
 * distraido nao vaze passaporte, localizacao ou token.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Campos redigidos antes de sair. A lista cobre as categorias sensiveis da
 * §23.1: passaporte, localizacao, saude, contato de emergencia, pagamento.
 */
const REDACTED_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'passport',
  'passaporte',
  'cpf',
  'card',
  'cvv',
  'pan',
  'latitude',
  'longitude',
  'location',
  'localizacao',
  'health',
  'saude',
  'medical',
  'email',
  'phone',
  'telefone',
] as const;

export const REDACTED = '[redacted]';

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACTED_KEYS.some((needle) => lower.includes(needle));
}

/** Redige recursivamente. Profundidade limitada para nao travar em ciclos. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = shouldRedact(key) ? REDACTED : redact(item, depth + 1);
  }
  return out;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  context?: Record<string, unknown> | undefined;
}

export interface LoggerOptions {
  service: string;
  minLevel?: LogLevel;
  /** Injetavel para teste; por padrao escreve no console. */
  sink?: (entry: LogEntry) => void;
}

function defaultSink(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else console.warn(line);
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(options: LoggerOptions): Logger {
  const { service, minLevel = 'info', sink = defaultSink } = options;
  const threshold = LEVEL_ORDER[minLevel];

  function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < threshold) return;
    sink({
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      context: context ? (redact(context) as Record<string, unknown>) : undefined,
    });
  }

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
  };
}
