import { Link, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AppHeader,
  Card,
  EmptyState,
  ErrorState,
  FlyQR,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { useSession } from '@/auth/session';

/**
 * Perfil (§9 e §37.7).
 *
 * Hub da identidade: Fly ID, QR pessoal, dados, preferencias, viagens,
 * conquistas, ranking, privacidade, notificacoes e Quem Somos.
 *
 * Viagens e conquistas aparecem **vazias** de proposito. A §37.7 pede isso, e
 * e a leitura certa: um cliente novo tem zero viagens, e inventar historico
 * para a tela "encher" seria dado falso em producao (§33).
 */

interface LinhaProps {
  label: string;
  hint?: string;
  /** `Href` e nao `string`: e o que faz o Expo Router recusar rota inexistente. */
  href?: Href;
  onPress?: () => void;
  tone?: 'default' | 'danger';
}

function Linha({ label, hint, href, onPress, tone = 'default' }: LinhaProps) {
  const conteudo = (
    <View style={styles.linha}>
      <View style={styles.linhaTextos}>
        <Text variant="body" tone={tone === 'danger' ? 'danger' : 'primary'}>
          {label}
        </Text>
        {hint ? (
          <Text variant="body" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Text variant="body" tone="faint">
        ›
      </Text>
    </View>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={label}>
          {conteudo}
        </Pressable>
      </Link>
    );
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {conteudo}
    </Pressable>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Kicker>{titulo}</Kicker>
      <Card padding={space.xs}>{children}</Card>
    </View>
  );
}

export default function ProfileScreen() {
  const { state, signOut } = useSession();
  const router = useRouter();

  if (state.kind === 'loading') {
    return (
      <Screen testID="screen-perfil">
        <LoadingSkeleton label="Carregando seu perfil" />
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen testID="screen-perfil">
        <ErrorState title="Não consegui carregar seu perfil" description={state.message} />
      </Screen>
    );
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen testID="screen-perfil">
        <AppHeader kicker="Perfil" title="Entre na sua conta" />
        <EmptyState
          title="A Fly é por convite"
          description="Use o link que a equipe enviou ou entre com a conta que você já ativou."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </Screen>
    );
  }

  const { profile } = state;
  const nome = profile.preferredName ?? profile.displayName ?? 'Viajante Fly';

  return (
    <Screen testID="screen-perfil">
      <AppHeader kicker="Perfil" title={nome} />

      <Card>
        <View style={styles.qrBloco}>
          <Text variant="body" tone="muted" style={styles.qrIntro}>
            Apresente este código nas Bases Fly e nos check-ins.
          </Text>
          <FlyQR value={profile.publicId} size={220} />
          <Text variant="body" tone="faint">
            Seu Fly ID
          </Text>
        </View>
      </Card>

      <Secao titulo="Você">
        <Linha
          label="Dados pessoais"
          hint="Nome, contato, data de nascimento"
          href="/perfil/dados"
        />
        <Linha
          label="Preferências"
          hint="Tamanhos, comidas, música, ocasiões especiais"
          href="/perfil/preferencias"
        />
        <Linha label="Família e acompanhantes" href="/perfil/acompanhantes" />
        <Linha label="Contato de emergência" href="/perfil/emergencia" />
      </Secao>

      <Secao titulo="Sua história">
        <View style={styles.vazio}>
          <Text variant="body" tone="muted">
            Minhas viagens
          </Text>
          <Text variant="body" tone="faint">
            Sua primeira viagem aparece aqui.
          </Text>
        </View>
        <View style={styles.divisor} />
        <View style={styles.vazio}>
          <Text variant="body" tone="muted">
            Conquistas
          </Text>
          <Text variant="body" tone="faint">
            Cada experiência concluída vira uma conquista.
          </Text>
        </View>
      </Secao>

      <Secao titulo="Privacidade e conta">
        <Linha
          label="Privacidade e consentimentos"
          hint="Você decide o que a Fly pode usar"
          href="/perfil/privacidade"
        />
        <Linha label="Ranking Fly" hint="Participação é opcional" href="/perfil/ranking" />
        <Linha
          label="Segurança"
          hint="Biometria, sessão e exclusão de conta"
          href="/perfil/seguranca"
        />
        <Linha label="Notificações" href="/notificacoes" />
        <Linha label="Quem Somos" href="/perfil/sobre" />
      </Secao>

      <Secao titulo="Ambiente interno">
        <Linha label="Catálogo de componentes" href="/catalogo" />
        <Linha label="Health do app" href="/health" />
      </Secao>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
        accessibilityHint="Encerra a sessão em todos os aparelhos"
        onPress={() => void signOut()}
        style={styles.sair}
        testID="perfil-sair"
      >
        <Text variant="body" tone="danger">
          Sair da conta
        </Text>
      </Pressable>

      <Text variant="body" tone="faint" style={styles.sairNota}>
        Sair encerra a sessão em todos os aparelhos.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrBloco: {
    alignItems: 'center',
    gap: space.lg,
  },
  qrIntro: {
    textAlign: 'center',
  },
  secao: {
    gap: space.md,
    marginTop: space.section,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touchTarget.min + space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  linhaTextos: {
    flex: 1,
    gap: space.xxs,
  },
  vazio: {
    gap: space.xxs,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  divisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.stroke,
    marginHorizontal: space.lg,
  },
  sair: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.section,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: 'rgba(240,84,84,.3)',
  },
  sairNota: {
    textAlign: 'center',
    marginTop: space.sm,
  },
});
