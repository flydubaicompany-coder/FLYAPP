import { describe, expect, it } from 'vitest';
import {
  CENTRAL_ROUTE,
  ROUTES_WITH_CART,
  TAB_LABELS,
  TAB_ORDER,
  TRIP_TAB_ORDER,
  pathForRoute,
  routeFromPathname,
  shouldShowCart,
  tabSides,
  tabsFor,
} from './routing';

/**
 * Testes de navegacao (entrega de qualidade da §36).
 *
 * O criterio de aceite da §32 e literal: "barra inferior possui exatamente os
 * cinco destinos definidos" e "deep link abre o destino correto". Os dois viram
 * asserçao aqui.
 */

describe('os cinco destinos', () => {
  it('tem exatamente cinco, nem um mais', () => {
    expect(TAB_ORDER).toHaveLength(5);
  });

  it('esta na ordem da §4: Inicio, Passeios, Minha Viagem, Carteira, Perfil', () => {
    expect([...TAB_ORDER]).toEqual(['index', 'passeios', 'viagem', 'carteira', 'perfil']);
  });

  it('coloca Minha Viagem no centro, na terceira posicao', () => {
    expect(TAB_ORDER[2]).toBe(CENTRAL_ROUTE);
    expect(CENTRAL_ROUTE).toBe('viagem');
  });

  it('rotula todo destino dos dois modos, sem sobrar nenhum', () => {
    const todos = [...new Set([...TAB_ORDER, ...TRIP_TAB_ORDER])].sort();
    expect(Object.keys(TAB_LABELS).sort()).toEqual(todos);
  });

  it('nao inclui nada que a §4.3 manda ficar fora da barra', () => {
    const foraDaBarra = ['album', 'gastronomia', 'mapa', 'eventos', 'ranking', 'notas'];
    for (const rota of foraDaBarra) {
      expect(TAB_ORDER).not.toContain(rota);
    }
  });
});

describe('routeFromPathname', () => {
  it.each([
    ['/', 'index'],
    ['/passeios', 'passeios'],
    ['/viagem', 'viagem'],
    ['/carteira', 'carteira'],
    ['/perfil', 'perfil'],
  ] as const)('%s ativa a aba %s', (caminho, esperado) => {
    expect(routeFromPathname(caminho)).toBe(esperado);
  });

  it('resolve caminho aninhado pela aba raiz — deep link de detalhe mantem a aba', () => {
    expect(routeFromPathname('/passeios/deserto-vip')).toBe('passeios');
    // Tres segmentos: a aba continua acesa em telas filhas de pedido. Sem
    // isto, quem esta preenchendo "quem vai" ve a aba Inicio destacada.
    expect(routeFromPathname('/passeios/pedido/abc-123')).toBe('passeios');
    expect(routeFromPathname('/passeios/participantes/abc-123')).toBe('passeios');
    expect(routeFromPathname('/viagem/dia/3')).toBe('viagem');
  });

  it('tolera barra final e barras duplicadas', () => {
    expect(routeFromPathname('/carteira/')).toBe('carteira');
    expect(routeFromPathname('//perfil')).toBe('perfil');
  });

  it('cai em Inicio para caminho desconhecido, em vez de deixar a barra sem selecao', () => {
    expect(routeFromPathname('/rota-que-nao-existe')).toBe('index');
    expect(routeFromPathname('')).toBe('index');
  });
});

describe('pathForRoute', () => {
  it('mapeia a raiz para / e nao para /index', () => {
    expect(pathForRoute('index')).toBe('/');
  });

  it.each(['passeios', 'viagem', 'carteira', 'perfil'] as const)('mapeia %s', (rota) => {
    expect(pathForRoute(rota)).toBe(`/${rota}`);
  });

  it('fecha o ciclo: todo destino volta para si mesmo', () => {
    for (const rota of TAB_ORDER) {
      expect(routeFromPathname(pathForRoute(rota))).toBe(rota);
    }
  });
});

describe('carrinho por area (§4.2)', () => {
  it('aparece em Inicio, Passeios e Carteira', () => {
    expect(shouldShowCart('index')).toBe(true);
    expect(shouldShowCart('passeios')).toBe(true);
    expect(shouldShowCart('carteira')).toBe(true);
  });

  it('nao aparece em Minha Viagem nem no Perfil', () => {
    expect(shouldShowCart('viagem')).toBe(false);
    expect(shouldShowCart('perfil')).toBe(false);
  });

  it('so lista destinos que existem', () => {
    for (const rota of ROUTES_WITH_CART) {
      expect(TAB_ORDER).toContain(rota);
    }
  });
});

describe('Trip Mode — Dubai set/2026', () => {
  it('sao quatro destinos, e Minha Viagem continua no centro', () => {
    expect(TRIP_TAB_ORDER).toHaveLength(4);
    expect(TRIP_TAB_ORDER).toContain(CENTRAL_ROUTE);
  });

  /**
   * Passeios e Carteira saem da BARRA, e nao do app.
   *
   * As telas continuam existindo e acessiveis por link. Barra e promessa, e
   * prometer Carteira sem valor de ponto definido (P45/P46) e prometer o que
   * ainda nao se cumpre.
   */
  it('tira Passeios e Carteira da barra sem tirar do app', () => {
    expect(TRIP_TAB_ORDER).not.toContain('passeios');
    expect(TRIP_TAB_ORDER).not.toContain('carteira');
    expect(pathForRoute('passeios')).toBe('/passeios');
    expect(pathForRoute('carteira')).toBe('/carteira');
  });

  it('a Galeria vira destino, e tem caminho proprio', () => {
    expect(TRIP_TAB_ORDER).toContain('galeria');
    expect(pathForRoute('galeria')).toBe('/galeria');
    expect(routeFromPathname('/galeria')).toBe('galeria');
  });

  it('tabsFor escolhe a lista, e e o unico lugar que escolhe', () => {
    expect(tabsFor(true)).toEqual(TRIP_TAB_ORDER);
    expect(tabsFor(false)).toEqual(TAB_ORDER);
  });

  it('com cinco abas, dois de cada lado do botao central', () => {
    const { left, right } = tabSides(TAB_ORDER);
    expect(left).toEqual(['index', 'passeios']);
    expect(right).toEqual(['carteira', 'perfil']);
  });

  /**
   * Com quatro, um lado fica com um destino e o outro com dois.
   *
   * E deliberado: os dois lados recebem o mesmo peso na barra, entao o botao
   * central continua no eixo. Dividir 3 por 2 sem isso tiraria o botao do
   * centro, que e a assinatura do desenho.
   */
  it('com quatro, um de um lado e dois do outro — o centro nao sai do eixo', () => {
    const { left, right } = tabSides(TRIP_TAB_ORDER);
    expect(left).toEqual(['index']);
    expect(right).toEqual(['galeria', 'perfil']);
  });

  it('o botao central nunca aparece entre os lados', () => {
    for (const lista of [TAB_ORDER, TRIP_TAB_ORDER]) {
      const { left, right } = tabSides(lista);
      expect([...left, ...right]).not.toContain(CENTRAL_ROUTE);
      expect(left.length + right.length).toBe(lista.length - 1);
    }
  });
});
