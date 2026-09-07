import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '@/ui';
import { casca, cor, foto, marca, raio, sombra, tipo } from './design';

/**
 * Os blocos da Home do Trip Mode, na medida do `Fly Trip Mode.dc.html`.
 *
 * Cada componente aqui corresponde a um bloco do arquivo de design, e os
 * números vêm de lá. Onde eu tiver mudado algo, o comentário diz o quê e por
 * quê — a regra é a mesma do resto do projeto: divergir do design é permitido,
 * divergir em silêncio não.
 */

// -----------------------------------------------------------------------------

export function TopoDaHome({
  primeiroNome,
  iniciais,
  onPerfil,
}: {
  primeiroNome: string | null;
  iniciais: string;
  onPerfil: () => void;
}) {
  return (
    <View style={e.topo}>
      <Image source={marca.logotipo} style={e.logotipo} resizeMode="contain" />
      <View style={e.topoDireita}>
        {primeiroNome ? (
          <Text style={[tipo('legenda'), { color: 'rgba(245,245,247,.6)' }]}>{primeiroNome}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
          onPress={onPerfil}
          style={({ pressed }) => [e.avatar, pressed && e.apertado]}
        >
          <LinearGradient
            colors={['rgba(223,201,138,.3)', 'rgba(223,201,138,.08)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[tipo('legenda'), e.iniciais]}>{iniciais}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------

export interface BannerProps {
  destino: string;
  bandeira: string;
  periodo: string;
  frase: string;
  /** 0 a 1. Ausente = a viagem não começou, e a barra não aparece. */
  progresso?: number | undefined;
  emAndamento: boolean;
}

/**
 * O banner de 326px.
 *
 * A foto é a do handoff (`opt-downtown-crepusculo`). É a única imagem fixa do
 * Trip Mode, e é fixa porque `trips` não guarda capa — inventar uma busca de
 * banco de imagens seria pior do que usar a que o design escolheu.
 */
export function BannerDaViagem({
  destino,
  bandeira,
  periodo,
  frase,
  progresso,
  emAndamento,
}: BannerProps) {
  return (
    <View style={[e.banner, sombra.banner]}>
      {/* `Image` com `cover`, e nao `ImageBackground`: no React Native Web o
          ImageBackground desenha um <img> no tamanho natural — medido aqui,
          780x1170 dentro de um banner de 343x326, com `object-fit: fill`. O
          que aparecia era um pedaco esticado do ceu. */}
      <Image
        source={foto.downtownCrepusculo}
        style={e.bannerFoto}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={['rgba(4,4,6,.5)', 'rgba(4,4,6,.05)', 'rgba(4,4,6,.58)', 'rgba(4,4,6,.96)']}
        locations={[0, 0.26, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {emAndamento ? (
        <View style={e.selo}>
          <View style={e.pontoVivo} />
          <Text style={[tipo('kicker'), e.seloTexto]}>VIAGEM EM ANDAMENTO</Text>
        </View>
      ) : null}

      <View style={e.bannerRodape}>
        <Text style={[tipo('kicker'), { color: cor.ouro }]}>{periodo}</Text>
        <View style={e.bannerLinha}>
          <Text style={[tipo('destaque'), { color: cor.textoBranco }]}>{destino}</Text>
          <Text style={e.bandeira}>{bandeira}</Text>
        </View>
        <Text style={[tipo('apoio'), { color: cor.m68 }]}>{frase}</Text>

        {progresso !== undefined ? (
          <View style={e.trilho}>
            <LinearGradient
              colors={['rgba(223,201,138,.5)', cor.ouro]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[e.trilhoCheio, { width: `${Math.round(progresso * 100)}%` }]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------

/**
 * O cartão do próximo compromisso.
 *
 * O design tem duas animações aqui — um brilho que atravessa o cartão a cada
 * 4.6s e um pulso no ícone a cada 2.4s. **Não as implementei ainda**, e o
 * cartão está estático. Elas são a diferença entre "bonito" e "vivo", e entram
 * antes do release: estão anotadas no TRIP_MODE.md.
 */
export function CartaoProximo({
  titulo,
  quando,
  onPress,
}: {
  titulo: string;
  quando: string;
  onPress: () => void;
}) {
  return (
    <View style={e.margemLateral}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Próximo compromisso: ${titulo}. ${quando}`}
        onPress={onPress}
        style={({ pressed }) => [e.proximo, pressed && e.apertadoLeve]}
        testID="trip-proximo"
      >
        <LinearGradient
          colors={['rgba(223,201,138,.16)', 'rgba(223,201,138,.04)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={e.proximoLinha}>
          <View style={e.proximoIcone}>
            <Svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouroClaro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M2.5 16.5c1.6 0 2.4-1.2 4-1.2s2.4 1.2 4 1.2 2.4-1.2 4-1.2 2.4 1.2 4 1.2 2-.4 3-1.2" />
              <Path d="M4.6 12.8l2.2-4.2a2 2 0 0 1 1.8-1.1h3.6l2.4 3.1" />
              <Path d="M15.6 8.2h3.1a1.9 1.9 0 0 1 1.7 2.8l-.9 1.7" />
              <Circle cx={17.4} cy={5.2} r={1.6} />
            </Svg>
          </View>

          <View style={e.proximoTextos}>
            <Text style={[tipo('kicker'), { color: cor.ouro }]}>PRÓXIMO COMPROMISSO</Text>
            <Text style={[tipo('cartaoTitulo'), e.proximoTitulo]} numberOfLines={1}>
              {titulo}
            </Text>
            <Text style={[tipo('legenda'), e.proximoQuando]}>{quando}</Text>
          </View>

          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(223,201,138,.7)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M9 5l7 7-7 7" />
          </Svg>
        </View>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------

/** O aviso âmbar. O texto vem do roteiro — o app não deduz o que levar. */
export function AvisoImportante({ texto }: { texto: string }) {
  return (
    <View style={[e.margemLateral, e.aviso]}>
      <View style={e.avisoIcone}>
        <Svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke={cor.aviso}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M12 8.6v4.2" />
          <Path d="M12 16.4h.01" />
          <Path d="M10.4 3.9L2.6 17.6A1.8 1.8 0 0 0 4.2 20.3h15.6a1.8 1.8 0 0 0 1.6-2.7L13.6 3.9a1.8 1.8 0 0 0-3.2 0z" />
        </Svg>
      </View>
      <View style={e.avisoTextos}>
        <Text style={[tipo('kicker'), { color: cor.aviso }]}>IMPORTANTE</Text>
        <Text style={[tipo('corpo'), e.avisoTexto]}>{texto}</Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------

export function TituloDeSecao({
  titulo,
  acao,
  onAcao,
}: {
  titulo: string;
  acao?: string;
  onAcao?: () => void;
}) {
  return (
    <View style={e.tituloSecao}>
      <Text style={[tipo('secao'), { color: cor.texto }]}>{titulo}</Text>
      {acao && onAcao ? (
        <Pressable accessibilityRole="button" accessibilityLabel={acao} onPress={onAcao}>
          <Text style={[tipo('legenda'), { color: cor.ouro }]}>{acao}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------

export interface LinhaDoDia {
  id: string;
  hora: string;
  titulo: string;
  /** `passou` risca o texto; `agora` deixa a hora e o ponto dourados. */
  estado: 'passou' | 'agora' | 'depois';
}

export function ListaDoDia({
  itens,
  onItem,
}: {
  itens: readonly LinhaDoDia[];
  onItem: (id: string) => void;
}) {
  return (
    <View style={[e.margemLateral, e.bloco]}>
      {itens.map((i, idx) => (
        <View key={i.id}>
          {idx > 0 ? <View style={e.divisor} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${i.hora} ${i.titulo}`}
            onPress={() => onItem(i.id)}
            style={e.linha}
          >
            <Text
              style={[
                tipo('legenda'),
                e.linhaHora,
                {
                  color:
                    i.estado === 'agora' ? cor.ouro : i.estado === 'passou' ? cor.m40 : cor.m55,
                },
              ]}
            >
              {i.hora}
            </Text>
            <View
              style={[
                e.ponto,
                i.estado === 'agora' && e.pontoAgora,
                {
                  backgroundColor:
                    i.estado === 'agora' ? cor.ouro : i.estado === 'passou' ? cor.m20 : cor.m30,
                },
              ]}
            />
            <Text
              style={[
                tipo(i.estado === 'agora' ? 'corpoForte' : 'corpo'),
                {
                  flex: 1,
                  color:
                    i.estado === 'agora'
                      ? cor.texto
                      : i.estado === 'passou'
                        ? cor.m50
                        : 'rgba(245,245,247,.8)',
                },
                i.estado === 'passou' && e.riscado,
              ]}
              numberOfLines={1}
            >
              {i.titulo}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------

export interface Atalho {
  chave: string;
  rotulo: string;
  desenho: React.ReactNode;
  onPress: () => void;
}

/** Grade de três colunas, como o design. */
export function GradeDeAtalhos({ atalhos }: { atalhos: readonly Atalho[] }) {
  return (
    <View style={[e.margemLateral, e.grade]}>
      {atalhos.map((a) => (
        <Pressable
          key={a.chave}
          accessibilityRole="button"
          accessibilityLabel={a.rotulo}
          onPress={a.onPress}
          style={({ pressed }) => [e.atalho, pressed && e.apertadoAtalho]}
          testID={`trip-atalho-${a.chave}`}
        >
          <LinearGradient
            colors={[cor.vidro06, 'rgba(255,255,255,.024)']}
            style={StyleSheet.absoluteFill}
          />
          {a.desenho}
          <Text style={[tipo('legenda'), { color: cor.texto }]} numberOfLines={1}>
            {a.rotulo}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const e = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: casca.margemTexto,
    paddingTop: 10,
  },
  logotipo: { height: 14, width: 48, opacity: 0.95 },
  topoDireita: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.32)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iniciais: { color: cor.ouroClaro, fontWeight: '700', letterSpacing: 0.25 },

  banner: {
    marginHorizontal: casca.margemTela,
    marginTop: 14,
    height: 326,
    borderRadius: raio.banner,
    overflow: 'hidden',
    backgroundColor: cor.fundoCartao,
  },
  bannerFoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  selo: {
    position: 'absolute',
    top: 18,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: raio.chip,
    backgroundColor: 'rgba(10,10,13,.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.15)',
  },
  pontoVivo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: cor.ativo,
  },
  seloTexto: { color: 'rgba(255,255,255,.9)' },
  bannerRodape: { position: 'absolute', left: 22, right: 22, bottom: 24 },
  bannerLinha: { marginTop: 9, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  bandeira: { fontSize: 20, lineHeight: 20 },
  trilho: {
    marginTop: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,.16)',
    overflow: 'hidden',
  },
  trilhoCheio: { height: '100%', borderRadius: 2 },

  margemLateral: { marginHorizontal: casca.margemTela },
  proximo: {
    marginTop: 16,
    borderRadius: raio.cartao,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    overflow: 'hidden',
  },
  proximoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 15,
    paddingHorizontal: 17,
  },
  proximoIcone: {
    width: 46,
    height: 46,
    borderRadius: raio.icone,
    backgroundColor: cor.ouroTinta16,
    borderWidth: 1,
    borderColor: cor.ouroBorda34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximoTextos: { flex: 1, minWidth: 0 },
  proximoTitulo: { marginTop: 5, color: cor.texto },
  proximoQuando: { marginTop: 3, color: cor.m50, fontWeight: '400' },

  aviso: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 13,
    paddingHorizontal: 15,
    borderRadius: raio.caixa,
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro07,
  },
  avisoIcone: {
    width: 30,
    height: 30,
    borderRadius: raio.iconePequeno,
    backgroundColor: cor.avisoTinta,
    borderWidth: 1,
    borderColor: cor.avisoBorda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoTextos: { flex: 1 },
  avisoTexto: { marginTop: 4, color: 'rgba(245,245,247,.72)' },

  tituloSecao: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: casca.margemTexto,
    paddingTop: 26,
  },
  bloco: {
    marginTop: 12,
    borderRadius: raio.bloco,
    borderWidth: 1,
    borderColor: cor.vidro075,
    backgroundColor: cor.vidro035,
    paddingVertical: 4,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  linhaHora: { width: 52 },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  pontoAgora: {},
  riscado: { textDecorationLine: 'line-through' },
  divisor: { height: 1, marginHorizontal: 16, backgroundColor: cor.vidro055 },

  grade: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  atalho: {
    // Três colunas com 9 de intervalo. `31.5%` deixa folga para o gap sem
    // depender de medir a largura da tela.
    flexBasis: '31.5%',
    flexGrow: 1,
    gap: 9,
    padding: 14,
    paddingHorizontal: 13,
    borderRadius: raio.caixa,
    borderWidth: 1,
    borderColor: cor.vidro075,
    overflow: 'hidden',
  },
  fita: { gap: 11, paddingHorizontal: casca.margemTela, paddingTop: 12 },
  expCartao: {
    width: 196,
    height: 168,
    borderRadius: raio.caixa,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: cor.vidro07,
    justifyContent: 'flex-end',
  },
  expTextos: { padding: 14 },
  expCategoria: { fontSize: 9, fontWeight: '700', letterSpacing: 1.26, color: cor.ouro },
  expNome: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 17.5,
    fontWeight: '600',
    letterSpacing: -0.24,
    color: cor.textoBranco,
  },
  expApoio: { marginTop: 3, fontSize: 11.5, color: 'rgba(255,255,255,.55)' },

  apertado: { transform: [{ scale: 0.92 }] },
  apertadoLeve: { transform: [{ scale: 0.985 }] },
  apertadoAtalho: { transform: [{ scale: 0.96 }] },
});

// -----------------------------------------------------------------------------

export interface ExperienciaCurta {
  id: string;
  titulo: string;
  categoria: string | null;
  apoio: string;
  foto: string | null;
}

/**
 * A fita de experiências da Home.
 *
 * Cartões estreitos, rolagem horizontal, e "Ver todas" ao lado do título —
 * como o desenho. A Home vende **sugerindo**, não listando: quem quiser a
 * lista inteira toca em "Ver todas" e vai para a tela própria, onde cada
 * cartão tem descrição, duração, preço e o botão.
 */
export function FitaDeExperiencias({
  itens,
  onVerTodas,
  onAbrir,
}: {
  itens: readonly ExperienciaCurta[];
  onVerTodas: () => void;
  onAbrir: () => void;
}) {
  if (itens.length === 0) return null;

  return (
    <>
      <View style={e.tituloSecao}>
        <Text style={[tipo('secao'), { color: cor.texto }]}>Mais experiências</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver todas" onPress={onVerTodas}>
          <Text style={[tipo('legenda'), { color: cor.ouro }]}>Ver todas</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fita}>
        {itens.map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={x.titulo}
            onPress={onAbrir}
            style={({ pressed }) => [e.expCartao, pressed && e.apertadoLeve]}
          >
            {x.foto ? (
              <Image source={{ uri: x.foto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#1A1A20', '#0E0E11']} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(4,4,6,.92)']}
              locations={[0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={e.expTextos}>
              {x.categoria ? <Text style={e.expCategoria}>{x.categoria.toUpperCase()}</Text> : null}
              <Text style={e.expNome} numberOfLines={2}>
                {x.titulo}
              </Text>
              <Text style={e.expApoio} numberOfLines={1}>
                {x.apoio}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
