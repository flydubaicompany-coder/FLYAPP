import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette } from '@/theme';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, PhaseStub, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { AcaoDaCarteira, CartaoDaCarteira, LinhaDeAcoes } from '@/carteira/CartaoDaCarteira';
import {
  CartaoDeBeneficio,
  CartaoDePontos,
  CartaoDeResgate,
  CartaoDeVoucher,
  DivisorDeMovimento,
  GrupoDeMovimentos,
  LinhaDeMovimento,
  SeloDoPacote,
  TituloDeSecao,
} from '@/carteira/CarteiraBlocos';
import { ehPacote } from '@/carteira/pacote';
import { progressoDoSaldo } from '@/carteira/nivel';
import { useCarteira, type Lancamento } from '@/carteira/useCarteira';
import { EXPLICACAO, useBeneficios, type Beneficio } from '@/carteira/useBeneficios';

/**
 * Por que um beneficio nao pode ser resgatado agora.
 *
 * Isto e **so para explicar** na tela. Quem decide e a RPC, que refaz todas as
 * conferencias com a linha travada — a §41 nao permite decidir elegibilidade
 * no cliente.
 */
const ORDEM_NIVEL: Record<string, number> = { basic: 1, prime: 2, elite: 3 };

function bloqueioDe(b: Beneficio, saldo: number, nivel: string): string | null {
  if (b.estoque !== null && b.estoque <= 0) return 'Esgotado por enquanto.';
  if (b.nivelMinimo && (ORDEM_NIVEL[nivel] ?? 1) < (ORDEM_NIVEL[b.nivelMinimo] ?? 1)) {
    return `A partir do nível ${b.nivelMinimo === 'elite' ? 'ELITE' : b.nivelMinimo}.`;
  }
  if (b.pacoteMinimo) return 'Disponível para outro pacote Fly.';
  if (saldo < b.custo) {
    return `Faltam ${new Intl.NumberFormat('pt-BR').format(b.custo - saldo)} pontos.`;
  }
  return null;
}

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

/** O texto que a Carteira usa quando a acao depende de parceiro de pagamento. */
const SEM_PARCEIRO =
  'Recarga e transferência entram quando a Fly ligar o parceiro de pagamento. Créditos que a Fly concede já aparecem no seu saldo.';

const TRACO_ACAO = '#F5F5F7';

function IconeMais() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5.6v12.8" stroke={TRACO_ACAO} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M5.6 12h12.8" stroke={TRACO_ACAO} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function IconeSeta() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19V5.6M6.4 11.2L12 5.6l5.6 5.6"
        stroke={TRACO_ACAO}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconeExtrato() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4.4h9.4L19 8v11.6H6z"
        stroke={TRACO_ACAO}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M9 10.6h7M9 14.4h7" stroke={TRACO_ACAO} strokeWidth={1.7} strokeLinecap="round" />
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
  const { data: dados, recarregar: recarregarCarteira } = useCarteira(userId);
  const { data: beneficios, resgatar, recarregar } = useBeneficios(userId);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function pedirResgate(id: string) {
    setResgatando(id);
    setRecado(null);
    const r = await resgatar(id);
    setResgatando(null);

    if (r.ok) {
      setRecado({ ok: true, texto: `Resgatado. Seu código é ${r.codigo}.` });
      // O resgate mexe no saldo, no extrato E no estoque: as duas consultas
      // precisam rodar de novo, nao so a dos beneficios.
      await Promise.all([recarregar(), recarregarCarteira()]);
      return;
    }
    setRecado({ ok: false, texto: EXPLICACAO[r.motivo] ?? r.motivo });
  }

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

  // O tipo cobrou este: a sessao tambem tem estado de erro, e ele nao estava
  // tratado. Sem ele a tela renderizaria sem perfil.
  if (state.kind === 'error') {
    return (
      <Screen testID="screen-carteira">
        <ErrorState title="Não consegui carregar sua conta" description={state.message} />
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

      <CartaoDaCarteira
        centavos={carteira.saldoCentavos}
        moeda={carteira.moeda}
        nome={state.profile.displayName ?? state.profile.preferredName ?? 'Viajante Fly'}
        flyId={state.profile.publicId}
        pacote={ehPacote(carteira.pacote) ? carteira.pacote : null}
      />

      <LinhaDeAcoes>
        <AcaoDaCarteira
          icone={<IconeMais />}
          rotulo="Adicionar"
          indisponivel={carteira.recargaLigada ? null : SEM_PARCEIRO}
          onPress={() =>
            setRecado({
              ok: carteira.recargaLigada,
              texto: carteira.recargaLigada ? '' : SEM_PARCEIRO,
            })
          }
        />
        <AcaoDaCarteira
          icone={<IconeSeta />}
          rotulo="Transferir"
          indisponivel={carteira.recargaLigada ? null : SEM_PARCEIRO}
          onPress={() =>
            setRecado({
              ok: carteira.recargaLigada,
              texto: carteira.recargaLigada ? '' : SEM_PARCEIRO,
            })
          }
        />
        <AcaoDaCarteira
          icone={<IconeExtrato />}
          rotulo="Extrato"
          indisponivel={null}
          onPress={() => setRecado({ ok: true, texto: 'Seu extrato está logo abaixo.' })}
        />
      </LinhaDeAcoes>

      <CartaoDePontos
        saldo={carteira.saldo}
        progresso={progresso}
        validadeMeses={carteira.validadeMeses}
      />

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {carteira.vouchers.length > 0 ? (
        <>
          <TituloDeSecao>Seus vouchers</TituloDeSecao>
          <View style={styles.lista}>
            {carteira.vouchers.map((v) => (
              <CartaoDeVoucher
                key={v.id}
                rotulo={v.rotulo}
                codigo={v.codigo}
                desconto={v.desconto}
                valeAte={v.valeAte}
              />
            ))}
          </View>
        </>
      ) : null}

      {beneficios.kind === 'ready' && beneficios.resgates.length > 0 ? (
        <>
          <TituloDeSecao>Seus resgates</TituloDeSecao>
          <View style={styles.lista}>
            {beneficios.resgates.map((r) => (
              <CartaoDeResgate key={r.id} titulo={r.titulo} codigo={r.codigo} pontos={r.pontos} />
            ))}
          </View>
        </>
      ) : null}

      {beneficios.kind === 'ready' && beneficios.beneficios.length > 0 ? (
        <>
          <TituloDeSecao>Benefícios</TituloDeSecao>
          <View style={styles.lista}>
            {beneficios.beneficios.map((b) => (
              <CartaoDeBeneficio
                key={b.id}
                titulo={b.titulo}
                descricao={b.descricao}
                custo={b.custo}
                estoque={b.estoque}
                bloqueio={bloqueioDe(b, carteira.saldo, progresso.nivel)}
                ocupado={resgatando === b.id}
                aoResgatar={() => void pedirResgate(b.id)}
              />
            ))}
          </View>
        </>
      ) : null}

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

  lista: { marginHorizontal: 16, gap: 10 },

  recado: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  recadoOk: {
    backgroundColor: 'rgba(223,201,138,.1)',
    borderColor: 'rgba(223,201,138,.32)',
  },
  recadoErro: {
    backgroundColor: 'rgba(233,162,59,.1)',
    borderColor: 'rgba(233,162,59,.3)',
  },
  recadoTexto: { fontSize: 13, lineHeight: 19, letterSpacing: -0.1, color: palette.text },
});
