import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import type { HomeState } from './composition';

/**
 * Estado da Home, vindo do servidor (§38.2).
 *
 * O app não decide a fase da viagem. Ele pergunta. A conta depende do fuso do
 * destino, e um celular com data errada — ou simplesmente em outro fuso —
 * mostraria a tela errada se calculasse sozinho.
 */

export interface HomeContext {
  state: HomeState;
  tripId: string | null;
  tripName: string | null;
  destinationName: string | null;
  destinationTimezone: string | null;
  startsOn: string | null;
  endsOn: string | null;
  daysUntil: number | null;
  dayNumber: number | null;
  totalDays: number | null;
  daysSince: number | null;
}

export interface HomeEvent {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  city: string | null;
  status: string;
  startsAt: string | null;
  flyBenefit: string | null;
  /** Caminho no bucket publico. `home_events` nao devolve midia; buscamos ao lado. */
  imagem: string | null;
}

export type HomeData =
  | { kind: 'loading' }
  | { kind: 'ready'; context: HomeContext; events: HomeEvent[] }
  | { kind: 'error'; message: string };

export function useHome(): { data: HomeData; reload: () => Promise<void> } {
  const { state: sessao } = useSession();
  const [data, setData] = useState<HomeData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (sessao.kind !== 'signedIn') return;
    const db = supabase();

    const [estado, eventos] = await Promise.all([
      db.rpc('home_state'),
      db.rpc('home_events', { p_limit: 3 }),
    ]);

    if (estado.error) return setData({ kind: 'error', message: estado.error.message });

    // A capa de cada evento vem numa segunda consulta: `home_events` nao
    // devolve midia, e mudar a assinatura dela custaria migration. E o mesmo
    // caminho que a vitrine de passeios ja usa.
    const ids = (eventos.data ?? []).map((e) => e.id);
    const capas = new Map<string, string>();
    if (ids.length > 0) {
      const { data: midias } = await db
        .from('event_media')
        .select('event_id, storage_path, sort_order')
        .in('event_id', ids)
        .eq('kind', 'image')
        .order('sort_order');
      for (const m of midias ?? []) {
        if (!capas.has(m.event_id)) capas.set(m.event_id, m.storage_path);
      }
    }

    const linha = Array.isArray(estado.data) ? estado.data[0] : estado.data;
    if (!linha) return setData({ kind: 'error', message: 'Sem resposta do servidor.' });

    setData({
      kind: 'ready',
      context: {
        state: linha.state as HomeState,
        tripId: linha.trip_id,
        tripName: linha.trip_name,
        destinationName: linha.destination_name,
        destinationTimezone: linha.destination_timezone,
        startsOn: linha.starts_on,
        endsOn: linha.ends_on,
        daysUntil: linha.days_until,
        dayNumber: linha.day_number,
        totalDays: linha.total_days,
        daysSince: linha.days_since,
      },
      events: (eventos.data ?? []).map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        summary: e.summary,
        city: e.city,
        status: e.status,
        startsAt: e.starts_at,
        flyBenefit: e.fly_benefit,
        imagem: capas.get(e.id) ?? null,
      })),
    });
  }, [sessao.kind]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { data, reload: carregar };
}

/** Contagem de notificações não lidas, para o sino. */
export function useUnreadCount(): number {
  const { state } = useSession();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (state.kind !== 'signedIn') return;
    void supabase()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .then(({ count }) => setTotal(count ?? 0));
  }, [state.kind]);

  return total;
}
