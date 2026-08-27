import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { useViagem, type Viagem } from '@/viagem/useViagem';
import { faltam, hora, saidaEminente } from '@/viagem/tempo';
import { itensAbertos, itensPendentes } from '@/viagem/hub';

/**
 * Minha Viagem — a tela raiz (§7.1).
 *
 * Esta é a tela que alguém abre andando na rua, com pressa, às vezes sem
 * saber exatamente onde está. Ela responde uma pergunta antes de qualquer
 * outra: **o que eu faço agora?**
 *
 * Por isso a ordem dos blocos não é negociável: alteração pendente vem antes
 * de tudo, "agora/próximo" vem em seguida, e o hub — que é navegação, não
 * informação — vem por último.
 *
 * Todo horário é formatado no fuso do destino. O aparelho pode estar em
 * qualquer fuso; a viagem acontece em um só.
 */

function ProximoPasso({ viagem }: { viagem: Viagem }) {
  const { agora, proximo, timezone } = viagem;

  if (agora) {
    return (
      <Card>
        <View style={styles.bloco}>
          <Kicker>Agora</Kicker>
          <Text variant="largeTitle">{agora.titulo}</Text>
          <Text variant="body" tone="muted">
            Começou às {hora(agora.comeca, timezone)}
          </Text>
          {proximo ? (
            <Text variant="body" tone="faint">
              Depois: {proximo.titulo}, {hora(proximo.comeca, timezone)}
            </Text>
          ) : null}
        </View>
      </Card>
    );
  }

  if (proximo) {
    // Perto da saída, o horário de sair é o dado que muda o que a pessoa faz.
    // Longe dela, é ruído — e o de começar é o que importa.
    const saindo = saidaEminente(proximo.saida);

    return (
      <Card>
        <View style={styles.bloco}>
          <Kicker>Próximo</Kicker>
          <Text variant="largeTitle">{proximo.titulo}</Text>

          {saindo && proximo.saida ? (
            <Text variant="section" tone="gold">
              Sair às {hora(proximo.saida, timezone)} · {faltam(proximo.saida)}
            </Text>
          ) : (
            <Text variant="body" tone="muted">
              {hora(proximo.comeca, timezone)} · {faltam(proximo.comeca)}
            </Text>
          )}

          {proximo.ponto ? (
            <Text variant="body" tone="muted">
              Ponto de encontro: {proximo.ponto}
            </Text>
          ) : null}

          <Link href={`/viagem/atividade/${proximo.id}`} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Abrir ${proximo.titulo}`}
              style={styles.linkCard}
            >
              <Text variant="body" tone="gold">
                Ver detalhes
              </Text>
            </Pressable>
          </Link>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.bloco}>
        <Kicker>Sua jornada</Kicker>
        <Text variant="section">Nada marcado para agora</Text>
        <Text variant="body" tone="muted">
          O roteiro completo está logo abaixo.
        </Text>
      </View>
    </Card>
  );
}

function Progresso({ viagem }: { viagem: Viagem }) {
  if (viagem.diaAtual === null) return null;

  const pct = Math.round((viagem.diaAtual / viagem.totalDias) * 100);

  return (
    <Card>
      <View style={styles.bloco}>
        <View style={styles.linhaEntre}>
          <Text variant="body" tone="muted">
            Dia {viagem.diaAtual} de {viagem.totalDias}
          </Text>
          <Text variant="body" tone="faint">
            {viagem.destino}
          </Text>
        </View>
        {/* A barra é decorativa: o número acima já diz tudo, e um leitor de
            tela não deve anunciar a mesma informação duas vezes. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.trilho}
        >
          <View style={[styles.preenchido, { width: `${pct}%` }]} />
        </View>
      </View>
    </Card>
  );
}

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
              style={({ pressed }) => [styles.itemHub, pressed && styles.pressed]}
              testID={`hub-${item.chave}`}
            >
              <Text variant="body" style={styles.itemTitulo}>
                {item.rotulo}
              </Text>
              <Text variant="body" tone="faint" numberOfLines={2}>
                {item.descricao}
              </Text>
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

export default function TripScreen() {
  const { data, reload } = useViagem();

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
    <Screen testID="screen-viagem">
      <AppHeader kicker={viagem.destino} title={viagem.nome} />

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

      <ProximoPasso viagem={viagem} />
      <Progresso viagem={viagem} />
      <Hub />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
