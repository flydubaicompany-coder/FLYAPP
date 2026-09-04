import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';

/**
 * A galeria da viagem (§13.5).
 *
 * O que esta tela **não** decide é o que aparece. Quem decide é a RLS de
 * `trip_media`, que exige três coisas ao mesmo tempo: a mídia estar liberada
 * pela equipe, a pessoa estar na viagem, e **ninguém marcado na foto ter
 * revogado o uso da própria imagem**. Filtrar aqui seria uma segunda regra —
 * e a segunda regra é a que fica desatualizada.
 *
 * A URL do arquivo é assinada na hora, e a mesma conferência acontece de novo
 * no Storage. Uma URL guardada de antes da revogação deixa de abrir quando
 * vence.
 */

export interface Foto {
  id: string;
  caminho: string;
  legenda: string | null;
  credito: string | null;
  tipo: 'photo' | 'video';
  diaId: string | null;
  url: string | null;
  euApareco: boolean;
}

export type GaleriaData =
  | { kind: 'loading' }
  | { kind: 'ready'; fotos: Foto[]; autorizaImagem: boolean | null }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export function useGaleria(tripId: string | null, userId: string | null) {
  const [data, setData] = useState<GaleriaData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId || !userId) return setData({ kind: 'ready', fotos: [], autorizaImagem: null });
    const db = supabase();

    const consultas = [
      db
        .from('trip_media')
        .select('id, storage_path, caption, credit, kind, trip_day_id')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(200),
      db.from('media_tags').select('media_id').eq('user_id', userId),
      db
        .from('current_consents')
        .select('purpose_key, granted')
        .eq('user_id', userId)
        .eq('purpose_key', 'image_use')
        .maybeSingle(),
    ] as const;

    let midiaRes, marcacoesRes, consentRes;
    try {
      [midiaRes, marcacoesRes, consentRes] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    if (midiaRes.error) {
      if (ehFalhaDeRede(midiaRes.error)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: midiaRes.error.message });
    }

    const linhas = midiaRes.data ?? [];
    const marcado = new Set((marcacoesRes.data ?? []).map((m) => m.media_id));

    // Uma assinatura por lote. Assinar uma a uma custaria uma ida ao servidor
    // por foto, e a galeria é a tela com mais itens do app.
    const caminhos = linhas.map((m) => m.storage_path);
    const assinadas = new Map<string, string>();
    if (caminhos.length > 0) {
      const { data: urls } = await db.storage.from('galeria').createSignedUrls(caminhos, 60 * 30);
      for (const u of urls ?? []) {
        if (u.path && u.signedUrl) assinadas.set(u.path, u.signedUrl);
      }
    }

    setData({
      kind: 'ready',
      autorizaImagem: consentRes.data?.granted ?? null,
      fotos: linhas.map((m) => ({
        id: m.id,
        caminho: m.storage_path,
        legenda: m.caption,
        credito: m.credit,
        tipo: m.kind as 'photo' | 'video',
        diaId: m.trip_day_id,
        url: assinadas.get(m.storage_path) ?? null,
        euApareco: marcado.has(m.id),
      })),
    });
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { data, recarregar: carregar };
}
