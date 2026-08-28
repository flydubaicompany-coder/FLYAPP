import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * Os dias da viagem e as atividades de cada um.
 *
 * A tela Minha Viagem passou a mostrar o roteiro direto, como o handoff manda,
 * em vez de so um hub de atalhos. A consulta e a mesma que `viagem/roteiro`
 * ja fazia — o que muda e quem a usa.
 */

export interface AtividadeDoDia {
  id: string;
  titulo: string;
  status: string;
  comecaEm: string | null;
  local: string | null;
  alteradaEm: string | null;
}

export interface DiaDaViagem {
  id: string;
  numero: number;
  data: string;
  titulo: string | null;
  atividades: AtividadeDoDia[];
}

export type DiasData =
  { kind: 'loading' } | { kind: 'ready'; dias: DiaDaViagem[] } | { kind: 'error'; message: string };

interface AtividadeCrua {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  meeting_point: string | null;
  changed_at: string | null;
  sort_order: number;
}

export function useDias(tripId: string | null): DiasData {
  const [data, setData] = useState<DiasData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId) return setData({ kind: 'ready', dias: [] });

    const { data: linhas, error } = await supabase()
      .from('trip_days')
      .select(
        'id, day_number, day_date, title, activities(id, title, status, starts_at, meeting_point, changed_at, sort_order)',
      )
      .eq('trip_id', tripId)
      .order('day_number');

    if (error) return setData({ kind: 'error', message: error.message });

    const dias: DiaDaViagem[] = (linhas ?? []).map(
      (d: {
        id: string;
        day_number: number;
        day_date: string;
        title: string | null;
        activities?: AtividadeCrua[] | null;
      }) => ({
        id: d.id,
        numero: d.day_number,
        data: d.day_date,
        titulo: d.title,
        atividades: [...(d.activities ?? [])]
          .sort(
            (a, b) =>
              (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || a.sort_order - b.sort_order,
          )
          .map((a) => ({
            id: a.id,
            titulo: a.title,
            status: a.status,
            comecaEm: a.starts_at,
            local: a.meeting_point,
            alteradaEm: a.changed_at,
          })),
      }),
    );

    setData({ kind: 'ready', dias });
  }, [tripId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
