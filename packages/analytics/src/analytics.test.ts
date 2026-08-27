import { describe, expect, it } from 'vitest';
import { Analytics, DestinoMemoria, limpar, REDIGIDO } from './index';

/**
 * O que estes testes protegem, em ordem de gravidade:
 *
 * 1. Nada sai sem consentimento — inclusive antes de ele ser conhecido.
 * 2. Consentimento negado descarta o que estava na fila, não guarda.
 * 3. Dado pessoal não sai, mesmo com consentimento.
 */

function novo(max?: number) {
  const destino = new DestinoMemoria();
  const analytics = new Analytics({
    destino,
    ...(max === undefined ? {} : { maxEspera: max }),
    agora: () => new Date('2026-08-25T12:00:00.000Z'),
  });
  return { destino, analytics };
}

describe('porta de consentimento', () => {
  it('nao envia enquanto o consentimento e desconhecido', () => {
    const { destino, analytics } = novo();

    analytics.registrar('home_vista', {
      estado: 'pre_trip',
      secoes: 8,
      eventos_em_destaque: 2,
    });

    expect(destino.recebidos).toHaveLength(0);
    expect(analytics.aguardando()).toBe(1);
  });

  it('libera a fila quando o consentimento chega positivo', () => {
    const { destino, analytics } = novo();

    analytics.registrar('home_vista', { estado: 'no_trip', secoes: 9, eventos_em_destaque: 3 });
    analytics.registrar('evento_visto', {
      evento_slug: 'fly-summit',
      categoria: 'summit',
      origem: 'home',
    });

    expect(destino.recebidos).toHaveLength(0);

    analytics.definirConsentimento('concedido');

    expect(destino.recebidos).toHaveLength(2);
    expect(analytics.aguardando()).toBe(0);
    expect(destino.recebidos[0]?.nome).toBe('home_vista');
  });

  it('descarta a fila quando o consentimento chega negativo', () => {
    const { destino, analytics } = novo();

    analytics.registrar('home_vista', { estado: 'no_trip', secoes: 9, eventos_em_destaque: 0 });
    analytics.definirConsentimento('negado');

    expect(destino.recebidos).toHaveLength(0);
    expect(analytics.aguardando()).toBe(0);
  });

  it('continua sem enviar depois da recusa', () => {
    const { destino, analytics } = novo();
    analytics.definirConsentimento('negado');

    analytics.registrar('evento_cta_tocado', {
      evento_slug: 'legends-dubai-cup',
      cta: 'open_fly_cup',
      resultado: 'fallback',
    });

    expect(destino.recebidos).toHaveLength(0);
  });

  it('envia direto depois do consentimento', () => {
    const { destino, analytics } = novo();
    analytics.definirConsentimento('concedido');

    analytics.registrar('notificacao_aberta', {
      categoria: 'operational',
      critica: true,
      exigiu_login: false,
      contexto_alcancado: true,
    });

    expect(destino.recebidos).toHaveLength(1);
    expect(analytics.aguardando()).toBe(0);
  });

  it('limita a fila de espera para nao crescer sem fim', () => {
    const { analytics } = novo(3);

    for (let i = 0; i < 10; i += 1) {
      analytics.registrar('home_secao_tocada', {
        estado: 'during_trip',
        secao: `secao-${i}`,
        posicao: i,
      });
    }

    expect(analytics.aguardando()).toBe(3);
  });

  it('mantem os mais recentes ao estourar o limite', () => {
    const { destino, analytics } = novo(2);

    for (let i = 0; i < 5; i += 1) {
      analytics.registrar('home_secao_tocada', {
        estado: 'during_trip',
        secao: `secao-${i}`,
        posicao: i,
      });
    }
    analytics.definirConsentimento('concedido');

    expect(destino.recebidos.map((e) => e.props.secao)).toEqual(['secao-3', 'secao-4']);
  });
});

describe('barreira de dado pessoal', () => {
  it('redige e-mail em qualquer campo', () => {
    const r = limpar({ origem: 'cliente@exemplo.com.br' });
    expect(r.props.origem).toBe(REDIGIDO);
    expect(r.redacoes).toBe(1);
  });

  it('redige uuid, que quase sempre e um user_id que escapou', () => {
    const r = limpar({ origem: '11111111-1111-1111-1111-111111111111' });
    expect(r.props.origem).toBe(REDIGIDO);
  });

  it('redige sequencia longa de digitos', () => {
    const r = limpar({ contexto: '+55 21 99999-8888' });
    expect(r.props.contexto).toBe(REDIGIDO);
  });

  it('redige token longo', () => {
    const r = limpar({ ref: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij' });
    expect(r.props.ref).toBe(REDIGIDO);
  });

  it('deixa passar slug, categoria e numero pequeno', () => {
    const r = limpar({ evento_slug: 'fly-cup-futevolei', categoria: 'fly-cup', posicao: 2 });
    expect(r.redacoes).toBe(0);
    expect(r.props).toEqual({
      evento_slug: 'fly-cup-futevolei',
      categoria: 'fly-cup',
      posicao: 2,
    });
  });

  it('nao deixa um registro inteiro entrar por uma propriedade', () => {
    const r = limpar({ perfil: { nome: 'Victor', email: 'v@fly.com' } });
    expect(r.props.perfil).toBe('[objeto]');
    expect(r.motivos).toContain('perfil:aninhado');
  });

  it('a barreira roda mesmo com consentimento concedido', () => {
    const { destino, analytics } = novo();
    analytics.definirConsentimento('concedido');

    analytics.registrar('evento_visto', {
      evento_slug: 'fly-summit',
      categoria: 'summit',
      // Fora do tipo de propósito: é o caso "alguém passou o que não devia".
      origem: 'contato@fly.com.br' as never,
    });

    expect(destino.recebidos[0]?.props.origem).toBe(REDIGIDO);
  });

  it('avisa quem instrumentou que algo foi redigido', () => {
    const destino = new DestinoMemoria();
    const avisos: string[] = [];
    const analytics = new Analytics({
      destino,
      aoRedigir: (nome, motivos) => avisos.push(`${nome}:${motivos.join(',')}`),
    });
    analytics.definirConsentimento('concedido');

    analytics.registrar('evento_visto', {
      evento_slug: 'x',
      categoria: 'y',
      origem: 'alguem@fly.com' as never,
    });

    expect(avisos).toEqual(['evento_visto:origem:email']);
  });
});
