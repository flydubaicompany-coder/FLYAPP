import { useCallback, useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AppHeader,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
  Toggle,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useAnalytics } from '@/analytics/provider';
import { decidir } from '@/push/destino';
import { usePush } from '@/push/usePush';

/**
 * Central de notificações (§26 e §38.9).
 *
 * A regra que a tela precisa deixar visível, e não só respeitar em silêncio:
 * **alerta operacional crítico não é silenciável**. Quem desliga marketing
 * continua sabendo que o ponto de encontro mudou.
 *
 * Isso não depende desta tela se comportar bem. Há um gatilho no banco que
 * recusa desligar categoria crítica — um bug aqui, ou uma chamada direta à
 * API, esbarram nele.
 */

interface Aviso {
  id: string;
  categoria: string;
  titulo: string;
  corpo: string | null;
  deepLink: string | null;
  criadoEm: string;
  lidoEm: string | null;
}

interface Categoria {
  key: string;
  label: string;
  description: string;
  isCritical: boolean;
  enabled: boolean;
}

export default function NotificacoesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const analytics = useAnalytics();
  const push = usePush();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  const carregar = useCallback(async () => {
    if (!userId) return;
    const db = supabase();

    const [lista, cats, prefs] = await Promise.all([
      db
        .from('notifications')
        .select('id, category_key, title, body, deep_link, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(50),
      db
        .from('notification_categories')
        .select('key, label, description, is_critical')
        .order('sort_order'),
      db.from('notification_preferences').select('category_key, is_enabled').eq('user_id', userId),
    ]);

    if (lista.error) return setErro(lista.error.message);

    const ligadas = new Map((prefs.data ?? []).map((p) => [p.category_key, p.is_enabled]));

    setAvisos(
      (lista.data ?? []).map((n) => ({
        id: n.id,
        categoria: n.category_key,
        titulo: n.title,
        corpo: n.body,
        deepLink: n.deep_link,
        criadoEm: n.created_at,
        lidoEm: n.read_at,
      })),
    );

    setCategorias(
      (cats.data ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        description: c.description,
        isCritical: c.is_critical,
        // Crítica é sempre ligada. Sem preferência gravada, o padrão é receber.
        enabled: c.is_critical ? true : (ligadas.get(c.key) ?? true),
      })),
    );
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alternar(cat: Categoria, valor: boolean) {
    if (!userId || cat.isCritical) return;
    setCategorias((atual) => atual.map((c) => (c.key === cat.key ? { ...c, enabled: valor } : c)));
    const { error } = await supabase()
      .from('notification_preferences')
      .upsert(
        { user_id: userId, category_key: cat.key, is_enabled: valor },
        { onConflict: 'user_id,category_key' },
      );
    if (error) {
      setErro('Não consegui salvar sua preferência.');
      await carregar();
      return;
    }

    analytics.registrar('notificacao_preferencia_alterada', {
      categoria: cat.key,
      ligada: valor,
    });
  }

  async function abrir(aviso: Aviso) {
    if (!aviso.lidoEm) {
      await supabase()
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', aviso.id);
      setAvisos(
        (a) =>
          a?.map((x) => (x.id === aviso.id ? { ...x, lidoEm: new Date().toISOString() } : x)) ??
          null,
      );
    }
    // A mesma decisão que o push usa. Duas portas para o mesmo destino não
    // podem ter validações diferentes: aqui a sessão existe, mas o link
    // continua vindo do servidor e continua precisando ser conferido.
    const d = decidir(
      {
        id: aviso.id,
        deepLink: aviso.deepLink,
        categoria: aviso.categoria,
        critica: categorias.find((c) => c.key === aviso.categoria)?.isCritical ?? false,
      },
      true,
    );

    analytics.registrar('notificacao_aberta', {
      categoria: aviso.categoria,
      critica: categorias.find((c) => c.key === aviso.categoria)?.isCritical ?? false,
      exigiu_login: false,
      contexto_alcancado: d.acao === 'navegar',
    });

    if (d.acao === 'navegar') router.push(d.rota as never);
  }

  if (state.kind !== 'signedIn') {
    return (
      <Screen withBottomNav={false} testID="screen-notificacoes">
        <AppHeader kicker="Início" title="Entre para ver" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (erro && !avisos) {
    return (
      <Screen withBottomNav={false} testID="screen-notificacoes">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!avisos) {
    return (
      <Screen withBottomNav={false} testID="screen-notificacoes">
        <LoadingSkeleton label="Carregando avisos" />
      </Screen>
    );
  }

  const criticas = categorias.filter((c) => c.isCritical);
  const opcionais = categorias.filter((c) => !c.isCritical);

  return (
    <Screen withBottomNav={false} testID="screen-notificacoes">
      <AppHeader kicker="Início" title="Seus avisos" onBack={() => router.back()} />

      {avisos.length === 0 ? (
        <EmptyState
          title="Nenhum aviso ainda"
          description="Alertas da sua viagem, lembretes e novidades aparecem aqui."
        />
      ) : (
        <View style={styles.lista}>
          {avisos.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`${a.titulo}${a.lidoEm ? '' : ', não lido'}`}
              onPress={() => void abrir(a)}
              style={({ pressed }) => [
                styles.aviso,
                !a.lidoEm && styles.avisoNaoLido,
                pressed && styles.pressed,
              ]}
              testID={`aviso-${a.id}`}
            >
              <View style={styles.avisoTopo}>
                {!a.lidoEm ? <View style={styles.pontoNaoLido} /> : null}
                <Text variant="body" style={styles.avisoTitulo}>
                  {a.titulo}
                </Text>
              </View>
              {a.corpo ? (
                <Text variant="body" tone="muted">
                  {a.corpo}
                </Text>
              ) : null}
              <Text variant="body" tone="faint">
                {new Date(a.criadoEm).toLocaleString('pt-BR')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.secao}>
        <Kicker>O que a Fly te avisa</Kicker>

        {criticas.length > 0 ? (
          <>
            <Text variant="body" tone="muted">
              Estes chegam sempre. Desligar marketing não silencia aviso da sua viagem.
            </Text>
            <Card padding={space.xs}>
              {criticas.map((c) => (
                <Toggle
                  key={c.key}
                  label={c.label}
                  hint={c.description}
                  value
                  disabled
                  onChange={() => undefined}
                  testID={`notif-cat-${c.key}`}
                />
              ))}
            </Card>
          </>
        ) : null}

        {opcionais.length > 0 ? (
          <Card padding={space.xs}>
            {opcionais.map((c) => (
              <Toggle
                key={c.key}
                label={c.label}
                hint={c.description}
                value={c.enabled}
                onChange={(v) => void alternar(c, v)}
                testID={`notif-cat-${c.key}`}
              />
            ))}
          </Card>
        ) : null}
      </View>

      <View style={styles.secao}>
        <Kicker>Push</Kicker>
        <Card>
          <View style={styles.blocoPush}>
            <Text variant="body" tone="muted">
              {push.registrado
                ? 'Este aparelho está registrado para receber avisos.'
                : 'Este aparelho ainda não recebe avisos pelo sistema.'}
            </Text>
            <Link href="/perfil/push" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Abrir configuração e teste de push"
              >
                {() => (
                  <View style={styles.linkPush}>
                    <Text variant="body" tone="gold">
                      Configurar e testar
                    </Text>
                  </View>
                )}
              </Pressable>
            </Link>
          </View>
        </Card>
      </View>

      {erro ? (
        <Text variant="body" tone="danger" accessibilityRole="alert" style={styles.erro}>
          {erro}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.md },
  aviso: {
    gap: space.xs,
    minHeight: touchTarget.min,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  avisoNaoLido: { borderColor: palette.goldBorder },
  avisoTopo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avisoTitulo: { fontWeight: '600' },
  pontoNaoLido: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.gold,
  },
  pressed: { opacity: 0.8 },
  secao: { gap: space.md, marginTop: space.section },
  erro: { marginTop: space.lg },
  blocoPush: { gap: space.sm },
  linkPush: { minHeight: touchTarget.min, justifyContent: 'center' },
});
