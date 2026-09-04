import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';
import type { Raridade } from './raridade';

/**
 * O álbum da viagem (§13.1 e §13.2).
 *
 * Uma temporada por viagem, um capítulo por dia. O que a tela **não** faz é
 * decidir o Dia Completo: quem fecha é o gatilho no servidor, como a §13.2
 * exige ("não pode ser inferido apenas pelo aplicativo"). Aqui a conclusão é
 * lida de `chapter_completions`, e o contador de "faltam N" existe para
 * explicar, não para decidir.
 */

export interface Figurinha {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  raridade: Raridade;
  obrigatoria: boolean;
  arte: string | null;
  desbloqueada: boolean;
  conquistadaEm: string | null;
}

export interface Capitulo {
  id: string;
  diaNumero: number;
  data: string;
  titulo: string;
  teaser: string | null;
  recompensa: string | null;
  liberaEm: string | null;
  completoEm: string | null;
  figurinhas: Figurinha[];
}

export type AlbumData =
  | { kind: 'loading' }
  | { kind: 'semViagem' }
  | { kind: 'ready'; capitulos: Capitulo[] }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export interface Resgate {
  ok: boolean;
  motivo: string | null;
  figurinhaNome: string | null;
  missaoTitulo: string | null;
  jaTinha: boolean;
}

export function useAlbum(tripId: string | null, userId: string | null) {
  const [data, setData] = useState<AlbumData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId || !userId) return setData({ kind: 'semViagem' });
    const db = supabase();

    const consultas = [
      db
        .from('album_chapters')
        .select(
          'id, title, teaser, reward_note, release_at, trip_day_id, stickers(id, code, name, description, rarity, is_required, image_path, sort_order, is_published)',
        )
        .eq('trip_id', tripId)
        .eq('is_published', true)
        .order('sort_order'),
      db.from('sticker_unlocks').select('sticker_id, unlocked_at').eq('user_id', userId),
      db.from('chapter_completions').select('chapter_id, completed_at').eq('user_id', userId),
      db.from('trip_days').select('id, day_number, day_date').eq('trip_id', tripId),
    ] as const;

    let capsRes, unlocksRes, doneRes, diasRes;
    try {
      [capsRes, unlocksRes, doneRes, diasRes] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    const falha = capsRes.error ?? unlocksRes.error ?? doneRes.error;
    if (falha) {
      if (ehFalhaDeRede(falha)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: falha.message });
    }

    const conquistadaEm = new Map(
      (unlocksRes.data ?? []).map((u) => [u.sticker_id, u.unlocked_at]),
    );
    const completoEm = new Map((doneRes.data ?? []).map((c) => [c.chapter_id, c.completed_at]));
    const dia = new Map(
      (diasRes.data ?? []).map((d) => [d.id, { numero: d.day_number, data: d.day_date }]),
    );

    const agora = Date.now();

    setData({
      kind: 'ready',
      capitulos: (capsRes.data ?? [])
        // "horário de liberação" (§13.2): capítulo do dia seguinte não abre
        // antes da hora. Quem filtra é a tela porque o dado é público para
        // quem está na viagem — o que a hora protege é a surpresa, não o dado.
        .filter((c) => c.release_at === null || new Date(c.release_at).getTime() <= agora)
        .map((c) => {
          const d = dia.get(c.trip_day_id);
          return {
            id: c.id,
            diaNumero: d?.numero ?? 0,
            data: d?.data ?? '',
            titulo: c.title,
            teaser: c.teaser,
            recompensa: c.reward_note,
            liberaEm: c.release_at,
            completoEm: completoEm.get(c.id) ?? null,
            figurinhas: [...(c.stickers ?? [])]
              .filter((s) => s.is_published)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((s) => ({
                id: s.id,
                codigo: s.code,
                nome: s.name,
                descricao: s.description,
                raridade: s.rarity as Raridade,
                obrigatoria: s.is_required,
                arte: s.image_path,
                desbloqueada: conquistadaEm.has(s.id),
                conquistadaEm: conquistadaEm.get(s.id) ?? null,
              })),
          };
        })
        .sort((a, b) => a.diaNumero - b.diaNumero),
    });
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Uma figurinha que abre enquanto a pessoa olha a tela é metade do
   * encantamento — e o desbloqueio costuma vir de fora do app: o guia valida
   * o check-in, e a figurinha aparece.
   */
  useEffect(() => {
    if (!userId) return;
    const db = supabase();
    const canal = db
      .channel('album:conquistas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sticker_unlocks' },
        () => {
          void carregar();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chapter_completions' },
        () => {
          void carregar();
        },
      )
      .subscribe();

    return () => {
      void db.removeChannel(canal);
    };
  }, [userId, carregar]);

  /**
   * O código digitado (§13.1 e §14.1).
   *
   * Digitado, e não lido pela câmera: ler QR no app exigiria `expo-camera`,
   * dependência nativa que este ambiente não consegue compilar nem testar. É
   * a mesma escolha honesta do Scanner do Fly Ops, que recebe o token por
   * campo desde a Fase 4.
   */
  const resgatar = useCallback(
    async (codigo: string): Promise<Resgate> => {
      const limpo = codigo.trim();
      if (limpo === '') {
        return {
          ok: false,
          motivo: 'Digite o código.',
          figurinhaNome: null,
          missaoTitulo: null,
          jaTinha: false,
        };
      }

      const { data: r, error } = await supabase().rpc('resgatar_codigo', { p_token: limpo });
      if (error) {
        return {
          ok: false,
          motivo: ehFalhaDeRede(error)
            ? 'Sem conexão. O código continua valendo — tente de novo quando voltar.'
            : error.message,
          figurinhaNome: null,
          missaoTitulo: null,
          jaTinha: false,
        };
      }

      const linha = Array.isArray(r) ? r[0] : r;
      await carregar();
      return {
        ok: linha?.ok ?? false,
        motivo: linha?.motivo ?? null,
        figurinhaNome: linha?.figurinha_nome ?? null,
        missaoTitulo: linha?.missao_titulo ?? null,
        jaTinha: linha?.ja_tinha ?? false,
      };
    },
    [carregar],
  );

  return { data, resgatar, recarregar: carregar };
}
