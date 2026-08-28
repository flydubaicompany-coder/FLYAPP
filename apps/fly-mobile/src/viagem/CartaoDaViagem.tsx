import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { palette } from '@/theme';
import { Text } from '@/ui';
import { urlDaImagem } from '@/passeios/midia';

/**
 * Cartao da viagem e seletor de dias, na composicao do handoff (secao 5).
 *
 * Medidas copiadas de `docs/design/extracao/04-minha-viagem.html`, e nao do
 * resumo em prosa: altura 196, raio 30, degrade de leitura em quatro paradas,
 * pilula "VIAGEM EM CURSO" com ponto de 5 px e brilho, titulo 27/700/-.034em,
 * barra de 3 px e o seletor de dias de 52 px com raio 19.
 */

export interface CartaoDaViagemProps {
  destino: string;
  /** "25 – 31 ago · Atlantis The Royal · 2 pessoas" */
  subtitulo: string;
  diaAtual: number | null;
  totalDias: number;
  /** Caminho da foto no bucket publico. Sem foto o cartao usa o grafite. */
  foto?: string | null;
}

export function CartaoDaViagem({
  destino,
  subtitulo,
  diaAtual,
  totalDias,
  foto,
}: CartaoDaViagemProps) {
  const url = urlDaImagem(foto ?? null);
  const pct = diaAtual && totalDias > 0 ? Math.min(1, diaAtual / totalDias) : 0;

  return (
    <View style={styles.cartao}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
        />
      ) : null}

      <LinearGradient
        colors={['rgba(4,4,6,.5)', 'rgba(4,4,6,.12)', 'rgba(4,4,6,.72)', 'rgba(4,4,6,.97)']}
        locations={[0, 0.34, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.pilula} pointerEvents="none">
        <View style={styles.ponto} />
        <Text variant="caption" tone="gold" style={styles.pilulaTexto}>
          VIAGEM EM CURSO
        </Text>
      </View>

      <View style={styles.base} pointerEvents="none">
        <Text variant="largeTitle" numberOfLines={1} style={styles.destino}>
          {destino}
        </Text>
        <Text variant="body" numberOfLines={1} style={styles.subtitulo}>
          {subtitulo}
        </Text>

        {diaAtual ? (
          <View style={styles.linhaProgresso}>
            <View style={styles.trilho}>
              <View style={[styles.barra, { width: `${pct * 100}%` }]} />
            </View>
            <Text variant="caption" style={styles.diaLabel}>
              dia {diaAtual} de {totalDias}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export interface Dia {
  chave: string;
  /** "SEX" */
  semana: string;
  /** "25" */
  numero: string;
}

export interface SeletorDeDiasProps {
  dias: readonly Dia[];
  selecionado: string;
  aoEscolher: (chave: string) => void;
}

/** Chip de dia: 52 de largura, raio 19. Selecionado usa o dourado (D106). */
export function SeletorDeDias({ dias, selecionado, aoEscolher }: SeletorDeDiasProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tira}
      style={styles.tiraFora}
    >
      {dias.map((d) => {
        const ativo = d.chave === selecionado;
        return (
          <Pressable
            key={d.chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            aria-selected={ativo}
            accessibilityLabel={`${d.semana} ${d.numero}`}
            onPress={() => aoEscolher(d.chave)}
            testID={`dia-${d.chave}`}
          >
            {() => (
              <View style={[styles.dia, ativo && styles.diaAtivo]}>
                <Text
                  variant="caption"
                  style={[styles.diaSemana, ativo ? styles.textoAtivo : styles.textoInativo]}
                >
                  {d.semana}
                </Text>
                <Text
                  variant="body"
                  style={[styles.diaNumero, ativo ? styles.textoAtivo : styles.textoInativo]}
                >
                  {d.numero}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cartao: {
    marginTop: 20,
    marginHorizontal: 16,
    height: 196,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#101013',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
    shadowColor: 'rgba(0,0,0,.95)',
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 10,
  },

  pilula: {
    position: 'absolute',
    top: 17,
    left: 18,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(223,201,138,.15)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.42)',
  },
  ponto: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.gold,
    shadowColor: 'rgba(223,201,138,.9)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  pilulaTexto: { fontSize: 9, fontWeight: '700', letterSpacing: 1.17 },

  base: { position: 'absolute', left: 20, right: 20, bottom: 17 },
  destino: { fontSize: 27, lineHeight: 28, fontWeight: '700', letterSpacing: -0.92, color: '#fff' },
  subtitulo: {
    marginTop: 6,
    fontSize: 13,
    letterSpacing: -0.1,
    color: 'rgba(255,255,255,.66)',
  },

  linhaProgresso: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trilho: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,.22)',
    overflow: 'hidden',
  },
  barra: {
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.gold,
    shadowColor: 'rgba(223,201,138,.7)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
  },
  diaLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.22,
    color: 'rgba(255,255,255,.78)',
  },

  tiraFora: { marginTop: 16 },
  tira: { gap: 8, paddingTop: 2, paddingBottom: 4, paddingHorizontal: 16 },
  dia: {
    width: 52,
    paddingTop: 9,
    paddingBottom: 10,
    borderRadius: 19,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.075)',
  },
  diaAtivo: {
    backgroundColor: 'rgba(223,201,138,.15)',
    borderColor: 'rgba(223,201,138,.44)',
  },
  diaSemana: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.95, opacity: 0.6 },
  diaNumero: { marginTop: 4, fontSize: 16.5, fontWeight: '700', letterSpacing: -0.33 },
  textoAtivo: { color: palette.gold },
  textoInativo: { color: 'rgba(245,245,247,.6)' },
});
