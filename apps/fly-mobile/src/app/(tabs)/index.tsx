import { useEffect } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AppHeader,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  PhaseStub,
  Screen,
  Text,
} from '@/ui';
import { useSession } from '@/auth/session';
import { useHome, useUnreadCount, type HomeContext, type HomeEvent } from '@/home/useHome';
import { EventBanner } from '@/home/EventBanner';
import {
  DayTimeline,
  HomeHeader,
  NextActionCard,
  PackagePointsBand,
  PendingAlert,
} from '@/home/HomeBlocks';
import { useHoje } from '@/home/useHoje';
import Svg, { Path } from 'react-native-svg';
import {
  countdownLabel,
  dayLabel,
  greetingFor,
  sectionsFor,
  type SectionKind,
} from '@/home/composition';
import { useAnalytics } from '@/analytics/provider';

/**
 * Início (§5).
 *
 * A Home responde uma pergunta: "o que importa para este cliente agora?" — e
 * responde diferente conforme a fase da viagem.
 *
 * Quem decide a fase é o servidor, em `home_state()`. O app apenas pergunta e
 * desenha. Duas razões: a conta depende do fuso do destino, e mudar a regra
 * não pode exigir nova build.
 *
 * A ordem das seções vem de `@/home/composition`, que é onde a regra da §5.4
 * — operacional antes de promoção — está escrita e testada.
 */

function SecaoPendente({
  titulo,
  fase,
  resumo,
  itens,
  ref_,
}: {
  titulo: string;
  fase: number;
  resumo: string;
  itens: readonly string[];
  ref_: string;
}) {
  return (
    <View style={styles.secao}>
      <Kicker>{titulo}</Kicker>
      <PhaseStub phase={fase} summary={resumo} planned={itens} specRef={ref_} />
    </View>
  );
}

/** Glifo de envio do quadrado dourado, 19 px, como o design. */
function GlifoEnvio() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z"
        stroke={palette.gold}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** "18:30" no fuso do aparelho. O roteiro completo mostra o fuso do destino. */
function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function ProximaAcao({ contexto }: { contexto: HomeContext }) {
  if (contexto.state === 'no_trip') {
    return (
      <NextActionCard
        kicker="PRÓXIMA EXPERIÊNCIA"
        titulo="Sua próxima viagem começa aqui"
        apoio="Quando a Fly montar sua viagem, ela aparece neste espaço com tudo o que você precisa saber."
        icone={<GlifoEnvio />}
      />
    );
  }

  if (contexto.state === 'during_trip' && contexto.dayNumber && contexto.totalDays) {
    return (
      <NextActionCard
        kicker="AGORA NA SUA JORNADA"
        titulo={dayLabel(contexto.dayNumber, contexto.totalDays)}
        apoio={contexto.destinationName}
        icone={<GlifoEnvio />}
        onPress={() => router.push('/viagem')}
        testID="home-proxima-acao"
      />
    );
  }

  if (contexto.state === 'post_trip') {
    return (
      <NextActionCard
        kicker="SUA VIAGEM"
        titulo={contexto.tripName ?? 'Viagem concluída'}
        apoio={
          contexto.daysSince === 0
            ? 'Terminou hoje.'
            : `Terminou há ${contexto.daysSince} ${contexto.daysSince === 1 ? 'dia' : 'dias'}.`
        }
        icone={<GlifoEnvio />}
      />
    );
  }

  return null;
}

function Contagem({ contexto }: { contexto: HomeContext }) {
  if (contexto.daysUntil === null) return null;

  return (
    <Card>
      <View style={styles.bloco}>
        <Kicker>{contexto.destinationName}</Kicker>
        <Text variant="largeTitle">{countdownLabel(contexto.daysUntil)}</Text>
        <Text variant="body" tone="muted">
          {contexto.tripName}
        </Text>
        <Text variant="body" tone="faint">
          {`Contagem no fuso de ${contexto.destinationName} — o mesmo que você vai viver lá.`}
        </Text>
      </View>
    </Card>
  );
}

/**
 * Eventos na Home = **o banner, e so ele**.
 *
 * O design nao poe cabecalho de secao nem lista acima ou abaixo: o banner ja
 * se apresenta, com a pilula "EVENTOS FLY" dentro. O cabecalho "Acontece na
 * Fly" com "Ver todos" era invencao minha — conferido no arquivo do
 * prototipo, que nao tem nenhum dos dois.
 *
 * Sem evento com foto o bloco some. A listagem completa continua em
 * `/eventos`, alcancavel pelo detalhe do evento.
 */
function Eventos({ eventos }: { eventos: HomeEvent[] }) {
  const comFoto = eventos.filter((e) => e.imagem);
  if (comFoto.length === 0) return null;
  return <EventBanner eventos={comFoto} />;
}

/**
 * Faixa de pacote e pontos.
 *
 * Sem dado ainda: pacote e saldo vivem na Carteira, que e a Fase 6. A faixa
 * mostra a forma do design com o vazio honesto, e nao um numero inventado.
 */
function StatusPontos() {
  return <PackagePointsBand />;
}

export default function HomeScreen() {
  const { state: sessao } = useSession();
  const { data, reload } = useHome();
  const naoLidas = useUnreadCount();
  const hoje = useHoje(data.kind === 'ready' ? data.context.tripId : null);
  const analytics = useAnalytics();

  // Só conta como Home vista quando ela de fato montou com dados. Registrar
  // no carregamento inflaria a métrica com telas que ninguém chegou a ver.
  const estado = data.kind === 'ready' ? data.context.state : null;
  const qtdEventos = data.kind === 'ready' ? data.events.length : 0;

  useEffect(() => {
    if (!estado) return;
    analytics.registrar('home_vista', {
      estado,
      secoes: sectionsFor(estado).length,
      eventos_em_destaque: qtdEventos,
    });
  }, [analytics, estado, qtdEventos]);

  if (sessao.kind === 'signedOut') {
    return (
      <Screen bleed testID="screen-inicio">
        <AppHeader kicker="Início" title="Bem-vindo à Fly" />
        <EmptyState
          title="A Fly é por convite"
          description="Use o link que sua equipe enviou, ou entre com a conta que já ativou."
        />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen bleed testID="screen-inicio">
        <LoadingSkeleton label="Preparando sua Home" />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen bleed testID="screen-inicio">
        <ErrorState description={data.message} onRetry={() => void reload()} />
      </Screen>
    );
  }

  const { context, events } = data;
  const nome =
    sessao.kind === 'signedIn'
      ? (sessao.profile.preferredName ?? sessao.profile.displayName ?? 'viajante')
      : 'viajante';

  function renderizar(kind: SectionKind) {
    switch (kind) {
      case 'greeting': {
        // Linha de contexto do design: "Dubai · dia 3 de 7". Sem o clima —
        // nao ha integracao de tempo no projeto, e a §33 proibe inventar.
        const partes = [
          context.destinationName,
          context.dayNumber && context.totalDays
            ? dayLabel(context.dayNumber, context.totalDays).toLowerCase()
            : null,
        ].filter(Boolean);

        return (
          <HomeHeader
            key={kind}
            saudacao={`${greetingFor()}, ${nome}`}
            contexto={partes.length > 0 ? partes.join(' · ') : null}
            naoLidas={naoLidas}
            onAbrirNotificacoes={() => router.push('/notificacoes')}
          />
        );
      }

      case 'countdown':
        return <Contagem key={kind} contexto={context} />;

      case 'nextAction':
        return <ProximaAcao key={kind} contexto={context} />;

      case 'statusPoints':
        return <StatusPontos key={kind} />;

      case 'events':
        return <Eventos key={kind} eventos={events} />;

      case 'checklist':
        return (
          <SecaoPendente
            key={kind}
            titulo="Antes de embarcar"
            fase={4}
            resumo="Checklist obrigatório, passaporte, documentos e termos."
            itens={['Passaporte e documentos', 'Termos e autorizações', 'Voo e aeroporto']}
            ref_="§5.3"
          />
        );

      case 'criticalAlerts': {
        if (hoje.kind !== 'ready' || hoje.alertas.length === 0) return null;
        const a = hoje.alertas[0]!;
        return (
          <PendingAlert
            key={kind}
            titulo={a.titulo}
            apoio={a.notaDaAlteracao ?? 'Confira o roteiro e confirme que você viu.'}
            onPress={() => router.push('/viagem/roteiro')}
          />
        );
      }

      case 'todayTimeline': {
        if (hoje.kind !== 'ready' || hoje.itens.length === 0) return null;
        // O "ativo" e o proximo compromisso ainda por vir — e a bolinha dourada
        // do design. Passado nao pulsa.
        const agora = Date.now();
        const proximo = hoje.itens.find((i) => i.comecaEm && Date.parse(i.comecaEm) >= agora);

        return (
          <View key={kind} style={styles.secao}>
            <View style={styles.secaoTopo}>
              <Kicker>Seu dia</Kicker>
              <Link href="/viagem/roteiro" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="Ver o roteiro completo">
                  <Text variant="body" tone="gold">
                    Ver tudo
                  </Text>
                </Pressable>
              </Link>
            </View>
            <DayTimeline
              itens={hoje.itens.map((i) => ({
                id: i.id,
                titulo: i.titulo,
                hora: i.comecaEm ? horaCurta(i.comecaEm) : null,
                local: i.pontoDeEncontro,
                ativo: proximo?.id === i.id,
                pendente: i.alteradaEm !== null,
              }))}
            />
          </View>
        );
      }

      case 'support':
        return (
          <View key={kind} style={styles.rodape}>
            <Text variant="body" tone="faint" style={styles.centro}>
              A Fly está a um toque de distância, pelo botão de ajuda.
            </Text>
          </View>
        );

      // Seções cujo conteúdo pertence a fases posteriores. Elas não aparecem
      // como espaço vazio: simplesmente ainda não são renderizadas.
      default:
        return null;
    }
  }

  return (
    <Screen bleed testID="screen-inicio">
      {sectionsFor(context.state).map((secao) => renderizar(secao.kind))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  blocoCurto: { flex: 1, gap: space.xs },
  linha: { flexDirection: 'row', gap: space.lg },
  secao: { gap: space.md, marginTop: space.section },
  secaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  lista: { gap: space.lg },
  nota: { marginTop: space.md },
  rodape: { marginTop: space.section },
  centro: { textAlign: 'center' },
  sino: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
  },
  sinoPonto: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.gold,
    borderWidth: 2,
    borderColor: palette.background,
  },
});
