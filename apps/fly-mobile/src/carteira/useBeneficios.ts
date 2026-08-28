import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * Beneficios e resgate (§8 e §41, entrega 4).
 *
 * A elegibilidade e o saldo aparecem aqui para a tela **explicar** por que um
 * beneficio nao pode ser resgatado. Mas quem decide e o banco: a RPC
 * `resgatar_beneficio` refaz todas as conferencias com a linha travada. A §41
 * e explicita que saldo e elegibilidade nunca sao decididos so no cliente.
 */

export interface Beneficio {
  id: string;
  chave: string;
  titulo: string;
  descricao: string | null;
  custo: number;
  /** `null` = ilimitado. `0` = esgotado. */
  estoque: number | null;
  nivelMinimo: string | null;
  pacoteMinimo: string | null;
}

export interface Resgate {
  id: string;
  beneficioId: string;
  titulo: string;
  codigo: string;
  pontos: number;
  quando: string;
}

export type BeneficiosData =
  | { kind: 'loading' }
  | { kind: 'ready'; beneficios: Beneficio[]; resgates: Resgate[] }
  | { kind: 'error'; message: string };

export interface ResultadoDoResgate {
  ok: boolean;
  motivo: string;
  codigo: string | null;
  saldoFinal: number | null;
}

/** Motivos do banco em texto que o cliente entende. */
export const EXPLICACAO: Record<string, string> = {
  'beneficio esgotado': 'Esgotado por enquanto.',
  'beneficio indisponivel': 'Fora do período de validade.',
  'beneficio nao encontrado': 'Este benefício não existe mais.',
  'saldo insuficiente': 'Você ainda não tem pontos suficientes.',
  'nivel nao elegivel': 'Disponível a partir de outro nível de Fly Points.',
  'pacote nao elegivel': 'Disponível para outro pacote Fly.',
};

export function useBeneficios(userId: string | null) {
  const [data, setData] = useState<BeneficiosData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [lista, meus] = await Promise.all([
      db
        .from('benefits')
        .select('id, key, title, description, points_cost, stock, min_level, min_package')
        .eq('is_active', true)
        .order('sort_order'),
      db
        .from('benefit_redemptions')
        .select('id, benefit_id, code, points_spent, redeemed_at, benefits(title)')
        .eq('user_id', userId)
        .order('redeemed_at', { ascending: false })
        .limit(10),
    ]);

    if (lista.error) return setData({ kind: 'error', message: lista.error.message });

    setData({
      kind: 'ready',
      beneficios: (lista.data ?? []).map((b) => ({
        id: b.id,
        chave: b.key,
        titulo: b.title,
        descricao: b.description,
        custo: b.points_cost,
        estoque: b.stock,
        nivelMinimo: b.min_level,
        pacoteMinimo: b.min_package,
      })),
      resgates: (meus.data ?? []).map(
        (r: {
          id: string;
          benefit_id: string;
          code: string;
          points_spent: number;
          redeemed_at: string;
          benefits?: { title: string } | null;
        }) => ({
          id: r.id,
          beneficioId: r.benefit_id,
          titulo: r.benefits?.title ?? 'Benefício',
          codigo: r.code,
          pontos: r.points_spent,
          quando: r.redeemed_at,
        }),
      ),
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Chama a RPC. Quem decide se pode e o banco, nao esta funcao. */
  const resgatar = useCallback(async (beneficioId: string): Promise<ResultadoDoResgate> => {
    const { data: linhas, error } = await supabase().rpc('resgatar_beneficio', {
      p_benefit: beneficioId,
    });

    if (error) return { ok: false, motivo: error.message, codigo: null, saldoFinal: null };

    const r = Array.isArray(linhas) ? linhas[0] : linhas;
    if (!r) return { ok: false, motivo: 'sem resposta', codigo: null, saldoFinal: null };

    return {
      ok: r.ok ?? false,
      motivo: r.motivo ?? '',
      codigo: r.codigo ?? null,
      saldoFinal: r.saldo_final ?? null,
    };
  }, []);

  return { data, resgatar, recarregar: carregar };
}
