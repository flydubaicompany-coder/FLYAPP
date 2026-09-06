import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, shadowStyle, space, touchTarget } from '@/theme';
import { Card, EmptyState, ErrorState, Kicker, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { faltaTexto, type Alerta, type AtividadeParaAlerta } from './alertas';
import { useRoteiroProximo } from './useRoteiroProximo';

/**
 * A Home do Trip Mode — Dubai, setembro de 2026.
 *
 * A pergunta que ela responde é uma só, e é a mesma que a Home completa
 * responde: **o que importa agora?** O que muda é a resposta: aqui não há
 * evento, oferta nem ponto. Há uma viagem acontecendo.
 *
 * A ordem é deliberada e é a da §5.4 — operacional antes de promoção:
 *
 *   1. onde você está (o banner, que também diz que a viagem começou);
 *   2. o que acontece **agora** (alertas, quando houver);
 *   3. o **próximo compromisso**, um só, grande;
 *   4. o resto do dia;
 *   5. os atalhos.
 *
 * Nada aqui inventa conteúdo. Destino, datas, horários e "o que levar" vêm do
 * roteiro que a operação escreveu — o app só decide o que é urgente, e decide
 * por hora, não por adivinhação.
 */

const COR_DO_ALERTA: Record<Alerta['nivel'], string> = {
  agora: palette.gold,
  mudou: palette.warning,
  importante: palette.warning,
  hoje: palette.textMuted,
  amanha: palette.textMuted,
};

function hora(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function intervaloCurto(inicio: string, fim: string): string {
  const a = new Date(inicio);
  const b = new Date(fim);
  const mes = (d: Date) =>
    d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${mes(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`;
}

/**
 * O banner.
 *
 * Gradiente e não imagem: uma foto de Dubai teria de vir de algum lugar, e
 * `trips` não guarda capa. Inventar uma imagem de banco de imagens seria
 * exatamente o "protótipo barato" que este release não pode parecer — o
 * gradiente dourado sobre grafite é a assinatura que o app já tem.
 */
function Banner({
  destino,
  periodo,
  nome,
  emAndamento,
}: {
  destino: string;
  periodo: string;
  nome: string | null;
  emAndamento: boolean;
}) {
  return (
    <View style={[styles.banner, shadowStyle('card')]}>
      <LinearGradient
        colors={[palette.goldFill, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerConteudo}>
        {nome ? <Kicker>Olá, {nome}</Kicker> : <Kicker>Fly</Kicker>}
        <Text variant="largeTitle" style={styles.bannerDestino}>
          {destino}
        </Text>
        <Text variant="body" style={styles.bannerPeriodo}>
          {periodo}
        </Text>
        <Text variant="body" tone="muted" style={styles.bannerFrase}>
          {emAndamento ? 'Sua experiência Fly começou.' : 'Sua experiência Fly está chegando.'}
        </Text>
      </View>
    </View>
  );
}

function FaixaDeAlertas({ alertas }: { alertas: readonly Alerta[] }) {
  if (alertas.length === 0) return null;
  return (
    <View style={styles.secao}>
      {alertas.slice(0, 4).map((a) => (
        <View
          key={a.id}
          style={[styles.alerta, { borderLeftColor: COR_DO_ALERTA[a.nivel] }]}
          accessibilityRole="alert"
        >
          <Text variant="caption" style={{ color: COR_DO_ALERTA[a.nivel] }}>
            {a.titulo}
          </Text>
          <Text variant="body">{a.corpo}</Text>
        </View>
      ))}
    </View>
  );
}

function CartaoDoProximo({ atividade }: { atividade: AtividadeParaAlerta }) {
  const referencia = atividade.saidaEm ?? atividade.comecaEm;
  const faltam = referencia
    ? Math.round((new Date(referencia).getTime() - Date.now()) / 60000)
    : null;

  return (
    <View style={styles.secao}>
      <Kicker>Próximo compromisso</Kicker>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalhes de ${atividade.titulo}`}
        onPress={() => router.push(`/viagem/atividade/${atividade.id}`)}
        style={({ pressed }) => [pressed && styles.pressionado]}
      >
        <Card>
          <Text variant="section" style={styles.proximoTitulo}>
            {atividade.titulo}
          </Text>
          <Text variant="body" style={styles.proximoQuando}>
            {referencia ? hora(referencia) : 'Horário a confirmar'}
            {faltam !== null && faltam <= 720 ? ` · ${faltaTexto(faltam)}` : ''}
          </Text>
          {atividade.local ? (
            <Text variant="body" tone="muted">
              {atividade.local}
            </Text>
          ) : null}
          <Text variant="caption" style={styles.verDetalhes}>
            VER DETALHES
          </Text>
        </Card>
      </Pressable>
    </View>
  );
}

function SeuDia({ itens }: { itens: readonly AtividadeParaAlerta[] }) {
  if (itens.length === 0) return null;
  return (
    <View style={styles.secao}>
      <Kicker>Seu dia</Kicker>
      <Card padding={space.lg}>
        {itens.map((a, i) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityLabel={a.titulo}
            onPress={() => router.push(`/viagem/atividade/${a.id}`)}
            style={[styles.linhaDoDia, i > 0 && styles.linhaComTopo]}
          >
            <Text variant="body" style={styles.horaDoDia}>
              {hora(a.comecaEm ?? a.saidaEm) || '—'}
            </Text>
            <View style={styles.tituloDoDia}>
              <Text variant="body">{a.titulo}</Text>
              {a.local ? (
                <Text variant="body" tone="muted">
                  {a.local}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

/**
 * Os destinos que a viagem usa todo dia.
 *
 * Sete, e cada um e uma tela que ja existia — nenhum atalho leva a algo
 * construido para este release, exceto Documentos e Mais experiencias. E a
 * ordem e a do dia: roteiro e passeios de manha, voo e hotel na chegada e na
 * saida, galeria no fim.
 */
const ATALHOS = [
  { rotulo: 'Meu roteiro', destino: '/viagem/roteiro' },
  { rotulo: 'Meus passeios', destino: '/passeios/meus' },
  { rotulo: 'Documentos', destino: '/viagem/documentos' },
  { rotulo: 'Voo', destino: '/viagem/voos' },
  { rotulo: 'Hotel', destino: '/viagem/hotel' },
  { rotulo: 'Galeria', destino: '/galeria' },
  { rotulo: 'Mais experiências', destino: '/experiencias' },
] as const;

function Atalhos() {
  return (
    <View style={styles.secao}>
      <Kicker>Atalhos</Kicker>
      <View style={styles.grade}>
        {ATALHOS.map((a) => (
          <Pressable
            key={a.destino}
            accessibilityRole="button"
            accessibilityLabel={a.rotulo}
            onPress={() => router.push(a.destino)}
            style={({ pressed }) => [styles.atalho, pressed && styles.pressionado]}
          >
            <Text variant="body" style={styles.atalhoTexto}>
              {a.rotulo}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TripHome() {
  const { state: sessao } = useSession();
  const { data: viagem } = useViagem();
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const roteiro = useRoteiroProximo(tripId);

  const perfil = sessao.kind === 'signedIn' ? sessao.profile : null;
  const nome = perfil?.preferredName ?? perfil?.displayName ?? null;

  if (viagem.kind === 'loading') {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }

  if (viagem.kind === 'error') {
    return (
      <Screen>
        <ErrorState description={viagem.message} />
      </Screen>
    );
  }

  if (viagem.kind === 'semViagem') {
    return (
      <Screen>
        <EmptyState
          title="Sua viagem ainda não começou"
          description="Quando a Fly montar sua viagem, tudo o que você precisa aparece aqui."
        />
      </Screen>
    );
  }

  const v = viagem.viagem;
  const emAndamento = v.diaAtual !== null;

  return (
    <Screen scroll>
      <Banner
        destino={v.destino}
        periodo={intervaloCurto(v.comecaEm, v.terminaEm)}
        nome={nome}
        emAndamento={emAndamento}
      />

      {roteiro.kind === 'ready' ? (
        <>
          <FaixaDeAlertas alertas={roteiro.alertas} />
          {roteiro.proximo ? <CartaoDoProximo atividade={roteiro.proximo} /> : null}
          <SeuDia itens={roteiro.doDia} />
        </>
      ) : null}

      {/* Os atalhos aparecem mesmo enquanto o roteiro carrega: eles não
          dependem dele, e são o que a pessoa toca quando abriu o app para
          buscar o voucher, não para saber a hora. */}
      <Atalhos />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.goldBorder,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  bannerConteudo: {
    padding: space.xl,
    gap: space.xs,
  },
  bannerDestino: {
    marginTop: space.xs,
  },
  bannerPeriodo: {
    color: palette.gold,
    letterSpacing: 1,
  },
  bannerFrase: {
    marginTop: space.sm,
  },
  secao: {
    marginBottom: space.xl,
    gap: space.sm,
  },
  alerta: {
    borderLeftWidth: 3,
    paddingLeft: space.md,
    paddingVertical: space.xs,
    gap: 2,
  },
  proximoTitulo: {
    marginBottom: space.xs,
  },
  proximoQuando: {
    color: palette.gold,
  },
  verDetalhes: {
    marginTop: space.md,
    color: palette.textMuted,
  },
  linhaDoDia: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.sm,
    minHeight: touchTarget.min,
    alignItems: 'center',
  },
  linhaComTopo: {
    borderTopWidth: 1,
    borderTopColor: palette.strokeSubtle,
  },
  horaDoDia: {
    width: 52,
    color: palette.textMuted,
  },
  tituloDoDia: {
    flex: 1,
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  atalho: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  atalhoTexto: {
    color: palette.text,
  },
  pressionado: {
    opacity: 0.7,
  },
});
