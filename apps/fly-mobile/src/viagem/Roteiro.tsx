import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette } from '@/theme';
import { Text } from '@/ui';
import { urlDaImagem } from '@/passeios/midia';

/**
 * A linha do tempo do dia, na composicao do handoff (secao 5, item 4).
 *
 * Medidas de `docs/design/extracao/04-minha-viagem.html`: rail de 8 px com
 * `padding-top: 19` para a bolinha alinhar com a linha da hora, fio de 1.5 px
 * em degrade, e o conteudo com `padding-bottom: 12`.
 *
 * O **item destacado** — o proximo compromisso — vira um cartao de vidro raio
 * 22 com borda dourada, miniatura de 52 e duas acoes de 42 divididas por um
 * fio de 1 px. E o unico item que ganha superficie: os outros sao texto solto
 * ao lado do trilho, e e essa diferenca que faz o proximo saltar.
 */

export interface ItemDoRoteiro {
  id: string;
  titulo: string;
  /** "08:00" */
  hora: string | null;
  /** "CONCLUÍDO", "CONFIRMADO", "EM 4H 12MIN" */
  status: string | null;
  local: string | null;
  /** Cinza no passado. */
  concluido: boolean;
  /** Ambar quando pende confirmacao. */
  pendente: boolean;
  /** O proximo: ganha o cartao de vidro. */
  destaque: boolean;
  /** Miniatura do cartao destacado. */
  foto?: string | null;
  /** "2h 30 · nível 148 · 2 ingressos" */
  detalhes?: string | null;
}

export interface RoteiroDoDiaProps {
  titulo: string;
  itens: readonly ItemDoRoteiro[];
  aoAbrir: (id: string) => void;
  aoVerIngressos?: (() => void) | undefined;
  aoVerRota?: (() => void) | undefined;
}

export function RoteiroDoDia({
  titulo,
  itens,
  aoAbrir,
  aoVerIngressos,
  aoVerRota,
}: RoteiroDoDiaProps) {
  return (
    <View>
      <View style={styles.cabecalhoDia}>
        <Text variant="section" style={styles.tituloDia}>
          {titulo}
        </Text>
        <Text variant="body" style={styles.contagem}>
          {itens.length} {itens.length === 1 ? 'item' : 'itens'}
        </Text>
      </View>

      <View style={styles.lista}>
        {itens.map((item, n) => (
          <View key={item.id} style={styles.linha}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.bolinha,
                  item.destaque && styles.bolinhaAtiva,
                  item.pendente && styles.bolinhaPendente,
                ]}
              />
              {n < itens.length - 1 ? (
                <LinearGradient
                  colors={['rgba(245,245,247,.16)', 'rgba(245,245,247,.06)']}
                  style={styles.fio}
                />
              ) : null}
            </View>

            <View style={styles.conteudo}>
              <View style={styles.cabecalhoItem}>
                {item.hora ? (
                  <Text variant="body" style={styles.hora}>
                    {item.hora}
                  </Text>
                ) : null}
                {item.status ? (
                  <Text
                    variant="caption"
                    style={[styles.status, item.pendente && styles.statusPendente]}
                  >
                    {item.status}
                  </Text>
                ) : null}
              </View>

              {item.destaque ? (
                // O cartao **nao** e um botao: no design so as duas acoes sao
                // clicaveis, e aninhar `<button>` dentro de `<button>` e HTML
                // invalido — o React Native Web reclama em voz alta.
                <View style={styles.cartao} testID={`roteiro-${item.id}`}>
                  <LinearGradient
                    colors={['rgba(255,255,255,.075)', 'rgba(255,255,255,.032)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.cartaoTopo}>
                    {urlDaImagem(item.foto ?? null) ? (
                      <Image
                        source={{ uri: urlDaImagem(item.foto ?? null) as string }}
                        style={styles.miniatura}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.miniatura, styles.miniaturaVazia]} />
                    )}
                    <View style={styles.cartaoTexto}>
                      <Text variant="body" numberOfLines={1} style={styles.cartaoTitulo}>
                        {item.titulo}
                      </Text>
                      {item.detalhes ? (
                        <Text variant="body" numberOfLines={1} style={styles.cartaoDetalhes}>
                          {item.detalhes}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.acoes}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Ver ingressos"
                      onPress={aoVerIngressos}
                      style={styles.acao}
                    >
                      <Text variant="body" style={styles.acaoDourada}>
                        Ingressos
                      </Text>
                    </Pressable>
                    <View style={styles.divisor} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Ver a rota"
                      onPress={aoVerRota}
                      style={styles.acao}
                    >
                      <Text variant="body" style={styles.acaoNeutra}>
                        Rota
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.titulo}
                  onPress={() => aoAbrir(item.id)}
                  testID={`roteiro-${item.id}`}
                >
                  {() => (
                    <View>
                      <Text
                        variant="body"
                        numberOfLines={2}
                        style={[styles.nome, item.concluido && styles.nomeConcluido]}
                      >
                        {item.titulo}
                      </Text>
                      {item.local ? (
                        <Text variant="body" numberOfLines={1} style={styles.local}>
                          {item.local}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecalhoDia: {
    marginTop: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloDia: { fontSize: 20, fontWeight: '600', letterSpacing: -0.56 },
  contagem: { fontSize: 12.5, letterSpacing: -0.06, color: 'rgba(245,245,247,.36)' },

  lista: { marginTop: 14, paddingHorizontal: 16 },
  linha: { flexDirection: 'row', gap: 13 },
  rail: { width: 8, alignItems: 'center', paddingTop: 19 },
  bolinha: {
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(245,245,247,.28)',
  },
  bolinhaAtiva: {
    backgroundColor: palette.gold,
    shadowColor: 'rgba(223,201,138,.9)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  bolinhaPendente: { backgroundColor: palette.warning },
  fio: { flex: 1, width: 1.5, marginTop: 2 },

  conteudo: { flex: 1, minWidth: 0, paddingBottom: 12 },
  cabecalhoItem: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  hora: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.25,
    color: 'rgba(245,245,247,.42)',
    fontVariant: ['tabular-nums'],
  },
  status: { fontSize: 11, letterSpacing: 0.88, color: 'rgba(245,245,247,.28)' },
  statusPendente: { color: palette.warning },

  nome: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.27,
    color: palette.text,
  },
  nomeConcluido: { color: 'rgba(245,245,247,.6)' },
  local: { marginTop: 3, fontSize: 12.5, letterSpacing: -0.06, color: 'rgba(245,245,247,.3)' },

  cartao: {
    marginTop: 8,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.28)',
  },
  pressionado: { opacity: 0.9 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  miniatura: { width: 52, height: 52, borderRadius: 16 },
  miniaturaVazia: { backgroundColor: 'rgba(255,255,255,.06)' },
  cartaoTexto: { flex: 1, minWidth: 0 },
  cartaoTitulo: { fontSize: 15, fontWeight: '600', letterSpacing: -0.27, color: palette.text },
  cartaoDetalhes: {
    marginTop: 3,
    fontSize: 12.5,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.4)',
  },

  acoes: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.08)' },
  acao: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.03)',
  },
  divisor: { width: 1 },
  acaoDourada: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.16, color: palette.gold },
  acaoNeutra: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.16,
    color: 'rgba(245,245,247,.7)',
  },
});
