/**
 * Sonda de conectividade com o backend, usada pela pagina de health.
 *
 * Deliberadamente sem SDK: uma requisicao ao endpoint de health do Supabase
 * basta para responder "o backend esta alcancavel deste ambiente". O cliente
 * Supabase entra na Fase 2, junto com o Fly ID.
 */

import type { HealthCheck } from './health';

export interface CheckBackendOptions {
  supabaseUrl: string;
  /** Chave PUBLICAVEL. */
  supabaseKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Acima disto a rede esta viva mas lenta o bastante para merecer aviso. */
export const SLOW_RESPONSE_MS = 1500;

/**
 * Nunca lanca: um backend fora do ar e um resultado, nao uma excecao. A
 * mensagem devolvida e curta e segura para exibir — sem corpo de resposta,
 * sem cabecalho, sem chave.
 */
export async function checkBackend(options: CheckBackendOptions): Promise<HealthCheck> {
  const { supabaseUrl, supabaseKey, timeoutMs = 5000, fetchImpl = fetch } = options;
  const name = 'backend';

  let endpoint: string;
  try {
    endpoint = new URL('/auth/v1/health', supabaseUrl).toString();
  } catch {
    return { name, status: 'down', detail: 'URL do backend invalida' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(endpoint, {
      headers: { apikey: supabaseKey },
      signal: controller.signal,
    });
    const elapsed = Date.now() - startedAt;

    if (!response.ok) {
      return { name, status: 'down', detail: `HTTP ${response.status}` };
    }
    if (elapsed > SLOW_RESPONSE_MS) {
      return { name, status: 'degraded', detail: `resposta lenta (${elapsed} ms)` };
    }
    return { name, status: 'ok', detail: `${elapsed} ms` };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      name,
      status: 'down',
      detail: aborted ? `sem resposta em ${timeoutMs} ms` : 'falha de rede',
    };
  } finally {
    clearTimeout(timer);
  }
}
