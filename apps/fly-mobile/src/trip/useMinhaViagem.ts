import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * O que a tela Minha Viagem do Trip Mode mostra, numa consulta só por assunto.
 *
 * Hotel, quarto, voo e as duas contagens (documentos e fotos). São cinco
 * tabelas e nenhuma delas é nova — a tela é montagem, não domínio.
 *
 * O número do quarto vem de `accommodation_guests.room_number`, e só aparece
 * quando `room_released_at` estiver preenchido. A coluna existe desde a Fase 4
 * para que "ainda não sei" seja diferente de "não tem": mostrar um quarto que o
 * hotel ainda não confirmou faz alguém subir com a mala para o andar errado.
 */

export interface HotelDaViagem {
  nome: string;
  endereco: string | null;
  mapa: string | null;
  entrada: string | null;
  saida: string | null;
  quarto: string | null;
  quartoLiberado: boolean;
  reserva: string | null;
}

export interface VooDaViagem {
  id: string;
  companhia: string;
  numero: string;
  origem: string;
  destino: string;
  parte: string;
  chega: string;
}

export interface MinhaViagem {
  hotel: HotelDaViagem | null;
  voo: VooDaViagem | null;
  documentos: { passaporte: boolean; cnh: boolean };
  fotos: number;
}

export type MinhaViagemData =
  { kind: 'loading' } | { kind: 'ready'; dados: MinhaViagem } | { kind: 'error'; message: string };

export function useMinhaViagem(tripId: string | null, userId: string | null): MinhaViagemData {
  const [data, setData] = useState<MinhaViagemData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId || !userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [hospRes, vooRes, docRes, fotoRes] = await Promise.all([
      db
        .from('accommodations')
        .select(
          'id, name, address, map_url, checkin_at, checkout_at, accommodation_guests(room_number, room_released_at)',
        )
        .eq('trip_id', tripId)
        .limit(1),
      db
        .from('flights')
        .select('id, airline, flight_number, origin_iata, destination_iata, departs_at, arrives_at')
        .eq('trip_id', tripId)
        .order('departs_at')
        .limit(1),
      db
        .from('documents')
        .select('kind')
        .eq('owner_id', userId)
        .in('kind', ['passport', 'driver_license']),
      db.from('trip_media').select('id').eq('trip_id', tripId).eq('is_released', true),
    ]);

    if (hospRes.error) return setData({ kind: 'error', message: hospRes.error.message });

    const h = hospRes.data?.[0];
    const hospede = h?.accommodation_guests?.[0];
    const f = vooRes.data?.[0];
    const tipos = new Set((docRes.data ?? []).map((d) => d.kind));

    setData({
      kind: 'ready',
      dados: {
        hotel: h
          ? {
              nome: h.name,
              endereco: h.address,
              mapa: h.map_url,
              entrada: h.checkin_at,
              saida: h.checkout_at,
              quarto: hospede?.room_released_at ? (hospede.room_number ?? null) : null,
              quartoLiberado: Boolean(hospede?.room_released_at),
              // `accommodations` não guarda número de reserva: o voucher é um
              // documento no cofre. Não invento um código aqui.
              reserva: null,
            }
          : null,
        voo: f
          ? {
              id: f.id,
              companhia: f.airline,
              numero: f.flight_number,
              origem: f.origin_iata,
              destino: f.destination_iata,
              parte: f.departs_at,
              chega: f.arrives_at,
            }
          : null,
        documentos: { passaporte: tipos.has('passport'), cnh: tipos.has('driver_license') },
        fotos: (fotoRes.data ?? []).length,
      },
    });
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
