import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
});
