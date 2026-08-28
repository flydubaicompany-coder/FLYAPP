import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * O dia de hoje na viagem ativa: alertas e linha do tempo.
 *
 * A §5.4 pede as duas coisas no topo da Home durante a viagem, e ate
 * 28/08/2026 as duas eram `PhaseStub`. Os dados existem desde a Fase 4 — o que
 * faltava era a Home ler.
 *
 * Alerta aqui e **atividade alterada que a pessoa ainda nao confirmou**, que e
 * o unico alerta que o schema sabe produzir hoje. Nada e inventado: sem
 * alteracao pendente, o bloco some.
 */

export interface ItemDoDia {
  id: string;
  titulo: string;
  status: string;
  comecaEm: string | null;
  pontoDeEncontro: string | null;
  alteradaEm: string | null;
  notaDaAlteracao: string | null;
}

export type HojeData =
  | { kind: 'loading' }
  | { kind: 'ready'; itens: ItemDoDia[]; alertas: ItemDoDia[] }
  | { kind: 'error'; message: string };

export function useHoje(tripId: string | null): HojeData {
  const [data, setData] = useState<HojeData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId) return setData({ kind: 'ready', itens: [], alertas: [] });

    const hoje = new Date().toISOString().slice(0, 10);

    const { data: dias, error } = await supabase()
      .from('trip_days')
      .select(
        'day_date, activities(id, title, status, starts_at, meeting_point, changed_at, change_note, sort_order)',
      )
      .eq('trip_id', tripId)
      .eq('day_date', hoje);

    if (error) return setData({ kind: 'error', message: error.message });

    interface AtividadeCrua {
      id: string;
      title: string;
      status: string;
      starts_at: string | null;
      meeting_point: string | null;
      changed_at: string | null;
      change_note: string | null;
    }

    const brutos = (dias ?? []).flatMap(
      (d: { activities?: AtividadeCrua[] | null }) => d.activities ?? [],
    );
    const itens: ItemDoDia[] = brutos
      .map((a) => ({
        id: a.id,
        titulo: a.title,
        status: a.status,
        comecaEm: a.starts_at,
        pontoDeEncontro: a.meeting_point,
        alteradaEm: a.changed_at,
        notaDaAlteracao: a.change_note,
      }))
      .sort((x, y) => (x.comecaEm ?? '').localeCompare(y.comecaEm ?? ''));

    setData({
      kind: 'ready',
      itens,
      alertas: itens.filter((i) => i.alteradaEm !== null),
    });
  }, [tripId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
