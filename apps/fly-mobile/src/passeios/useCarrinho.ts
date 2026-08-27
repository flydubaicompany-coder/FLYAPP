import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { reservaExpirou, somar, totalDaLinha, type Dinheiro, type Moeda } from './dinheiro';

/**
 * Carrinho (§6.5).
 *
 * Persistente entre sessões: mora no banco, não no aparelho. O cliente que
 * escolheu no celular e finaliza no computador encontra o que escolheu.
 *
 * O item **não some** quando a reserva expira — some a reserva. A diferença
 * importa: apagar o item faria a pessoa perder a escolha por ter demorado a
 * decidir; manter sem reserva a obriga apenas a conferir se ainda há vaga.
 */

export interface ItemDoCarrinho {
  id: string;
  slotId: string;
  variantId: string;
  pessoas: number;
  expiraEm: string;
  reservaVencida: boolean;
  passeioSlug: string;
  passeioTitulo: string;
  varianteRotulo: string;
  cobrePessoas: number;
  comeca: string | null;
  timezone: string;
  precoUnitario: Dinheiro;
  /** Preço que estava valendo quando entrou. Serve para avisar se mudou. */
  precoQuandoEntrou: Dinheiro;
  linha: Dinheiro;
}

export type EstadoCarrinho =
  | { kind: 'loading' }
  | { kind: 'vazio' }
  | {
      kind: 'ready';
      itens: ItemDoCarrinho[];
      total: Dinheiro | null;
      /** Quando o carrinho mistura moedas, não há total — e não se converte. */
      moedasMisturadas: Moeda[] | null;
      algumPrecoMudou: boolean;
      algumaReservaVenceu: boolean;
    }
  | { kind: 'error'; message: string };

export function useCarrinho() {
  const { state: sessao } = useSession();
  const [estado, setEstado] = useState<EstadoCarrinho>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (sessao.kind !== 'signedIn') return setEstado({ kind: 'vazio' });

    const { data, error } = await supabase()
      .from('cart_items')
      // Uma string só, sem concatenar: o PostgREST tipa a partir do literal,
      // e `'a' + 'b'` vira `string` — a inferência morre e tudo volta como
      // `GenericStringError`.
      .select(
        'id, slot_id, variant_id, people, hold_expires_at, price_cents_snapshot, currency_snapshot, tour_slots(starts_at, timezone), tour_variants(label, price_cents, currency, covers_people, tours(slug, title))',
      )
      .order('created_at');

    if (error) return setEstado({ kind: 'error', message: error.message });
    if (!data || data.length === 0) return setEstado({ kind: 'vazio' });

    const itens: ItemDoCarrinho[] = data.map((i) => {
      const variante = i.tour_variants;
      const preco: Dinheiro = {
        centavos: variante?.price_cents ?? i.price_cents_snapshot,
        moeda: (variante?.currency ?? i.currency_snapshot) as Moeda,
      };
      const cobre = variante?.covers_people ?? 1;

      return {
        id: i.id,
        slotId: i.slot_id,
        variantId: i.variant_id,
        pessoas: i.people,
        expiraEm: i.hold_expires_at,
        reservaVencida: reservaExpirou(i.hold_expires_at),
        passeioSlug: variante?.tours?.slug ?? '',
        passeioTitulo: variante?.tours?.title ?? '—',
        varianteRotulo: variante?.label ?? '—',
        cobrePessoas: cobre,
        comeca: i.tour_slots?.starts_at ?? null,
        timezone: i.tour_slots?.timezone ?? 'UTC',
        precoUnitario: preco,
        precoQuandoEntrou: {
          centavos: i.price_cents_snapshot,
          moeda: i.currency_snapshot as Moeda,
        },
        linha: totalDaLinha(preco, i.people, cobre),
      };
    });

    const soma = somar(itens.map((i) => i.linha));

    setEstado({
      kind: 'ready',
      itens,
      total: soma.ok ? soma.total : null,
      moedasMisturadas: soma.ok ? null : soma.moedas,
      // O preço mudou desde que entrou no carrinho. A tela avisa em vez de
      // cobrar diferente em silêncio.
      algumPrecoMudou: itens.some((i) => i.precoUnitario.centavos !== i.precoQuandoEntrou.centavos),
      algumaReservaVenceu: itens.some((i) => i.reservaVencida),
    });
  }, [sessao.kind]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const remover = useCallback(
    async (itemId: string) => {
      await supabase().from('cart_items').delete().eq('id', itemId);
      await carregar();
    },
    [carregar],
  );

  return { estado, recarregar: carregar, remover };
}

/** Quantos itens há no carrinho. Alimenta o contador flutuante da §6.5. */
export function useContadorDoCarrinho(): number {
  const { state: sessao } = useSession();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (sessao.kind !== 'signedIn') return setN(0);
    void (async () => {
      const { count } = await supabase()
        .from('cart_items')
        .select('id', { count: 'exact', head: true });
      setN(count ?? 0);
    })();
  }, [sessao.kind]);

  return n;
}

export type ResultadoReserva =
  | { ok: true; expiraEm: string; vagasRestantes: number }
  | { ok: false; motivo: string; vagas: number | null };

/**
 * Põe no carrinho.
 *
 * Passa por RPC, e não por `insert`: é lá que o slot é bloqueado e a
 * disponibilidade conferida. Um `insert` direto veria um estoque que pode ter
 * mudado entre a leitura e a gravação.
 */
export async function reservar(slotId: string, pessoas: number): Promise<ResultadoReserva> {
  const { data, error } = await supabase().rpc('reservar_no_carrinho', {
    p_slot: slotId,
    p_people: pessoas,
  });

  if (error) return { ok: false, motivo: 'Não consegui reservar agora.', vagas: null };

  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) return { ok: false, motivo: 'Sem resposta do servidor.', vagas: null };

  return linha.ok
    ? { ok: true, expiraEm: linha.expira_em as string, vagasRestantes: linha.vagas ?? 0 }
    : {
        ok: false,
        motivo: MOTIVOS[linha.motivo ?? ''] ?? 'Não deu para reservar.',
        vagas: linha.vagas,
      };
}

/**
 * O servidor devolve o motivo em código; a tela mostra o que a pessoa faz com
 * ele. "sem vagas" e "slot já aconteceu" pedem ações diferentes.
 */
const MOTIVOS: Record<string, string> = {
  'sem vagas': 'Este horário esgotou enquanto você escolhia. Veja os outros horários.',
  'slot indisponivel': 'Este horário não está mais disponível.',
  'slot ja aconteceu': 'Este horário já passou.',
  'opcao indisponivel': 'Esta opção saiu do catálogo.',
  'quantidade fora do permitido': 'Este passeio tem um mínimo e um máximo de pessoas.',
  'quantidade invalida': 'Escolha ao menos uma pessoa.',
};
