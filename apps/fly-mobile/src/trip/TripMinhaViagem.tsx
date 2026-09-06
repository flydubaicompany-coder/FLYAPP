import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { EmptyState, ErrorState, LoadingSkeleton, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { casca, cor, foto, raio, tipo } from './design';
import { TripTela } from './TripTela';
import { useMinhaViagem } from './useMinhaViagem';

/**
 * Minha viagem — a tela do botão central.
 *
 * Três blocos, na ordem do desenho: hotel com o **número do quarto em 38px**,
 * voo em cartão de rota, e a lista de atalhos. É a tela que a pessoa abre no
 * balcão do hotel, e o número do quarto é o motivo — daí o tamanho.
 *
 * O quarto só aparece depois de `room_released_at`. Enquanto o hotel não
 * confirmar, o bloco diz que ainda não saiu, em vez de mostrar um número que
 * faria alguém subir com a mala para o andar errado.
 */

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function dataCurta(iso: string | null): string {
  return iso ? DATA_CURTA.format(new Date(iso)).replace('.', '').toUpperCase() : '—';
}

function LinhaDeAtalho({
  titulo,
  apoio,
  desenho,
  onPress,
}: {
  titulo: string;
  apoio: string;
  desenho: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${apoio}`}
      onPress={onPress}
      style={({ pressed }) => [e.atalho, pressed && e.apertadoLeve]}
    >
      <View style={e.atalhoIcone}>{desenho}</View>
      <View style={e.atalhoTextos}>
        <Text style={[tipo('corpoForte'), { color: cor.texto }]}>{titulo}</Text>
        <Text style={[tipo('miudo'), e.atalhoApoio]}>{apoio}</Text>
      </View>
      <Svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor.m35}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M9 5l7 7-7 7" />
      </Svg>
    </Pressable>
  );
}

export default function TripMinhaViagem() {
  const { state: sessao } = useSession();
  const { data: viagem } = useViagem();
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;
  const dados = useMinhaViagem(tripId, userId);

  if (viagem.kind === 'loading' || dados.kind === 'loading') {
    return (
      <TripTela kicker="MINHA VIAGEM" titulo="Minha viagem">
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      </TripTela>
    );
  }

  if (viagem.kind === 'semViagem') {
    return (
      <TripTela kicker="MINHA VIAGEM" titulo="Minha viagem">
        <View style={e.margem}>
          <EmptyState
            title="Nenhuma viagem ativa"
            description="Quando a Fly montar sua viagem, hotel, voo e documentos aparecem aqui."
          />
        </View>
      </TripTela>
    );
  }

  if (dados.kind === 'error' || viagem.kind === 'error') {
    return (
      <TripTela kicker="MINHA VIAGEM" titulo="Minha viagem">
        <View style={e.margem}>
          <ErrorState
            description={dados.kind === 'error' ? dados.message : 'Não consegui carregar.'}
          />
        </View>
      </TripTela>
    );
  }

  const v = viagem.viagem;
  const { hotel, voo, documentos, fotos } = dados.dados;

  const docApoio = documentos.passaporte
    ? documentos.cnh
      ? 'Passaporte e CNH guardados'
      : 'Passaporte guardado · CNH pendente'
    : documentos.cnh
      ? 'CNH guardada · passaporte pendente'
      : 'Nenhum documento adicionado';

  return (
    <TripTela
      kicker={`${v.destino.toUpperCase()} · ${dataCurta(v.comecaEm)} – ${dataCurta(v.terminaEm)}`}
      titulo="Minha viagem"
    >
      {hotel ? (
        <View style={e.cartaoHotel}>
          <View style={e.capaHotel}>
            <Image source={foto.burjAlArabPraia} style={e.capaFoto} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(4,4,6,.3)', 'rgba(8,8,11,.94)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={e.capaTextos}>
              <Text style={[tipo('diaDaSemana'), { color: cor.ouro }]}>MEU HOTEL</Text>
              <Text style={[e.nomeHotel]} numberOfLines={2}>
                {hotel.nome}
              </Text>
            </View>
          </View>

          <View style={e.corpoHotel}>
            <View style={e.linhaQuarto}>
              <View style={e.blocoQuarto}>
                <LinearGradient
                  colors={[cor.ouroTinta16, 'rgba(223,201,138,.04)']}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[tipo('kicker'), { color: cor.ouro }]}>SEU QUARTO</Text>
                {hotel.quarto ? (
                  <Text style={e.numeroQuarto}>{hotel.quarto}</Text>
                ) : (
                  <Text style={[tipo('corpoForte'), e.quartoPendente]}>Ainda não liberado</Text>
                )}
                <Text style={[tipo('miudo'), { color: cor.m50 }]}>
                  {hotel.quarto ? 'Apresente na recepção' : 'O hotel avisa no check-in'}
                </Text>
              </View>

              <View style={e.colunaDatas}>
                <View style={e.caixaData}>
                  <Text style={[tipo('diaDaSemana'), { color: cor.m35 }]}>CHECK-IN</Text>
                  <Text style={[tipo('apoio'), e.valorData]}>{dataCurta(hotel.entrada)}</Text>
                </View>
                <View style={e.caixaData}>
                  <Text style={[tipo('diaDaSemana'), { color: cor.m35 }]}>CHECK-OUT</Text>
                  <Text style={[tipo('apoio'), e.valorData]}>{dataCurta(hotel.saida)}</Text>
                </View>
              </View>
            </View>

            <View style={e.acoesHotel}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver documentos e vouchers"
                onPress={() => router.push('/viagem/cofre')}
                style={({ pressed }) => [e.botaoOuro, pressed && e.apertado]}
              >
                <Text style={[tipo('legenda'), { color: cor.ouroClaro }]}>Voucher do hotel</Text>
              </Pressable>

              {hotel.mapa ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir o hotel no mapa"
                  onPress={() => void Linking.openURL(hotel.mapa as string)}
                  style={({ pressed }) => [e.botaoIcone, pressed && e.apertado]}
                >
                  <Svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={cor.m62}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M20 10.5c0 5.6-8 11.4-8 11.4s-8-5.8-8-11.4a8 8 0 0 1 16 0z" />
                    <Circle cx={12} cy={10.4} r={2.6} />
                  </Svg>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {voo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voo ${voo.numero}, de ${voo.origem} para ${voo.destino}`}
          onPress={() => router.push('/viagem/voos')}
          style={({ pressed }) => [e.cartaoVoo, pressed && e.apertadoLeve]}
        >
          <View style={e.topoVoo}>
            <Text style={[tipo('kicker'), { color: cor.ouro }]}>MEU VOO</Text>
            <Text style={[tipo('miudo'), e.numeroVoo]}>{voo.numero}</Text>
          </View>

          <View style={e.rotaVoo}>
            <View>
              <Text style={e.iata}>{voo.origem}</Text>
              <Text style={[tipo('miudo'), e.horaVoo]}>
                {dataCurta(voo.parte)} · {HORA.format(new Date(voo.parte))}
              </Text>
            </View>

            <View style={e.tracoVoo}>
              <View style={e.traco} />
              <Svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={cor.ouro}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M10.2 20.4l1.8-5.4 7.4-2.2a1.8 1.8 0 0 0 .4-3.3l-2-1.2-3 .9-4.4-4.6-1.9.6 2.5 5.3-3.4 1-2.2-1.7-1.4.4 1.9 3.4-.6 2.2 2.1-1.5z" />
              </Svg>
              <View style={e.traco} />
            </View>

            <View style={e.iataDireita}>
              <Text style={e.iata}>{voo.destino}</Text>
              <Text style={[tipo('miudo'), e.horaVoo]}>
                {dataCurta(voo.chega)} · {HORA.format(new Date(voo.chega))}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={e.listaAtalhos}>
        <LinhaDeAtalho
          titulo="Documentos"
          apoio={docApoio}
          onPress={() => router.push('/viagem/documentos')}
          desenho={
            <Svg
              width={19}
              height={19}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M6.4 2.8h7l4.2 4.2v14.2H6.4z" />
              <Path d="M13.4 2.8V7h4.2" />
            </Svg>
          }
        />
        <LinhaDeAtalho
          titulo="Galeria da viagem"
          apoio={
            fotos === 0
              ? 'As fotos aparecem aqui durante a viagem'
              : `${fotos} foto${fotos === 1 ? '' : 's'} disponíve${fotos === 1 ? 'l' : 'is'}`
          }
          onPress={() => router.push('/galeria')}
          desenho={
            <Svg
              width={19}
              height={19}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Rect x={3.4} y={3.4} width={17.2} height={17.2} rx={3} />
              <Path d="M3.4 16l4.2-4a1.8 1.8 0 0 1 2.5 0l4.7 4.6" />
              <Circle cx={15} cy={8.6} r={1.4} />
            </Svg>
          }
        />
        <LinhaDeAtalho
          titulo="Meus passeios"
          apoio="O que você já reservou nesta viagem"
          onPress={() => router.push('/passeios/meus')}
          desenho={
            <Svg
              width={19}
              height={19}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M2.8 17.2c1.7 0 2.5-1.3 4.2-1.3s2.5 1.3 4.2 1.3 2.5-1.3 4.2-1.3 2.5 1.3 4.2 1.3" />
              <Path d="M6.4 12.2V6.6a1.8 1.8 0 0 1 1.8-1.8h7.6a1.8 1.8 0 0 1 1.8 1.8v5.6" />
              <Path d="M12 4.8V2.4" />
            </Svg>
          }
        />
        <LinhaDeAtalho
          titulo="Mais experiências"
          apoio="Peça algo a mais pelo WhatsApp"
          onPress={() => router.push('/experiencias')}
          desenho={
            <Svg
              width={19}
              height={19}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
            </Svg>
          }
        />
      </View>
    </TripTela>
  );
}

const e = StyleSheet.create({
  margem: { paddingHorizontal: casca.margemTela, paddingTop: 20 },

  cartaoHotel: {
    marginTop: 20,
    marginHorizontal: casca.margemTela,
    borderRadius: raio.cartao,
    overflow: 'hidden',
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro075,
  },
  capaHotel: { height: 132 },
  capaFoto: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  capaTextos: { position: 'absolute', left: 16, bottom: 13, right: 16 },
  nomeHotel: {
    marginTop: 5,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.46,
    color: cor.textoBranco,
  },
  corpoHotel: { padding: 16 },
  linhaQuarto: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  blocoQuarto: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: raio.caixa,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    overflow: 'hidden',
  },
  numeroQuarto: {
    marginTop: 6,
    fontSize: 38,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: cor.texto,
  },
  quartoPendente: { marginTop: 8, marginBottom: 4, color: cor.m62 },
  colunaDatas: { width: 112, gap: 9 },
  caixaData: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: raio.icone,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: cor.vidro07,
  },
  valorData: { marginTop: 4, color: cor.texto, fontWeight: '600' },
  acoesHotel: { marginTop: 12, flexDirection: 'row', gap: 8 },
  botaoOuro: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cor.ouroBorda34,
    backgroundColor: cor.ouroTinta12,
  },
  botaoIcone: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cor.vidro10,
    backgroundColor: cor.vidro05,
  },

  cartaoVoo: {
    marginTop: 13,
    marginHorizontal: casca.margemTela,
    borderRadius: raio.cartao,
    overflow: 'hidden',
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro075,
  },
  topoVoo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 17,
    paddingTop: 15,
  },
  numeroVoo: { color: cor.m62, fontWeight: '600', letterSpacing: 0.46 },
  rotaVoo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 17,
    paddingTop: 14,
    paddingBottom: 16,
  },
  iata: { fontSize: 27, lineHeight: 27, fontWeight: '700', letterSpacing: -0.81, color: cor.texto },
  iataDireita: { alignItems: 'flex-end' },
  horaVoo: { marginTop: 5, color: cor.m45 },
  tracoVoo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  traco: { flex: 1, height: 1, backgroundColor: 'rgba(223,201,138,.35)' },

  listaAtalhos: { marginTop: 13, marginHorizontal: casca.margemTela, gap: 9 },
  atalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: raio.caixa,
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro075,
  },
  atalhoIcone: {
    width: 40,
    height: 40,
    borderRadius: raio.nota,
    backgroundColor: cor.ouroTinta12,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoTextos: { flex: 1 },
  atalhoApoio: { marginTop: 3, color: 'rgba(245,245,247,.44)' },

  apertado: { transform: [{ scale: 0.95 }] },
  apertadoLeve: { transform: [{ scale: 0.985 }] },
});
