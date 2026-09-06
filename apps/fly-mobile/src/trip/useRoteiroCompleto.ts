import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * O roteiro inteiro, com os campos que a tela do desenho mostra.
 *
 * `useDias` já traz dia e atividade, e não serve aqui: falta `what_to_bring`
 * (a nota dourada), `image_path` (a foto de 104px) e o pedido que vira
 * voucher. Estender o hook compartilhado carregaria esses campos também nas
 * telas que não os usam — e a Minha Viagem é a tela que mais gente abre num
 * 4G de deserto.
 */

export interface AtividadeDoRoteiro {
  id: string;
  titulo: string;
  subtitulo: string | null;
  comecaEm: string | null;
  saidaEm: string | null;
  local: string | null;
  nota: string | null;
  imagem: string | null;
  status: string;
  mapa: string | null;
}

export interface DiaDoRoteiro {
  id: string;
  numero: number;
  data: string;
  titulo: string | null;
  atividades: AtividadeDoRoteiro[];
}

export type RoteiroCompleto =
  | { kind: 'loading' }
  | { kind: 'ready'; dias: DiaDoRoteiro[] }
  | { kind: 'error'; message: string };

interface Crua {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string | null;
  departure_at: string | null;
  meeting_point: string | null;
  meeting_map_url: string | null;
  what_to_bring: string | null;
  image_path: string | null;
  sort_order: number;
}

export function useRoteiroCompleto(tripId: string | null): RoteiroCompleto {
  const [data, setData] = useState<RoteiroCompleto>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId) return setData({ kind: 'ready', dias: [] });

    const { data: linhas, error } = await supabase()
      .from('trip_days')
      .select(
        'id, day_number, day_date, title, activities(id, title, description, status, starts_at, departure_at, meeting_point, meeting_map_url, what_to_bring, image_path, sort_order)',
      )
      .eq('trip_id', tripId)
      .order('day_number');

    if (error) return setData({ kind: 'error', message: error.message });

    setData({
      kind: 'ready',
      dias: (linhas ?? []).map(
        (d: {
          id: string;
          day_number: number;
          day_date: string;
          title: string | null;
          activities?: Crua[] | null;
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
              subtitulo: a.description,
              comecaEm: a.starts_at,
              saidaEm: a.departure_at,
              local: a.meeting_point,
              nota: a.what_to_bring,
              imagem: a.image_path,
              status: a.status,
              mapa: a.meeting_map_url,
            })),
        }),
      ),
    });
  }, [tripId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
