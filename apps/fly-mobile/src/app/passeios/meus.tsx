import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AlertBanner, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/auth/client';
import { LinhaDoPedido, Segmentado } from '@/passeios/LinhaDoPedido';
import type { Moeda } from '@/passeios/dinheiro';

/**
 * Meus Passeios (§6.1).
 *
 * Agrupado como a §6.1 pede: próximos, aguardando confirmação, concluídos,
 * cancelados e reembolsados. O reembolsado **fica** na lista — a §40 exige
 * que o reembolso não apague histórico, e sumir da tela seria apagar do ponto
 * de vista de quem comprou.
 *
 * O botão de incluir na viagem fica **fora** do cartão, e não dentro: o cartão
 * inteiro já é um link para o pedido, e um botão dentro de um toque maior é a
 * receita de abrir a tela errada com o polegar.
 */

interface Pedido {
  /** Capa do passeio, para a miniatura de 72. */
  capa?: string | null;
  id: string;
  referencia: string;
  status: string;
  /** `null` = comprado solto, fora do roteiro. */
  viagemId: string | null;
  total: { centavos: number; moeda: Moeda };
  feitoEm: string;
  itens: {
    titulo: string;
    variante: string;
    comeca: string | null;
    timezone: string | null;
    pessoas: number;
  }[];
}

const ROTULO_STATUS: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado em parte',
  failed: 'Pagamento não concluído',
};

/** Em qual grupo da §6.1 cada pedido cai. */
function grupoDe(p: Pedido): 'proximos' | 'pendentes' | 'concluidos' | 'encerrados' {
  if (p.status === 'pending_payment') return 'pendentes';
  if (['cancelled', 'refunded', 'partially_refunded', 'failed'].includes(p.status)) {
    return 'encerrados';
  }
  const futuro = p.itens.some((i) => i.comeca && new Date(i.comeca).getTime() > Date.now());
  return futuro ? 'proximos' : 'concluidos';
}

export default function MeusPasseios() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso] = useState<string | null>(null);
  const [aba, setAba] = useState<'conf' | 'hist'>('conf');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('orders')
      .select(
        'id, reference, status, trip_id, total_cents, currency, placed_at, order_items(tour_id, tour_title, variant_label, starts_at, timezone, people)',
      )
      .order('placed_at', { ascending: false });

    if (error) return setErro(error.message);

    // A capa da miniatura vem do catalogo: o pedido guarda o titulo, nao a foto
    // — e de proposito, para o pedido nao mudar quando a vitrine muda.
    const idsDePasseio = [
      ...new Set(
        (data ?? []).flatMap((o) => (o.order_items ?? []).map((i) => i.tour_id).filter(Boolean)),
      ),
    ] as string[];
    const capas = new Map<string, string>();
    if (idsDePasseio.length > 0) {
      const { data: midias } = await supabase()
        .from('tour_media')
        .select('tour_id, storage_path, sort_order')
        .in('tour_id', idsDePasseio)
        .eq('kind', 'image')
        .order('sort_order');
      for (const m of midias ?? []) if (!capas.has(m.tour_id)) capas.set(m.tour_id, m.storage_path);
    }

    setPedidos(
      (data ?? []).map((o) => ({
        id: o.id,
        capa: capas.get((o.order_items ?? [])[0]?.tour_id ?? '') ?? null,
        referencia: o.reference,
        status: o.status,
        viagemId: o.trip_id,
        total: { centavos: o.total_cents, moeda: o.currency as Moeda },
        feitoEm: o.placed_at,
        itens: (o.order_items ?? []).map((i) => ({
          titulo: i.tour_title,
          variante: i.variant_label,
          comeca: i.starts_at,
          timezone: i.timezone,
          pessoas: i.people,
        })),
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Liga e desliga com o mesmo botão.
   *
   * Quem confere se a viagem é sua é `incluir_pedido_na_viagem()` — o cliente
   * não tem `update` em `orders`, e a tela só repete o motivo que voltar.
   */

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-meus-passeios">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!pedidos) {
    return (
      <Screen withBottomNav={false} testID="screen-meus-passeios">
        <LoadingSkeleton label="Carregando seus passeios" />
      </Screen>
    );
  }

  // Duas abas, como o design: **Confirmados** e **Histórico**. Os quatro
  // grupos antigos ("Próximos", "Aguardando", "Concluídos", "Cancelados")
  // viravam quatro títulos numa tela de três linhas.
  const confirmados = pedidos.filter((p) => ['proximos', 'pendentes'].includes(grupoDe(p)));
  const historico = pedidos.filter((p) => ['concluidos', 'encerrados'].includes(grupoDe(p)));
  const lista = aba === 'conf' ? confirmados : historico;

  const pessoas = pedidos[0]?.itens[0]?.pessoas ?? null;
  const resumo = [
    `${pedidos.length} ${pedidos.length === 1 ? 'experiência' : 'experiências'}`,
    pessoas ? `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen bleed withBottomNav={false} testID="screen-meus-passeios">
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para Passeios"
          onPress={() => router.back()}
          style={styles.voltar}
          testID="voltar-passeios"
        >
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={palette.gold}
              strokeWidth={2.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text variant="body" tone="gold" style={styles.voltarTexto}>
            Passeios
          </Text>
        </Pressable>
      </View>

      <View style={styles.tituloArea}>
        <Text variant="largeTitle" style={styles.titulo}>
          Meus Passeios
        </Text>
        {resumo ? (
          <Text variant="body" style={styles.resumo}>
            {resumo}
          </Text>
        ) : null}
      </View>

      {aviso ? <AlertBanner title={aviso} /> : null}

      {pedidos.length === 0 ? (
        <EmptyState
          title="Você ainda não comprou nenhum passeio"
          description="O que você reservar aparece aqui, com ingresso e QR quando houver."
        />
      ) : (
        <>
          <Segmentado
            opcoes={[
              { chave: 'conf', rotulo: 'Confirmados' },
              { chave: 'hist', rotulo: 'Histórico' },
            ]}
            selecionado={aba}
            aoEscolher={(c) => setAba(c as 'conf' | 'hist')}
          />

          <View style={styles.lista}>
            {lista.length === 0 ? (
              <Text variant="body" tone="muted" style={styles.vazio}>
                {aba === 'conf' ? 'Nada confirmado no momento.' : 'Nada no histórico ainda.'}
              </Text>
            ) : (
              lista.map((p) => {
                const item = p.itens[0];
                const grupo = grupoDe(p);
                return (
                  <LinhaDoPedido
                    key={p.id}
                    quando={quandoDe(item?.comeca ?? null, item?.timezone ?? null)}
                    titulo={item?.titulo ?? p.referencia}
                    situacao={
                      grupo === 'pendentes'
                        ? 'aguardando'
                        : grupo === 'proximos'
                          ? 'confirmado'
                          : 'concluido'
                    }
                    rotuloSituacao={ROTULO_STATUS[p.status] ?? p.status}
                    pessoas={
                      item ? `${item.pessoas} ${item.pessoas === 1 ? 'pessoa' : 'pessoas'}` : null
                    }
                    foto={p.capa ?? null}
                    aoAbrir={() => router.push(`/passeios/pedido/${p.id}`)}
                    testID={`pedido-${p.referencia}`}
                  />
                );
              })
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

/** "SEX, 25 AGO · 18:30", como o kicker do design. */
function quandoDe(iso: string | null, timezone: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const opcoes: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};
  const dia = d
    .toLocaleDateString('pt-BR', { ...opcoes, weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .toUpperCase();
  const hora = d.toLocaleTimeString('pt-BR', { ...opcoes, hour: '2-digit', minute: '2-digit' });
  return `${dia} · ${hora}`;
}

const styles = StyleSheet.create({
  navBar: { height: 44, justifyContent: 'center', paddingHorizontal: 12 },
  voltar: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 8 },
  voltarTexto: { fontSize: 15, fontWeight: '500', letterSpacing: -0.21 },
  tituloArea: { paddingTop: 6, paddingHorizontal: 20 },
  titulo: { fontSize: 33, lineHeight: 34, fontWeight: '700', letterSpacing: -1.25 },
  resumo: { marginTop: 7, fontSize: 13.5, letterSpacing: -0.11, color: 'rgba(245,245,247,.45)' },
  lista: { marginTop: 18, marginHorizontal: 16, gap: 12 },
  vazio: { paddingVertical: 24, textAlign: 'center' },
  bloco: { gap: space.xs },
  secao: { gap: space.md, marginTop: space.section },
  pedido: {
    minHeight: touchTarget.min,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
  },
  mono: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.8 },
});
