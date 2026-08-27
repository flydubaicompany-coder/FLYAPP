import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AlertBanner,
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
import { Link } from 'expo-router';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { dataCurta, faltam, hora } from '@/viagem/tempo';

/**
 * Voos e Modo Aeroporto (§7.5).
 *
 * Duas coisas fazem esta tela diferente das outras:
 *
 * 1. **Cada ponta tem o seu fuso.** "Sai 22h de Guarulhos, chega 18h de
 *    Dubai" só faz sentido se cada horário for formatado no fuso do seu
 *    aeroporto. Converter tudo para um fuso só produz o número certo e a
 *    leitura errada.
 *
 * 2. **Modo Aeroporto.** Uma tela reduzida ao que se usa em pé, na fila, com
 *    pressa: voo, portão, horário de sair e onde a Fly está. Tudo o mais sai
 *    da frente — não por estética, mas porque rolar procurando o portão com
 *    uma mala em cada mão é o cenário que a tela precisa vencer.
 */

interface Voo {
  id: string;
  companhia: string;
  numero: string;
  origem: string;
  destino: string;
  parte: string;
  chega: string;
  fusoOrigem: string;
  fusoDestino: string;
  terminal: string | null;
  portao: string | null;
  bagagem: string | null;
  sairAs: string | null;
  instrucoesBase: string | null;
  status: string | null;
  assento: string | null;
}

export default function VoosScreen() {
  const { state: sessao } = useSession();
  const { data: viagemData } = useViagem();
  const [voos, setVoos] = useState<Voo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modoAeroporto, setModoAeroporto] = useState(false);
  const [passaporte, setPassaporte] = useState<
    | {
        validade: string;
        venceAntes: boolean;
        folga: number;
        conferido: boolean;
      }
    | null
    | 'ausente'
  >(null);

  const tripId = viagemData.kind === 'ready' ? viagemData.viagem.id : null;
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;

  const carregar = useCallback(async () => {
    if (!tripId) return;
    const db = supabase();

    const [lista, assentos] = await Promise.all([
      db
        .from('flights')
        .select(
          'id, airline, flight_number, origin_iata, destination_iata, departs_at, arrives_at, origin_timezone, destination_timezone, terminal, gate, baggage_allowance, leave_by_at, fly_base_instructions, status',
        )
        .eq('trip_id', tripId)
        .order('departs_at'),
      userId
        ? db.from('flight_passengers').select('flight_id, seat').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (lista.error) return setErro(lista.error.message);

    const porVoo = new Map((assentos.data ?? []).map((a) => [a.flight_id, a.seat]));

    setVoos(
      (lista.data ?? []).map((f) => ({
        id: f.id,
        companhia: f.airline,
        numero: f.flight_number,
        origem: f.origin_iata,
        destino: f.destination_iata,
        parte: f.departs_at,
        chega: f.arrives_at,
        fusoOrigem: f.origin_timezone,
        fusoDestino: f.destination_timezone,
        terminal: f.terminal,
        portao: f.gate,
        bagagem: f.baggage_allowance,
        sairAs: f.leave_by_at,
        instrucoesBase: f.fly_base_instructions,
        status: f.status,
        assento: porVoo.get(f.id) ?? null,
      })),
    );
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * O checklist de passaporte da §7.5.
   *
   * A conta de "vence antes do fim da viagem" vem do servidor, porque depende
   * da data da viagem. A regra dos seis meses **não** é afirmada: varia por
   * destino e nacionalidade, e a §33 proíbe a Fly dizer ao cliente uma regra
   * que não confirmou. O que a tela afirma é a aritmética, e mostra a folga
   * para a pessoa decidir.
   */
  useEffect(() => {
    if (!tripId) return;
    void (async () => {
      const { data, error } = await supabase().rpc('passaporte_para_viagem', { p_trip: tripId });
      // Falha de leitura nao e "sem passaporte cadastrado". Dizer 'ausente'
      // por causa de rede manda o viajante recadastrar um documento que ja
      // esta la — e o bloco simplesmente nao aparece, que e o estado honesto.
      if (error) return setPassaporte(null);
      const p = Array.isArray(data) ? data[0] : data;
      if (!p) return setPassaporte('ausente');
      setPassaporte({
        validade: p.expires_on,
        venceAntes: p.vence_antes_do_fim,
        folga: p.dias_de_folga,
        conferido: Boolean(p.verified_at),
      });
    })();
  }, [tripId]);

  if (viagemData.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-voos">
        <AppHeader kicker="Voos" title="Sem viagem ativa" />
        <EmptyState title="Nada por aqui ainda" description="Seus voos aparecem com a viagem." />
      </Screen>
    );
  }

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-voos">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!voos) {
    return (
      <Screen withBottomNav={false} testID="screen-voos">
        <LoadingSkeleton label="Carregando seus voos" />
      </Screen>
    );
  }

  // O próximo voo é o primeiro que ainda não partiu.
  const agora = Date.now();
  const proximo = voos.find((v) => new Date(v.parte).getTime() > agora) ?? voos[0] ?? null;

  // --- Modo Aeroporto -----------------------------------------------------
  if (modoAeroporto && proximo) {
    return (
      <Screen withBottomNav={false} testID="screen-modo-aeroporto">
        <View style={styles.aeroporto}>
          <Kicker>Modo Aeroporto</Kicker>

          <Text variant="largeTitle">
            {proximo.companhia} {proximo.numero}
          </Text>

          <View style={styles.rota}>
            <View style={styles.ponta}>
              <Text variant="largeTitle">{proximo.origem}</Text>
              <Text variant="section">{hora(proximo.parte, proximo.fusoOrigem)}</Text>
              <Text variant="body" tone="faint">
                horário local
              </Text>
            </View>
            <Text variant="section" tone="faint">
              →
            </Text>
            <View style={styles.ponta}>
              <Text variant="largeTitle">{proximo.destino}</Text>
              <Text variant="section">{hora(proximo.chega, proximo.fusoDestino)}</Text>
              <Text variant="body" tone="faint">
                horário local
              </Text>
            </View>
          </View>

          <View style={styles.grandes}>
            <Grande rotulo="Terminal" valor={proximo.terminal} />
            <Grande rotulo="Portão" valor={proximo.portao} />
            <Grande rotulo="Assento" valor={proximo.assento} />
          </View>

          {proximo.sairAs ? (
            <Card>
              <View style={styles.bloco}>
                <Text variant="body" tone="muted">
                  Sair às
                </Text>
                <Text variant="largeTitle" tone="gold">
                  {hora(proximo.sairAs, proximo.fusoOrigem)}
                </Text>
                <Text variant="body" tone="faint">
                  {faltam(proximo.sairAs)}
                </Text>
              </View>
            </Card>
          ) : null}

          {proximo.instrucoesBase ? (
            <Card>
              <View style={styles.bloco}>
                <Kicker>Base Fly</Kicker>
                <Text variant="body" tone="muted">
                  {proximo.instrucoesBase}
                </Text>
              </View>
            </Card>
          ) : null}

          <Botao
            rotulo="Sair do Modo Aeroporto"
            variante="fantasma"
            onPress={() => setModoAeroporto(false)}
            testID="sair-modo-aeroporto"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-voos">
      <AppHeader kicker="Sua viagem" title="Voos" />

      {voos.length === 0 ? (
        <EmptyState
          title="Nenhum voo cadastrado"
          description="Assim que a Fly emitir, os detalhes aparecem aqui."
        />
      ) : (
        <>
          {proximo ? (
            <Botao
              rotulo="Modo Aeroporto"
              onPress={() => setModoAeroporto(true)}
              testID="entrar-modo-aeroporto"
            />
          ) : null}

          {/* Checklist de passaporte (§7.5). Antes dos voos: sem documento
              válido, o horário do voo não importa. */}
          {passaporte === 'ausente' ? (
            <Card>
              <View style={styles.bloco}>
                <Text variant="section">Falta seu passaporte</Text>
                <Text variant="body" tone="muted">
                  A Fly precisa dos dados do seu passaporte para emitir as passagens.
                </Text>
                <Link href="/perfil/passaporte" asChild>
                  <Botao rotulo="Preencher agora" onPress={() => undefined} />
                </Link>
              </View>
            </Card>
          ) : passaporte ? (
            <Card>
              <View style={styles.bloco}>
                <View style={styles.linhaTopo}>
                  <Text variant="body" tone="muted">
                    Passaporte
                  </Text>
                  <Text variant="body" tone={passaporte.conferido ? 'ok' : 'faint'}>
                    {passaporte.conferido ? 'Conferido' : 'Aguardando conferência'}
                  </Text>
                </View>

                {passaporte.venceAntes ? (
                  <Text variant="body" tone="danger">
                    Vence em {dataCurta(`${passaporte.validade}T12:00:00Z`, 'UTC')}, antes do fim da
                    viagem.
                  </Text>
                ) : (
                  <Text variant="body">
                    Válido por {passaporte.folga} dias além do fim da viagem.
                  </Text>
                )}

                <Text variant="body" tone="faint">
                  Vários países exigem validade mínima além da data de retorno. Confira a exigência
                  do seu destino antes de embarcar.
                </Text>
              </View>
            </Card>
          ) : null}

          {voos.map((v) => (
            <Card key={v.id}>
              <View style={styles.bloco}>
                <View style={styles.linhaTopo}>
                  <Text variant="section">
                    {v.origem} → {v.destino}
                  </Text>
                  <Text variant="body" tone="faint">
                    {dataCurta(v.parte, v.fusoOrigem)}
                  </Text>
                </View>

                <Text variant="body" tone="muted">
                  {v.companhia} {v.numero}
                  {v.status ? ` · ${v.status}` : ''}
                </Text>

                {/* Cada horário no fuso do seu aeroporto, e dito assim. */}
                <Text variant="body">
                  Sai {hora(v.parte, v.fusoOrigem)} em {v.origem} · chega{' '}
                  {hora(v.chega, v.fusoDestino)} em {v.destino}
                </Text>

                {[
                  ['Terminal', v.terminal],
                  ['Portão', v.portao],
                  ['Assento', v.assento],
                  ['Bagagem', v.bagagem],
                ]
                  .filter(([, valor]) => valor)
                  .map(([rotulo, valor]) => (
                    <View key={rotulo} style={styles.linha}>
                      <Text variant="body" tone="muted">
                        {rotulo}
                      </Text>
                      <Text variant="body">{valor}</Text>
                    </View>
                  ))}

                {v.sairAs ? (
                  <Text variant="body" tone="gold">
                    Sair às {hora(v.sairAs, v.fusoOrigem)} · {faltam(v.sairAs)}
                  </Text>
                ) : null}
              </View>
            </Card>
          ))}

          {/* O que a Fly não controla, a Fly não promete (§33). */}
          <AlertBanner
            title="Confirme sempre no painel do aeroporto"
            description="Portão e horário podem mudar de última hora. A Fly avisa o que souber, mas o painel do aeroporto é a fonte final."
          />
        </>
      )}
    </Screen>
  );
}

function Grande({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <View style={styles.grande}>
      <Text variant="body" tone="muted">
        {rotulo}
      </Text>
      <Text variant="largeTitle">{valor ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
  },
  aeroporto: { gap: space.xl },
  rota: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  ponta: { gap: space.xs, alignItems: 'center', flex: 1 },
  grandes: { flexDirection: 'row', gap: space.md },
  grande: {
    flex: 1,
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
    alignItems: 'center',
  },
});
