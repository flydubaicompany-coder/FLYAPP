import { useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { EmptyState, ErrorState, LoadingSkeleton, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { usePasseios } from '@/passeios/usePasseios';
import { urlDaImagem } from '@/passeios/midia';
import { GlifoWhatsapp } from '@/trip/TripChrome';
import { casca, cor, raio, tipo } from '@/trip/design';
import { TripTelaInterna } from '@/trip/TripTela';
import { useSuporteFly } from '@/trip';

/**
 * Mais experiências — os cartões do `Fly Trip Mode.dc.html`.
 *
 * O catálogo é o mesmo de Passeios: mesma consulta, mesmas fotos, mesmo
 * cadastro. Construir uma segunda listagem criaria um segundo lugar para
 * cadastrar experiência, e no dia seguinte os dois discordariam.
 *
 * O que muda é o fim do fluxo. Não há checkout nesta viagem — o parceiro de
 * pagamento continua pendente (P09/P38) e o que existe é sandbox. Então o
 * botão dourado não compra: abre a conversa com a mensagem pronta, e quem
 * fecha é a operação, que é como a Fly já vende.
 *
 * Preço aparece quando o passeio tem; quando é sob consulta, o cartão diz
 * "Sob consulta" — que é o que o desenho mostra, e é a verdade para um passeio
 * que só tem proposta.
 */

function Meta({ desenho, texto }: { desenho: React.ReactNode; texto: string }) {
  return (
    <View style={e.meta}>
      {desenho}
      <Text style={e.metaTexto}>{texto}</Text>
    </View>
  );
}

function preco(centavos: number | null, moeda: string | null): string {
  if (centavos === null || !moeda) return 'Sob consulta';
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: moeda,
      maximumFractionDigits: 0,
    }).format(centavos / 100);
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(0)}`;
  }
}

export default function MaisExperiencias() {
  const { state: sessao } = useSession();
  const { pagina, carregando, erro, carregarMais, acabou } = usePasseios({});
  const suporte = useSuporteFly();
  const [pedindo, setPedindo] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  async function solicitar(titulo: string) {
    setPedindo(titulo);
    setRecado(null);
    const abriu = await suporte.pedirExperiencia(titulo);
    setPedindo(null);
    if (!abriu) {
      setRecado(
        suporte.pronto
          ? 'Não consegui abrir o WhatsApp. Fale com alguém da equipe Fly.'
          : 'O canal de atendimento ainda não foi configurado.',
      );
    }
  }

  return (
    <TripTelaInterna titulo="Mais experiências">
      <View style={e.intro}>
        <Text style={e.pergunta}>Quer mais alguma coisa?</Text>
        <Text style={e.explicacao}>
          Solicite pelo WhatsApp e a equipe Fly organiza durante a viagem.
        </Text>
      </View>

      {recado ? (
        <View style={e.margem}>
          <ErrorState description={recado} />
        </View>
      ) : null}

      {sessao.kind !== 'signedIn' ? (
        <View style={e.margem}>
          <EmptyState
            title="Entre para ver as experiências"
            description="As experiências da sua viagem aparecem aqui depois que você entra na conta."
          />
        </View>
      ) : erro ? (
        <View style={e.margem}>
          <ErrorState description={erro} />
        </View>
      ) : null}

      {sessao.kind === 'signedIn' && carregando && pagina.itens.length === 0 ? (
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      ) : null}

      {sessao.kind === 'signedIn' && !carregando && pagina.itens.length === 0 && !erro ? (
        <View style={e.margem}>
          <EmptyState
            title="Nada por aqui ainda"
            description="A Fly publica as experiências da viagem por aqui. Fale com a equipe se quiser algo específico."
          />
        </View>
      ) : null}

      <View style={e.lista}>
        {pagina.itens.map((p) => {
          const foto = p.imagem ? urlDaImagem(p.imagem) : null;
          return (
            <View key={p.id} style={e.cartao}>
              <View style={e.capa}>
                {foto ? (
                  <Image
                    source={{ uri: foto }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <LinearGradient colors={['#1A1A20', '#0E0E11']} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['rgba(4,4,6,.32)', 'transparent', 'rgba(4,4,6,.9)']}
                  locations={[0, 0.4, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={e.capaTextos}>
                  <Text style={e.categoria}>{(p.categoria ?? 'EXPERIÊNCIA').toUpperCase()}</Text>
                  <Text style={e.nome} numberOfLines={2}>
                    {p.titulo}
                  </Text>
                </View>
              </View>

              <View style={e.corpo}>
                {p.resumo ? (
                  <Text style={e.descricao} numberOfLines={3}>
                    {p.resumo}
                  </Text>
                ) : null}

                <View style={e.metas}>
                  {p.duracaoMin ? (
                    <Meta
                      texto={
                        p.duracaoMin >= 60
                          ? `${Math.round(p.duracaoMin / 60)} hora${p.duracaoMin >= 120 ? 's' : ''}`
                          : `${p.duracaoMin} min`
                      }
                      desenho={
                        <Svg
                          width={13}
                          height={13}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={cor.m40}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                        >
                          <Circle cx={12} cy={12} r={9} />
                          <Path d="M12 7.2V12l3.2 2" />
                        </Svg>
                      }
                    />
                  ) : null}
                  {p.cidade ? (
                    <Meta
                      texto={p.cidade}
                      desenho={
                        <Svg
                          width={13}
                          height={13}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={cor.m40}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <Path d="M20 10.5c0 5.6-8 11.4-8 11.4s-8-5.8-8-11.4a8 8 0 0 1 16 0z" />
                          <Circle cx={12} cy={10.4} r={2.6} />
                        </Svg>
                      }
                    />
                  ) : null}
                </View>

                <View style={e.rodape}>
                  <Text style={e.preco}>
                    {preco(p.precoMenor?.centavos ?? null, p.precoMenor?.moeda ?? null)}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Solicitar ${p.titulo}`}
                    accessibilityHint="Abre o WhatsApp da Fly com o pedido pronto"
                    disabled={!suporte.pronto || pedindo !== null}
                    onPress={() => void solicitar(p.titulo)}
                    style={({ pressed }) => [
                      e.solicitar,
                      pressed && e.apertado,
                      !suporte.pronto && e.desligado,
                    ]}
                    testID={`solicitar-${p.slug}`}
                  >
                    <LinearGradient
                      colors={[cor.ouroClaro, cor.ouroFundo]}
                      style={StyleSheet.absoluteFill}
                    />
                    <GlifoWhatsapp tamanho={15} cor="#1A1408" />
                    <Text style={e.solicitarTexto}>
                      {pedindo === p.titulo ? 'Abrindo…' : 'Solicitar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {!acabou && pagina.itens.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver mais experiências"
          onPress={() => void carregarMais()}
          style={e.verMais}
        >
          <Text style={[tipo('legenda'), { color: cor.m45 }]}>
            {carregando ? 'Carregando…' : 'Ver mais'}
          </Text>
        </Pressable>
      ) : null}
    </TripTelaInterna>
  );
}

const e = StyleSheet.create({
  intro: { paddingHorizontal: casca.margemTexto, paddingTop: 16 },
  pergunta: {
    fontSize: 22,
    lineHeight: 24.2,
    fontWeight: '600',
    letterSpacing: -0.66,
    color: cor.texto,
  },
  explicacao: { marginTop: 7, fontSize: 13.5, lineHeight: 20.25, color: cor.m45 },
  margem: { marginHorizontal: 18, marginTop: 18 },

  lista: { paddingHorizontal: casca.margemTela, paddingTop: 18, gap: 13 },
  cartao: {
    borderRadius: raio.cartao,
    overflow: 'hidden',
    backgroundColor: '#0E0E11',
    borderWidth: 1,
    borderColor: cor.vidro07,
  },
  capa: { height: 140 },
  capaTextos: { position: 'absolute', left: 16, right: 16, bottom: 13 },
  categoria: { fontSize: 9, fontWeight: '700', letterSpacing: 1.26, color: cor.ouro },
  nome: {
    marginTop: 5,
    fontSize: 19,
    lineHeight: 21.3,
    fontWeight: '600',
    letterSpacing: -0.46,
    color: cor.textoBranco,
  },
  corpo: { paddingVertical: 13, paddingHorizontal: 16, paddingBottom: 15 },
  descricao: { fontSize: 12.5, lineHeight: 18.75, color: cor.m50 },
  metas: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTexto: { fontSize: 12, color: 'rgba(245,245,247,.44)' },
  rodape: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  preco: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, color: cor.texto },
  solicitar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    overflow: 'hidden',
  },
  solicitarTexto: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.14, color: '#1A1408' },
  desligado: { opacity: 0.45 },
  apertado: { transform: [{ scale: 0.96 }] },
  verMais: {
    marginTop: 16,
    marginBottom: casca.margemTela,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
