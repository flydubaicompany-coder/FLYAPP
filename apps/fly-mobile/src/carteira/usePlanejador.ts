import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';
import type { CategoriaDeGasto, GastoManual, Lancamento, Moeda, Orcamento } from './planejador';

/**
 * Planejador financeiro (§15.4).
 *
 * Duas consultas separadas de propósito, e nunca um `union`: o oficial vem de
 * `orders` e `wallet_entries`, o manual vem de `manual_expenses`. A §15.4 é
 * literal — "não misturar gasto manual com extrato financeiro oficial" — e
 * misturar começa na consulta, não na tela.
 */

export interface GastoAnotado extends GastoManual {
  id: string;
  nota: string | null;
}

export type PlanejadorData =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      oficiais: Lancamento[];
      manuais: GastoAnotado[];
      orcamento: Orcamento | null;
      /** Notas fiscais registradas. O valor a receber depende da P47. */
      notas: number;
    }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

function dia(iso: string): string {
  return iso.slice(0, 10);
}

export function usePlanejador(userId: string | null, tripId: string | null) {
  const [data, setData] = useState<PlanejadorData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const consultas = [
      db.from('orders').select('total_cents, currency, created_at').eq('user_id', userId),
      db
        .from('wallet_entries')
        .select('amount_cents, currency, occurred_at, kind')
        .eq('user_id', userId),
      db
        .from('manual_expenses')
        .select('id, amount_cents, currency, category, note, spent_on')
        .eq('user_id', userId)
        .order('spent_on', { ascending: false })
        .limit(300),
      db.from('receipts').select('id').eq('user_id', userId),
    ] as const;

    let pedidos, carteira, anotados, notas;
    try {
      [pedidos, carteira, anotados, notas] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    const falha = pedidos.error ?? anotados.error;
    if (falha) {
      if (ehFalhaDeRede(falha)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: falha.message });
    }

    let orcamento: Orcamento | null = null;
    if (tripId) {
      const { data: o } = await db
        .from('trip_budgets')
        .select('daily_limit_cents, currency')
        .eq('user_id', userId)
        .eq('trip_id', tripId)
        .maybeSingle();
      if (o) {
        orcamento = {
          diarioCentavos: Number(o.daily_limit_cents),
          moeda: o.currency as Moeda,
        };
      }
    }

    setData({
      kind: 'ready',
      orcamento,
      notas: (notas.data ?? []).length,
      oficiais: [
        ...(pedidos.data ?? []).map((p) => ({
          centavos: Number(p.total_cents),
          moeda: p.currency as Moeda,
          dia: dia(p.created_at),
        })),
        // Só o que saiu da carteira. Crédito e ajuste não são gasto.
        ...(carteira.data ?? [])
          .filter((w) => w.kind === 'debit')
          .map((w) => ({
            centavos: Math.abs(Number(w.amount_cents)),
            moeda: w.currency as Moeda,
            dia: dia(w.occurred_at),
          })),
      ],
      manuais: (anotados.data ?? []).map((m) => ({
        id: m.id,
        centavos: Number(m.amount_cents),
        moeda: m.currency as Moeda,
        categoria: m.category as CategoriaDeGasto,
        dia: m.spent_on,
        nota: m.note,
      })),
    });
  }, [userId, tripId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const anotar = useCallback(
    async (centavos: number, moeda: Moeda, categoria: CategoriaDeGasto, nota: string) => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };
      if (!Number.isFinite(centavos) || centavos <= 0) {
        return { ok: false, motivo: 'Escreva quanto você gastou.' };
      }
      const { error } = await supabase()
        .from('manual_expenses')
        .insert({
          user_id: userId,
          ...(tripId ? { trip_id: tripId } : {}),
          amount_cents: centavos,
          currency: moeda,
          category: categoria,
          ...(nota.trim() === '' ? {} : { note: nota.trim() }),
        });
      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [userId, tripId, carregar],
  );

  const apagar = useCallback(
    async (id: string) => {
      // Anotação do próprio bolso se apaga, ao contrário de tudo o mais neste
      // projeto: não é registro operacional da Fly, é o caderno da pessoa.
      const { error } = await supabase().from('manual_expenses').delete().eq('id', id);
      if (!error) await carregar();
    },
    [carregar],
  );

  const definirOrcamento = useCallback(
    async (centavos: number, moeda: Moeda) => {
      if (!userId || !tripId) return { ok: false, motivo: 'Sem viagem ativa.' };
      if (!Number.isFinite(centavos) || centavos <= 0) {
        return { ok: false, motivo: 'Escreva o limite diário.' };
      }
      const { error } = await supabase()
        .from('trip_budgets')
        .upsert(
          { user_id: userId, trip_id: tripId, daily_limit_cents: centavos, currency: moeda },
          { onConflict: 'user_id,trip_id' },
        );
      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [userId, tripId, carregar],
  );

  return { data, anotar, apagar, definirOrcamento, recarregar: carregar };
}
