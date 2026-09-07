import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { EmptyState, LoadingSkeleton, Text } from '@/ui';
import { casca, cor, tipo } from './design';
import { TripTelaInterna } from './TripTela';

/**
 * Meu voo — o cartão de rota do `Fly Trip Mode.dc.html`.
 *
 * ## O que o desenho pede e o schema não guarda
 *
 * O arquivo mostra três colunas: LOCALIZADOR, ASSENTO e CLASSE. `flights` tem
 * assento (em `flight_passengers`), terminal e portão; **localizador e classe
 * não existem** em lugar nenhum do banco.
 *
 * Não inventei os dois. A grade continua de três colunas — é o que dá o ritmo
 * do cartão — e mostra o que o app realmente sabe: assento, terminal e portão.
 * Um "FLY7K2M" fabricado seria um código que alguém tentaria usar no balcão.
 *
 * O voo de retorno é o segundo da lista, quando houver — o desenho o mostra
 * como cartão apartado, e é assim que a operação pensa: ida e volta.
 */

interface Voo {
  id: string;
  companhia: string;
  numero: string;
  origem: string;
  destino: string;
  parte: string;
  chega: string;
  terminal: string | null;
  portao: string | null;
  bagagem: string | null;
  status: string | null;
  assento: string | null;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function quando(iso: string): string {
  return `${DATA.format(new Date(iso)).replace('.', '').toUpperCase()} · ${HORA.format(new Date(iso))}`;
}

/** "14H 30M" — a duração, calculada, porque as duas pontas são conhecidas. */
function duracao(parte: string, chega: string): string {
  const min = Math.max(
    0,
    Math.round((new Date(chega).getTime() - new Date(parte).getTime()) / 60000),
  );
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}H` : `${h}H ${String(m).padStart(2, '0')}M`;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={e.campo}>
      <Text style={e.campoRotulo}>{rotulo}</Text>
      <Text style={e.campoValor}>{valor}</Text>
    </View>
  );
}

/** O traço pontilhado do desenho: seis segmentos com o avião no meio. */
function Trilha() {
  return (
    <View style={e.trilha}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={e.tracinho} />
      ))}
    </View>
  );
}

function CartaoDeVoo({ voo }: { voo: Voo }) {
  const confirmado = voo.status === null || /confirm|ok|schedul/i.test(voo.status);

  return (
    <View style={e.cartao}>
      <LinearGradient
        colors={['#16161A', '#101013']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={e.topo}>
        <View>
          <Text style={[tipo('kicker'), { color: cor.ouro }]}>{voo.companhia.toUpperCase()}</Text>
          <Text style={[tipo('cartaoTitulo'), e.numero]}>{voo.numero}</Text>
        </View>
        {confirmado ? (
          <View style={e.selo}>
            <View style={e.pontoVivo} />
            <Text style={e.seloTexto}>CONFIRMADO</Text>
          </View>
        ) : (
          <View style={[e.selo, e.seloAviso]}>
            <Text style={[e.seloTexto, { color: cor.aviso }]}>
              {(voo.status ?? '').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={e.rota}>
        <View>
          <Text style={e.iata}>{voo.origem}</Text>
          <Text style={[tipo('miudo'), e.cidade]}>Partida</Text>
          <Text style={e.horario}>{quando(voo.parte)}</Text>
          {voo.terminal ? <Text style={e.terminal}>Terminal {voo.terminal}</Text> : null}
        </View>

        <View style={e.meio}>
          <Text style={e.duracao}>{duracao(voo.parte, voo.chega)}</Text>
          <Trilha />
          <Text style={e.direto}>DIRETO</Text>
        </View>

        <View style={e.direita}>
          <Text style={e.iata}>{voo.destino}</Text>
          <Text style={[tipo('miudo'), e.cidade]}>Chegada</Text>
          <Text style={e.horario}>{quando(voo.chega)}</Text>
          {voo.portao ? <Text style={e.terminal}>Portão {voo.portao}</Text> : null}
        </View>
      </View>

      <View style={e.divisor} />

      <View style={e.grade}>
        <Campo rotulo="ASSENTO" valor={voo.assento ?? 'A definir'} />
        <Campo rotulo="TERMINAL" valor={voo.terminal ?? '—'} />
        <Campo rotulo="BAGAGEM" valor={voo.bagagem ?? '—'} />
      </View>
    </View>
  );
}

export default function TripVoo() {
  const { state: sessao } = useSession();
  const { data: viagem } = useViagem();
  const [voos, setVoos] = useState<Voo[] | null>(null);

  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;

  useEffect(() => {
    if (!tripId) return;
    void (async () => {
      const db = supabase();
      const [vooRes, paxRes] = await Promise.all([
        db
          .from('flights')
          .select(
            'id, airline, flight_number, origin_iata, destination_iata, departs_at, arrives_at, terminal, gate, baggage_allowance, status',
          )
          .eq('trip_id', tripId)
          .order('departs_at'),
        userId
          ? db.from('flight_passengers').select('flight_id, seat').eq('user_id', userId)
          : Promise.resolve({ data: [] as { flight_id: string; seat: string | null }[] }),
      ]);

      const assentos = new Map((paxRes.data ?? []).map((p) => [p.flight_id, p.seat]));
      setVoos(
        (vooRes.data ?? []).map((f) => ({
          id: f.id,
          companhia: f.airline,
          numero: f.flight_number,
          origem: f.origin_iata,
          destino: f.destination_iata,
          parte: f.departs_at,
          chega: f.arrives_at,
          terminal: f.terminal,
          portao: f.gate,
          bagagem: f.baggage_allowance,
          status: f.status,
          assento: assentos.get(f.id) ?? null,
        })),
      );
    })();
  }, [tripId, userId]);

  const ida = voos?.[0];
  const volta = voos?.[1];

  return (
    <TripTelaInterna titulo="Meu voo">
      {voos === null ? (
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      ) : null}

      {voos !== null && voos.length === 0 ? (
        <View style={e.margem}>
          <EmptyState
            title="Nenhum voo cadastrado"
            description="Quando a Fly emitir as passagens, o voo e o e-ticket aparecem aqui."
          />
        </View>
      ) : null}

      {ida ? (
        <>
          <View style={e.margem}>
            <CartaoDeVoo voo={ida} />
          </View>

          <View style={e.margem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver e-ticket no cofre"
              onPress={() => router.push('/viagem/cofre')}
              style={({ pressed }) => [e.eticket, pressed && e.apertado]}
              testID="trip-eticket"
            >
              <LinearGradient
                colors={[cor.ouroClaro, cor.ouroFundo]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={e.eticketTexto}>Ver e-ticket</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {volta ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voo de retorno ${volta.numero}`}
          onPress={() => router.push('/viagem/voos')}
          style={({ pressed }) => [e.margem, e.retorno, pressed && e.apertado]}
        >
          <Text style={e.retornoKicker}>VOO DE RETORNO</Text>
          <View style={e.retornoLinha}>
            <Text style={[tipo('corpoForte'), { color: cor.texto, fontSize: 15 }]}>
              {volta.origem} → {volta.destino} · {volta.numero}
            </Text>
            <Text style={[tipo('legenda'), { color: cor.m45, fontWeight: '400' }]}>
              {quando(volta.parte)}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </TripTelaInterna>
  );
}

const e = StyleSheet.create({
  margem: { marginHorizontal: 18, marginTop: 18 },
  cartao: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: cor.vidro075,
  },
  topo: {
    paddingTop: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numero: { marginTop: 5, color: cor.texto },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: 'rgba(123,228,154,.1)',
    borderWidth: 1,
    borderColor: 'rgba(123,228,154,.22)',
  },
  seloAviso: {
    backgroundColor: cor.avisoTinta,
    borderColor: cor.avisoBorda,
  },
  pontoVivo: { width: 5, height: 5, borderRadius: 3, backgroundColor: cor.ativo },
  seloTexto: { fontSize: 9, fontWeight: '700', letterSpacing: 1.17, color: cor.ativo },

  rota: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  iata: { fontSize: 34, lineHeight: 34, fontWeight: '700', letterSpacing: -1.16, color: cor.texto },
  cidade: { marginTop: 6, color: cor.m45 },
  horario: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: cor.texto,
  },
  terminal: { marginTop: 3, fontSize: 11.5, color: cor.m40 },
  meio: { flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 10, marginBottom: 12 },
  duracao: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: cor.m35 },
  trilha: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  tracinho: { flex: 1, height: 1, backgroundColor: 'rgba(223,201,138,.55)' },
  direto: { fontSize: 10, letterSpacing: 0.6, color: cor.m30 },
  direita: { alignItems: 'flex-end' },

  divisor: { marginHorizontal: 20, height: 1, backgroundColor: cor.vidro07 },
  grade: { flexDirection: 'row', padding: 20, paddingTop: 16, gap: 14 },
  campo: { flex: 1 },
  campoRotulo: { fontSize: 9, fontWeight: '700', letterSpacing: 1.08, color: cor.m35 },
  campoValor: {
    marginTop: 5,
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: cor.texto,
  },

  eticket: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  eticketTexto: { fontSize: 15.5, fontWeight: '600', letterSpacing: -0.23, color: '#111' },

  retorno: {
    padding: 15,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro07,
    marginBottom: casca.margemTela,
  },
  retornoKicker: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.33,
    color: 'rgba(245,245,247,.38)',
  },
  retornoLinha: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  apertado: { transform: [{ scale: 0.975 }] },
});
