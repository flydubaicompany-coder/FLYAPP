import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';
import { chaveDoItem, montarMala, type ItemDaMala, type Marcacao } from './mala';

/**
 * Mala Pronta (§45, entrega 8).
 *
 * A lista não é guardada: ela é derivada do roteiro e da curadoria a cada
 * leitura. O que se guarda é o que a pessoa fez — marcou, ou acrescentou.
 *
 * Guardar uma cópia da lista criaria a divergência clássica: a operação muda
 * o que levar numa atividade, e a mala de quem já abriu a tela continua com o
 * texto velho.
 */

export type MalaData =
  | { kind: 'loading' }
  | { kind: 'semViagem' }
  | { kind: 'ready'; itens: ItemDaMala[] }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export function useMala(tripId: string | null, userId: string | null) {
  const [data, setData] = useState<MalaData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId || !userId) return setData({ kind: 'semViagem' });
    const db = supabase();

    const consultas = [
      db
        .from('trip_days')
        .select('activities(title, what_to_bring, dress_code)')
        .eq('trip_id', tripId),
      db.from('packing_items').select('label').eq('is_active', true).order('sort_order'),
      db
        .from('packing_checks')
        .select('item, marcado, proprio')
        .eq('user_id', userId)
        .eq('trip_id', tripId),
    ] as const;

    let dias, curados, marcacoes;
    try {
      [dias, curados, marcacoes] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    const falha = dias.error ?? marcacoes.error;
    if (falha) {
      if (ehFalhaDeRede(falha)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: falha.message });
    }

    const atividades = (dias.data ?? []).flatMap((d) =>
      (
        (d.activities ?? []) as Array<{
          title: string;
          what_to_bring: string | null;
          dress_code: string | null;
        }>
      ).map((a) => ({
        titulo: a.title,
        oQueLevar: a.what_to_bring,
        trajeSugerido: a.dress_code,
      })),
    );

    setData({
      kind: 'ready',
      itens: montarMala(
        atividades,
        (curados.data ?? []).map((c) => c.label),
        (marcacoes.data ?? []) as Marcacao[],
      ),
    });
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const marcar = useCallback(
    async (item: ItemDaMala, marcado: boolean) => {
      if (!tripId || !userId) return;
      await supabase()
        .from('packing_checks')
        .upsert(
          {
            user_id: userId,
            trip_id: tripId,
            item: item.chave,
            marcado,
            proprio: item.fonte === 'proprio',
          },
          { onConflict: 'user_id,trip_id,item' },
        );
      await carregar();
    },
    [tripId, userId, carregar],
  );

  const acrescentar = useCallback(
    async (rotulo: string) => {
      if (!tripId || !userId) return { ok: false, motivo: 'Sem viagem ativa.' };
      const chave = chaveDoItem(rotulo);
      if (chave === '') return { ok: false, motivo: 'Escreva o item.' };

      const { error } = await supabase()
        .from('packing_checks')
        .upsert(
          { user_id: userId, trip_id: tripId, item: chave, proprio: true, marcado: false },
          { onConflict: 'user_id,trip_id,item' },
        );
      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [tripId, userId, carregar],
  );

  return { data, marcar, acrescentar, recarregar: carregar };
}
