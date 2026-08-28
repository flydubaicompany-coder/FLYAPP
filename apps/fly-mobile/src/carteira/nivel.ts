import { FLY_POINTS_LEVELS, type FlyPointsLevel } from '@fly/design-tokens';

/**
 * Nivel de Fly Points a partir do saldo.
 *
 * **Nivel nao e pacote** (D95). Standard, Black e Billionaire sao o pacote que
 * o cliente comprou; basic, prime e elite sao o nivel que ele sobe acumulando.
 * Este arquivo so trata do segundo.
 *
 * Os limiares vem de `app_config`, nunca de constante no codigo: mudar o
 * degrau de prime e ato de operacao, nao de release. E enquanto forem nulos —
 * como foram ate 28/08/2026 — a tela diz "a definir" em vez de chutar (§33).
 */

export interface Limiares {
  /** Pontos para prime. `null` = ainda nao decidido. */
  prime: number | null;
  /** Pontos para elite. `null` = ainda nao decidido. */
  elite: number | null;
}

export const LIMIARES_DESCONHECIDOS: Limiares = { prime: null, elite: null };

/**
 * O nivel do saldo.
 *
 * Com limiar nulo o cliente fica em `basic`: e o unico nivel que nao afirma
 * nada sobre quanto ele acumulou.
 */
export function nivelDoSaldo(saldo: number, limiares: Limiares): FlyPointsLevel {
  if (limiares.elite !== null && saldo >= limiares.elite) return 'elite';
  if (limiares.prime !== null && saldo >= limiares.prime) return 'prime';
  return 'basic';
}

export interface Progresso {
  nivel: FlyPointsLevel;
  /** `null` quando ja e elite, ou quando o proximo limiar e desconhecido. */
  proximo: FlyPointsLevel | null;
  /** Pontos que faltam para o proximo. `null` pelo mesmo motivo. */
  faltam: number | null;
  /** 0 a 1 dentro da faixa atual. `null` quando nao da para saber. */
  fracao: number | null;
}

/**
 * Onde o cliente esta e quanto falta.
 *
 * A fracao e medida **dentro da faixa atual**, nao do zero: quem esta em prime
 * com 30.000 de 100.000 nao tem 30% da barra, tem 6,7% do caminho entre prime
 * e elite. Medir do zero faz a barra parecer parada logo depois de subir.
 */
export function progressoDoSaldo(saldo: number, limiares: Limiares): Progresso {
  const nivel = nivelDoSaldo(saldo, limiares);

  if (nivel === 'elite') return { nivel, proximo: null, faltam: null, fracao: null };

  const alvo = nivel === 'basic' ? limiares.prime : limiares.elite;
  if (alvo === null) return { nivel, proximo: null, faltam: null, fracao: null };

  const piso = nivel === 'basic' ? 0 : (limiares.prime ?? 0);
  const proximo: FlyPointsLevel = nivel === 'basic' ? 'prime' : 'elite';
  const faixa = alvo - piso;

  return {
    nivel,
    proximo,
    faltam: Math.max(0, alvo - saldo),
    // Faixa degenerada (limiares iguais ou invertidos) nao vira divisao por
    // zero nem barra maior que a trilha.
    fracao: faixa > 0 ? Math.max(0, Math.min(1, (saldo - piso) / faixa)) : 1,
  };
}

/** Rotulo de exibicao. `elite` aparece em caixa alta: e o topo. */
export const ROTULO_NIVEL: Record<FlyPointsLevel, string> = {
  basic: 'basic',
  prime: 'prime',
  elite: 'ELITE',
};

export { FLY_POINTS_LEVELS };
export type { FlyPointsLevel };
