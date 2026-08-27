import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AppHeader,
  Botao,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { dataCurta, faltam, hora } from '@/viagem/tempo';

/**
 * Hotel e transfers (§7.6).
 *
 * O número do quarto é o dado delicado desta tela. Ele só aparece quando o
 * hotel liberou — e a coluna `room_released_at` existe justamente para que
 * "ainda não sei" seja diferente de "não tem". Mostrar "a definir" com cara de
 * dado faz alguém subir ao andar errado com a mala.
 *
 * Dados do motorista aparecem conforme a política de privacidade: a RLS já
 * limita a quem embarca, e a tela mostra o que houver, sem inventar.
 */

interface Hotel {
  id: string;
  nome: string;
  endereco: string | null;
  mapa: string | null;
  telefone: string | null;
  checkin: string | null;
  checkout: string | null;
  politica: string | null;
  timezone: string;
  quarto: string | null;
  quartoLiberadoEm: string | null;
}

interface Transfer {
  id: string;
  titulo: string;
  ponto: string;
  quando: string;
  destino: string | null;
  status: string;
  motorista: string | null;
  veiculo: string | null;
  placa: string | null;
  rastreio: string | null;
  embarcadoEm: string | null;
}

const ROTULO_TRANSFER: Record<string, string> = {
  scheduled: 'Programado',
  driver_assigned: 'Motorista definido',
  en_route: 'A caminho',
  arrived: 'Chegou',
  boarded: 'Embarcado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export default function HotelScreen() {
  const { state: sessao } = useSession();
  const { data: viagemData } = useViagem();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tripId = viagemData.kind === 'ready' ? viagemData.viagem.id : null;
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;

  const carregar = useCallback(async () => {
    if (!tripId) return;
    const db = supabase();

    const { data: hospedagens, error } = await db
      .from('accommodations')
      .select('id, name, address, map_url, phone, checkin_at, checkout_at, policy, timezone')
      .eq('trip_id', tripId)
      .order('checkin_at')
      .limit(1);

    if (error) return setErro(error.message);

    const h = hospedagens?.[0];
    if (h) {
      const { data: hospede } = userId
        ? await db
            .from('accommodation_guests')
            .select('room_number, room_released_at')
            .eq('accommodation_id', h.id)
            .eq('user_id', userId)
            .maybeSingle()
        : { data: null };

      setHotel({
        id: h.id,
        nome: h.name,
        endereco: h.address,
        mapa: h.map_url,
        telefone: h.phone,
        checkin: h.checkin_at,
        checkout: h.checkout_at,
        politica: h.policy,
        timezone: h.timezone,
        quarto: hospede?.room_number ?? null,
        quartoLiberadoEm: hospede?.room_released_at ?? null,
      });
    }

    const { data: ts } = await db
      .from('transfers')
      .select(
        'id, title, pickup_point, pickup_at, dropoff_point, status, driver_name, vehicle_description, vehicle_plate, tracking_url',
      )
      .eq('trip_id', tripId)
      .order('pickup_at');

    const { data: meus } = userId
      ? await db.from('transfer_passengers').select('transfer_id, boarded_at').eq('user_id', userId)
      : { data: [] };

    const embarque = new Map((meus ?? []).map((m) => [m.transfer_id, m.boarded_at]));

    setTransfers(
      (ts ?? []).map((t) => ({
        id: t.id,
        titulo: t.title,
        ponto: t.pickup_point,
        quando: t.pickup_at,
        destino: t.dropoff_point,
        status: t.status,
        motorista: t.driver_name,
        veiculo: t.vehicle_description,
        placa: t.vehicle_plate,
        rastreio: t.tracking_url,
        embarcadoEm: embarque.get(t.id) ?? null,
      })),
    );
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (viagemData.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-hotel">
        <AppHeader kicker="Hotel" title="Sem viagem ativa" />
        <EmptyState title="Nada por aqui ainda" description="A hospedagem aparece com a viagem." />
      </Screen>
    );
  }

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-hotel">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!transfers) {
    return (
      <Screen withBottomNav={false} testID="screen-hotel">
        <LoadingSkeleton label="Carregando hospedagem" />
      </Screen>
    );
  }

  const tz = hotel?.timezone ?? (viagemData.kind === 'ready' ? viagemData.viagem.timezone : 'UTC');

  return (
    <Screen withBottomNav={false} testID="screen-hotel">
      <AppHeader kicker="Sua viagem" title="Hotel e transfers" />

      {hotel ? (
        <Card>
          <View style={styles.bloco}>
            <Text variant="section">{hotel.nome}</Text>

            {hotel.endereco ? (
              <Text variant="body" tone="muted">
                {hotel.endereco}
              </Text>
            ) : null}

            <View style={styles.linha}>
              <Text variant="body" tone="muted">
                Quarto
              </Text>
              {/* Liberado é diferente de inexistente. */}
              <Text variant="body" tone={hotel.quarto ? undefined : 'faint'}>
                {hotel.quarto ?? 'Liberado no check-in'}
              </Text>
            </View>

            {hotel.checkin ? (
              <View style={styles.linha}>
                <Text variant="body" tone="muted">
                  Check-in
                </Text>
                <Text variant="body">
                  {dataCurta(hotel.checkin, tz)} · {hora(hotel.checkin, tz)}
                </Text>
              </View>
            ) : null}

            {hotel.checkout ? (
              <View style={styles.linha}>
                <Text variant="body" tone="muted">
                  Check-out
                </Text>
                <Text variant="body">
                  {dataCurta(hotel.checkout, tz)} · {hora(hotel.checkout, tz)}
                </Text>
              </View>
            ) : null}

            {hotel.politica ? (
              <Text variant="body" tone="faint">
                {hotel.politica}
              </Text>
            ) : null}

            <View style={styles.acoes}>
              {hotel.mapa ? (
                <Botao
                  rotulo="Abrir no mapa"
                  variante="fantasma"
                  onPress={() => void Linking.openURL(hotel.mapa as string)}
                />
              ) : null}
              {hotel.telefone ? (
                <Botao
                  rotulo="Ligar para o hotel"
                  variante="fantasma"
                  onPress={() => void Linking.openURL(`tel:${hotel.telefone}`)}
                />
              ) : null}
            </View>
          </View>
        </Card>
      ) : (
        <EmptyState
          title="Hospedagem ainda não publicada"
          description="Assim que a Fly confirmar, o hotel aparece aqui."
        />
      )}

      <View style={styles.secao}>
        <Kicker>Transfers</Kicker>

        {transfers.length === 0 ? (
          <Card>
            <Text variant="body" tone="muted">
              Nenhum transfer programado.
            </Text>
          </Card>
        ) : (
          transfers.map((t) => (
            <Card key={t.id}>
              <View style={styles.bloco}>
                <View style={styles.linhaTopo}>
                  <Text variant="body" style={styles.titulo}>
                    {t.titulo}
                  </Text>
                  <Text variant="body" tone={t.status === 'en_route' ? 'gold' : 'faint'}>
                    {ROTULO_TRANSFER[t.status] ?? t.status}
                  </Text>
                </View>

                <Text variant="body" tone="muted">
                  {hora(t.quando, tz)} · {t.ponto}
                  {t.destino ? ` → ${t.destino}` : ''}
                </Text>

                <Text variant="body" tone="faint">
                  {faltam(t.quando)}
                </Text>

                {t.motorista || t.veiculo || t.placa ? (
                  <Text variant="body" tone="muted">
                    {[t.motorista, t.veiculo, t.placa].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}

                {t.embarcadoEm ? (
                  <Text variant="body" tone="faint">
                    Embarque confirmado às {hora(t.embarcadoEm, tz)}
                  </Text>
                ) : null}

                {t.rastreio ? (
                  <Botao
                    rotulo="Onde está meu transfer?"
                    variante="fantasma"
                    onPress={() => void Linking.openURL(t.rastreio as string)}
                  />
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  secao: { gap: space.md, marginTop: space.section },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.stroke,
    borderRadius: radius.chip,
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
  },
  titulo: { fontWeight: '600', flexShrink: 1 },
  acoes: { gap: space.sm, marginTop: space.sm },
});
