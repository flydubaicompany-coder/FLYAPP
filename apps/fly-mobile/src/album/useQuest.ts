import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';

/**
 * Fly Quest (§14.1).
 *
 * Nome proprio da Fly. A §14.1 e explicita: "Nao usar nome, personagens ou
 * identidade Pokemon."
 *
 * **A prova aceita hoje e o codigo.** A §14.1 lista geofence, foto e enigma —
 * geofence ela mesma condiciona a "quando confiavel", e nao ha provedor de
 * mapa (P16). Aceitar posicao do aparelho como prova de presenca e o furo
 * classico desse tipo de jogo, e a §14.2 pede o contrario: "validacao no
 * servidor", "sinais de localizacao falsa".
 */

export interface Missao {
  id: string;
  codigo: string;
  titulo: string;
  briefing: string | null;
  pontos: number;
  temFigurinha: boolean;
  comecaEm: string | null;
  terminaEm: string | null;
  concluidaEm: string | null;
}

export type QuestData =
  | { kind: 'loading' }
  | { kind: 'ready'; missoes: Missao[] }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export function useQuest(userId: string | null) {
  const [data, setData] = useState<QuestData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'ready', missoes: [] });
    const db = supabase();

    const consultas = [
      db
        .from('quest_missions')
        .select('id, code, title, briefing, points_reward, sticker_id, starts_at, ends_at')
        .eq('is_published', true)
        .order('sort_order'),
      db.from('quest_completions').select('mission_id, completed_at').eq('user_id', userId),
    ] as const;

    let missoesRes, feitasRes;
    try {
      [missoesRes, feitasRes] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    const falha = missoesRes.error ?? feitasRes.error;
    if (falha) {
      if (ehFalhaDeRede(falha)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: falha.message });
    }

    const feitaEm = new Map((feitasRes.data ?? []).map((f) => [f.mission_id, f.completed_at]));
    const agora = Date.now();

    setData({
      kind: 'ready',
      missoes: (missoesRes.data ?? [])
        // Missao fora da janela nao aparece: uma lista de missoes que nao
        // valem hoje transforma o jogo numa lista de decepcoes.
        .filter(
          (m) =>
            (m.starts_at === null || new Date(m.starts_at).getTime() <= agora) &&
            (m.ends_at === null || new Date(m.ends_at).getTime() > agora),
        )
        .map((m) => ({
          id: m.id,
          codigo: m.code,
          titulo: m.title,
          briefing: m.briefing,
          pontos: m.points_reward,
          temFigurinha: m.sticker_id !== null,
          comecaEm: m.starts_at,
          terminaEm: m.ends_at,
          concluidaEm: feitaEm.get(m.id) ?? null,
        })),
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { data, recarregar: carregar };
}
