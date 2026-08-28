import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette, radius, space, textStyle, touchTarget } from '@/theme';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import {
  useCategorias,
  usePasseios,
  type Filtros,
  type Passeio,
  type Selo,
} from '@/passeios/usePasseios';
import { CardPasseio } from '@/passeios/CardPasseio';
import { urlDaImagem } from '@/passeios/midia';
import { useVitrine } from '@/passeios/useVitrine';
import { useMeusPasseios } from '@/passeios/useMeusPasseios';

/**
 * Passeios (§6.1), na composição do Claude Design.
 *
 * A ordem é a do canvas versionado em `docs/design/canvas`: título grande,
 * barra Meus Passeios com as capas empilhadas, busca, chips e então as
 * prateleiras — cada uma com "Ver tudo" à direita.
 *
 * **As prateleiras empilham na vertical, não rolam para o lado.** Card de 244
 * px de altura ocupando a largura toda: a foto é o que vende, e um trilho
 * horizontal a encolhe para caber três na tela.
 *
 * Busca e filtros vão para o servidor. Trazer o catálogo inteiro e filtrar no
 * aparelho funciona com doze passeios e para de funcionar com duzentos.
 *
 * Buscar ou filtrar troca a vitrine pelo resultado: quem digitou "deserto"
 * quer a lista de deserto, não seis prateleiras curadas antes dela.
 */

const SELOS: { valor: Selo; rotulo: string }[] = [
  { valor: 'trending', rotulo: 'Em alta' },
  { valor: 'exclusive', rotulo: 'Exclusivo Fly' },
  { valor: 'included', rotulo: 'Incluído' },
  { valor: 'addon', rotulo: 'Adicional' },
];

function Lupa() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.8} cy={10.8} r={6.6} stroke="rgba(245,245,247,.34)" strokeWidth={1.8} />
      <Path
        d="M15.6 15.6L21 21"
        stroke="rgba(245,245,247,.34)"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Seta() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke="rgba(245,245,247,.3)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Ajustes() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h10M18 7h2M4 17h4M12 17h8M16 4v6M8 14v6"
        stroke={palette.text}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * A barra "Meus Passeios" da §6.1, com as capas dos próximos empilhadas.
 *
 * As três capas se sobrepõem com um anel da cor do fundo entre elas — sem o
 * anel viram uma mancha só. Quem não tem passeio comprado não vê a barra:
 * uma barra vazia que leva a uma tela vazia é dois toques até nada.
 */
function BarraMeusPasseios() {
  const { capas, quantidade, proximo } = useMeusPasseios();
  if (quantidade === 0) return null;

  return (
    <Link href="/passeios/meus" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Meus passeios, ${quantidade} ${quantidade === 1 ? 'experiência' : 'experiências'}${proximo ? `, ${proximo}` : ''}`}
        testID="meus-passeios"
      >
        {({ pressed }) => (
          <View style={[styles.barra, pressed && styles.barraPressionada]}>
            <View style={styles.pilha}>
              {capas.slice(0, 3).map((capa, n) => {
                const uri = urlDaImagem(capa);
                return uri ? (
                  <Image
                    key={`${capa}-${n}`}
                    source={{ uri }}
                    style={[styles.capa, { left: n * 13 }]}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    key={`vazia-${n}`}
                    style={[styles.capa, styles.capaVazia, { left: n * 13 }]}
                  />
                );
              })}
            </View>

            <View style={styles.barraTexto}>
              <Text variant="body" style={styles.barraTitulo}>
                Meus Passeios
              </Text>
              {proximo ? (
                <Text variant="body" tone="faint" numberOfLines={1} style={styles.barraSub}>
                  {proximo}
                </Text>
              ) : null}
            </View>

            <View style={styles.barraFim}>
              <View style={styles.contador}>
                <Text variant="body" tone="gold" style={styles.contadorTexto}>
                  {quantidade}
                </Text>
              </View>
              <Seta />
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function Prateleira({
  titulo,
  passeios,
  aoVerTudo,
}: {
  titulo: string;
  passeios: Passeio[];
  aoVerTudo: () => void;
}) {
  return (
    <View style={styles.prateleira}>
      <View style={styles.cabecalhoSecao}>
        <Text variant="section">{titulo}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver tudo em ${titulo}`}
          onPress={aoVerTudo}
          hitSlop={10}
        >
          <Text variant="body" tone="gold" style={styles.verTudo}>
            Ver tudo
          </Text>
        </Pressable>
      </View>

      <View style={styles.cards}>
        {passeios.map((p) => (
          <CardPasseio key={p.id} passeio={p} />
        ))}
      </View>
    </View>
  );
}

export default function PasseiosScreen() {
  const router = useRouter();
  const [filtros, setFiltros] = useState<Filtros>({});
  const [busca, setBusca] = useState('');
  const categorias = useCategorias();
  const { pagina, carregando, erro, acabou, recarregar, carregarMais } = usePasseios(filtros);
  const { estado: vitrine } = useVitrine();

  const filtrando = Boolean(filtros.busca || filtros.categoria || filtros.selo);

  return (
    <Screen testID="screen-passeios">
      {/* Sem kicker: no canvas o título fica sozinho no topo, e o dourado
          desta tela é gasto nos chips e nos "Ver tudo". */}
      <AppHeader
        title="Passeios"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtros"
            onPress={() => router.push('/passeios/meus')}
            style={styles.botaoAjustes}
            hitSlop={8}
            testID="passeios-filtros"
          >
            <Ajustes />
          </Pressable>
        }
      />

      <BarraMeusPasseios />

      <View style={styles.busca}>
        <Lupa />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => setFiltros((f) => ({ ...f, busca }))}
          placeholder="Buscar experiências em Dubai"
          placeholderTextColor="rgba(245,245,247,.34)"
          returnKeyType="search"
          style={styles.buscaCampo}
          accessibilityLabel="Buscar passeio"
          testID="passeios-busca"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {SELOS.map((s) => {
          const ativo = filtros.selo === s.valor;
          return (
            <Pressable
              key={s.valor}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              aria-pressed={ativo}
              onPress={() => setFiltros((f) => ({ ...f, selo: ativo ? undefined : s.valor }))}
              style={[styles.chip, ativo && styles.chipAtivo]}
              testID={`selo-${s.valor}`}
            >
              <Text variant="body" tone={ativo ? 'gold' : 'muted'} style={styles.chipTexto}>
                {s.rotulo}
              </Text>
            </Pressable>
          );
        })}

        {categorias.map((c) => {
          const ativo = filtros.categoria === c.key;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              aria-pressed={ativo}
              onPress={() => setFiltros((f) => ({ ...f, categoria: ativo ? undefined : c.key }))}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text variant="body" tone={ativo ? 'gold' : 'muted'} style={styles.chipTexto}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!filtrando && vitrine.kind === 'ready'
        ? vitrine.secoes.map((secao) => (
            <Prateleira
              key={secao.chave}
              titulo={secao.titulo}
              passeios={secao.passeios}
              aoVerTudo={() => setFiltros({ busca: secao.titulo })}
            />
          ))
        : null}

      {!filtrando && vitrine.kind === 'ready' && vitrine.secoes.length > 0 ? (
        <View style={styles.cabecalhoSecao}>
          <Text variant="section">Todos os passeios</Text>
        </View>
      ) : null}

      {erro ? (
        <ErrorState description={erro} onRetry={() => void recarregar()} />
      ) : carregando ? (
        <LoadingSkeleton label="Carregando passeios" />
      ) : pagina.itens.length === 0 ? (
        <EmptyState
          title="Nada encontrado"
          description={
            filtrando
              ? 'Tente outra busca ou tire os filtros.'
              : 'A Fly está montando o catálogo. Assim que publicar, aparece aqui.'
          }
        />
      ) : (
        <View style={styles.cards}>
          {pagina.itens.map((p) => (
            <CardPasseio key={p.id} passeio={p} />
          ))}

          {!acabou ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Carregar mais passeios"
              onPress={() => void carregarMais()}
              style={styles.mais}
            >
              <Text variant="body" tone="gold">
                Carregar mais
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  botaoAjustes: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },

  barra: {
    marginTop: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingLeft: 11,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.085)',
    minHeight: touchTarget.min,
  },
  barraPressionada: { opacity: 0.85 },
  pilha: { width: 62, height: 40 },
  capa: {
    position: 'absolute',
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#111114',
  },
  capaVazia: { backgroundColor: palette.surface },
  barraTexto: { flex: 1, minWidth: 0 },
  barraTitulo: { fontWeight: '600' },
  barraSub: { marginTop: 3 },
  barraFim: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  contador: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(223,201,138,.14)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.32)',
  },
  contadorTexto: { fontWeight: '700' },

  busca: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  buscaCampo: { flex: 1, ...textStyle('body'), color: palette.text },

  chips: { gap: space.sm, paddingVertical: 2, marginTop: 14 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.075)',
  },
  chipAtivo: {
    backgroundColor: 'rgba(223,201,138,.11)',
    borderColor: 'rgba(223,201,138,.3)',
  },
  chipTexto: { fontSize: 13.5 },

  prateleira: { marginTop: space.xl },
  cabecalhoSecao: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: 14,
  },
  verTudo: { fontWeight: '600' },
  cards: { gap: space.lg },
  mais: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
});
