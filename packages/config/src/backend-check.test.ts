import { describe, expect, it, vi } from 'vitest';
import { SLOW_RESPONSE_MS, checkBackend } from './backend-check';

const OPTIONS = {
  supabaseUrl: 'https://exemplo.supabase.co',
  supabaseKey: 'sb_publishable_exemplo',
};

function respondWith(init: { ok: boolean; status: number }, delayMs = 0): typeof fetch {
  return vi.fn(async () => {
    if (delayMs > 0) await vi.advanceTimersByTimeAsync(delayMs);
    return { ok: init.ok, status: init.status } as Response;
  }) as unknown as typeof fetch;
}

describe('checkBackend', () => {
  it('reporta ok quando o backend responde', async () => {
    const check = await checkBackend({
      ...OPTIONS,
      fetchImpl: respondWith({ ok: true, status: 200 }),
    });
    expect(check.status).toBe('ok');
    expect(check.name).toBe('backend');
  });

  it('reporta down com o codigo HTTP quando o backend recusa', async () => {
    const check = await checkBackend({
      ...OPTIONS,
      fetchImpl: respondWith({ ok: false, status: 503 }),
    });
    expect(check.status).toBe('down');
    expect(check.detail).toBe('HTTP 503');
  });

  it('nao lanca quando a rede falha', async () => {
    const failing = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const check = await checkBackend({ ...OPTIONS, fetchImpl: failing });
    expect(check.status).toBe('down');
    expect(check.detail).toBe('falha de rede');
  });

  it('reporta down quando estoura o timeout', async () => {
    const aborting = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    const check = await checkBackend({ ...OPTIONS, timeoutMs: 250, fetchImpl: aborting });
    expect(check.status).toBe('down');
    expect(check.detail).toBe('sem resposta em 250 ms');
  });

  it('reporta degraded quando responde, mas devagar', async () => {
    vi.useFakeTimers();
    try {
      const check = await checkBackend({
        ...OPTIONS,
        fetchImpl: respondWith({ ok: true, status: 200 }, SLOW_RESPONSE_MS + 100),
      });
      expect(check.status).toBe('degraded');
      expect(check.detail).toMatch(/resposta lenta/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reporta down sem chamar a rede quando a URL e invalida', async () => {
    const spy = vi.fn();
    const check = await checkBackend({
      ...OPTIONS,
      supabaseUrl: 'nao-e-url',
      fetchImpl: spy as unknown as typeof fetch,
    });
    expect(check.status).toBe('down');
    expect(check.detail).toBe('URL do backend invalida');
    expect(spy).not.toHaveBeenCalled();
  });

  it('manda a chave no header apikey e nunca na URL', async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    await checkBackend({ ...OPTIONS, fetchImpl: spy as unknown as typeof fetch });

    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://exemplo.supabase.co/auth/v1/health');
    expect(url).not.toContain(OPTIONS.supabaseKey);
    expect((init.headers as Record<string, string>).apikey).toBe(OPTIONS.supabaseKey);
  });
});
