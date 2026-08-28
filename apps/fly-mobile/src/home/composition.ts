/**
 * Composição da Home (§5).
 *
 * A §5 responde uma pergunta só: "o que importa para este cliente agora?" — e
 * responde diferente em cada fase da viagem. As ordens abaixo são as da
 * especificação, literais.
 *
 * Módulo puro: a Home decide **o quê** mostrar aqui, e só desenha na tela. Sem
 * isso, a regra de ordenação ficaria espalhada em JSX e a §5.4 — que exige
 * informação operacional acima de promoção — viraria uma questão de quem
 * escreveu o componente por último.
 */

export type HomeState = 'no_trip' | 'pre_trip' | 'during_trip' | 'post_trip';

export type SectionKind =
  | 'greeting'
  | 'nextAction'
  | 'countdown'
  | 'checklist'
  | 'criticalAlerts'
  | 'todayTimeline'
  | 'chapterProgress'
  | 'memory'
  | 'statusPoints'
  | 'benefits'
  | 'trendingTours'
  | 'gallery'
  | 'events'
  | 'talks'
  | 'recap'
  | 'feedback'
  | 'referral'
  | 'support';

export interface Section {
  kind: SectionKind;
  /** Menor aparece antes. */
  order: number;
  /**
   * Informação operacional. A §5.4 exige que ela venha antes de promoção, e a
   * §26 proíbe que marketing a substitua. Marcar aqui permite testar a regra
   * em vez de confiar na ordem escrita à mão.
   */
  operational: boolean;
}

function s(kind: SectionKind, order: number, operational = false): Section {
  return { kind, order, operational };
}

/**
 * §5.2 — sem viagem ativa.
 * Ordem: saudação e pontos, hero, Acontece na Fly, benefícios, passeios em
 * alta, galeria, indicação e suporte.
 */
const SEM_VIAGEM: readonly Section[] = [
  s('greeting', 10),
  s('statusPoints', 20),
  s('nextAction', 30),
  s('events', 40),
  s('benefits', 50),
  s('trendingTours', 60),
  s('gallery', 70),
  s('referral', 80),
  s('support', 90, true),
];

/**
 * §5.3 — pré-viagem.
 * Contagem regressiva primeiro, depois checklist e pendências. Promoção não
 * aparece: quem viaja em seis dias precisa do passaporte, não de oferta.
 */
const PRE_VIAGEM: readonly Section[] = [
  s('greeting', 10),
  s('countdown', 20, true),
  s('checklist', 30, true),
  s('nextAction', 40, true),
  s('criticalAlerts', 50, true),
  s('talks', 60),
  s('events', 70),
  s('support', 80, true),
];

/**
 * §5.4 — durante a viagem.
 * "Agora na sua jornada" no topo, alertas críticos logo abaixo, e "Acontece na
 * Fly em espaço menor". Esta é a tela que alguém abre andando na rua.
 */
const DURANTE: readonly Section[] = [
  // A §5.4 nao listava saudacao aqui — ela abria direto no operacional. O
  // handoff de 28/08 mostra a barra de identidade e a saudacao no topo tambem
  // durante a viagem, e elas nao competem com nada: sao cabecalho, e o
  // "Agora na sua jornada" continua sendo o primeiro bloco de conteudo.
  s('greeting', 5),
  s('nextAction', 10, true),
  s('criticalAlerts', 20, true),
  s('todayTimeline', 30, true),
  s('chapterProgress', 40),
  s('memory', 50),
  s('trendingTours', 60),
  s('events', 70),
  s('support', 80, true),
];

/**
 * §5.5 — pós-viagem.
 * Resumo, álbum, pontos, recibos, feedback e a próxima experiência.
 */
const POS_VIAGEM: readonly Section[] = [
  s('greeting', 10),
  s('recap', 20),
  s('gallery', 30),
  s('statusPoints', 40),
  s('feedback', 50),
  s('trendingTours', 60),
  s('referral', 70),
  s('events', 80),
];

const POR_ESTADO: Record<HomeState, readonly Section[]> = {
  no_trip: SEM_VIAGEM,
  pre_trip: PRE_VIAGEM,
  during_trip: DURANTE,
  post_trip: POS_VIAGEM,
};

/** Seções da Home para um estado, já na ordem. */
export function sectionsFor(state: HomeState): readonly Section[] {
  return [...POR_ESTADO[state]].sort((a, b) => a.order - b.order);
}

/** Só as chaves, na ordem. Útil para renderizar e para testar. */
export function sectionKindsFor(state: HomeState): readonly SectionKind[] {
  return sectionsFor(state).map((sec) => sec.kind);
}

/** Seções promocionais — o que a §5.4 manda ficar abaixo do operacional. */
export const PROMOTIONAL: readonly SectionKind[] = ['trendingTours', 'benefits', 'referral'];

export function isPromotional(kind: SectionKind): boolean {
  return PROMOTIONAL.includes(kind);
}

/**
 * Contagem regressiva em texto.
 *
 * `days` vem do servidor, já calculado no fuso do destino — o app nunca faz
 * essa conta, porque um celular com data errada mostraria outro número.
 */
export function countdownLabel(days: number): string {
  if (days <= 0) return 'É hoje';
  if (days === 1) return 'Amanhã';
  return `Faltam ${days} dias`;
}

/** "Dia 3 de 8", durante a viagem. */
export function dayLabel(dayNumber: number, totalDays: number): string {
  return `Dia ${dayNumber} de ${totalDays}`;
}

/** Saudação pelo horário local de quem está olhando. */
export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
