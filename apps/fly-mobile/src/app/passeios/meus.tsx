import { useCallback, useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { formatar, type Moeda } from '@/passeios/dinheiro';
import { dataCurta, hora } from '@/viagem/tempo';
import { useViagem } from '@/viagem/useViagem';

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

/** O que acabou não entra em roteiro: o roteiro fala do que vai acontecer. */
const FORA_DO_ROTEIRO = ['cancelled', 'refunded', 'failed'];

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
  const [aviso, setAviso] = useState<string | null>(null);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const { data: viagemData } = useViagem();

  const viagem = viagemData.kind === 'ready' ? viagemData.viagem : null;

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('orders')
      .select(
        'id, reference, status, trip_id, total_cents, currency, placed_at, order_items(tour_title, variant_label, starts_at, timezone, people)',
      )
      .order('placed_at', { ascending: false });

    if (error) return setErro(error.message);

    setPedidos(
      (data ?? []).map((o) => ({
        id: o.id,
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
  async function alternarNaViagem(p: Pedido) {
    if (!viagem) return;
    setMexendo(p.id);
    setAviso(null);

    // Omitir `p_trip` desliga. `exactOptionalPropertyTypes` recusa passar
    // `undefined` explícito, então a chave some do objeto.
    const { data, error } = await supabase().rpc('incluir_pedido_na_viagem', {
      p_order: p.id,
      ...(p.viagemId ? {} : { p_trip: viagem.id }),
    });

    setMexendo(null);
    const linha = Array.isArray(data) ? data[0] : data;

    if (error || !linha?.ok) {
      setAviso(linha?.motivo ?? 'Não consegui alterar agora.');
      return;
    }

    setAviso(
      p.viagemId
        ? 'Tirado do roteiro. O pedido continua seu — só não aparece em Minha Viagem.'
        : `Adicionado a ${viagem.nome}. Aparece no roteiro, no dia do passeio.`,
    );
    await carregar();
  }

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

  const grupos: [string, Pedido[]][] = [
    ['Próximos', pedidos.filter((p) => grupoDe(p) === 'proximos')],
    ['Aguardando confirmação', pedidos.filter((p) => grupoDe(p) === 'pendentes')],
    ['Concluídos', pedidos.filter((p) => grupoDe(p) === 'concluidos')],
    ['Cancelados e reembolsados', pedidos.filter((p) => grupoDe(p) === 'encerrados')],
  ];

  return (
    <Screen withBottomNav={false} testID="screen-meus-passeios">
      <AppHeader kicker="Passeios" title="Meus passeios" />

      {aviso ? <AlertBanner title={aviso} /> : null}

      {pedidos.length === 0 ? (
        <EmptyState
          title="Você ainda não comprou nenhum passeio"
          description="O que você reservar aparece aqui, com ingresso e QR quando houver."
        />
      ) : (
        grupos
          .filter(([, lista]) => lista.length > 0)
          .map(([titulo, lista]) => (
            <View key={titulo} style={styles.secao}>
              <Kicker>{titulo}</Kicker>
              {lista.map((p) => (
                <View key={p.id} style={styles.bloco}>
                  <Link href={`/passeios/pedido/${p.id}`} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`Pedido ${p.referencia}, ${ROTULO_STATUS[p.status] ?? p.status}`}
                      testID={`pedido-${p.referencia}`}
                    >
                      {({ pressed }) => (
                        <View style={[styles.pedido, pressed && styles.pressed]}>
                          <View style={styles.bloco}>
                            <View style={styles.linhaTopo}>
                              <Text variant="body" style={styles.titulo}>
                                {p.itens[0]?.titulo ?? 'Pedido'}
                                {p.itens.length > 1 ? ` +${p.itens.length - 1}` : ''}
                              </Text>
                              <Text
                                variant="body"
                                tone={
                                  p.status === 'confirmed'
                                    ? 'ok'
                                    : p.status === 'pending_payment'
                                      ? 'warning'
                                      : 'faint'
                                }
                              >
                                {ROTULO_STATUS[p.status] ?? p.status}
                              </Text>
                            </View>

                            {p.itens[0]?.comeca ? (
                              <Text variant="body" tone="muted">
                                {dataCurta(p.itens[0].comeca, p.itens[0].timezone ?? 'UTC')} ·{' '}
                                {hora(p.itens[0].comeca, p.itens[0].timezone ?? 'UTC')}
                              </Text>
                            ) : null}

                            <View style={styles.linhaTopo}>
                              <Text variant="body" tone="faint" style={styles.mono}>
                                {p.referencia}
                              </Text>
                              <Text variant="body">{formatar(p.total)}</Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  </Link>

                  {/* §6.1: "botão para adicionar à Minha Viagem quando
                    permitido". Permitido é: existe viagem, e o pedido não
                    está encerrado — o que acabou não entra em roteiro. */}
                  {viagem && !FORA_DO_ROTEIRO.includes(p.status) ? (
                    <Botao
                      rotulo={p.viagemId ? 'Tirar de Minha Viagem' : 'Adicionar a Minha Viagem'}
                      variante="fantasma"
                      ocupado={mexendo === p.id}
                      onPress={() => void alternarNaViagem(p)}
                      testID={`viagem-${p.referencia}`}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  titulo: { fontWeight: '600', flexShrink: 1 },
  mono: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.8 },
});
