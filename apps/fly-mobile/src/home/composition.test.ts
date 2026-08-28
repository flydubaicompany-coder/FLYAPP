import { describe, expect, it } from 'vitest';
import {
  countdownLabel,
  dayLabel,
  greetingFor,
  isPromotional,
  sectionKindsFor,
  sectionsFor,
  type HomeState,
} from './composition';

const ESTADOS: HomeState[] = ['no_trip', 'pre_trip', 'during_trip', 'post_trip'];

describe('composicao da Home', () => {
  it.each(ESTADOS)('%s tem secoes', (estado) => {
    expect(sectionsFor(estado).length).toBeGreaterThan(0);
  });

  it('nao repete secao dentro de um estado', () => {
    for (const estado of ESTADOS) {
      const chaves = sectionKindsFor(estado);
      expect(new Set(chaves).size).toBe(chaves.length);
    }
  });

  it('devolve sempre em ordem crescente', () => {
    for (const estado of ESTADOS) {
      const ordens = sectionsFor(estado).map((s) => s.order);
      expect([...ordens].sort((a, b) => a - b)).toEqual(ordens);
    }
  });

  it('muda de verdade entre os estados — nao e a mesma tela com outro titulo', () => {
    const porEstado = ESTADOS.map((e) => sectionKindsFor(e).join('|'));
    expect(new Set(porEstado).size).toBe(ESTADOS.length);
  });
});

describe('prioridade do operacional (§5.4)', () => {
  // A saudacao entrou no topo em 28/08/2026, seguindo o handoff. Ela e
  // cabecalho, nao secao de conteudo: o que a §5.4 protege e que o
  // **operacional** venha antes de qualquer outra coisa, e isso continua
  // valendo — o teste passou a afirmar exatamente isso, em vez do indice zero.
  it('durante a viagem, a proxima acao e o primeiro bloco de conteudo', () => {
    const chaves = sectionKindsFor('during_trip').filter((k) => k !== 'greeting');
    expect(chaves[0]).toBe('nextAction');
  });

  it('durante a viagem, so a saudacao pode vir antes da proxima acao', () => {
    const chaves = sectionKindsFor('during_trip');
    expect(chaves.slice(0, chaves.indexOf('nextAction'))).toEqual(['greeting']);
  });

  it('durante a viagem, alerta critico vem antes de qualquer promocao', () => {
    const chaves = sectionKindsFor('during_trip');
    const alerta = chaves.indexOf('criticalAlerts');
    const primeiraPromo = chaves.findIndex(isPromotional);
    expect(alerta).toBeGreaterThanOrEqual(0);
    expect(alerta).toBeLessThan(primeiraPromo);
  });

  it('em toda fase, tudo que e operacional vem antes de tudo que e promocional', () => {
    for (const estado of ESTADOS) {
      const secoes = sectionsFor(estado);
      const ultimaOperacional = Math.max(...secoes.map((s, i) => (s.operational ? i : -1)));
      const primeiraPromo = secoes.findIndex((s) => isPromotional(s.kind));
      if (primeiraPromo === -1 || ultimaOperacional === -1) continue;
      // O suporte e operacional e fica no rodape de proposito; o que importa
      // e nao haver promocao acima de alerta ou proxima acao.
      const operacionaisCriticas = secoes
        .map((s, i) => ({ s, i }))
        .filter(({ s }) =>
          ['nextAction', 'criticalAlerts', 'countdown', 'checklist'].includes(s.kind),
        );
      for (const { i } of operacionaisCriticas) {
        expect(i).toBeLessThan(primeiraPromo);
      }
    }
  });

  it('pre-viagem nao mostra passeio em alta — quem viaja em dias precisa do passaporte', () => {
    expect(sectionKindsFor('pre_trip')).not.toContain('trendingTours');
  });

  it('durante a viagem, Acontece na Fly fica abaixo do roteiro do dia', () => {
    const chaves = sectionKindsFor('during_trip');
    expect(chaves.indexOf('todayTimeline')).toBeLessThan(chaves.indexOf('events'));
  });
});

describe('rotulos', () => {
  it.each([
    [0, 'É hoje'],
    [1, 'Amanhã'],
    [16, 'Faltam 16 dias'],
  ])('contagem de %s dias vira "%s"', (dias, esperado) => {
    expect(countdownLabel(dias)).toBe(esperado);
  });

  it('nao mostra numero negativo se o servidor mandar algo estranho', () => {
    expect(countdownLabel(-3)).toBe('É hoje');
  });

  it('numera o dia da viagem', () => {
    expect(dayLabel(3, 8)).toBe('Dia 3 de 8');
  });

  it.each([
    [3, 'Boa madrugada'],
    [9, 'Bom dia'],
    [15, 'Boa tarde'],
    [21, 'Boa noite'],
  ])('as %s horas, saudacao e "%s"', (hora, esperado) => {
    const d = new Date(2026, 8, 10, hora, 0, 0);
    expect(greetingFor(d)).toBe(esperado);
  });
});
