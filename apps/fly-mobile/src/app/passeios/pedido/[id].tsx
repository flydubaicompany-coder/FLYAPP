import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { formatar, type Moeda } from '@/passeios/dinheiro';
import { usePagamento } from '@/passeios/usePagamento';
import { dataCurta, hora } from '@/viagem/tempo';
import { useViagem } from '@/viagem/useViagem';

/**
 * Pedido (§6.5, passo 7).
 *
 * Duas coisas ficam visíveis aqui e não em outro lugar:
 *
 * - **A política de cancelamento que valia no momento da compra**, lida do
 *   próprio pedido e não do catálogo. Se a Fly mudar a política amanhã, esta
 *   tela continua mostrando o que a pessoa aceitou.
 * - **Os reembolsos**, um a um. Reembolso não apaga o pedido; acrescenta uma
 *   linha ao histórico.
 *
 * O pagamento passa por um adapter (§40.9). Qual provedor atende vem do banco,
 * não daqui — e enquanto nenhum PSP estiver contratado (P09), o adapter
 * devolve "indisponível" e a tela diz que a Fly entra em contato, em vez de
 * simular uma cobrança (§33).
 *
 * A tela **não acredita na resposta do pagamento**. `pendente` quer dizer que
 * o provedor aceitou a intenção; quem confirma é o webhook, no servidor. Por
 * isso, depois de autorizar, ela recarrega o pedido e mostra o que o servidor
 * disser — inclusive se ainda não disser nada.
 */

interface Item {
  titulo: string;
  variante: string;
  comeca: string | null;
  timezone: string | null;
  pessoas: number;
  total: { centavos: number; moeda: Moeda };
}

interface Reembolso {
  id: string;
  valor: { centavos: number; moeda: Moeda };
  motivo: string;
  em: string;
}

interface Pedido {
  id: string;
  /** Viagem a que o pedido esta ligado, se houver (D90). */
  viagemId: string | null;
  /** Soma das vagas dos itens. Define quantos nomes a lista comporta. */
  pessoas: number;
  referencia: string;
  status: string;
  subtotal: { centavos: number; moeda: Moeda };
  desconto: { centavos: number; moeda: Moeda };
  total: { centavos: number; moeda: Moeda };
  cupom: string | null;
  feitoEm: string;
  politicaTitulo: string | null;
  politicaTexto: string | null;
  politicaVersao: number | null;
  itens: Item[];
  reembolsos: Reembolso[];
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

export default function PedidoScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null | 'nao-encontrado'>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [mexendoNaViagem, setMexendoNaViagem] = useState(false);
  const { data: dadosDaViagem } = useViagem();
  // Falha de leitura nao pode ser contada como "pedido inexistente". Numa tela
  // de pagamento essa confusao e a pior possivel: quem acabou de pagar leria
  // que o pedido dele nao existe.
  const [falhaAoCarregar, setFalhaAoCarregar] = useState<string | null>(null);
  const { estado: pagamento, pagando, pagar } = usePagamento();

  const carregar = useCallback(async () => {
    if (!id) return;
    setFalhaAoCarregar(null);
    const { data, error } = await supabase()
      .from('orders')
      .select(
        'id, trip_id, reference, status, subtotal_cents, discount_cents, total_cents, currency, coupon_code, placed_at, cancellation_policy_label, cancellation_policy_text, cancellation_policy_version, order_items(tour_title, variant_label, starts_at, timezone, people, line_total_cents, currency), refunds(id, amount_cents, currency, reason, created_at)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) return setFalhaAoCarregar(error.message);
    if (!data) return setPedido('nao-encontrado');

    const moeda = data.currency as Moeda;
    setPedido({
      id: data.id,
      viagemId: data.trip_id,
      referencia: data.reference,
      status: data.status,
      pessoas: (data.order_items ?? []).reduce((soma, i) => soma + i.people, 0),
      subtotal: { centavos: data.subtotal_cents, moeda },
      desconto: { centavos: data.discount_cents, moeda },
      total: { centavos: data.total_cents, moeda },
      cupom: data.coupon_code,
      feitoEm: data.placed_at,
      politicaTitulo: data.cancellation_policy_label,
      politicaTexto: data.cancellation_policy_text,
      politicaVersao: data.cancellation_policy_version,
      itens: (data.order_items ?? []).map((i) => ({
        titulo: i.tour_title,
        variante: i.variant_label,
        comeca: i.starts_at,
        timezone: i.timezone,
        pessoas: i.people,
        total: { centavos: i.line_total_cents, moeda: i.currency as Moeda },
      })),
      reembolsos: (data.refunds ?? []).map((r) => ({
        id: r.id,
        valor: { centavos: r.amount_cents, moeda: r.currency as Moeda },
        motivo: r.reason,
        em: r.created_at,
      })),
    });
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function cancelar() {
    if (!pedido || pedido === 'nao-encontrado') return;
    setCancelando(true);
    setAviso(null);

    const { data, error } = await supabase().rpc('cancelar_pedido', {
      p_order: pedido.id,
      p_reason: 'Cancelado pelo cliente no app',
    });

    setCancelando(false);
    const linha = Array.isArray(data) ? data[0] : data;

    if (error || !linha?.ok) {
      setAviso(linha?.motivo ?? 'Não consegui cancelar agora.');
      return;
    }

    // O cancelamento não decide reembolso: quanto volta depende da política,
    // e aplicar percentual sem a Fly ter definido a regra seria inventar
    // dinheiro (§33).
    setAviso('Pedido cancelado. A Fly avalia o reembolso pela política acima e entra em contato.');
    await carregar();
  }

  async function confirmarPagamento() {
    if (!pedido || pedido === 'nao-encontrado') return;
    setAviso(null);

    const r = await pagar(pedido.id, pedido.total.centavos, pedido.total.moeda);

    if (r.status === 'recusado') {
      setAviso(`Pagamento recusado: ${r.motivo}`);
      await carregar();
      return;
    }

    if (r.status === 'indisponivel') {
      // Fallback humano — a regra do CLAUDE.md para toda integração externa.
      // Não se pede "tente de novo" sem saber se o provedor voltou.
      setAviso(
        `Não consegui falar com o provedor de pagamento (${r.motivo}). A Fly entra em contato para concluir — sua vaga está guardada.`,
      );
      return;
    }

    // `pendente`: o provedor aceitou. O status verdadeiro é o que o servidor
    // gravar quando o webhook chegar, então quem responde é o recarregamento.
    await carregar();
  }

  if (falhaAoCarregar) {
    return (
      <Screen withBottomNav={false} testID="screen-pedido">
        <AppHeader kicker="Passeios" title="Não carregou" onBack={() => router.back()} />
        <ErrorState description={falhaAoCarregar} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (pedido === 'nao-encontrado') {
    return (
      <Screen withBottomNav={false} testID="screen-pedido">
        <AppHeader kicker="Passeios" title="Não encontrei" onBack={() => router.back()} />
        <EmptyState title="Este pedido não existe" description="Confira em Meus passeios." />
      </Screen>
    );
  }

  if (!pedido) {
    return (
      <Screen withBottomNav={false} testID="screen-pedido">
        <LoadingSkeleton label="Carregando pedido" />
      </Screen>
    );
  }

  const podeCancelar = ['pending_payment', 'paid', 'confirmed'].includes(pedido.status);
  const viagemAtiva = dadosDaViagem.kind === 'ready' ? dadosDaViagem.viagem : null;

  async function alternarNaViagem() {
    if (!viagemAtiva || pedido === null || pedido === 'nao-encontrado') return;
    setMexendoNaViagem(true);
    setAviso(null);

    // Omitir `p_trip` desliga. `exactOptionalPropertyTypes` recusa passar
    // `undefined` explicito, entao a chave some do objeto.
    const { data, error } = await supabase().rpc('incluir_pedido_na_viagem', {
      p_order: pedido.id,
      ...(pedido.viagemId ? {} : { p_trip: viagemAtiva.id }),
    });

    setMexendoNaViagem(false);
    const linha = Array.isArray(data) ? data[0] : data;

    if (error || !linha?.ok) {
      setAviso(linha?.motivo ?? 'Não consegui alterar agora.');
      return;
    }

    setAviso(
      pedido.viagemId
        ? 'Tirado do roteiro. O pedido continua seu — só não aparece em Minha Viagem.'
        : `Adicionado a ${viagemAtiva.nome}. Aparece no roteiro, no dia do passeio.`,
    );
    await carregar();
  }

  return (
    <Screen withBottomNav={false} testID="screen-pedido">
      <AppHeader
        kicker={pedido.referencia}
        title={ROTULO_STATUS[pedido.status] ?? pedido.status}
        onBack={() => router.back()}
      />

      {aviso ? <AlertBanner title={aviso} /> : null}

      {pedido.status === 'pending_payment' ? (
        <View style={styles.secao}>
          {pagamento.disponivel === true ? (
            <>
              <AlertBanner
                severity="warning"
                title="Falta o pagamento"
                description="Sua vaga está guardada até a confirmação."
              />

              {/* O sandbox não cobra nada, e a tela diz isso. Deixar
                  ambíguo faria alguém acreditar que pagou. */}
              {!pagamento.ehProducao ? (
                <AlertBanner
                  title="Ambiente de teste"
                  description="Este pagamento é simulado por um provedor de sandbox. Nenhum valor é cobrado."
                />
              ) : null}

              <Botao
                rotulo="Pagar agora"
                ocupado={pagando}
                onPress={() => void confirmarPagamento()}
                testID="pagar-pedido"
              />
            </>
          ) : (
            <AlertBanner
              severity="warning"
              title="Falta o pagamento"
              description={
                // Enquanto a leitura da flag não voltou, a tela não afirma
                // nem que dá para pagar nem que não há provedor. Afirmar o
                // segundo e depois mostrar o botão é pior do que esperar.
                pagamento.disponivel === null
                  ? 'Sua vaga está guardada até a confirmação.'
                  : 'A Fly ainda não tem provedor de pagamento no app. A equipe entra em contato para concluir — sua vaga está guardada.'
              }
            />
          )}
        </View>
      ) : null}

      <View style={styles.lista}>
        {pedido.itens.map((i, n) => (
          <Card key={`${i.titulo}-${n}`}>
            <View style={styles.bloco}>
              <Text variant="body" style={styles.titulo}>
                {i.titulo}
              </Text>
              <Text variant="body" tone="muted">
                {i.variante}
                {i.comeca
                  ? ` · ${dataCurta(i.comeca, i.timezone ?? 'UTC')} ${hora(i.comeca, i.timezone ?? 'UTC')}`
                  : ''}
              </Text>
              <View style={styles.linha}>
                <Text variant="body" tone="faint">
                  {i.pessoas} {i.pessoas === 1 ? 'pessoa' : 'pessoas'}
                </Text>
                <Text variant="body">{formatar(i.total)}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {/* Quem vai (§6.5, passo 5). Fica junto dos itens porque é sobre eles —
          e some no pedido cancelado, onde a lista virou histórico. */}
      {pedido.status !== 'cancelled' && pedido.status !== 'refunded' ? (
        <View style={styles.secao}>
          <Botao
            rotulo={`Quem vai (${pedido.pessoas} ${pedido.pessoas === 1 ? 'pessoa' : 'pessoas'})`}
            variante="fantasma"
            onPress={() => router.push(`/passeios/participantes/${pedido.id}` as never)}
            testID="abrir-participantes"
          />
        </View>
      ) : null}

      <Card>
        <View style={styles.bloco}>
          <View style={styles.linha}>
            <Text variant="body" tone="muted">
              Subtotal
            </Text>
            <Text variant="body">{formatar(pedido.subtotal)}</Text>
          </View>

          {pedido.desconto.centavos > 0 ? (
            <View style={styles.linha}>
              <Text variant="body" tone="muted">
                Desconto{pedido.cupom ? ` (${pedido.cupom})` : ''}
              </Text>
              <Text variant="body">− {formatar(pedido.desconto)}</Text>
            </View>
          ) : null}

          <View style={styles.linhaTotal}>
            <Text variant="body">Total</Text>
            <Text variant="section">{formatar(pedido.total)}</Text>
          </View>
        </View>
      </Card>

      {/* A política que valia na compra, lida do pedido — não do catálogo. */}
      {pedido.politicaTexto ? (
        <View style={styles.secao}>
          <Kicker>{pedido.politicaTitulo ?? 'Cancelamento'}</Kicker>
          <Card>
            <View style={styles.bloco}>
              <Text variant="body" tone="muted">
                {pedido.politicaTexto}
              </Text>
              <Text variant="body" tone="faint">
                Esta é a política que valia quando você comprou
                {pedido.politicaVersao ? ` (versão ${pedido.politicaVersao})` : ''}. Mudanças
                posteriores não valem para este pedido.
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      {pedido.reembolsos.length > 0 ? (
        <View style={styles.secao}>
          <Kicker>Reembolsos</Kicker>
          {pedido.reembolsos.map((r) => (
            <Card key={r.id}>
              <View style={styles.bloco}>
                <View style={styles.linha}>
                  <Text variant="body">{formatar(r.valor)}</Text>
                  <Text variant="body" tone="faint">
                    {dataCurta(r.em, 'UTC')}
                  </Text>
                </View>
                <Text variant="body" tone="muted">
                  {r.motivo}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {podeCancelar ? (
        <View style={styles.secao}>
          <Botao
            rotulo="Cancelar pedido"
            variante="fantasma"
            ocupado={cancelando}
            onPress={() => void cancelar()}
            testID="cancelar-pedido"
          />
          <Text variant="body" tone="faint">
            O reembolso segue a política acima e é avaliado pela Fly.
          </Text>
        </View>
      ) : null}

      {/* Incluir o pedido no roteiro (D90). Estava na lista de Meus Passeios,
          que o handoff reduziu a linhas sem acao — a funcao veio para ca, que e
          onde o design manda a linha navegar. */}
      {viagemAtiva && !['cancelled', 'refunded', 'failed'].includes(pedido.status) ? (
        <View style={styles.secao}>
          <Botao
            rotulo={pedido.viagemId ? 'Tirar de Minha Viagem' : `Adicionar a ${viagemAtiva.nome}`}
            variante="fantasma"
            ocupado={mexendoNaViagem}
            onPress={() => {
              void alternarNaViagem();
            }}
          />
        </View>
      ) : null}

      <View style={styles.secao}>
        <Botao
          rotulo="Ver meus passeios"
          variante="fantasma"
          onPress={() => router.replace('/passeios/meus')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  lista: { gap: space.md },
  secao: { gap: space.md, marginTop: space.section },
  titulo: { fontWeight: '600' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  linhaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.lg,
    marginTop: space.xs,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
    borderRadius: radius.chip,
  },
});
