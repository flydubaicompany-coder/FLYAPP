import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { LIMIARES_DESCONHECIDOS, type Limiares } from './nivel';

/**
 * Dados da Carteira (§8).
 *
 * Tres consultas, tres dominios separados, como a §41 exige: saldo de pontos,
 * pacote adquirido e configuracao. Nao ha consulta de saldo financeiro porque
 * nao ha saldo financeiro — ver D126.
 *
 * O saldo vem da view `points_balance`, que soma o ledger. Nao ha coluna de
 * saldo em lugar nenhum, de proposito: saldo guardado diverge do extrato.
 */

export type TipoDeLancamento = 'earn' | 'redeem' | 'expire' | 'adjust' | 'reverse';

export interface Lancamento {
  id: string;
  tipo: TipoDeLancamento;
  pontos: number;
  origem: string;
  referencia: string | null;
  quando: string;
  venceEm: string | null;
  motivo: string | null;
}

export interface Carteira {
  saldo: number;
  /** Pacote adquirido. `null` = a Fly ainda nao registrou. */
  pacote: string | null;
  limiares: Limiares;
  /** Meses ate um ganho vencer. `null` = nunca vence. */
  validadeMeses: number | null;
  /** Saldo financeiro e Fly Card. Falso ate haver parceiro (P09/P38). */
  financeiroLigado: boolean;
  lancamentos: Lancamento[];
}

export type CarteiraData =
  { kind: 'loading' } | { kind: 'ready'; carteira: Carteira } | { kind: 'error'; message: string };

/** Le um numero de `app_config`, aceitando nulo como "ainda nao decidido". */
function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function useCarteira(userId: string | null): CarteiraData {
  const [data, setData] = useState<CarteiraData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [saldoRes, pacoteRes, configRes, extratoRes] = await Promise.all([
      db.from('points_balance').select('balance').eq('user_id', userId).maybeSingle(),
      db.from('customer_packages').select('package').eq('user_id', userId).maybeSingle(),
      db
        .from('app_config')
        .select('key, value')
        .in('key', [
          'points.level_thresholds',
          'points.validity_months',
          'wallet.financial_balance_enabled',
        ]),
      db
        .from('points_ledger')
        .select('id, kind, amount, source, reference, occurred_at, expires_on, reason')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(20),
    ]);

    // O extrato e o saldo sao o coracao da tela: se qualquer um falhar, a tela
    // erra em vez de mostrar zero, que seria mentira tranquilizadora.
    if (saldoRes.error) return setData({ kind: 'error', message: saldoRes.error.message });
    if (extratoRes.error) return setData({ kind: 'error', message: extratoRes.error.message });

    const config = new Map((configRes.data ?? []).map((c) => [c.key, c.value]));
    const limiaresCrus = config.get('points.level_thresholds') as Record<string, unknown> | null;

    setData({
      kind: 'ready',
      carteira: {
        // Sem linha na view o cliente ainda nao tem lancamento: saldo zero e
        // verdade, nao ausencia de dado.
        saldo: saldoRes.data?.balance ?? 0,
        pacote: pacoteRes.data?.package ?? null,
        limiares: limiaresCrus
          ? {
              prime: numeroOuNulo(limiaresCrus['prime']),
              elite: numeroOuNulo(limiaresCrus['elite']),
            }
          : LIMIARES_DESCONHECIDOS,
        validadeMeses: numeroOuNulo(config.get('points.validity_months')),
        financeiroLigado: config.get('wallet.financial_balance_enabled') === true,
        lancamentos: (extratoRes.data ?? []).map((l) => ({
          id: l.id,
          tipo: l.kind as TipoDeLancamento,
          pontos: l.amount,
          origem: l.source,
          referencia: l.reference,
          quando: l.occurred_at,
          venceEm: l.expires_on,
          motivo: l.reason,
        })),
      },
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
