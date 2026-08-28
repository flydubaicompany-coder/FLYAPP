import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { useViagem, type Viagem } from '@/viagem/useViagem';
import { CartaoDaViagem, SeletorDeDias, type Dia } from '@/viagem/CartaoDaViagem';
import { RoteiroDoDia, type ItemDoRoteiro } from '@/viagem/Roteiro';
import { useDias, type DiaDaViagem } from '@/viagem/useDias';
import { useState } from 'react';
import { router } from 'expo-router';
import { dataCurta, faltam, hora } from '@/viagem/tempo';
import { itensAbertos, itensPendentes } from '@/viagem/hub';
function Hub() {
  return (
    <View style={styles.secao}>
      <Kicker>Sua viagem</Kicker>
      <View style={styles.grade}>
        {itensAbertos().map((item) => (
          <Link key={item.chave} href={item.rota as never} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${item.rotulo}. ${item.descricao}`}
              testID={`hub-${item.chave}`}
            >
              {({ pressed }) => (
                <View style={[styles.itemHub, pressed && styles.pressed]}>
                  <Text variant="body" style={styles.itemTitulo}>
                    {item.rotulo}
                  </Text>
                  <Text variant="body" tone="faint" numberOfLines={2}>
                    {item.descricao}
                  </Text>
                </View>
              )}
            </Pressable>
          </Link>
        ))}
      </View>

      {/* O que ainda não abriu continua listado, com a fase. Esconder ensina
          o cliente a não procurar. */}
      <Text variant="body" tone="faint" style={styles.notaHub}>
        Em breve:{' '}
        {itensPendentes()
          .map((i) => i.rotulo)
          .join(' · ')}
      </Text>
    </View>
  );
}

const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const ROTULO_ITEM: Record<string, string> = {
  done: 'CONCLUÍDO',
  confirmed: 'CONFIRMADO',
  scheduled: 'CONFIRMADO',
  cancelled: 'CANCELADO',
};

/**
 * O diario: seletor de dias, titulo do dia e a linha do tempo.
 *
 * Substitui os blocos "Proximo passo" e "Progresso", que repetiam o que o
 * cartao da viagem ja diz. O design abre a viagem no roteiro, e nao num resumo
 * do resumo.
 */
function Diario({
  dias,
  viagem,
  escolhido,
  aoEscolher,
}: {
  dias: readonly DiaDaViagem[];
  viagem: Viagem;
  escolhido: string | null;
  aoEscolher: (chave: string) => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const atual = escolhido ?? dias.find((d) => d.data === hoje)?.id ?? dias[0]!.id;
  const dia = dias.find((d) => d.id === atual) ?? dias[0]!;

  const chips: Dia[] = dias.map((d) => {
    const data = new Date(`${d.data}T12:00:00`);
    return {
      chave: d.id,
      semana: SEMANA[data.getDay()] ?? '',
      numero: String(data.getDate()),
    };
  });

  const agora = Date.now();
  const proximo = dia.atividades.find((a) => a.comecaEm && Date.parse(a.comecaEm) >= agora);

  const itens: ItemDoRoteiro[] = dia.atividades.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    hora: hora(a.comecaEm, viagem.timezone),
    status: a.alteradaEm
      ? 'ALTEROU'
      : proximo?.id === a.id
        ? (faltam(a.comecaEm)?.toUpperCase() ?? null)
        : (ROTULO_ITEM[a.status] ?? null),
    local: a.local,
    concluido: a.status === 'done',
    pendente: a.alteradaEm !== null,
    destaque: proximo?.id === a.id,
    detalhes: a.local,
  }));

  return (
    <>
      <SeletorDeDias dias={chips} selecionado={atual} aoEscolher={aoEscolher} />
      <RoteiroDoDia
        titulo={dia.titulo ?? tituloDoDia(dia.data)}
        itens={itens}
        aoAbrir={(id) => router.push(`/viagem/atividade/${id}`)}
        aoVerIngressos={() => router.push('/viagem/qr')}
        aoVerRota={() => undefined}
      />
    </>
  );
}

/** "Sexta, 25 de agosto" — o titulo do dia, como o design escreve. */
function tituloDoDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const nome = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}, ${d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
  })}`;
}

export default function TripScreen() {
  const { data, reload } = useViagem();
  const tripId = data.kind === 'ready' ? data.viagem.id : null;
  const dias = useDias(tripId);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);

  if (data.kind === 'loading') {
    return (
      <Screen testID="screen-viagem">
        <LoadingSkeleton label="Carregando sua viagem" />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen testID="screen-viagem">
        <ErrorState description={data.message} onRetry={() => void reload()} />
      </Screen>
    );
  }

  if (data.kind === 'semViagem') {
    return (
      <Screen testID="screen-viagem">
        <AppHeader kicker="Minha Viagem" title="Sua jornada" />
        <EmptyState
          title="Nenhuma viagem ativa"
          description="Quando a Fly montar sua viagem, tudo o que você precisa aparece aqui: roteiro, documentos, voos e o que está incluso."
        />
      </Screen>
    );
  }

  const { viagem } = data;

  return (
    <Screen bleed testID="screen-viagem">
      <View style={styles.cabecalho}>
        <Text variant="largeTitle" style={styles.tituloTela}>
          Minha Viagem
        </Text>
      </View>

      {/* Cartao da viagem, com as medidas do handoff. Substitui o cabecalho de
          texto que havia aqui: o design abre com a foto do destino. */}
      <CartaoDaViagem
        destino={viagem.destino}
        subtitulo={[dataCurta(viagem.comecaEm, viagem.timezone), viagem.nome]
          .filter(Boolean)
          .join(' · ')}
        diaAtual={viagem.diaAtual}
        totalDias={viagem.totalDias}
        foto="eventos/burj-khalifa.jpg"
      />

      {/* Alteração de roteiro vem antes de tudo. É a §5.4 aplicada aqui:
          informação operacional acima de qualquer outra coisa. */}
      {viagem.alteracoesPendentes > 0 ? (
        <AlertBanner
          severity="critical"
          title={
            viagem.alteracoesPendentes === 1
              ? 'Uma atividade mudou'
              : `${viagem.alteracoesPendentes} atividades mudaram`
          }
          description="Confirme a leitura para a equipe saber que você viu."
          actionLabel="Ver o que mudou"
          onAction={() => undefined}
        />
      ) : null}

      {dias.kind === 'ready' && dias.dias.length > 0 ? (
        <Diario
          dias={dias.dias}
          viagem={viagem}
          escolhido={diaEscolhido}
          aoEscolher={setDiaEscolhido}
        />
      ) : null}

      <Hub />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: { paddingHorizontal: 20, paddingTop: 4 },
  tituloTela: { fontSize: 33, fontWeight: '700', letterSpacing: -1.25 },
  bloco: { gap: space.sm },
  linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  secao: { gap: space.md, marginTop: space.section },
  grade: { gap: space.md },
  itemHub: {
    gap: space.xs,
    minHeight: touchTarget.min,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  itemTitulo: { fontWeight: '600' },
  notaHub: { marginTop: space.sm },
  pressed: { opacity: 0.8 },
  linkCard: { minHeight: touchTarget.min, justifyContent: 'center' },
  trilho: {
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.stroke,
    overflow: 'hidden',
  },
  preenchido: { height: 4, borderRadius: 2, backgroundColor: palette.gold },
});
