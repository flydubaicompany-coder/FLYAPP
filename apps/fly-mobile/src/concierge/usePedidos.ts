import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * Restaurantes e servicos de estilo de vida (§11.2 e §11.3).
 *
 * Os dois tem o mesmo desenho: **catalogo que a Fly cura, pedido que uma
 * pessoa atende**. A §11.3 manda comecar assim e so ativar parceiro quando
 * houver API, contrato e termos — entao nao ha adapter nenhum aqui.
 *
 * **Pedir nao e confirmar.** O estado inicial e "pedido", e so a Fly muda. O
 * app nunca escreve "confirmado" sozinho: o cliente sairia daqui achando que
 * tem mesa, e descobriria na porta.
 */

export type SituacaoDaReserva =
  'requested' | 'confirmed' | 'waitlist' | 'declined' | 'cancelled' | 'seated' | 'no_show';

export const ROTULO_RESERVA: Record<SituacaoDaReserva, string> = {
  requested: 'Pedido enviado',
  confirmed: 'Confirmada',
  waitlist: 'Na espera',
  declined: 'Não foi possível',
  cancelled: 'Cancelada',
  seated: 'Você compareceu',
  no_show: 'Não compareceu',
};

export type SituacaoDoServico = 'requested' | 'in_progress' | 'done' | 'declined' | 'cancelled';

export const ROTULO_SERVICO: Record<SituacaoDoServico, string> = {
  requested: 'Pedido enviado',
  in_progress: 'A Fly está resolvendo',
  done: 'Resolvido',
  declined: 'Não foi possível',
  cancelled: 'Cancelado',
};

export type TipoDeServico =
  'pharmacy' | 'grocery' | 'salon' | 'barber' | 'spa' | 'laundry' | 'essentials' | 'other';

export const NOME_DO_TIPO: Record<TipoDeServico, string> = {
  pharmacy: 'Farmácia',
  grocery: 'Mercado',
  salon: 'Salão',
  barber: 'Barbeiro',
  spa: 'Spa',
  laundry: 'Lavanderia',
  essentials: 'Compras essenciais',
  other: 'Outros',
};

export interface Restaurante {
  id: string;
  nome: string;
  cozinha: string | null;
  bairro: string | null;
  descricao: string | null;
  curado: boolean;
  notaDaFly: string | null;
  exigeDeposito: boolean;
}

export interface Reserva {
  id: string;
  restauranteId: string;
  restaurante: string;
  pessoas: number;
  quando: string;
  ocasiao: string | null;
  situacao: SituacaoDaReserva;
  motivoRecusa: string | null;
}

export interface Servico {
  id: string;
  tipo: TipoDeServico;
  nome: string;
  descricao: string | null;
}

export interface PedidoDeServico {
  id: string;
  servico: string;
  detalhes: string;
  entregarEm: string | null;
  situacao: SituacaoDoServico;
  resposta: string | null;
}

export type ConciergeData =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      restaurantes: Restaurante[];
      reservas: Reserva[];
      servicos: Servico[];
      pedidos: PedidoDeServico[];
      parceirosLigados: boolean;
    }
  | { kind: 'error'; message: string };

export function useConcierge(userId: string | null, tripId: string | null) {
  const [data, setData] = useState<ConciergeData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [rest, res, serv, ped, cfg] = await Promise.all([
      db
        .from('restaurants')
        .select(
          'id, name, cuisine, neighborhood, description, is_curated, fly_note, requires_deposit',
        )
        .eq('is_active', true)
        .order('sort_order'),
      db
        .from('restaurant_reservations')
        .select(
          'id, restaurant_id, party_size, desired_at, occasion, status, decline_reason, restaurants(name)',
        )
        .eq('user_id', userId)
        .order('desired_at', { ascending: false }),
      db
        .from('lifestyle_services')
        .select('id, kind, name, description')
        .eq('is_active', true)
        .order('sort_order'),
      db
        .from('service_requests')
        .select('id, details, deliver_to, status, response_note, lifestyle_services(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      db.from('app_config').select('value').eq('key', 'partners.delivery_enabled').maybeSingle(),
    ]);

    if (rest.error) return setData({ kind: 'error', message: rest.error.message });

    setData({
      kind: 'ready',
      parceirosLigados: cfg.data?.value === true,
      restaurantes: (rest.data ?? []).map((r) => ({
        id: r.id,
        nome: r.name,
        cozinha: r.cuisine,
        bairro: r.neighborhood,
        descricao: r.description,
        curado: r.is_curated,
        notaDaFly: r.fly_note,
        exigeDeposito: r.requires_deposit,
      })),
      reservas: (res.data ?? []).map(
        (r: {
          id: string;
          restaurant_id: string;
          party_size: number;
          desired_at: string;
          occasion: string | null;
          status: string;
          decline_reason: string | null;
          restaurants?: { name: string } | null;
        }) => ({
          id: r.id,
          restauranteId: r.restaurant_id,
          restaurante: r.restaurants?.name ?? 'Restaurante',
          pessoas: r.party_size,
          quando: r.desired_at,
          ocasiao: r.occasion,
          situacao: r.status as SituacaoDaReserva,
          motivoRecusa: r.decline_reason,
        }),
      ),
      servicos: (serv.data ?? []).map((s) => ({
        id: s.id,
        tipo: s.kind as TipoDeServico,
        nome: s.name,
        descricao: s.description,
      })),
      pedidos: (ped.data ?? []).map(
        (p: {
          id: string;
          details: string;
          deliver_to: string | null;
          status: string;
          response_note: string | null;
          lifestyle_services?: { name: string } | null;
        }) => ({
          id: p.id,
          servico: p.lifestyle_services?.name ?? 'Serviço',
          detalhes: p.details,
          entregarEm: p.deliver_to,
          situacao: p.status as SituacaoDoServico,
          resposta: p.response_note,
        }),
      ),
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pedirMesa = useCallback(
    async (restauranteId: string, pessoas: number, quando: string, ocasiao: string) => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };
      const { error } = await supabase()
        .from('restaurant_reservations')
        .insert({
          user_id: userId,
          trip_id: tripId,
          restaurant_id: restauranteId,
          party_size: pessoas,
          desired_at: quando,
          occasion: ocasiao.trim() || null,
        });
      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [userId, tripId, carregar],
  );

  const pedirServico = useCallback(
    async (servicoId: string, detalhes: string, entregarEm: string) => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };
      if (!detalhes.trim()) return { ok: false, motivo: 'Diga o que você precisa.' };
      const { error } = await supabase()
        .from('service_requests')
        .insert({
          user_id: userId,
          trip_id: tripId,
          service_id: servicoId,
          details: detalhes.trim(),
          deliver_to: entregarEm.trim() || null,
        });
      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [userId, tripId, carregar],
  );

  /** Desistir e direito do cliente — e a unica mudanca que ele faz. */
  const cancelarReserva = useCallback(
    async (id: string) => {
      const { error } = await supabase()
        .from('restaurant_reservations')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [carregar],
  );

  return { data, pedirMesa, pedirServico, cancelarReserva, recarregar: carregar };
}
