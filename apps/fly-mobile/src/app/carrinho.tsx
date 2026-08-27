import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useCarrinho } from '@/passeios/useCarrinho';
import { formatar, tempoRestante } from '@/passeios/dinheiro';
import { dataCurta, hora } from '@/viagem/tempo';

/**
 * Carrinho e checkout (§6.5).
 *
 * O que esta tela **não** faz: calcular o que será cobrado. Ela mostra uma
 * previsão a partir do catálogo, e `criar_pedido()` recalcula tudo no
 * servidor. Se divergirem, o servidor manda — e é por isso que a tela avisa
 * quando o preço mudou desde que o item entrou, em vez de descobrir na
 * cobrança.
 *
 * Três avisos ficam acima do botão, porque são coisas que mudam a decisão:
 * reserva vencida, preço alterado e moedas misturadas.
 */

/** Chave de idempotência: sobrevive a toque duplo e a rede instável. */
function novaChave(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function CarrinhoScreen() {
  const router = useRouter();
  const { estado, recarregar, remover } = useCarrinho();
  const [cupom, setCupom] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [fechando, setFechando] = useState(false);
  const [agora, setAgora] = useState(() => new Date());

  // A contagem da reserva precisa andar sozinha. Sem isso, "3:00" fica
  // parado na tela enquanto a vaga vai embora.
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * A chave é gerada uma vez e reusada nas tentativas.
   *
   * Gerar a cada toque anularia a idempotência: duas chaves diferentes são
   * dois pedidos, que é exatamente o que ela existe para impedir.
   */
  const [chave] = useState(novaChave);

  const fechar = useCallback(async () => {
    setFechando(true);
    setAviso(null);

    const { data, error } = await supabase().rpc('criar_pedido', {
      p_idempotency_key: chave,
      ...(cupom.trim() ? { p_coupon: cupom.trim() } : {}),
    });

    setFechando(false);

    if (error) {
      setAviso('Não consegui fechar o pedido agora. Tente de novo.');
      return;
    }

    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha?.ok) {
      setAviso(MOTIVOS[linha?.motivo ?? ''] ?? 'Não consegui fechar o pedido.');
      await recarregar();
      return;
    }

    router.replace(`/passeios/pedido/${linha.order_id}` as never);
  }, [chave, cupom, recarregar, router]);

  if (estado.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-carrinho">
        <LoadingSkeleton label="Abrindo o carrinho" />
      </Screen>
    );
  }

  if (estado.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-carrinho">
        <ErrorState description={estado.message} onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (estado.kind === 'vazio') {
    return (
      <Screen withBottomNav={false} testID="screen-carrinho">
        <AppHeader kicker="Carrinho" title="Está vazio" />
        <EmptyState
          title="Nada no carrinho"
          description="Os passeios que você escolher aparecem aqui, com a vaga reservada por alguns minutos."
        />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-carrinho">
      <AppHeader kicker="Carrinho" title="Sua escolha" />

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      {/* Moedas misturadas: a Fly não converte, e diz por quê. */}
      {estado.moedasMisturadas ? (
        <AlertBanner
          severity="critical"
          title="Moedas diferentes no mesmo carrinho"
          description={`Há itens em ${estado.moedasMisturadas.join(' e ')}. A Fly não converte câmbio por conta própria — finalize uma moeda de cada vez.`}
        />
      ) : null}

      {estado.algumaReservaVenceu ? (
        <AlertBanner
          severity="warning"
          title="Uma reserva venceu"
          description="A vaga voltou para o catálogo. Confira se ainda há lugar antes de fechar."
        />
      ) : null}

      {estado.algumPrecoMudou ? (
        <AlertBanner
          severity="warning"
          title="O preço mudou"
          description="Um item mudou de preço desde que você o colocou no carrinho. O valor cobrado é o que aparece agora."
        />
      ) : null}

      <View style={styles.lista}>
        {estado.itens.map((i) => {
          const resta = tempoRestante(i.expiraEm, agora);
          return (
            <Card key={i.id}>
              <View style={styles.bloco}>
                <Text variant="body" style={styles.titulo}>
                  {i.passeioTitulo}
                </Text>
                <Text variant="body" tone="muted">
                  {i.varianteRotulo}
                  {i.comeca
                    ? ` · ${dataCurta(i.comeca, i.timezone)} ${hora(i.comeca, i.timezone)}`
                    : ''}
                </Text>
                <Text variant="body" tone="faint">
                  {i.pessoas} {i.pessoas === 1 ? 'pessoa' : 'pessoas'}
                  {i.cobrePessoas > 1 ? ' · preço por grupo' : ''}
                </Text>

                {i.reservaVencida ? (
                  <Text variant="body" tone="warning">
                    Reserva vencida — confira a disponibilidade
                  </Text>
                ) : resta ? (
                  <Text variant="body" tone="gold">
                    Vaga reservada por mais {resta}
                  </Text>
                ) : null}

                <View style={styles.linhaTotal}>
                  <Text variant="section">{formatar(i.linha)}</Text>
                  <Botao
                    rotulo="Remover"
                    variante="fantasma"
                    rotuloAcessivel={`Remover ${i.passeioTitulo} do carrinho`}
                    onPress={() => void remover(i.id)}
                    testID={`remover-${i.id}`}
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <View style={styles.secao}>
        <Kicker>Cupom</Kicker>
        <Field
          label="Código do cupom"
          hint="Opcional. O desconto é conferido no servidor."
          value={cupom}
          onChangeText={setCupom}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="carrinho-cupom"
        />
      </View>

      <Card>
        <View style={styles.bloco}>
          <View style={styles.linhaTotal}>
            <Text variant="body" tone="muted">
              Total
            </Text>
            <Text variant="section">{estado.total ? formatar(estado.total) : '—'}</Text>
          </View>

          <Text variant="body" tone="faint">
            O valor final é calculado no servidor no momento do pedido, com o cupom aplicado.
          </Text>

          <Botao
            rotulo="Fechar pedido"
            ocupado={fechando}
            desabilitado={estado.moedasMisturadas !== null}
            onPress={() => void fechar()}
            testID="fechar-pedido"
          />
        </View>
      </Card>
    </Screen>
  );
}

const MOTIVOS: Record<string, string> = {
  'carrinho vazio': 'Seu carrinho está vazio.',
  'carrinho com moedas diferentes':
    'Há itens em moedas diferentes. Finalize uma moeda de cada vez.',
  'chave de idempotencia ausente': 'Erro interno ao identificar o pedido. Tente de novo.',
};

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  lista: { gap: space.md },
  secao: { gap: space.md, marginTop: space.section },
  titulo: { fontWeight: '600' },
  linhaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
    borderRadius: radius.chip,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
    paddingTop: space.md,
  },
});
