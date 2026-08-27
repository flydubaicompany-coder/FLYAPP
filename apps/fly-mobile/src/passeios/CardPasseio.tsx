import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Link } from 'expo-router';
import { palette, radius, space, touchTarget } from '@/theme';
import { Text } from '@/ui';
import { formatar } from './dinheiro';
import { urlDaImagem } from './midia';
import type { Passeio } from './usePasseios';
import wing from '../../assets/brand/fly-wing.png';

/**
 * Card de passeio, na composição do Claude Design.
 *
 * As medidas aqui não são gosto meu: vêm do canvas versionado em
 * `docs/design/canvas`. Altura 244, raio 30, foto sangrando até a borda, e um
 * degradê que escurece só o terço de baixo — o suficiente para o texto ter
 * contraste sem apagar a foto.
 *
 * **A foto é o card.** A versão anterior era um bloco de texto com preço no
 * canto: funcionava e não vendia nada. A diferença entre as duas não é
 * decoração, é a razão de a tela existir.
 *
 * Passeio sem foto não vira retângulo cinza. O card encolhe para o formato
 * compacto, que continua legível e não finge que há imagem.
 */

const ROTULO_SELO: Record<string, string> = {
  included: 'INCLUÍDO',
  addon: 'ADICIONAL',
  exclusive: 'EXCLUSIVO FLY',
  trending: 'EM ALTA',
};

function Relogio() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.4} stroke="rgba(255,255,255,.62)" strokeWidth={1.9} />
      <Path
        d="M12 7.6V12l3.4 2.2"
        stroke="rgba(255,255,255,.62)"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Mais() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5.6v12.8" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Path d="M5.6 12h12.8" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function duracao(minutos: number | null): string | null {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}`;
}

export interface CardPasseioProps {
  passeio: Passeio;
  /** Ausente esconde o botão "+" — a vitrine mostra, a lista de favoritos não. */
  aoAdicionar?: (() => void) | undefined;
}

export function CardPasseio({ passeio, aoAdicionar }: CardPasseioProps) {
  const foto = urlDaImagem(passeio.imagem);
  const tempo = duracao(passeio.duracaoMin);
  const selo = passeio.selo ? (ROTULO_SELO[passeio.selo] ?? passeio.selo) : null;

  const preco = passeio.soProposta
    ? 'Sob proposta'
    : passeio.precoMenor
      ? formatar(passeio.precoMenor)
      : null;

  // O rótulo do leitor de tela é montado uma vez, para a foto e o selo não
  // serem anunciados como elementos soltos depois do título.
  const rotulo = [passeio.titulo, tempo, preco, selo && `Selo ${selo}`].filter(Boolean).join('. ');

  if (!foto) return <CardSemFoto passeio={passeio} rotulo={rotulo} tempo={tempo} preco={preco} />;

  return (
    <View style={styles.moldura}>
      <Link href={`/passeios/${passeio.slug}`} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={rotulo}
          style={({ pressed }) => [styles.card, pressed && styles.pressionado]}
          testID={`passeio-${passeio.slug}`}
        >
          <Image
            source={{ uri: foto }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
          />

          {/* Degradê em quatro paradas, como o canvas: escurece o topo o
              bastante para o selo, some no meio e fecha embaixo no texto. */}
          <View style={styles.veu} pointerEvents="none">
            <View style={[styles.veuFaixa, styles.veuTopo]} />
            <View style={[styles.veuFaixa, styles.veuBaixo]} />
          </View>

          {selo ? (
            <View style={styles.selo}>
              <Image source={wing} style={styles.asa} contentFit="contain" />
              <Text variant="caption" tone="gold" style={styles.seloTexto}>
                {selo}
              </Text>
            </View>
          ) : null}

          <View style={styles.rodape}>
            <Text variant="section" style={styles.titulo} numberOfLines={2}>
              {passeio.titulo}
            </Text>
            <View style={styles.linha}>
              {tempo ? (
                <View style={styles.tempo}>
                  <Relogio />
                  <Text variant="body" style={styles.tempoTexto}>
                    {tempo}
                  </Text>
                </View>
              ) : (
                <View />
              )}
              {preco ? (
                <Text variant="body" style={styles.preco}>
                  {preco}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Link>

      {/* Fora do Pressable do card: botão dentro de área tocável maior é a
          receita de abrir a tela errada com o polegar. */}
      {aoAdicionar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Adicionar ${passeio.titulo} ao carrinho`}
          onPress={aoAdicionar}
          style={({ pressed }) => [styles.mais, pressed && styles.maisPressionado]}
          hitSlop={8}
          testID={`adicionar-${passeio.slug}`}
        >
          <Mais />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Sem foto o card não finge ter uma: encolhe e mostra o que sabe. */
function CardSemFoto({
  passeio,
  rotulo,
  tempo,
  preco,
}: {
  passeio: Passeio;
  rotulo: string;
  tempo: string | null;
  preco: string | null;
}) {
  return (
    <Link href={`/passeios/${passeio.slug}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={rotulo}
        style={({ pressed }) => [styles.compacto, pressed && styles.pressionado]}
        testID={`passeio-${passeio.slug}`}
      >
        {passeio.selo ? (
          <Text variant="caption" tone="gold">
            {ROTULO_SELO[passeio.selo] ?? passeio.selo}
          </Text>
        ) : null}
        <Text variant="section" numberOfLines={2}>
          {passeio.titulo}
        </Text>
        {passeio.resumo ? (
          <Text variant="body" tone="muted" numberOfLines={2}>
            {passeio.resumo}
          </Text>
        ) : null}
        <View style={styles.linha}>
          <Text variant="body" tone="faint">
            {[tempo, passeio.cidade].filter(Boolean).join(' · ')}
          </Text>
          {preco ? <Text variant="body">{preco}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  moldura: { position: 'relative' },
  card: {
    height: 244,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: '#101013',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  pressionado: { opacity: 0.88 },

  veu: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  veuFaixa: { position: 'absolute', left: 0, right: 0 },
  veuTopo: { top: 0, height: 78, backgroundColor: 'rgba(4,4,6,.34)' },
  veuBaixo: { bottom: 0, height: 150, backgroundColor: 'rgba(4,4,6,.72)' },

  selo: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
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
  asa: { height: 6, width: 14 },
  seloTexto: { fontSize: 9 },

  mais: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,13,.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.2)',
  },
  maisPressionado: { transform: [{ scale: 0.86 }] },

  rodape: { position: 'absolute', left: 18, right: 18, bottom: space.lg },
  titulo: { color: '#fff' },
  linha: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tempoTexto: { color: 'rgba(255,255,255,.62)' },
  preco: { color: '#fff', fontWeight: '600' },

  compacto: {
    minHeight: touchTarget.min,
    padding: space.lg,
    gap: space.xs,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
});
