import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '@/theme';
import { Text } from '@/ui';
import { urlDaImagem } from './midia';

/**
 * Linha de pedido da pagina Meus Passeios (secao 4 do handoff).
 *
 * Medidas de `docs/design/extracao/03-meus-passeios.html`: vidro raio 24 com
 * `padding: 12` e gap 13, miniatura 72 raio 18 com contorno interno de 1 px,
 * kicker dourado 9.5/700/+.14em, nome 15/600/-.018em e um selo de status ao
 * lado do numero de pessoas.
 *
 * O selo **nao usa verde**. O design tem tres: branco para confirmado, ambar
 * para o que aguarda, cinza para concluido. Verde nao esta na paleta, e a tela
 * usava — era a unica cor fora do sistema em toda a pagina.
 */

export type SituacaoDoPedido = 'confirmado' | 'aguardando' | 'concluido';

const SELO: Record<SituacaoDoPedido, { fundo: string; borda: string; ponto: string }> = {
  confirmado: {
    fundo: 'rgba(255,255,255,.1)',
    borda: 'rgba(255,255,255,.14)',
    ponto: '#F5F5F7',
  },
  aguardando: {
    fundo: 'rgba(233,162,59,.13)',
    borda: 'rgba(233,162,59,.26)',
    ponto: '#E9A23B',
  },
  concluido: {
    fundo: 'rgba(255,255,255,.06)',
    borda: 'rgba(255,255,255,.1)',
    ponto: 'rgba(245,245,247,.5)',
  },
};

export interface LinhaDoPedidoProps {
  /** "SEX, 25 AGO · 18:30" */
  quando: string | null;
  titulo: string;
  situacao: SituacaoDoPedido;
  rotuloSituacao: string;
  /** "2 pessoas" */
  pessoas: string | null;
  foto?: string | null;
  aoAbrir: () => void;
  testID?: string;
}

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke="rgba(245,245,247,.22)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LinhaDoPedido({
  quando,
  titulo,
  situacao,
  rotuloSituacao,
  pessoas,
  foto,
  aoAbrir,
  testID,
}: LinhaDoPedidoProps) {
  const url = urlDaImagem(foto ?? null);
  const cores = SELO[situacao];
  const cinza = situacao === 'concluido';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={aoAbrir}
      testID={testID}
    >
      {({ pressed }) => (
        <View style={[styles.linha, pressed && styles.pressionada]}>
          {/* O gradiente fica atras: no React Native Web um irmao absoluto
              pinta por cima do estatico, e ele cobria a miniatura inteira. */}
          <LinearGradient
            colors={['rgba(255,255,255,.07)', 'rgba(255,255,255,.03)']}
            style={styles.fundo}
            pointerEvents="none"
          />

          {/* A foto vai dentro de uma moldura com tamanho, e nao no `style` da
              propria Image: o contentor interno do `expo-image` colapsa para
              altura zero quando so ele carrega a medida. E o padrao que o card
              de passeio e o cartao da viagem ja usam. */}
          <View style={[styles.miniatura, cinza && styles.miniaturaCinza]}>
            {url ? (
              <Image
                source={{ uri: url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : null}
          </View>

          <View style={styles.texto}>
            {quando ? (
              <Text variant="caption" tone="gold" style={[styles.quando, cinza && styles.apagado]}>
                {quando}
              </Text>
            ) : null}
            <Text
              variant="body"
              numberOfLines={2}
              style={[styles.nome, cinza && styles.nomeApagado]}
            >
              {titulo}
            </Text>

            <View style={styles.rodape}>
              <View
                style={[styles.selo, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
              >
                <View style={[styles.seloPonto, { backgroundColor: cores.ponto }]} />
                <Text variant="body" style={styles.seloTexto}>
                  {rotuloSituacao}
                </Text>
              </View>
              {pessoas ? (
                <Text variant="body" style={styles.pessoas}>
                  {pessoas}
                </Text>
              ) : null}
            </View>
          </View>

          <Chevron />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 12,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  pressionada: { transform: [{ scale: 0.99 }] },
  fundo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },

  miniatura: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,.06)',
  },
  // No Historico o design esmaece a miniatura em vez de esconder.
  miniaturaCinza: { opacity: 0.4 },
  miniaturaVazia: { backgroundColor: 'rgba(255,255,255,.06)' },

  texto: { flex: 1, minWidth: 0, zIndex: 1 },
  quando: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.33 },
  apagado: { opacity: 0.5 },
  nome: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.27,
    color: palette.text,
  },
  nomeApagado: { color: 'rgba(245,245,247,.55)' },

  rodape: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 21,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  seloPonto: { width: 5, height: 5, borderRadius: 3 },
  seloTexto: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    color: 'rgba(245,245,247,.86)',
  },
  pessoas: { fontSize: 11.5, color: 'rgba(245,245,247,.36)' },
});

export interface SegmentadoProps {
  opcoes: readonly { chave: string; rotulo: string }[];
  selecionado: string;
  aoEscolher: (chave: string) => void;
}

/** Controle segmentado do design: trilho raio 16 padding 3, segmento 32 raio 13. */
export function Segmentado({ opcoes, selecionado, aoEscolher }: SegmentadoProps) {
  return (
    <View style={seg.trilho}>
      {opcoes.map((o) => {
        const ativo = o.chave === selecionado;
        return (
          <Pressable
            key={o.chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            aria-selected={ativo}
            accessibilityLabel={o.rotulo}
            onPress={() => aoEscolher(o.chave)}
            style={seg.area}
            testID={`segmento-${o.chave}`}
          >
            <View style={[seg.segmento, ativo && seg.ativo]}>
              <Text variant="body" style={[seg.texto, ativo && seg.textoAtivo]}>
                {o.rotulo}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  trilho: {
    marginTop: 20,
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  area: { flex: 1 },
  segmento: {
    height: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ativo: {
    backgroundColor: 'rgba(255,255,255,.13)',
    borderColor: 'rgba(255,255,255,.1)',
  },
  texto: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.16,
    color: 'rgba(245,245,247,.45)',
  },
  textoAtivo: { color: palette.text },
});
