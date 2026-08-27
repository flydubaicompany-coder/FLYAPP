/**
 * Leitura de ambiente.
 *
 * Regra do projeto (spec §21.4): o cliente so recebe a chave PUBLICAVEL do
 * Supabase. A chave secreta / service_role nunca entra em bundle de app.
 * `assertNoServerSecrets` existe para transformar essa regra em erro de
 * execucao em vez de recomendacao em documento.
 */

export const ENVIRONMENTS = ['local', 'development', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

export interface PublicEnv {
  environment: Environment;
  supabaseUrl: string;
  /** Chave PUBLICAVEL. Nunca a secreta. */
  supabaseKey: string;
  /** Versao da aplicacao, exibida em /health. */
  appVersion: string;
  /** Commit do build, quando a esteira injeta. */
  commitSha: string | undefined;
}

/**
 * Nomes de variavel que jamais podem chegar ao cliente. A lista e conferida
 * por substring e sem diferenciar maiuscula de minuscula.
 */
const FORBIDDEN_IN_CLIENT = [
  'service_role',
  'secret',
  'private_key',
  'password',
  'access_token',
] as const;

export class ClientSecretLeakError extends Error {
  readonly keys: string[];

  constructor(keys: string[]) {
    super(
      `Variaveis de servidor apareceram no ambiente do cliente: ${keys.join(', ')}. ` +
        'Remova-as do build — o cliente so pode receber a chave publicavel.',
    );
    this.name = 'ClientSecretLeakError';
    this.keys = keys;
  }
}

/**
 * Lanca se qualquer chave do ambiente exposto parecer um segredo de servidor.
 * Chame no bootstrap de cada aplicacao cliente.
 */
export function assertNoServerSecrets(env: Record<string, unknown>): void {
  const offending = Object.keys(env).filter((key) => {
    const lower = key.toLowerCase();
    return FORBIDDEN_IN_CLIENT.some((needle) => lower.includes(needle));
  });

  if (offending.length > 0) {
    throw new ClientSecretLeakError(offending);
  }
}

export class MissingEnvError extends Error {
  readonly keys: string[];

  constructor(keys: string[]) {
    super(
      `Variaveis de ambiente ausentes: ${keys.join(', ')}. ` +
        'Copie o .env.example do app e preencha os valores.',
    );
    this.name = 'MissingEnvError';
    this.keys = keys;
  }
}

/**
 * Le o ambiente publico a partir de um mapa de variaveis ja resolvido pelo
 * bundler (import.meta.env no Vite, process.env no Expo/Node).
 */
export function readPublicEnv(raw: Record<string, string | undefined>, prefix: string): PublicEnv {
  assertNoServerSecrets(raw);

  const url = raw[`${prefix}SUPABASE_URL`];
  const key = raw[`${prefix}SUPABASE_PUBLISHABLE_KEY`];

  const missing: string[] = [];
  if (!url) missing.push(`${prefix}SUPABASE_URL`);
  if (!key) missing.push(`${prefix}SUPABASE_PUBLISHABLE_KEY`);
  if (missing.length > 0) throw new MissingEnvError(missing);

  const envName = raw[`${prefix}ENVIRONMENT`] ?? 'local';
  if (!isEnvironment(envName)) {
    throw new Error(`Ambiente invalido: "${envName}". Use um de: ${ENVIRONMENTS.join(', ')}.`);
  }

  return {
    environment: envName,
    supabaseUrl: url as string,
    supabaseKey: key as string,
    appVersion: raw[`${prefix}APP_VERSION`] ?? '0.0.0',
    commitSha: raw[`${prefix}COMMIT_SHA`],
  };
}
