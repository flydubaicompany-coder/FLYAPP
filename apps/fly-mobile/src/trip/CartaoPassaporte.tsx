import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '@/ui';
import { usePrefersReducedMotion } from '@/ui';
import { cor, marca, raio } from './design';
import { linhasMrz, type DadosDoPassaporte } from './mrz';

/**
 * O cartão do passaporte, com o brilho que atravessa.
 *
 * É a peça mais caprichada do arquivo de design, e a animação é o que a faz
 * parecer um documento e não uma tabela: uma faixa de luz inclinada cruza o
 * cartão a cada 5.4 s — `flyShine` no arquivo, `translateX(-150%) → 260%` com
 * `skewX(-18deg)`, opacidade subindo até .85 aos 18% e caindo até o fim.
 *
 * ## O reset explícito
 *
 * `Animated.loop` sozinho deixa o valor parado no fim da primeira volta — o
 * mesmo defeito já documentado no anel da boia, em `FloatingActionRail`. A
 * sequência volta a zero com duração zero, e é isso que faz a segunda passada
 * acontecer.
 *
 * ## Quem pediu menos movimento recebe menos movimento
 *
 * Com "reduzir movimento" ligado no sistema, a faixa não corre. O cartão
 * continua inteiro — só para de brilhar.
 */
export function CartaoPassaporte({
  dados,
  verificado,
}: {
  dados: DadosDoPassaporte;
  verificado: boolean;
}) {
  const brilho = useRef(new Animated.Value(0)).current;
  const semMovimento = usePrefersReducedMotion();

  useEffect(() => {
    if (semMovimento) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(brilho, {
          toValue: 1,
          duration: 5400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(brilho, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [brilho, semMovimento]);

  const [linha1, linha2] = linhasMrz(dados);

  const validade = dados.validade
    ? new Date(`${dados.validade}T12:00:00`)
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        .replace('.', '')
        .toUpperCase()
    : '—';

  return (
    <View style={e.cartao}>
      <LinearGradient
        colors={['#2A2418', '#151310', '#0C0B09']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          e.brilho,
          {
            opacity: brilho.interpolate({
              inputRange: [0, 0.18, 1],
              outputRange: [0, 0.85, 0],
            }),
            transform: [
              {
                translateX: brilho.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-150%', '260%'],
                }),
              },
              { skewX: '-18deg' },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,.10)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={e.topo}>
        <View>
          <Text style={e.republica}>REPÚBLICA FEDERATIVA DO BRASIL</Text>
          <Text style={e.palavra}>PASSAPORTE</Text>
        </View>
        <Image source={marca.asaDourada} style={e.asa} resizeMode="contain" />
      </View>

      <View style={e.corpo}>
        <View style={e.retrato}>
          <Svg
            width={30}
            height={30}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(223,201,138,.45)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Circle cx={12} cy={8.4} r={3.8} />
            <Path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" />
          </Svg>
        </View>

        <View style={e.campos}>
          <Text style={e.rotulo}>NOME</Text>
          <Text style={e.valorNome} numberOfLines={2}>
            {dados.nomeCompleto.toUpperCase()}
          </Text>

          <View style={e.doisCampos}>
            <View>
              <Text style={e.rotulo}>NÚMERO</Text>
              <Text style={e.valor}>{dados.numero.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={e.rotulo}>VALIDADE</Text>
              <Text style={e.valor}>{validade}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={e.faixa}>
        {/* A MRZ é transcrição do que a pessoa cadastrou — nada aqui é
            inventado. Ver `mrz.ts`. */}
        <Text style={e.mrz}>{linha1}</Text>
        <Text style={e.mrz}>{linha2}</Text>
      </View>

      {verificado ? null : (
        <View style={e.aguardando}>
          <Text style={e.aguardandoTexto}>Aguardando conferência da Fly</Text>
        </View>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  cartao: {
    borderRadius: raio.cartao,
    overflow: 'hidden',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.18)',
  },
  brilho: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '36%' },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  republica: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.7,
    color: 'rgba(223,201,138,.8)',
  },
  palavra: {
    marginTop: 7,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: cor.ouroClaro,
  },
  asa: { height: 9, width: 28, opacity: 0.8 },
  corpo: { marginTop: 20, flexDirection: 'row', gap: 14 },
  retrato: {
    width: 64,
    height: 82,
    borderRadius: 10,
    backgroundColor: 'rgba(223,201,138,.08)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campos: { flex: 1, minWidth: 0 },
  rotulo: { fontSize: 8.5, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(223,201,138,.6)' },
  valorNome: {
    marginTop: 3,
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: cor.texto,
  },
  doisCampos: { marginTop: 11, flexDirection: 'row', gap: 18 },
  valor: { marginTop: 3, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.75, color: cor.texto },
  faixa: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(223,201,138,.16)',
  },
  mrz: {
    fontFamily: 'monospace',
    fontSize: 8.5,
    lineHeight: 13,
    letterSpacing: 0.4,
    color: 'rgba(245,245,247,.42)',
  },
  aguardando: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: cor.avisoTinta,
    borderWidth: 1,
    borderColor: cor.avisoBorda,
  },
  aguardandoTexto: { fontSize: 11, fontWeight: '600', color: cor.aviso },
});
