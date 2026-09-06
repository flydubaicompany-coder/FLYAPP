import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Text } from '@/ui';
import { casca, cor, marca, raio, sombra, tipo } from './design';

/**
 * A casca do Trip Mode: barra inferior, botão do WhatsApp e o véu.
 *
 * Cinco destinos, como o design manda — e **Carteira continua na barra, com
 * cadeado**. Foi a correção mais importante desta rodada: eu a tinha removido,
 * e o design a mantém visível e bloqueada. As duas leituras são defensáveis, e
 * a do design é melhor: uma aba que some deixa a pessoa achando que a Fly
 * tirou o benefício; uma aba com cadeado diz que ele existe e ainda não abriu.
 *
 * O botão central é a asa dourada, sem rótulo — é o único item da barra sem
 * texto, e é assim que ele se lê como botão e não como aba.
 */

type Destino = 'home' | 'roteiro' | 'viagem' | 'carteira' | 'perfil';

export interface TripChromeProps {
  ativo: Destino;
  onIr: (destino: Destino) => void;
  onAjuda: () => void;
  /** Carteira aparece com cadeado enquanto a regra de pontos for pendência. */
  carteiraBloqueada?: boolean;
}

function IconeCasa({ cor: c }: { cor: string }) {
  return (
    <Svg
      width={21}
      height={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3.4 10.8L12 3.8l8.6 7v9.4H3.4z" />
      <Path d="M9.6 20.2v-6h4.8v6" />
    </Svg>
  );
}

function IconeRoteiro({ cor: c }: { cor: string }) {
  return (
    <Svg
      width={21}
      height={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={3.4} y={4.8} width={17.2} height={15.8} rx={3} />
      <Path d="M3.4 9.4h17.2M8.4 2.8v3.4M15.6 2.8v3.4" />
    </Svg>
  );
}

function IconeCarteira({ cor: c }: { cor: string }) {
  return (
    <Svg
      width={21}
      height={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={2.8} y={6.2} width={18.4} height={12.6} rx={3} />
      <Path d="M2.8 10.6h18.4" />
    </Svg>
  );
}

function IconePerfil({ cor: c }: { cor: string }) {
  return (
    <Svg
      width={21}
      height={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={8.4} r={3.8} />
      <Path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" />
    </Svg>
  );
}

/** O cadeado de 7px que se sobrepõe ao ícone da Carteira. */
function SeloDeCadeado() {
  return (
    <View style={estilos.cadeado}>
      <Svg
        width={7}
        height={7}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(245,245,247,.65)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Rect x={4.4} y={10.4} width={15.2} height={10.4} rx={2.4} />
        <Path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" />
      </Svg>
    </View>
  );
}

export function GlifoWhatsapp({
  tamanho = 18,
  cor: c = cor.zapTexto,
}: {
  tamanho?: number;
  cor?: string;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={c}>
      <Path d="M12 2.2A9.7 9.7 0 0 0 3.7 17l-1.3 4.8 5-1.3A9.7 9.7 0 1 0 12 2.2zm0 1.8a7.9 7.9 0 1 1-4 14.7l-.5-.3-2.9.8.8-2.8-.3-.5A7.9 7.9 0 0 1 12 4zm-3.4 3.7c-.2 0-.5.1-.7.4-.3.3-.8.9-.8 1.9s.8 2.1.9 2.3c.1.2 1.5 2.4 3.7 3.3 1.9.7 2.2.6 2.6.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3l-1.5-.7c-.2-.1-.4-.1-.5.1l-.6.8c-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.7-1.1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.4-.5c.1-.2.1-.3.2-.5 0-.1 0-.3-.1-.4l-.6-1.5c-.2-.4-.3-.4-.5-.5h-.4z" />
    </Svg>
  );
}

function Aba({
  rotulo,
  ativo,
  onPress,
  children,
  selo,
}: {
  rotulo: string;
  ativo: boolean;
  onPress: () => void;
  children: (c: string) => React.ReactNode;
  selo?: React.ReactNode;
}) {
  // Ativo é branco, inativo é 45% — os dois valores do design. O dourado NÃO
  // marca aba selecionada: não está entre os usos permitidos, e já esteve
  // errado aqui uma vez.
  const c = ativo ? cor.texto : cor.m45;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      aria-selected={ativo}
      accessibilityLabel={rotulo}
      onPress={onPress}
      style={estilos.aba}
      testID={`trip-aba-${rotulo.toLowerCase()}`}
    >
      <View>
        {children(c)}
        {selo}
      </View>
      <Text style={[tipo('aba'), { color: c }]} numberOfLines={1}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

export function TripChrome({ ativo, onIr, onAjuda, carteiraBloqueada = true }: TripChromeProps) {
  const insets = useSafeAreaInsets();
  const naViagem = ativo === 'viagem';

  return (
    <>
      {/* O véu. Não é decoração: sem ele o conteúdo rolando passa por baixo da
          barra de vidro e fica legível através dela, o que suja a leitura. */}
      <LinearGradient
        colors={['rgba(8,8,10,0)', 'rgba(8,8,10,.86)', cor.fundo]}
        locations={[0, 0.46, 1]}
        style={[estilos.veu, { height: casca.veuAltura + insets.bottom }]}
        pointerEvents="none"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Preciso de ajuda"
        accessibilityHint="Abre o suporte da Fly pelo WhatsApp"
        onPress={onAjuda}
        style={({ pressed }) => [
          estilos.zap,
          { bottom: casca.zapDeBaixo + insets.bottom },
          sombra.zap,
          pressed && estilos.apertado,
        ]}
        testID="trip-ajuda"
      >
        <LinearGradient
          colors={[cor.zapTopo, cor.zapBase]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <GlifoWhatsapp />
        <Text style={[tipo('legenda'), estilos.zapTexto]}>Preciso de ajuda</Text>
      </Pressable>

      <View
        style={[estilos.barra, { bottom: casca.barraInferior + insets.bottom }, sombra.barra]}
        accessibilityRole="tablist"
      >
        <BlurView intensity={28} tint="dark" style={estilos.material} />

        <Aba rotulo="Início" ativo={ativo === 'home'} onPress={() => onIr('home')}>
          {(c) => <IconeCasa cor={c} />}
        </Aba>

        <Aba rotulo="Roteiro" ativo={ativo === 'roteiro'} onPress={() => onIr('roteiro')}>
          {(c) => <IconeRoteiro cor={c} />}
        </Aba>

        {/* O botão central: sem rótulo, e é isso que o faz ler como botão. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minha viagem"
          accessibilityState={{ selected: naViagem }}
          onPress={() => onIr('viagem')}
          style={estilos.centro}
          testID="trip-aba-viagem"
        >
          <View
            style={[estilos.asa, { borderColor: naViagem ? cor.ouroBorda60 : cor.ouroBorda30 }]}
          >
            <LinearGradient
              colors={[cor.ouroTinta26, 'rgba(223,201,138,.06)']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Image
              source={marca.asaDourada}
              style={[estilos.asaImagem, { opacity: naViagem ? 1 : 0.72 }]}
              resizeMode="contain"
            />
          </View>
        </Pressable>

        <Aba
          rotulo="Carteira"
          ativo={ativo === 'carteira'}
          onPress={() => onIr('carteira')}
          selo={carteiraBloqueada ? <SeloDeCadeado /> : undefined}
        >
          {(c) => <IconeCarteira cor={c} />}
        </Aba>

        <Aba rotulo="Perfil" ativo={ativo === 'perfil'} onPress={() => onIr('perfil')}>
          {(c) => <IconePerfil cor={c} />}
        </Aba>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  veu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 70,
  },
  zap: {
    position: 'absolute',
    right: casca.zapDireita,
    zIndex: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: casca.zapAltura,
    paddingHorizontal: 18,
    borderRadius: casca.zapAltura / 2,
    overflow: 'hidden',
  },
  zapTexto: {
    color: cor.zapTexto,
    fontWeight: '700',
  },
  barra: {
    position: 'absolute',
    left: casca.barraMargem,
    right: casca.barraMargem,
    height: casca.barraAltura,
    zIndex: 80,
    borderRadius: raio.barra,
    borderWidth: 1,
    borderColor: cor.barraBorda,
    backgroundColor: cor.barra,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  material: {
    // `StyleSheet.absoluteFillObject` nao existe no tipo desta versao do RN —
    // armadilha ja registrada no ESTADO. As quatro bordas a mao resolvem.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: raio.barra,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  cadeado: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#1B1B20',
    borderWidth: 1,
    borderColor: cor.vidro16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: {
    width: 60,
    alignItems: 'center',
  },
  asa: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  asaImagem: {
    height: 11,
    width: 34,
  },
  apertado: {
    transform: [{ scale: 0.94 }],
  },
});
