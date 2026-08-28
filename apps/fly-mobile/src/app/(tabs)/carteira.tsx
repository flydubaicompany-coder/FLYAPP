import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, PhaseStub, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import {
  CartaoDePontos,
  DivisorDeMovimento,
  FinanceiroDesligado,
  GrupoDeMovimentos,
  LinhaDeMovimento,
  SeloDoPacote,
  TituloDeSecao,
} from '@/carteira/CarteiraBlocos';
import { ehPacote } from '@/carteira/pacote';
import { progressoDoSaldo } from '@/carteira/nivel';
import { useCarteira, type Lancamento } from '@/carteira/useCarteira';

/**
 * Carteira (§8), na composicao de `docs/design/extracao/05-carteira.html`.
 *
 * **Metade do design nao foi construida, e isso e a entrega.** O canvas mostra
 * "SALDO DISPONIVEL R$ 8.420,00", cartao `•••• 4102`, Adicionar/Transferir,
 * recarga por Pix e "≈ R$ 2.412" convertendo ponto em real. A §41 e explicita:
 * "saldo financeiro e Fly Card ficam desligados sem parceiro", e nao ha
 * parceiro de pagamento (P09/P38). A taxa de conversao esta na lista do que a
 * §33 proibe inventar.
 *
 * Entao a tela mostra o que e verdade — pontos, nivel e extrato — e **diz** por
 * que o resto nao esta la, em vez de deixar um cartao vazio (D126).
 *
 * O que ainda e Fase 6 e nao foi feito: beneficios, resgate, vouchers,
 * pagamentos tokenizados, ranking e tax-free. O bloco de fases continua no fim
 * da tela, honesto sobre o que falta.
 */

/* Icones por origem. O do pedido e o do proprio canvas. */
const TRACO = 'rgba(245,245,247,.72)';
const OURO = '#DFC98A';

function IconePorOrigem({ origem, positivo }: { origem: string; positivo: boolean }) {
  const cor = positivo ? OURO : TRACO;
  const props = {
    stroke: cor,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (origem === 'event') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6 6.8 19.5 8 13.7 3.6 9.7l5.9-.7z"
          {...props}
        />
      </Svg>
    );
  }
  if (origem === 'referral') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Circle cx={9.2} cy={8.6} r={3.3} {...props} />
        <Path d="M3.2 20c.8-3.4 3.1-5.1 6-5.1s5.2 1.7 6 5.1" {...props} />
        <Path d="M16.4 6.2a3.3 3.3 0 0 1 0 6.2" {...props} />
      </Svg>
    );
  }
  if (origem === 'checkin') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M12 21c4-4.2 6-7.4 6-10a6 6 0 1 0-12 0c0 2.6 2 5.8 6 10z" {...props} />
        <Circle cx={12} cy={11} r={2.2} {...props} />
      </Svg>
    );
  }
  // Pedido e ajuste usam o predio do canvas.
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M6 20.4V8.6L12 4l6 4.6v11.8z" {...props} />
      <Path d="M10.4 20.4v-5.2h3.2v5.2" {...props} />
    </Svg>
  );
}

const NOME_DA_ORIGEM: Record<string, string> = {
  order: 'Experiência comprada',
  event: 'Check-in em evento Fly',
  referral: 'Indicação',
  checkin: 'Check-in',
  challenge: 'Desafio',
  ops: 'Ajuste da Fly',
};

const NOME_DO_TIPO: Record<Lancamento['tipo'], string> = {
  earn: 'Pontos creditados',
  redeem: 'Resgate',
  expire: 'Pontos vencidos',
  adjust: 'Ajuste da Fly',
  reverse: 'Estorno',
};

function tituloDoLancamento(l: Lancamento): string {
  if (l.tipo === 'earn') return NOME_DA_ORIGEM[l.origem] ?? 'Pontos creditados';
  return NOME_DO_TIPO[l.tipo];
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function WalletScreen() {
  const { state } = useSession();
  const router = useRouter();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const dados = useCarteira(userId);

  if (state.kind === 'signedOut') {
    return (
      <Screen testID="screen-carteira">
        <AppHeader kicker="Carteira" title="Entre para ver" />
        <EmptyState
          title="Sua carteira é sua"
          description="Fly Points, nível e extrato aparecem quando você entra na sua conta."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </Screen>
    );
  }

  if (state.kind === 'loading' || dados.kind === 'loading') {
    return (
      <Screen testID="screen-carteira">
        <LoadingSkeleton label="Carregando sua carteira" />
      </Screen>
    );
  }

  if (dados.kind === 'error') {
    return (
      <Screen testID="screen-carteira">
        <ErrorState title="Não consegui carregar sua carteira" description={dados.message} />
      </Screen>
    );
  }

  const { carteira } = dados;
  const progresso = progressoDoSaldo(carteira.saldo, carteira.limiares);

  return (
    <Screen bleed testID="screen-carteira">
      <View style={styles.cabecalho}>
        <Text variant="largeTitle" style={styles.titulo}>
          Carteira
        </Text>
        {ehPacote(carteira.pacote) ? <SeloDoPacote pacote={carteira.pacote} /> : null}
      </View>

      <CartaoDePontos
        saldo={carteira.saldo}
        progresso={progresso}
        validadeMeses={carteira.validadeMeses}
      />

      <TituloDeSecao>Movimentações</TituloDeSecao>

      {carteira.lancamentos.length === 0 ? (
        <View style={styles.vazio}>
          <Text variant="body" style={styles.vazioTitulo}>
            Nenhuma movimentação ainda
          </Text>
          <Text variant="body" style={styles.vazioNota}>
            Seus primeiros pontos aparecem aqui depois da primeira experiência.
          </Text>
        </View>
      ) : (
        <GrupoDeMovimentos>
          {carteira.lancamentos.map((l, n) => (
            <View key={l.id}>
              {n > 0 ? <DivisorDeMovimento /> : null}
              <LinhaDeMovimento
                titulo={tituloDoLancamento(l)}
                detalhe={
                  l.motivo ?? `${dataCurta(l.quando)}${l.referencia ? ` · ${l.referencia}` : ''}`
                }
                pontos={l.pontos}
                apagado={l.tipo === 'reverse' || l.tipo === 'expire'}
                icone={<IconePorOrigem origem={l.origem} positivo={l.pontos > 0} />}
              />
            </View>
          ))}
        </GrupoDeMovimentos>
      )}

      {!carteira.financeiroLigado ? <FinanceiroDesligado /> : null}

      <View style={styles.fases}>
        <PhaseStub
          phase={6}
          summary="Pontos, nível e extrato já funcionam. O resto da Fase 6 ainda não."
          planned={[
            'Benefícios, elegibilidade e resgate',
            'Vouchers e cupons',
            'Compras, pagamentos e reembolsos na Carteira',
            'Ranking opt-in e premiação',
            'Notas e Tax-Free, sempre como estimativa',
          ]}
          specRef="§8"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    paddingTop: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  titulo: { fontSize: 33, lineHeight: 34, fontWeight: '700', letterSpacing: -1.25 },

  vazio: { marginHorizontal: 20, paddingVertical: 8 },
  vazioTitulo: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.23 },
  vazioNota: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.38)',
  },

  fases: { marginTop: 28, marginHorizontal: 16 },
});
