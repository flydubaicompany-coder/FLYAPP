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

export interface Voucher {
  id: string;
  codigo: string;
  rotulo: string;
  /** "20% de desconto" ou "AED 150 de desconto". */
  desconto: string;
  valeAte: string | null;
}

/**
 * Uma linha do extrato.
 *
 * O canvas mistura os dois dominios numa lista so — "− R$ 1.240" ao lado de
 * "+ 2.480 pts" — e esta e a leitura certa: o cliente quer ver **o que
 * aconteceu**, em ordem, e nao dois extratos que ele precisa cruzar de cabeca.
 *
 * O que **nao** se mistura e a conta: dinheiro e pontos continuam em ledgers
 * separados, com saldos separados. A juncao acontece so na hora de exibir.
 */
export interface Movimento {
  id: string;
  quando: string;
  titulo: string;
  detalhe: string;
  /** `pontos` ou `dinheiro`. Decide o sufixo e a cor. */
  dominio: 'pontos' | 'dinheiro';
  /** Pontos, ou centavos. Assinado. */
  valor: number;
  moeda: string | null;
  origem: string;
  /** Estorno e vencimento aparecem apagados. */
  apagado: boolean;
}

export interface Carteira {
  saldo: number;
  /** Pacote adquirido. `null` = a Fly ainda nao registrou. */
  pacote: string | null;
  limiares: Limiares;
  /** Meses ate um ganho vencer. `null` = nunca vence. */
  validadeMeses: number | null;
  /** Saldo financeiro em centavos, do ledger `wallet_entries`. */
  saldoCentavos: number;
  moeda: string;
  /** Recarga e transferencia pelo cliente. Exigem PSP (P09/P38). */
  recargaLigada: boolean;
  lancamentos: Lancamento[];
  /** Vouchers ainda nao usados. Usado some da Carteira. */
  vouchers: Voucher[];
  /** Extrato unico, dinheiro e pontos em ordem cronologica. */
  movimentos: Movimento[];
}

export type CarteiraData =
  { kind: 'loading' } | { kind: 'ready'; carteira: Carteira } | { kind: 'error'; message: string };

/**
 * O desconto em uma linha.
 *
 * A tabela garante que e **ou** percentual **ou** valor fixo, nunca os dois —
 * cupom que e as duas coisas vira reclamacao. Aqui isso vira texto.
 */
function descrever(
  percentual: number | null,
  centavos: number | null,
  moeda: string | null,
): string {
  if (percentual !== null) return `${percentual}% de desconto`;
  if (centavos !== null && moeda) {
    const v = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(centavos / 100);
    return `${moeda} ${v} de desconto`;
  }
  return 'desconto';
}

const TITULO_PONTOS: Record<string, string> = {
  order: 'Experiência comprada',
  event: 'Check-in em evento Fly',
  referral: 'Indicação',
  checkin: 'Check-in',
  challenge: 'Desafio',
  ops: 'Ajuste da Fly',
  benefit: 'Resgate de benefício',
  system: 'Pontos vencidos',
};

function tituloDePontos(kind: string, source: string): string {
  if (kind === 'earn') return TITULO_PONTOS[source] ?? 'Pontos creditados';
  if (kind === 'redeem') return 'Resgate de benefício';
  if (kind === 'expire') return 'Pontos vencidos';
  if (kind === 'reverse') return 'Estorno de pontos';
  return 'Ajuste da Fly';
}

const TITULO_DINHEIRO: Record<string, string> = {
  credit: 'Crédito da Fly',
  topup: 'Recarga da carteira',
  debit: 'Pago com a carteira',
  refund: 'Reembolso em crédito',
  adjust: 'Ajuste da Fly',
  reverse: 'Estorno',
};

function tituloDeDinheiro(kind: string): string {
  return TITULO_DINHEIRO[kind] ?? 'Movimentação';
}

/** Le um numero de `app_config`, aceitando nulo como "ainda nao decidido". */
function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export interface CarteiraHook {
  data: CarteiraData;
  /** Chame depois de qualquer coisa que mexa no saldo — um resgate, por exemplo. */
  recarregar: () => Promise<void>;
}

/**
 * **Devolve uma funcao de recarga, e nao aceita uma chave.**
 *
 * A primeira versao recebia um `chaveDeRecarga` que entrava na lista de
 * dependencias do `useCallback`. Nao funcionou, e o motivo vale registrar:
 * este app roda com o **React Compiler ligado** (`app.json`, experiments), e
 * ele memoiza pelo que a funcao **de fato le no corpo** — nao pela lista de
 * dependencias declarada. Como `chaveDeRecarga` nunca era lida dentro de
 * `carregar`, o compilador considerou a funcao estavel e ela nunca era
 * recriada. O saldo ficava parado depois de um resgate, sem nenhuma consulta
 * saindo do navegador.
 */
export function useCarteira(userId: string | null): CarteiraHook {
  const [data, setData] = useState<CarteiraData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [saldoRes, pacoteRes, configRes, extratoRes, vouchersRes, carteiraRes, dinheiroRes] =
      await Promise.all([
        db.from('points_balance').select('balance').eq('user_id', userId).maybeSingle(),
        db.from('customer_packages').select('package').eq('user_id', userId).maybeSingle(),
        db
          .from('app_config')
          .select('key, value')
          .in('key', ['points.level_thresholds', 'points.validity_months', 'wallet.topup_enabled']),
        db
          .from('points_ledger')
          .select('id, kind, amount, source, reference, occurred_at, expires_on, reason')
          .eq('user_id', userId)
          .order('occurred_at', { ascending: false })
          .limit(20),
        db
          .from('customer_vouchers')
          .select(
            'id, coupon_code, coupons(label, percent_off, amount_off_cents, currency, valid_until, is_active)',
          )
          .eq('user_id', userId)
          .is('used_at', null)
          .order('granted_at', { ascending: false }),
        db.from('wallet_balance').select('currency, balance_cents').eq('user_id', userId),
        db
          .from('wallet_entries')
          .select('id, kind, amount_cents, currency, source, reference, occurred_at, reason')
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

    // Os dois extratos viram um so, em ordem. As contas continuam separadas:
    // a juncao acontece na exibicao, e nao no saldo.
    const dePontos: Movimento[] = (extratoRes.data ?? []).map((l) => ({
      id: `p:${l.id}`,
      quando: l.occurred_at,
      titulo: tituloDePontos(l.kind, l.source),
      detalhe: l.reason ?? l.reference ?? '',
      dominio: 'pontos' as const,
      valor: l.amount,
      moeda: null,
      origem: l.source,
      apagado: l.kind === 'reverse' || l.kind === 'expire',
    }));

    const deDinheiro: Movimento[] = (dinheiroRes.data ?? []).map((w) => ({
      id: `d:${w.id}`,
      quando: w.occurred_at,
      titulo: tituloDeDinheiro(w.kind),
      detalhe: w.reason ?? w.reference ?? '',
      dominio: 'dinheiro' as const,
      valor: Number(w.amount_cents),
      moeda: w.currency,
      origem: w.source,
      apagado: w.kind === 'reverse',
    }));

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
        // Uma moeda por enquanto: somar moedas exigiria cambio, que a §33
        // proibe inventar. A view ja separa por moeda, entao quando houver
        // uma segunda ela aparece — nao se soma por acidente.
        saldoCentavos: Number(carteiraRes.data?.[0]?.balance_cents ?? 0),
        moeda: carteiraRes.data?.[0]?.currency ?? 'AED',
        recargaLigada: config.get('wallet.topup_enabled') === true,
        vouchers: (vouchersRes.data ?? [])
          .filter((v) => v.coupons?.is_active)
          .map((v) => ({
            id: v.id,
            codigo: v.coupon_code,
            rotulo: v.coupons?.label ?? v.coupon_code,
            desconto: descrever(
              v.coupons?.percent_off ?? null,
              v.coupons?.amount_off_cents ?? null,
              v.coupons?.currency ?? null,
            ),
            valeAte: v.coupons?.valid_until ?? null,
          })),
        movimentos: [...dePontos, ...deDinheiro].sort((a, b) => b.quando.localeCompare(a.quando)),
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

  return { data, recarregar: carregar };
}
