import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { FlyPackage } from '@fly/design-tokens';
import { palette } from '@/theme';
import { Text } from '@/ui';
import { ROTULO_PACOTE } from './pacote';
import asaOuro from '../../assets/brand/fly-wing-gold.png';

/**
 * O cartao da Carteira, medido em `docs/design/extracao/05-carteira.html`.
 *
 * Altura 202, raio 26, nucleo em degrade radial `128% 128% at 82% 6%`, borda
 * dourada `.26`, brilho de 196 no canto superior direito, chip de 38x28 e a
 * lasca de um segundo cartao aparecendo por tras — que e o que da a ele a
 * leitura de "carteira", e nao de "caixa".
 *
 * **O saldo e real.** Vem de `wallet_entries`, o ledger financeiro, que e
 * dominio separado dos pontos (§41). Zero e zero, e nao um numero inventado
 * para a tela parecer cheia.
 *
 * No lugar do numero do cartao vai o **Fly ID**. O `•••• 4102` do canvas
 * pressupoe um cartao emitido, que exige parceiro de pagamento (P09/P38). O
 * Fly ID e a credencial que existe, e e desta pessoa.
 */

const NUCLEO = [
  { offset: '0', color: '#32323A' },
  { offset: '0.44', color: '#191920' },
  { offset: '1', color: '#0B0B0E' },
] as const;

export interface CartaoDaCarteiraProps {
  /** Saldo em centavos. */
  centavos: number;
  moeda: string;
  nome: string;
  flyId: string;
  pacote: FlyPackage | null;
}

function dinheiro(centavos: number, moeda: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(
      centavos / 100,
    );
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

export function CartaoDaCarteira({ centavos, moeda, nome, flyId, pacote }: CartaoDaCarteiraProps) {
  return (
    <View style={styles.area}>
      {/* A lasca do cartao de tras. E ela que faz o bloco parecer uma
          carteira com mais de um cartao dentro. */}
      <View style={styles.atras} pointerEvents="none" />

      <View style={styles.cartao}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="cartaoNucleo" cx="82%" cy="6%" r="128%">
              {NUCLEO.map((p) => (
                <Stop key={p.offset} offset={p.offset} stopColor={p.color} />
              ))}
            </RadialGradient>
            <RadialGradient id="cartaoBrilho" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#DFC98A" stopOpacity={0.16} />
              <Stop offset="0.7" stopColor="#DFC98A" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cartaoNucleo)" />
          {/* O brilho dourado escapando pelo canto de cima. */}
          <Circle cx="100%" cy="0" r="98" fill="url(#cartaoBrilho)" />
        </Svg>

        {/* A linha de luz de 1 px. `inset box-shadow` nao existe no React
            Native — vira uma View, como em todo material do app (D109). */}
        <View style={styles.luz} pointerEvents="none" />

        <View style={styles.topo} pointerEvents="none">
          <Image source={asaOuro} style={styles.asa} contentFit="contain" />
          {pacote ? (
            <View style={styles.selo}>
              <Text variant="caption" style={styles.seloTexto}>
                {ROTULO_PACOTE[pacote].replace('FLY ', '')}
              </Text>
            </View>
          ) : null}
        </View>

        <LinearGradient
          colors={['rgba(223,201,138,.62)', 'rgba(201,169,107,.32)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chip}
          pointerEvents="none"
        />

        <View style={styles.base} pointerEvents="none">
          <Text variant="caption" style={styles.kicker}>
            SALDO DISPONÍVEL
          </Text>
          <Text variant="largeTitle" style={styles.saldo}>
            {dinheiro(centavos, moeda)}
          </Text>
          <View style={styles.rodape}>
            <Text variant="body" numberOfLines={1} style={styles.nome}>
              {nome.toUpperCase()}
            </Text>
            <Text variant="body" style={styles.flyId}>
              {flyId}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ acoes */

export interface AcaoProps {
  icone: ReactNode;
  rotulo: string;
  /** Explicacao quando a acao ainda nao existe. `null` = disponivel. */
  indisponivel: string | null;
  onPress: () => void;
}

export function AcaoDaCarteira({ icone, rotulo, indisponivel, onPress }: AcaoProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={indisponivel ? `${rotulo}. ${indisponivel}` : rotulo}
      onPress={onPress}
      style={styles.acaoArea}
      testID={`carteira-${rotulo}`}
    >
      {({ pressed }) => (
        <View
          style={[styles.acao, pressed && styles.acaoPressionada, !!indisponivel && styles.acaoOff]}
        >
          {icone}
          <Text variant="body" style={styles.acaoTexto}>
            {rotulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function LinhaDeAcoes({ children }: { children: ReactNode }) {
  return <View style={styles.acoes}>{children}</View>;
}

const styles = StyleSheet.create({
  area: { marginTop: 22, marginHorizontal: 16, paddingTop: 9 },
  atras: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 40,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },

  cartao: {
    height: 202,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.26)',
    shadowColor: 'rgba(0,0,0,.95)',
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 1,
    shadowRadius: 52,
    elevation: 12,
  },
  luz: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,.11)',
  },

  topo: {
    position: 'absolute',
    top: 20,
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  asa: { width: 30, height: 13 },
  selo: {
    height: 23,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.22)',
  },
  seloTexto: { fontSize: 9, fontWeight: '700', letterSpacing: 1.26, color: '#fff' },

  chip: {
    position: 'absolute',
    left: 22,
    top: 74,
    width: 38,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.4)',
  },

  base: { position: 'absolute', left: 22, right: 22, bottom: 20 },
  /* As alturas de linha sao explicitas porque o bloco e ancorado embaixo e
     cresce para cima: qualquer sobra empurra o texto para dentro do chip. */
  kicker: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 1.44,
    color: 'rgba(223,201,138,.85)',
  },
  saldo: {
    marginTop: 7,
    fontSize: 29,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -1.04,
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  rodape: {
    marginTop: 13,
    flexDirection: 'row',
    // Altura fixa: `alignItems: 'baseline'` no React Native Web soma folga que
    // o CSS do design nao soma, e a linha vinha com 23 em vez de 14. Como o
    // bloco e ancorado embaixo e cresce para cima, essa folga empurrava o
    // texto para dentro do chip.
    height: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nome: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.72,
    color: 'rgba(255,255,255,.72)',
  },
  flyId: {
    fontSize: 11.5,
    letterSpacing: 0.69,
    color: 'rgba(255,255,255,.42)',
    fontVariant: ['tabular-nums'],
  },

  acoes: { flexDirection: 'row', gap: 10, marginTop: 16, marginHorizontal: 16 },
  acaoArea: { flex: 1 },
  acao: {
    alignItems: 'center',
    gap: 9,
    paddingTop: 14,
    paddingBottom: 13,
    paddingHorizontal: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.075)',
  },
  acaoPressionada: { transform: [{ scale: 0.96 }] },
  // Indisponivel nao some: fica recuado. Sumir esconderia do cliente o que a
  // Carteira vai fazer quando o parceiro existir.
  acaoOff: { opacity: 0.5 },
  acaoTexto: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.12,
    color: 'rgba(245,245,247,.82)',
  },
});

export { palette };
