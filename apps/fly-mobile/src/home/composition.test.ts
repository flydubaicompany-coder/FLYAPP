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
  // Em 28/08/2026 o dono pediu "banner sempre topo", seguindo o handoff. A
  // saudacao e o banner passam a vir antes do operacional. O que a §5.4
  // protege continua valendo e continua testado logo abaixo: o operacional vem
  // antes de qualquer **promocao**, e o alerta critico vem antes do resto do
  // conteudo operacional.
  it('durante a viagem, so a saudacao e o banner vem antes da proxima acao', () => {
    const chaves = sectionKindsFor('during_trip');
    expect(chaves.slice(0, chaves.indexOf('nextAction'))).toEqual(['greeting', 'events']);
  });

  it('durante a viagem, a proxima acao abre o operacional', () => {
    const chaves = sectionKindsFor('during_trip').filter((k) => k !== 'greeting' && k !== 'events');
    expect(chaves[0]).toBe('nextAction');
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

  // ~~'Acontece na Fly fica abaixo do roteiro do dia'~~ — a §5.4 mandava isso
  // e o dono reverteu em 28/08/2026: o banner vai para o topo, em todos os
  // estados. O teste foi trocado por este, que afirma a regra nova.
  it('o banner de eventos vem logo depois da saudacao, em todos os estados', () => {
    for (const estado of ['no_trip', 'pre_trip', 'during_trip', 'post_trip'] as const) {
      const chaves = sectionKindsFor(estado);
      expect(chaves.indexOf('events')).toBe(chaves.indexOf('greeting') + 1);
    }
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
