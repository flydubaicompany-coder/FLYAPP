import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/ui';
import { casca, cor, tipo } from './design';

/**
 * A casca de uma tela interna do Trip Mode.
 *
 * Todas seguem o mesmo desenho: kicker dourado, título de 26px e uma linha de
 * apoio. O respiro de baixo é 124 — o que a barra flutuante ocupa. Sem ele o
 * último item fica embaixo dela, que é o defeito mais comum de barra
 * flutuante e o mais fácil de não notar numa tela grande.
 *
 * O topo é 56 no arquivo porque lá o recorte da câmera é fixo. Aqui vem do
 * `safe area`, que é a mesma intenção medida no aparelho de verdade.
 */
export function TripTela({
  kicker,
  titulo,
  apoio,
  acao,
  children,
}: {
  kicker: string;
  titulo: string;
  apoio?: string | undefined;
  acao?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={e.tela}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 20) + 10,
        paddingBottom: casca.respiroInferior + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={e.cabecalho}>
        <View style={e.cabecalhoTextos}>
          <Text style={[tipo('kicker'), { color: cor.ouro }]}>{kicker}</Text>
          <Text style={[tipo('tituloTela'), e.titulo]}>{titulo}</Text>
          {apoio ? <Text style={[tipo('apoio'), e.apoio]}>{apoio}</Text> : null}
        </View>
        {acao}
      </View>
      {children}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: casca.margemTexto,
  },
  cabecalhoTextos: { flex: 1 },
  titulo: { marginTop: 8, color: cor.texto },
  apoio: { marginTop: 6, color: cor.m45 },

  barraInterna: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: casca.margemTexto,
    paddingTop: 14,
  },
  voltar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.085)',
    backgroundColor: cor.vidro05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voltarApertado: { transform: [{ scale: 0.9 }] },
  tituloInterno: { fontSize: 15, fontWeight: '600', letterSpacing: -0.27, color: cor.texto },
});

/**
 * A casca das telas internas: seta de voltar de 36px e título de 15px.
 *
 * É outro cabeçalho, e não uma variação do de cima. As telas de aba se
 * apresentam com kicker e título grande; as internas — voo, voucher,
 * documentos — chegam por um toque e precisam de duas coisas: o caminho de
 * volta e o nome do lugar. Um título de 26px aqui roubaria a atenção do
 * conteúdo, que é o motivo de a pessoa ter entrado.
 */
export function TripTelaInterna({
  titulo,
  children,
  aoVoltar,
}: {
  titulo: string;
  children: ReactNode;
  aoVoltar?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={e.tela}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 20) + 4,
        paddingBottom: casca.respiroInferior + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={e.barraInterna}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => (aoVoltar ? aoVoltar() : router.back())}
          style={({ pressed }) => [e.voltar, pressed && e.voltarApertado]}
          testID="trip-voltar"
        >
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={cor.texto}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text style={e.tituloInterno}>{titulo}</Text>
      </View>
      {children}
    </ScrollView>
  );
}
