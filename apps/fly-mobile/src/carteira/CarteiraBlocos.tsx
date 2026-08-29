import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { flyPackage, type FlyPackage } from '@fly/design-tokens';
import { ROTULO_PACOTE } from './pacote';
import { palette } from '@/theme';
import { Text } from '@/ui';
import { ROTULO_NIVEL, type Progresso } from './nivel';

/**
 * Blocos da Carteira, medidos em `docs/design/extracao/05-carteira.html`.
 *
 * O que **nao** esta aqui e tao importante quanto o que esta: nao ha cartao de
 * saldo em dinheiro, nem `•••• 4102`, nem Adicionar/Transferir, nem conversao
 * de ponto em real. A §41 manda o saldo financeiro nascer desligado sem
 * parceiro de pagamento, e nao ha parceiro (D126).
 *
 * Tambem nao ha "Resgatar" nem "Ver tudo": resgate e a entrega 4 da Fase 6, e
 * tela de extrato completo nao existe. Botao que nao leva a lugar nenhum e
 * pior que botao nenhum.
 */

/* ----------------------------------------------------------- selo do pacote */

/**
 * Selo do pacote adquirido, na cor do pacote (D120).
 *
 * Standard azul, Black branco, Billionaire dourado — as tres paletas que a
 * D95 ja tinha posto em `flyPackage`. **Nao e nivel de pontos**: pacote se
 * compra, nivel se conquista.
 */
export function SeloDoPacote({ pacote }: { pacote: FlyPackage }) {
  const cor = flyPackage[pacote];
  return (
    <View style={[styles.selo, { backgroundColor: cor.fill, borderColor: cor.border }]}>
      <View style={[styles.seloPonto, { backgroundColor: cor.dot }]} />
      <Text variant="caption" style={[styles.seloTexto, { color: cor.label }]}>
        {ROTULO_PACOTE[pacote]}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------- cartao de pontos */

export interface CartaoDePontosProps {
  saldo: number;
  progresso: Progresso;
  /** Meses ate vencer. `null` = nunca vence. */
  validadeMeses: number | null;
}

function formatar(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function CartaoDePontos({ saldo, progresso, validadeMeses }: CartaoDePontosProps) {
  const { nivel, proximo, faltam, fracao } = progresso;

  return (
    <View style={styles.cartao}>
      <LinearGradient
        colors={['rgba(223,201,138,.09)', 'rgba(223,201,138,.035)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.cartaoTopo}>
        <View style={styles.cartaoTexto}>
          <Text variant="caption" tone="gold" style={styles.kicker}>
            FLY POINTS
          </Text>
          <View style={styles.saldoLinha}>
            <Text variant="section" style={styles.saldo}>
              {formatar(saldo)}
            </Text>
            <Text variant="body" style={styles.nivelAtual}>
              nível {ROTULO_NIVEL[nivel]}
            </Text>
          </View>
        </View>
      </View>

      {/* A barra so aparece quando ha para onde subir E o limiar e conhecido.
          Sem isso ela mostraria progresso inventado — o oposto da §33. */}
      {proximo !== null && fracao !== null ? (
        <View style={styles.progresso}>
          <View style={styles.trilho}>
            <LinearGradient
              colors={['#C9A96B', '#DFC98A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.barra, { width: `${fracao * 100}%` }]}
            />
          </View>
          <View style={styles.marcos}>
            {(['basic', 'prime', 'elite'] as const).map((n) => (
              <Text
                key={n}
                variant="caption"
                style={[styles.marco, n === nivel && styles.marcoAtual]}
              >
                {ROTULO_NIVEL[n]}
              </Text>
            ))}
          </View>
          {faltam !== null ? (
            <Text variant="body" style={styles.faltam}>
              Faltam{' '}
              <Text variant="body" style={styles.faltamForte}>
                {formatar(faltam)} pontos
              </Text>{' '}
              para {ROTULO_NIVEL[proximo]}.
            </Text>
          ) : null}
        </View>
      ) : nivel === 'elite' ? (
        <Text variant="body" style={styles.nota}>
          Você está no nível mais alto.
        </Text>
      ) : (
        <Text variant="body" style={styles.nota}>
          Os níveis ainda estão sendo definidos pela Fly.
        </Text>
      )}

      {validadeMeses !== null ? (
        <Text variant="body" style={styles.validade}>
          Cada ponto vale por {validadeMeses} meses a partir do dia em que entra.
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ movimentacao */

export interface MovimentoProps {
  titulo: string;
  detalhe: string;
  pontos: number;
  icone: ReactNode;
  /** Estorno e vencimento aparecem apagados: saiu, mas nao foi gasto. */
  apagado?: boolean;
}

export function LinhaDeMovimento({
  titulo,
  detalhe,
  pontos,
  icone,
  apagado = false,
}: MovimentoProps) {
  const positivo = pontos > 0;
  return (
    <View style={styles.movimento}>
      <View style={[styles.movIcone, positivo && styles.movIconeOuro]}>{icone}</View>
      <View style={styles.movTexto}>
        <Text variant="body" numberOfLines={1} style={styles.movTitulo}>
          {titulo}
        </Text>
        <Text variant="body" numberOfLines={1} style={styles.movDetalhe}>
          {detalhe}
        </Text>
      </View>
      <Text
        variant="body"
        style={[styles.movPontos, positivo && styles.movPontosOuro, apagado && styles.movApagado]}
      >
        {positivo ? '+' : '−'} {formatar(Math.abs(pontos))} pts
      </Text>
    </View>
  );
}

export function DivisorDeMovimento() {
  return <View style={styles.movDivisor} />;
}

export function GrupoDeMovimentos({ children }: { children: ReactNode }) {
  return <View style={styles.grupo}>{children}</View>;
}

export function TituloDeSecao({ children }: { children: ReactNode }) {
  return (
    <Text variant="section" style={styles.secao}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------- financeiro, desligado */

/**
 * O bloco que diz por que nao ha saldo em dinheiro.
 *
 * O design mostra "SALDO DISPONIVEL R$ 8.420,00" e um cartao. A §41 manda
 * isso nascer desligado sem parceiro de pagamento, e nao ha parceiro
 * (P09/P38). Em vez de um cartao vazio ou de um numero falso, a tela diz a
 * verdade — que e o que o cliente precisa para nao ficar esperando.
 */
export function FinanceiroDesligado({ aoSaberMais }: { aoSaberMais?: (() => void) | undefined }) {
  return (
    <View style={styles.desligado}>
      <View style={styles.desligadoIcone}>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3.6 8.6h16.8v10.8H3.6z"
            stroke="rgba(245,245,247,.4)"
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path d="M3.6 12.4h16.8" stroke="rgba(245,245,247,.4)" strokeWidth={1.7} />
        </Svg>
      </View>
      <View style={styles.desligadoTexto}>
        <Text variant="body" style={styles.desligadoTitulo}>
          Saldo em dinheiro ainda não
        </Text>
        <Text variant="body" style={styles.desligadoNota}>
          Adicionar saldo, transferir e o Fly Card dependem de um parceiro de pagamento. Enquanto
          ele não existir, a Fly prefere não mostrar um número que não é seu de verdade.
        </Text>
        {aoSaberMais ? (
          <Pressable accessibilityRole="button" onPress={aoSaberMais} style={styles.desligadoLink}>
            <Text variant="body" tone="gold" style={styles.desligadoLinkTexto}>
              Como funcionam os Fly Points
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  seloPonto: { width: 5, height: 5, borderRadius: 3 },
  seloTexto: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },

  cartao: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.22)',
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cartaoTexto: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9, fontWeight: '700', letterSpacing: 1.35 },
  saldoLinha: { marginTop: 6, flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  saldo: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  nivelAtual: { fontSize: 12, letterSpacing: -0.06, color: 'rgba(245,245,247,.42)' },

  progresso: { marginTop: 14 },
  trilho: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,.1)',
    overflow: 'hidden',
  },
  barra: { height: 3, borderRadius: 2 },
  marcos: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' },
  marco: { fontSize: 11, fontWeight: '600', letterSpacing: -0.05, color: 'rgba(245,245,247,.36)' },
  marcoAtual: { color: palette.text, fontWeight: '700' },
  faltam: {
    marginTop: 11,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.44)',
  },
  faltamForte: { color: palette.gold, fontWeight: '600' },

  nota: {
    marginTop: 12,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.44)',
  },
  validade: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.07)',
    fontSize: 11.5,
    lineHeight: 17,
    letterSpacing: -0.04,
    color: 'rgba(245,245,247,.34)',
  },

  secao: {
    marginTop: 28,
    marginBottom: 12,
    marginHorizontal: 20,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.56,
  },
  grupo: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },

  movimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  movIcone: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.09)',
  },
  movIconeOuro: {
    backgroundColor: 'rgba(223,201,138,.11)',
    borderColor: 'rgba(223,201,138,.24)',
  },
  movTexto: { flex: 1, minWidth: 0 },
  movTitulo: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.23, color: palette.text },
  movDetalhe: {
    marginTop: 3,
    fontSize: 12,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.38)',
  },
  movPontos: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.26,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  movPontosOuro: { color: palette.gold },
  movApagado: { color: 'rgba(245,245,247,.4)' },
  movDivisor: { height: 1, marginLeft: 65, backgroundColor: 'rgba(255,255,255,.07)' },

  desligado: {
    marginTop: 24,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 13,
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  desligadoIcone: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.05)',
  },
  desligadoTexto: { flex: 1, minWidth: 0 },
  desligadoTitulo: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: 'rgba(245,245,247,.7)',
  },
  desligadoNota: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.38)',
  },
  desligadoLink: { marginTop: 9, alignSelf: 'flex-start' },
  desligadoLinkTexto: { fontSize: 13, fontWeight: '600', letterSpacing: -0.13 },

  beneficio: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  // Bloqueado nao some: continua legivel, so recuado. Sumir esconderia do
  // cliente o que ele ganha ao subir de nivel.
  beneficioBloqueado: { opacity: 0.62 },
  beneficioTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  beneficioTexto: { flex: 1, minWidth: 0 },
  beneficioTitulo: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.23, color: palette.text },
  beneficioDescricao: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: -0.08,
    color: 'rgba(245,245,247,.42)',
  },
  beneficioCusto: { alignItems: 'flex-end' },
  beneficioCustoValor: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.35,
    color: palette.gold,
    fontVariant: ['tabular-nums'],
  },
  beneficioCustoUnidade: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: 'rgba(223,201,138,.55)',
  },
  beneficioRodape: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  beneficioBloqueio: { flex: 1, fontSize: 12, letterSpacing: -0.06, color: 'rgba(245,245,247,.4)' },
  beneficioEstoque: { fontSize: 12, letterSpacing: -0.06, color: palette.warning },
  resgatar: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(223,201,138,.14)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.38)',
  },
  resgatarPressionado: { transform: [{ scale: 0.95 }] },
  resgatarTexto: { fontSize: 13, fontWeight: '600', letterSpacing: -0.13, color: palette.gold },

  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  voucherTexto: { flex: 1, minWidth: 0 },
  voucherRotulo: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: palette.text },
  voucherNota: {
    marginTop: 3,
    fontSize: 12,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.4)',
  },
  voucherCodigo: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
  },
  voucherCodigoTexto: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },

  resgate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(223,201,138,.07)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.2)',
  },
  resgateTexto: { flex: 1, minWidth: 0 },
  resgateTitulo: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: palette.text },
  resgateNota: {
    marginTop: 3,
    fontSize: 12,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.4)',
  },
  resgateCodigo: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,.35)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.3)',
  },
  resgateCodigoTexto: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: palette.gold,
    fontVariant: ['tabular-nums'],
  },
});

/* ------------------------------------------------------------- beneficios */

export interface CartaoDeBeneficioProps {
  titulo: string;
  descricao: string | null;
  custo: number;
  /** `null` = ilimitado, `0` = esgotado. */
  estoque: number | null;
  /** Por que nao da para resgatar agora. `null` = pode. */
  bloqueio: string | null;
  ocupado: boolean;
  aoResgatar: () => void;
}

/**
 * Um beneficio.
 *
 * Quando nao da para resgatar, o cartao **diz o motivo** em vez de so
 * desabilitar o botao. Botao cinza sem explicacao e a forma mais rapida de
 * fazer alguem achar que o app quebrou.
 */
export function CartaoDeBeneficio({
  titulo,
  descricao,
  custo,
  estoque,
  bloqueio,
  ocupado,
  aoResgatar,
}: CartaoDeBeneficioProps) {
  const podeResgatar = bloqueio === null && !ocupado;

  return (
    <View style={[styles.beneficio, bloqueio !== null && styles.beneficioBloqueado]}>
      <View style={styles.beneficioTopo}>
        <View style={styles.beneficioTexto}>
          <Text variant="body" style={styles.beneficioTitulo}>
            {titulo}
          </Text>
          {descricao ? (
            <Text variant="body" style={styles.beneficioDescricao}>
              {descricao}
            </Text>
          ) : null}
        </View>
        <View style={styles.beneficioCusto}>
          <Text variant="body" style={styles.beneficioCustoValor}>
            {formatar(custo)}
          </Text>
          <Text variant="caption" style={styles.beneficioCustoUnidade}>
            PTS
          </Text>
        </View>
      </View>

      <View style={styles.beneficioRodape}>
        {bloqueio !== null ? (
          <Text variant="body" style={styles.beneficioBloqueio}>
            {bloqueio}
          </Text>
        ) : estoque !== null && estoque <= 3 ? (
          <Text variant="body" style={styles.beneficioEstoque}>
            {estoque === 1 ? 'Última unidade' : `Restam ${estoque}`}
          </Text>
        ) : (
          <View />
        )}

        {podeResgatar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Resgatar ${titulo}`}
            onPress={aoResgatar}
            testID={`resgatar-${titulo}`}
          >
            {({ pressed }) => (
              <View style={[styles.resgatar, pressed && styles.resgatarPressionado]}>
                <Text variant="body" style={styles.resgatarTexto}>
                  Resgatar
                </Text>
              </View>
            )}
          </Pressable>
        ) : ocupado ? (
          <Text variant="body" style={styles.beneficioEstoque}>
            Resgatando…
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Voucher: um cupom que e **desta pessoa**.
 *
 * O codigo fica em destaque porque e o que ela vai digitar no checkout. A
 * validade aparece so quando existe — "sem prazo" e informacao, "—" nao e.
 */
export function CartaoDeVoucher({
  rotulo,
  codigo,
  desconto,
  valeAte,
}: {
  rotulo: string;
  codigo: string;
  desconto: string;
  valeAte: string | null;
}) {
  return (
    <View style={styles.voucher}>
      <View style={styles.voucherTexto}>
        <Text variant="body" numberOfLines={1} style={styles.voucherRotulo}>
          {rotulo}
        </Text>
        <Text variant="body" style={styles.voucherNota}>
          {desconto}
          {valeAte
            ? ` · até ${new Date(valeAte).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
            : ' · sem prazo'}
        </Text>
      </View>
      <View style={styles.voucherCodigo}>
        <Text variant="body" style={styles.voucherCodigoTexto}>
          {codigo}
        </Text>
      </View>
    </View>
  );
}

/** O codigo que o cliente apresenta na Base Fly. */
export function CartaoDeResgate({
  titulo,
  codigo,
  pontos,
}: {
  titulo: string;
  codigo: string;
  pontos: number;
}) {
  return (
    <View style={styles.resgate}>
      <View style={styles.resgateTexto}>
        <Text variant="body" numberOfLines={1} style={styles.resgateTitulo}>
          {titulo}
        </Text>
        <Text variant="body" style={styles.resgateNota}>
          {formatar(pontos)} pts · apresente na Base Fly
        </Text>
      </View>
      <View style={styles.resgateCodigo}>
        <Text variant="body" style={styles.resgateCodigoTexto}>
          {codigo}
        </Text>
      </View>
    </View>
  );
}
