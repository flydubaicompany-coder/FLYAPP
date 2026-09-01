import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * Ranking Fly (§9.3).
 *
 * A tela **nao filtra** quem optou por participar: quem faz isso e a policy de
 * `ranking_scores`. Foi de proposito — uma tela nova que esquecesse o filtro
 * exporia todo mundo, e o criterio da §41 ("usuario fora do ranking nao
 * aparece") nao pode depender de cada consulta lembrar disso.
 *
 * A pontuacao que chega aqui e **normalizada de 0 a 1000**. Nao ha coluna de
 * dinheiro na tabela de origem — a §9.3 proibe expor gasto exato, e a forma
 * mais segura de nunca vazar e nao guardar.
 *
 * O nome vem de `ranking_scores.public_name`, e **nao** de `profiles`. A
 * policy `profiles_select_own` so deixa o cliente ler o proprio cadastro:
 * traduzir ids pela tabela de perfis mostraria "Viajante Fly" em toda linha
 * que nao fosse a dele. O nome autorizado (§9.3) e copiado para a linha do
 * ranking no calculo, e so para quem optou por participar.
 */

export interface Premio {
  id: string;
  /** "1º lugar" ou "1º ao 3º". */
  faixa: string;
  rotulo: string;
}

export interface Periodo {
  id: string;
  rotulo: string;
  dimensao: string;
  comeca: string;
  termina: string;
  /** Como se pontua, em portugues. O banco recusa publicar sem isto. */
  criterio: string | null;
  /** Quando os finalistas foram anunciados. `null` = ainda nao. */
  finalistasEm: string | null;
  premios: Premio[];
}

export interface Colocacao {
  userId: string;
  posicao: number;
  pontuacao: number;
  nome: string;
  /** `true` quando a linha e do proprio cliente. */
  euMesmo: boolean;
}

export type RankingData =
  | { kind: 'loading' }
  | { kind: 'ready'; periodo: Periodo | null; colocacoes: Colocacao[] }
  | { kind: 'error'; message: string };

export function useRanking(userId: string | null): RankingData {
  const [data, setData] = useState<RankingData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    const db = supabase();

    const { data: periodos, error } = await db
      .from('ranking_periods')
      .select('id, label, dimension, starts_on, ends_on, criteria_note, finalists_published_at')
      .eq('is_published', true)
      .order('starts_on', { ascending: false })
      .limit(1);

    if (error) return setData({ kind: 'error', message: error.message });

    const p = (periodos ?? [])[0];
    if (!p) return setData({ kind: 'ready', periodo: null, colocacoes: [] });

    const { data: premios } = await db
      .from('ranking_prizes')
      .select('id, position_from, position_to, label')
      .eq('period_id', p.id)
      .order('sort_order');

    const { data: scores } = await db
      .from('ranking_scores')
      .select('user_id, public_score, position, public_name')
      .eq('period_id', p.id)
      .order('position')
      .limit(50);

    setData({
      kind: 'ready',
      periodo: {
        id: p.id,
        rotulo: p.label,
        dimensao: p.dimension,
        comeca: p.starts_on,
        termina: p.ends_on,
        criterio: p.criteria_note,
        finalistasEm: p.finalists_published_at,
        premios: (premios ?? []).map((x) => ({
          id: x.id,
          faixa:
            x.position_from === x.position_to
              ? `${x.position_from}º lugar`
              : `${x.position_from}º ao ${x.position_to}º`,
          rotulo: x.label,
        })),
      },
      colocacoes: (scores ?? []).map((s) => ({
        userId: s.user_id,
        posicao: s.position,
        pontuacao: s.public_score,
        nome: s.public_name ?? 'Viajante Fly',
        euMesmo: s.user_id === userId,
      })),
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
