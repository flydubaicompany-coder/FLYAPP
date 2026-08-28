import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette, space } from '@/theme';
import { Text } from '@/ui';
import wordmark from '../../assets/brand/fly-wordmark.png';

/**
 * Os blocos da Home, com as medidas do handoff de 28/08/2026 (secao 1).
 *
 * O que o design mostra e o estado "durante a viagem", com conteudo ficticio.
 * Aqui a forma e a mesma e o conteudo e o real — quando nao existe, o bloco
 * some ou mostra o vazio honesto, em vez de um numero inventado.
 */

const CHEVRON = 'm9 5 7 7-7 7';

export function Chevron({
  size = 16,
  color = palette.textDisabled,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={CHEVRON}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// -----------------------------------------------------------------------------
// 1. Barra de identidade + saudacao
// -----------------------------------------------------------------------------

export interface HomeHeaderProps {
  saudacao: string;
  /** "Dubai · dia 3 de 7". Ausente quando nao ha viagem. */
  contexto?: string | null;
  naoLidas: number;
  onAbrirNotificacoes: () => void;
}

export function HomeHeader({ saudacao, contexto, naoLidas, onAbrirNotificacoes }: HomeHeaderProps) {
  return (
    <View>
      <View style={styles.identidade}>
        <Image source={wordmark} style={styles.wordmark} contentFit="contain" accessible={false} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
          onPress={onAbrirNotificacoes}
          style={({ pressed }) => [styles.sino, pressed && styles.pressionado]}
          testID="home-notificacoes"
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3.6a5.6 5.6 0 0 1 5.6 5.6v3.4l1.5 2.6H4.9l1.5-2.6V9.2A5.6 5.6 0 0 1 12 3.6Z"
              stroke={palette.text}
              strokeWidth={1.7}
              strokeLinejoin="round"
            />
            <Path
              d="M10.2 18.2a1.9 1.9 0 0 0 3.6 0"
              stroke={palette.text}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          </Svg>
          {naoLidas > 0 ? <View style={styles.ponto} testID="home-notificacoes-ponto" /> : null}
        </Pressable>
      </View>

      <View style={styles.saudacao}>
        <Text variant="section" numberOfLines={2} style={styles.saudacaoTexto}>
          {saudacao}
        </Text>
        {contexto ? (
          <Text variant="body" tone="muted" style={styles.saudacaoContexto}>
            {contexto}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 2. Proxima acao
// -----------------------------------------------------------------------------

export interface NextActionCardProps {
  kicker: string;
  titulo: string;
  apoio?: string | null;
  /** Glifo dentro do quadrado dourado de 42. */
  icone: React.ReactNode;
  onPress?: (() => void) | undefined;
  testID?: string;
}

export function NextActionCard({
  kicker,
  titulo,
  apoio,
  icone,
  onPress,
  testID,
}: NextActionCardProps) {
  const conteudo = (
    <View style={styles.acaoLinha}>
      <View style={styles.acaoIcone}>{icone}</View>
      <View style={styles.acaoTexto}>
        <Text variant="caption" tone="gold" style={styles.acaoKicker}>
          {kicker}
        </Text>
        <Text variant="body" numberOfLines={2} style={styles.acaoTitulo}>
          {titulo}
        </Text>
        {apoio ? (
          <Text variant="body" tone="muted" numberOfLines={2} style={styles.acaoApoio}>
            {apoio}
          </Text>
        ) : null}
      </View>
      {onPress ? <Chevron /> : null}
    </View>
  );

  if (!onPress) return <View style={styles.vidro}>{conteudo}</View>;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID}>
      {({ pressed }) => (
        <View style={[styles.vidro, pressed && styles.pressionado]}>{conteudo}</View>
      )}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// 3. Alerta de pendencia — ambar, e so ambar
// -----------------------------------------------------------------------------

export interface PendingAlertProps {
  titulo: string;
  apoio?: string | null;
  onPress?: (() => void) | undefined;
}

export function PendingAlert({ titulo, apoio, onPress }: PendingAlertProps) {
  const corpo = (
    <View style={styles.alertaLinha}>
      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 4.2 21 19.4H3L12 4.2Z"
          stroke={palette.warning}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
        <Path d="M12 10v4" stroke={palette.warning} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M12 16.6h.01" stroke={palette.warning} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <View style={styles.acaoTexto}>
        <Text variant="body" numberOfLines={2} style={styles.alertaTitulo}>
          {titulo}
        </Text>
        {apoio ? (
          <Text variant="body" tone="muted" numberOfLines={2} style={styles.acaoApoio}>
            {apoio}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return <View style={styles.alerta}>{corpo}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => <View style={[styles.alerta, pressed && styles.pressionado]}>{corpo}</View>}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// 4. Faixa pacote + Fly Points
// -----------------------------------------------------------------------------

export interface PackagePointsBandProps {
  /** Pacote adquirido: Standard, Black ou Billionaire. */
  pacote?: string | null;
  /** Saldo de Fly Points. */
  pontos?: string | null;
  /** Progresso de 0 a 1 para o proximo NIVEL de pontos. */
  progressoNivel?: number | null;
  /** Nome do proximo nivel. */
  proximoNivel?: string | null;
}

/**
 * A faixa de duas colunas do design — com a nomenclatura corrigida.
 *
 * O handoff chama a coluna da esquerda de "FLY STATUS", com "Black" e uma
 * barra de progresso "para Billionaire". Isso mistura duas escalas que a D95
 * separou por decisao do dono: **Standard / Black / Billionaire e o pacote
 * adquirido**, e ninguem sobe de pacote acumulando ponto — compra-se.
 * **Basic / prime / elite e o nivel de Fly Points**, esse sim conquistado.
 *
 * Entao: a esquerda mostra o pacote, sem barra, porque nao ha o que progredir.
 * A barra dourada fica na direita, nos pontos, que e onde o progresso existe —
 * e e exatamente o uso que a regra do dourado sempre permitiu ("progresso para
 * o proximo nivel de Fly Points").
 */
export function PackagePointsBand({
  pacote,
  pontos,
  progressoNivel,
  proximoNivel,
}: PackagePointsBandProps) {
  const pct = Math.max(0, Math.min(1, progressoNivel ?? 0));

  return (
    <View style={styles.faixa}>
      <LinearGradient
        colors={['rgba(255,255,255,.08)', 'rgba(255,255,255,.028)']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.faixaTopo} pointerEvents="none" />

      <View style={styles.coluna}>
        <Text variant="caption" tone="muted" style={styles.faixaKicker}>
          SEU PACOTE
        </Text>
        <Text variant="section" style={styles.faixaValor}>
          {pacote ?? '—'}
        </Text>
        <Text variant="body" tone="faint" style={styles.faixaNota}>
          {pacote ? 'Definido na sua contratação' : 'Aparece quando a Fly registrar'}
        </Text>
      </View>

      <View style={styles.fio} />

      <View style={styles.coluna}>
        <Text variant="caption" tone="muted" style={styles.faixaKicker}>
          FLY POINTS
        </Text>
        <Text variant="section" style={styles.faixaValor}>
          {pontos ?? '—'}
        </Text>
        {progressoNivel !== null && progressoNivel !== undefined && proximoNivel ? (
          <>
            <View style={styles.trilho}>
              <LinearGradient
                colors={['#C9A96B', '#DFC98A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.barra, { width: `${pct * 100}%` }]}
              />
            </View>
            <Text variant="body" tone="gold" style={styles.faixaNota}>
              para {proximoNivel}
            </Text>
          </>
        ) : (
          <Text variant="body" tone="faint" style={styles.faixaNota}>
            Fórmula e níveis vêm da Carteira
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressionado: { opacity: 0.88 },

  identidade: {
    paddingTop: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 14 px de altura, como o handoff manda; a largura acompanha a arte.
  wordmark: { width: 62, height: 14, opacity: 0.95 },
  sino: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,13,.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.2)',
  },
  ponto: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.gold,
    shadowColor: 'rgba(223,201,138,.85)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 7,
  },

  saudacao: { paddingVertical: 12, paddingHorizontal: 20, gap: 2 },
  saudacaoTexto: { fontSize: 25, fontWeight: '600', letterSpacing: -0.75 },
  saudacaoContexto: { fontSize: 13.5 },

  vidro: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.085)',
  },
  acaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  acaoIcone: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(223,201,138,.11)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.26)',
  },
  acaoTexto: { flex: 1, minWidth: 0, gap: 1 },
  acaoKicker: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.43 },
  acaoTitulo: { fontSize: 15.5, fontWeight: '600', letterSpacing: -0.28 },
  acaoApoio: { fontSize: 12.5 },

  alerta: {
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(233,162,59,.07)',
    borderWidth: 1,
    borderColor: 'rgba(233,162,59,.22)',
  },
  alertaLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertaTitulo: { fontSize: 15, fontWeight: '600', letterSpacing: -0.24 },

  faixa: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.085)',
  },
  faixaTopo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  coluna: { flex: 1, paddingTop: 12, paddingHorizontal: 15, paddingBottom: 11, gap: space.xxs },
  fio: { width: 1, backgroundColor: 'rgba(255,255,255,.09)' },
  faixaKicker: { fontSize: 9, fontWeight: '700', letterSpacing: 1.35 },
  faixaValor: { fontSize: 19, fontWeight: '700', letterSpacing: -0.57 },
  faixaNota: { fontSize: 11.5 },
  trilho: {
    height: 3,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: 'rgba(255,255,255,.1)',
    overflow: 'hidden',
  },
  barra: {
    height: 3,
    borderRadius: 2,
    shadowColor: 'rgba(223,201,138,.55)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
  },
});
