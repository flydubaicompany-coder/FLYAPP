import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';

/**
 * O que entra no mapa (§12.1).
 *
 * Quatro camadas, e cada uma vem de onde já mora: **Bases Fly**
 * (`fly_bases`), **lugares** publicados pela operação (`map_places`:
 * atrações, parceiros, clínicas, hospitais, farmácias) e o **roteiro de
 * hoje** (as atividades do dia atual da viagem).
 *
 * Não há camada de Fly Quest: o Fly Quest inteiro é a Fase 9 (§44). Uma
 * camada vazia prometeria uma função que ainda não existe.
 *
 * Não há posição de funcionário, aqui nem em lugar nenhum (D179).
 */

export type TipoDeLugar = 'attraction' | 'partner' | 'clinic' | 'hospital' | 'pharmacy';

export interface Lugar {
  id: string;
  tipo: TipoDeLugar;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  horario: string | null;
  observacao: string | null;
  latitude: number;
  longitude: number;
}

export interface Base {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  horario: string | null;
  servicos: string[];
  /**
   * O recado do dia da base. É por aqui que a §12.2 pede "fila ou
   * disponibilidade": texto que a operação escreve, e não um contador que o
   * sistema inventaria.
   */
  observacao: string | null;
  aberta: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface ParadaDoDia {
  id: string;
  titulo: string;
  comecaEm: string | null;
  ponto: string | null;
  /** Link de mapa que a operação escreveu na atividade. */
  mapa: string | null;
}

export interface Mapa {
  bases: Base[];
  lugares: Lugar[];
  hoje: ParadaDoDia[];
}

export type MapaData =
  | { kind: 'loading' }
  | { kind: 'ready'; mapa: Mapa }
  /** Sem rede. O mapa não fica em cache — o que se disca fica, na tela de ajuda. */
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export function useMapa(tripId: string | null, diaAtual: number | null) {
  const [data, setData] = useState<MapaData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    const db = supabase();

    const consultas = [
      db
        .from('fly_bases')
        .select(
          'id, name, address, phone, hours_note, services, notes, is_open, latitude, longitude',
        )
        .eq('is_active', true)
        .order('sort_order'),
      db
        .from('map_places')
        .select('id, kind, name, address, phone, hours_note, notes, latitude, longitude')
        .eq('is_active', true)
        .order('sort_order'),
    ] as const;

    // Sem rede o `fetch` lança; com rede e recusa, o PostgREST devolve
    // `error`. A tela diz coisas diferentes para cada um.
    let basesRes, lugaresRes;
    try {
      [basesRes, lugaresRes] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    const falha = basesRes.error ?? lugaresRes.error;
    if (falha) {
      if (ehFalhaDeRede(falha)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: falha.message });
    }

    // O roteiro de hoje só existe durante a viagem. Fora dela, a camada some
    // em vez de mostrar o dia 1 de uma viagem que ainda não começou.
    let hoje: ParadaDoDia[] = [];
    if (tripId && diaAtual !== null) {
      const { data: dia } = await db
        .from('trip_days')
        .select(
          'id, activities(id, title, starts_at, meeting_point, meeting_map_url, sort_order, status)',
        )
        .eq('trip_id', tripId)
        .eq('day_number', diaAtual)
        .maybeSingle();

      hoje = [...(dia?.activities ?? [])]
        .filter((a) => a.status !== 'cancelled')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((a) => ({
          id: a.id,
          titulo: a.title,
          comecaEm: a.starts_at,
          ponto: a.meeting_point,
          mapa: a.meeting_map_url,
        }));
    }

    setData({
      kind: 'ready',
      mapa: {
        bases: (basesRes.data ?? []).map((b) => ({
          id: b.id,
          nome: b.name,
          endereco: b.address,
          telefone: b.phone,
          horario: b.hours_note,
          servicos: b.services ?? [],
          observacao: b.notes,
          aberta: b.is_open,
          latitude: b.latitude,
          longitude: b.longitude,
        })),
        // A constraint do banco garante coordenada em lugar publicado; o
        // filtro aqui é o que ensina isso ao TypeScript.
        lugares: (lugaresRes.data ?? [])
          .filter(
            (l): l is typeof l & { latitude: number; longitude: number } =>
              l.latitude !== null && l.longitude !== null,
          )
          .map((l) => ({
            id: l.id,
            tipo: l.kind as TipoDeLugar,
            nome: l.name,
            endereco: l.address,
            telefone: l.phone,
            horario: l.hours_note,
            observacao: l.notes,
            latitude: l.latitude,
            longitude: l.longitude,
          })),
        hoje,
      },
    });
  }, [tripId, diaAtual]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { data, recarregar: carregar };
}
