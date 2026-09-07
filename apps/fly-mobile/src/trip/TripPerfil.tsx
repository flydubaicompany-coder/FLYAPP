import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { LoadingSkeleton, Text } from '@/ui';
import { useMinhaViagem } from './useMinhaViagem';
import { casca, cor, raio, tipo } from './design';
import { TripTela } from './TripTela';

/**
 * Perfil do Trip Mode.
 *
 * Curto de propósito, como o desenho: quem você é, qual é a viagem, como a Fly
 * te encontra, seus documentos, o suporte e sair. Nada de pontos, nível ou
 * ranking — as regras dos três são pendência do dono (P45, P46), e um saldo
 * cuja escala ninguém definiu vira print na mão de um influenciador.
 *
 * As telas completas continuam existindo: some o caminho, não o código.
 */

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function curta(iso: string): string {
  return DATA.format(new Date(iso)).replace('.', '').toUpperCase();
}

function iniciaisDe(nome: string | null): string {
  if (!nome) return 'FL';
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? 'F';
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (a + b).toUpperCase();
}

function Linha({
  titulo,
  desenho,
  tom,
  onPress,
}: {
  titulo: string;
  desenho: React.ReactNode;
  tom?: 'verde';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      style={({ pressed }) => [e.linha, pressed && e.apertado]}
    >
      <View style={[e.linhaIcone, tom === 'verde' && e.linhaIconeVerde]}>{desenho}</View>
      <Text style={[tipo('corpoForte'), { flex: 1, color: cor.texto }]}>{titulo}</Text>
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

export default function TripPerfil() {
  const { state: sessao, signOut } = useSession();
  const { data: viagem } = useViagem();
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;
  const extra = useMinhaViagem(tripId, userId);

  if (sessao.kind !== 'signedIn') {
    return (
      <TripTela kicker="PERFIL" titulo="Sua conta">
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      </TripTela>
    );
  }

  const perfil = sessao.profile;
  const nome = perfil.preferredName ?? perfil.displayName ?? null;
  const v = viagem.kind === 'ready' ? viagem.viagem : null;
  const hotel = extra.kind === 'ready' ? extra.dados.hotel : null;

  return (
    <TripTela kicker="PERFIL" titulo="Sua conta">
      <View style={[e.margem, e.cabecalho]}>
        <View style={e.avatar}>
          <LinearGradient
            colors={['rgba(223,201,138,.3)', 'rgba(223,201,138,.08)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={e.iniciais}>{iniciaisDe(nome)}</Text>
        </View>
        <View style={e.cabecalhoTextos}>
          <Text style={[tipo('cartaoTitulo'), { color: cor.texto }]} numberOfLines={2}>
            {nome ?? 'Membro Fly'}
          </Text>
          {v ? (
            <Text style={[tipo('miudo'), { marginTop: 3, color: cor.m45 }]}>
              Convidado · {v.destino}
            </Text>
          ) : null}
        </View>
      </View>

      {v ? (
        <View style={[e.margem, e.cartaoViagem]}>
          <LinearGradient
            colors={[cor.ouroTinta16, 'rgba(223,201,138,.04)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[tipo('kicker'), { color: cor.ouro }]}>VIAGEM ATUAL</Text>
          <Text style={[tipo('cartaoTitulo'), e.viagemTitulo]}>
            {v.destino} · {curta(v.comecaEm)} – {curta(v.terminaEm)}
          </Text>
          {hotel ? (
            <Text style={[tipo('miudo'), { color: cor.m50 }]}>
              {hotel.nome}
              {hotel.quarto ? ` · quarto ${hotel.quarto}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[e.margem, e.bloco]}>
        <View style={e.par}>
          <Text style={[tipo('miudo'), { color: cor.m45 }]}>E-mail</Text>
          <Text style={[tipo('legenda'), { color: cor.texto }]} numberOfLines={1}>
            {sessao.session.user.email ?? '—'}
          </Text>
        </View>
        <View style={e.divisor} />
        <View style={e.par}>
          <Text style={[tipo('miudo'), { color: cor.m45 }]}>Fly ID</Text>
          <Text style={[tipo('legenda'), e.mono]}>{perfil.publicId}</Text>
        </View>
      </View>

      <View style={[e.margem, e.linhas]}>
        <Linha
          titulo="Meus documentos"
          onPress={() => router.push('/viagem/documentos')}
          desenho={
            <Svg
              width={18}
              height={18}
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
        <Linha
          titulo="Dados pessoais"
          onPress={() => router.push('/perfil/dados')}
          desenho={
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 12.4a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6zM4.8 20.4a7.2 7.2 0 0 1 14.4 0" />
            </Svg>
          }
        />
        <Linha
          titulo="Privacidade e consentimentos"
          onPress={() => router.push('/perfil/privacidade')}
          desenho={
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M5 11h14v9H5zM8 11V7.5a4 4 0 0 1 8 0V11" />
            </Svg>
          }
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
        onPress={() => void signOut()}
        style={({ pressed }) => [e.margem, e.sair, pressed && e.apertado]}
        testID="trip-sair"
      >
        <Text style={[tipo('corpoForte'), e.sairTexto]}>Sair da conta</Text>
      </Pressable>

      <Text style={e.rodape}>FLY APP · TRIP MODE{v ? ` · ${v.destino.toUpperCase()}` : ''}</Text>
    </TripTela>
  );
}

const e = StyleSheet.create({
  margem: { marginHorizontal: 18, marginTop: 18 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.32)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iniciais: { fontSize: 19, fontWeight: '700', letterSpacing: 0.4, color: cor.ouroClaro },
  cabecalhoTextos: { flex: 1 },

  cartaoViagem: {
    padding: 16,
    borderRadius: raio.caixa,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    overflow: 'hidden',
  },
  viagemTitulo: { marginTop: 6, marginBottom: 4, color: cor.texto },

  bloco: {
    borderRadius: raio.caixa,
    borderWidth: 1,
    borderColor: cor.vidro075,
    backgroundColor: cor.vidro035,
  },
  par: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divisor: { height: 1, marginHorizontal: 16, backgroundColor: cor.vidro055 },
  mono: { color: cor.texto, letterSpacing: 1 },

  linhas: { gap: 9 },
  linha: {
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
  linhaIcone: {
    width: 38,
    height: 38,
    borderRadius: raio.nota,
    backgroundColor: cor.ouroTinta12,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaIconeVerde: {
    backgroundColor: cor.zapTinta,
    borderColor: cor.zapBorda,
  },
  sair: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: raio.caixa,
    borderWidth: 1,
    borderColor: 'rgba(255,86,86,.28)',
    backgroundColor: 'rgba(255,86,86,.08)',
  },
  sairTexto: { color: '#FF7A7A' },
  rodape: {
    marginTop: 22,
    marginBottom: casca.margemTela,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: cor.m30,
  },
  apertado: { transform: [{ scale: 0.98 }] },
});
