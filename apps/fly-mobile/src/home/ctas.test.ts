import { describe, expect, it, vi } from 'vitest';
import { FLY_CUP_WEB, ROTULO_PADRAO, abrirCta, destinoDe, type EventoCta } from './ctas';

function cta(over: Partial<EventoCta> = {}): EventoCta {
  return { id: 'x', kind: 'view_event', label: 'Ver', targetUrl: null, ...over };
}

describe('destino do CTA', () => {
  it('reconhece URL externa', () => {
    expect(destinoDe(cta({ targetUrl: 'https://fly.com/evento' }))).toEqual({
      tipo: 'externo',
      url: 'https://fly.com/evento',
    });
  });

  it('reconhece rota interna', () => {
    expect(destinoDe(cta({ targetUrl: '/passeios' }))).toEqual({
      tipo: 'interno',
      rota: '/passeios',
    });
  });

  it('sem destino, nao inventa um', () => {
    expect(destinoDe(cta())).toEqual({ tipo: 'nenhum' });
  });

  it('Fly Cup devolve deep link E fallback', () => {
    const d = destinoDe(cta({ kind: 'open_fly_cup', targetUrl: 'flycup://torneio/42' }));
    expect(d).toEqual({
      tipo: 'appExterno',
      deepLink: 'flycup://torneio/42',
      fallback: FLY_CUP_WEB,
    });
  });

  it('Fly Cup sem destino cai no scheme e na web', () => {
    const d = destinoDe(cta({ kind: 'open_fly_cup' }));
    expect(d).toEqual({ tipo: 'appExterno', deepLink: 'flycup://', fallback: FLY_CUP_WEB });
  });

  it('Fly Cup com URL http usa a propria URL como fallback', () => {
    const d = destinoDe(cta({ kind: 'open_fly_cup', targetUrl: 'https://flycup.com.br/x' }));
    expect(d).toMatchObject({ fallback: 'https://flycup.com.br/x' });
  });
});

describe('abrir o Fly Cup (§38.8)', () => {
  const flyCup = cta({ kind: 'open_fly_cup', targetUrl: 'flycup://torneio/42' });

  it('com o app instalado, usa o deep link', async () => {
    const abrir = vi.fn(async () => undefined);
    const r = await abrirCta(flyCup, abrir, async () => true);
    expect(r).toEqual({ ok: true, via: 'deepLink' });
    expect(abrir).toHaveBeenCalledWith('flycup://torneio/42');
  });

  it('SEM o app instalado, cai na web em vez de nao fazer nada', async () => {
    const abrir = vi.fn(async () => undefined);
    const r = await abrirCta(flyCup, abrir, async () => false);
    expect(r).toEqual({ ok: true, via: 'fallback' });
    expect(abrir).toHaveBeenCalledWith(FLY_CUP_WEB);
  });

  it('se a checagem de scheme explodir, ainda tenta o fallback', async () => {
    const abrir = vi.fn(async () => undefined);
    const podeAbrir = vi.fn(async () => {
      throw new Error('scheme nao declarado');
    });
    const r = await abrirCta(flyCup, abrir, podeAbrir);
    expect(r).toEqual({ ok: true, via: 'fallback' });
  });

  it('reporta falha quando nem o fallback abre', async () => {
    const abrir = vi.fn(async () => {
      throw new Error('sem navegador');
    });
    const r = await abrirCta(flyCup, abrir, async () => false);
    expect(r).toEqual({ ok: false, motivo: 'falhou' });
  });
});

describe('abrir os demais CTAs', () => {
  it('abre URL externa direto', async () => {
    const abrir = vi.fn(async () => undefined);
    const r = await abrirCta(cta({ targetUrl: 'https://fly.com' }), abrir, async () => true);
    expect(r).toEqual({ ok: true, via: 'externo' });
  });

  it('nao chama nada quando nao ha destino', async () => {
    const abrir = vi.fn(async () => undefined);
    const r = await abrirCta(cta(), abrir, async () => true);
    expect(r).toEqual({ ok: false, motivo: 'sem_destino' });
    expect(abrir).not.toHaveBeenCalled();
  });
});

describe('catalogo de CTAs', () => {
  it('tem exatamente os sete que a §5.6 lista', () => {
    expect(Object.keys(ROTULO_PADRAO)).toHaveLength(7);
  });

  it('inclui os nomeados na especificacao', () => {
    for (const k of [
      'view_event',
      'buy_ticket',
      'join_list',
      'watch',
      'view_results',
      'open_fly_cup',
      'want_dubai',
    ]) {
      expect(ROTULO_PADRAO).toHaveProperty(k);
    }
  });
});
