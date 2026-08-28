import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { easing, palette } from '@/theme';
import { Text } from '@/ui';
import { urlDaImagem } from './midia';

/**
 * A folha de Meus Passeios (secao 3 do handoff).
 *
 * Medidas de `docs/design/extracao/08-meus-passeios-sheet.html`: overlay
 * `rgba(0,0,0,.6)` com blur 4 e fade de 300 ms; painel ancorado embaixo com
 * `max-height: 79%`, raio superior 34, `rgba(19,19,23,.88)` e blur 48;
 * entrada de `translateY(101%)` a 0 em **520 ms** na curva de entrada.
 *
 * O toque no overlay fecha — e o gesto que todo mundo tenta primeiro.
 */

const [EX1, EY1, EX2, EY2] = easing.enter;

export interface ItemDaFolha {
  id: string;
  /** "SEX, 25 AGO · 18:30" */
  quando: string | null;
  titulo: string;
  foto?: string | null;
}

export interface MeusPasseiosSheetProps {
  visivel: boolean;
  aoFechar: () => void;
  titulo?: string;
  resumo?: string | null;
  itens: readonly ItemDaFolha[];
  aoAbrirPagina: () => void;
}

function Fechar() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke="rgba(245,245,247,.62)"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MeusPasseiosSheet({
  visivel,
  aoFechar,
  titulo = 'Meus Passeios',
  resumo,
  itens,
  aoAbrirPagina,
}: MeusPasseiosSheetProps) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: visivel ? 1 : 0,
      duration: visivel ? 520 : 260,
      easing: Easing.bezier(EX1, EY1, EX2, EY2),
      useNativeDriver: true,
    }).start();
  }, [visivel, t]);

  return (
    <Modal visible={visivel} transparent animationType="none" onRequestClose={aoFechar}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: t }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={aoFechar}
          style={StyleSheet.absoluteFill}
        >
          {() => (
            <View style={StyleSheet.absoluteFill}>
              <BlurView intensity={4} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.veu} />
            </View>
          )}
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.painel,
          {
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }) },
            ],
          },
        ]}
      >
        <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.fundo} pointerEvents="none" />
        <View style={styles.luz} pointerEvents="none" />

        <View style={styles.puxador} />

        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoTexto}>
            <Text variant="section" style={styles.titulo}>
              {titulo}
            </Text>
            {resumo ? (
              <Text variant="body" style={styles.resumo}>
                {resumo}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={aoFechar}
            style={styles.botaoFechar}
            testID="folha-fechar"
          >
            <Fechar />
          </Pressable>
        </View>

        <View style={styles.lista}>
          {itens.map((it) => (
            <View key={it.id} style={styles.linha}>
              {urlDaImagem(it.foto ?? null) ? (
                <Image
                  source={{ uri: urlDaImagem(it.foto ?? null) as string }}
                  style={styles.miniatura}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.miniatura, styles.miniaturaVazia]} />
              )}
              <View style={styles.linhaTexto}>
                {it.quando ? (
                  <Text variant="caption" tone="gold" style={styles.quando}>
                    {it.quando}
                  </Text>
                ) : null}
                <Text variant="body" numberOfLines={2} style={styles.nome}>
                  {it.titulo}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir Meus Passeios"
          onPress={aoAbrirPagina}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressionado]}
          testID="folha-abrir"
        >
          <Text variant="body" style={styles.ctaTexto}>
            Abrir Meus Passeios
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veu: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.6)',
  },

  painel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '79%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
    paddingTop: 10,
    paddingBottom: 32,
    shadowColor: 'rgba(0,0,0,.7)',
    shadowOffset: { width: 0, height: -30 },
    shadowOpacity: 1,
    shadowRadius: 60,
  },
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(19,19,23,.88)',
  },
  luz: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,.14)',
  },

  puxador: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,.28)',
    alignSelf: 'center',
  },

  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  cabecalhoTexto: { flex: 1, minWidth: 0 },
  titulo: { fontSize: 20, fontWeight: '700', letterSpacing: -0.6 },
  resumo: {
    marginTop: 4,
    fontSize: 12.5,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.44)',
  },
  botaoFechar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.09)',
  },

  lista: { marginTop: 16, paddingHorizontal: 20, gap: 14 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  miniatura: { width: 56, height: 56, borderRadius: 16 },
  miniaturaVazia: { backgroundColor: 'rgba(255,255,255,.06)' },
  linhaTexto: { flex: 1, minWidth: 0 },
  quando: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.33 },
  nome: {
    marginTop: 5,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.26,
    color: palette.text,
  },

  cta: {
    marginTop: 20,
    marginHorizontal: 20,
    height: 50,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F5',
  },
  ctaPressionado: { transform: [{ scale: 0.98 }] },
  ctaTexto: { fontSize: 15.5, fontWeight: '600', letterSpacing: -0.28, color: '#0A0A0B' },
});
