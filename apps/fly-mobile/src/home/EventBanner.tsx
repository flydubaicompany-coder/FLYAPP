import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { easing, palette, radius, space } from '@/theme';
import { Text } from '@/ui';
import type { HomeEvent } from './useHome';
import { urlDaImagem } from '@/passeios/midia';
import wingGold from '../../assets/brand/fly-wing.png';

/**
 * O carrossel de eventos da Home (secao 1, item 3 do handoff).
 *
 * Medidas do design: altura 340, raio 30, margem lateral 16. Tres slides num
 * trilho de 300%, autoplay de 5400 ms, arraste que segue o dedo e solta
 * avancando se |dx| > 46.
 *
 * **O conteudo e real.** O design traz Fly Cup, Legends e Fly Summit como
 * exemplo; aqui entram os eventos que o Fly Ops publicou, e a §33 continua
 * valendo: nada de data, local ou beneficio inventado. Evento sem foto nao
 * entra no carrossel — um slide de 340 px sem imagem e um buraco preto.
 */

const ALTURA = 340;
const MARGEM = 16;
const AVANCA_EM = 46;
const AUTOPLAY_MS = 5400;
const TRANSICAO_MS = 620;
const INDICADOR_MS = 550;
const PASSO_INDICADOR = 24;

const [CX1, CY1, CX2, CY2] = easing.continuous;
const [EX1, EY1, EX2, EY2] = easing.enter;

function Chevron({ size = 12, color = '#F5F5F7' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 5 7 7-7 7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Kicker do slide: "12–14 SET · JUMEIRAH GOLF ESTATES", sem inventar nada. */
function kickerDe(evento: HomeEvent): string | null {
  const partes: string[] = [];
  if (evento.startsAt) {
    const d = new Date(evento.startsAt);
    partes.push(
      d
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        .replace('.', '')
        .toUpperCase(),
    );
  }
  if (evento.city) partes.push(evento.city.toUpperCase());
  return partes.length > 0 ? partes.join(' · ') : null;
}

export interface EventBannerProps {
  eventos: HomeEvent[];
}

export function EventBanner({ eventos }: EventBannerProps) {
  const { width: larguraTela } = useWindowDimensions();
  const largura = larguraTela - MARGEM * 2;

  // Evento sem foto fica de fora: o slide e uma foto com texto por cima.
  const slides = eventos.filter((e) => e.imagem).slice(0, 3);

  const [indice, setIndice] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const desloc = useRef(new Animated.Value(0)).current;
  const traco = useRef(new Animated.Value(0)).current;
  const indiceRef = useRef(0);
  indiceRef.current = indice;

  function irPara(n: number) {
    const alvo = (n + slides.length) % slides.length;
    setIndice(alvo);
    Animated.timing(desloc, {
      toValue: -alvo * largura,
      duration: TRANSICAO_MS,
      easing: Easing.bezier(CX1, CY1, CX2, CY2),
      useNativeDriver: true,
    }).start();
    Animated.timing(traco, {
      toValue: alvo * PASSO_INDICADOR,
      duration: INDICADOR_MS,
      easing: Easing.bezier(EX1, EY1, EX2, EY2),
      useNativeDriver: true,
    }).start();
  }

  // Autoplay, pausado durante o arraste.
  useEffect(() => {
    if (arrastando || slides.length < 2) return;
    const id = setTimeout(() => irPara(indiceRef.current + 1), AUTOPLAY_MS);
    return () => clearTimeout(id);
    // `irPara` fica fora das dependencias de proposito: ela e recriada a cada
    // render e entraria em laco. O projeto nao tem o plugin `react-hooks`, e
    // um `eslint-disable` de regra inexistente e erro de lint — daqui o
    // comentario em vez da diretiva.
  }, [indice, arrastando, slides.length, largura]);

  const pan = useRef(
    PanResponder.create({
      // So assume o gesto quando ele e claramente horizontal — senao o
      // carrossel rouba a rolagem vertical da Home inteira.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderGrant: () => setArrastando(true),
      onPanResponderMove: (_e, g) => {
        desloc.setValue(-indiceRef.current * largura + g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        setArrastando(false);
        if (Math.abs(g.dx) > AVANCA_EM) irPara(indiceRef.current + (g.dx < 0 ? 1 : -1));
        else irPara(indiceRef.current);
      },
    }),
  ).current;

  if (slides.length === 0) return null;

  return (
    <View style={[styles.moldura, { height: ALTURA }]} {...pan.panHandlers}>
      <Animated.View
        style={[
          styles.trilho,
          { width: largura * slides.length, transform: [{ translateX: desloc }] },
        ]}
      >
        {slides.map((evento) => (
          <View key={evento.id} style={[styles.slide, { width: largura }]}>
            <Image
              source={{ uri: urlDaImagem(evento.imagem) ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
            />
            {/* Degrade de leitura em quatro paradas, como o design. */}
            <LinearGradient
              colors={['rgba(4,4,6,.55)', 'rgba(4,4,6,.04)', 'rgba(4,4,6,.5)', 'rgba(4,4,6,.95)']}
              locations={[0, 0.3, 0.64, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>
        ))}
      </Animated.View>

      {/* Pilula "EVENTOS FLY" — dourada, e um dos usos permitidos. */}
      <View style={styles.pilula} pointerEvents="none">
        <Image source={wingGold} style={styles.asa} contentFit="contain" tintColor={palette.gold} />
        <Text variant="caption" tone="gold" style={styles.pilulaTexto}>
          EVENTOS FLY
        </Text>
      </View>

      <View style={styles.texto} pointerEvents="none">
        {kickerDe(slides[indice]!) ? (
          <Text variant="caption" tone="gold" style={styles.kicker}>
            {kickerDe(slides[indice]!)}
          </Text>
        ) : null}
        <Text variant="largeTitle" numberOfLines={2} style={styles.titulo}>
          {slides[indice]!.title}
        </Text>
        {slides[indice]!.summary ? (
          <Text variant="body" numberOfLines={2} style={styles.apoio}>
            {slides[indice]!.summary}
          </Text>
        ) : null}
      </View>

      <View style={styles.rodape}>
        <Link href={`/eventos/${slides[indice]!.slug}`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Ver detalhes do evento">
            {({ pressed }) => (
              <View style={[styles.cta, pressed && styles.ctaPressionado]}>
                <Text variant="body" style={styles.ctaTexto}>
                  Ver detalhes
                </Text>
                <Chevron />
              </View>
            )}
          </Pressable>
        </Link>

        {slides.length > 1 ? (
          <View style={styles.indicador} pointerEvents="none">
            {slides.map((s) => (
              <View key={s.id} style={styles.traco} />
            ))}
            <Animated.View style={[styles.tracoAtivo, { transform: [{ translateX: traco }] }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moldura: {
    marginHorizontal: MARGEM,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: '#101013',
    shadowColor: 'rgba(0,0,0,.95)',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 1,
    shadowRadius: 62,
    elevation: 12,
  },
  trilho: { flexDirection: 'row', height: '100%' },
  slide: { height: '100%' },

  pilula: {
    position: 'absolute',
    top: 18,
    left: 20,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,10,13,.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.2)',
    zIndex: 2,
  },
  asa: { width: 7, height: 7 },
  pilulaTexto: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.33 },

  texto: { position: 'absolute', left: 22, right: 22, bottom: 66, gap: space.xxs, zIndex: 2 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.45 },
  titulo: { fontSize: 31, fontWeight: '700', letterSpacing: -1.12, color: '#FFFFFF' },
  apoio: { fontSize: 13.5, color: 'rgba(255,255,255,.68)' },

  rodape: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  cta: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.24)',
  },
  ctaPressionado: { opacity: 0.88 },
  ctaTexto: { fontSize: 13, fontWeight: '600', color: '#F5F5F7' },

  indicador: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  traco: { width: 18, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.26)' },
  tracoAtivo: {
    position: 'absolute',
    left: 0,
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.gold,
  },
});
