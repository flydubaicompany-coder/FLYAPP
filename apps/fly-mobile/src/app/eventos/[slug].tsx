import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
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
} from '@/ui';
import { supabase } from '@/auth/client';
import { abrirCta, type EventoCta } from '@/home/ctas';
import { useAnalytics } from '@/analytics/provider';

/**
 * Detalhe do evento (§5.6 e §38.5).
 *
 * O CTA vem do banco, não do código. A §5.6 lista os sete aceitos, e o painel
 * escolhe qual aparece — inclusive "Abrir no Fly Cup", que sai deste app.
 */

interface Evento {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  status: string;
  startsAt: string | null;
  timezone: string;
  flyBenefit: string | null;
}

interface Participante {
  id: string;
  name: string;
  role: string | null;
}

export default function EventoScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const analytics = useAnalytics();
  const [evento, setEvento] = useState<Evento | null | 'nao-encontrado'>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [ctas, setCtas] = useState<EventoCta[]>([]);
  // Falha de carregamento e coisa diferente de evento inexistente. Sem esta
  // separacao, uma queda de rede era anunciada como "este evento nao esta
  // disponivel" — e a pessoa desistia de um evento que existe.
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    void (async () => {
      setErro(null);
      const { data, error } = await supabase()
        .from('events')
        .select(
          'id, title, summary, description, city, country, status, starts_at, timezone, fly_benefit, category_key',
        )
        .eq('slug', slug)
        .maybeSingle();

      if (!vivo) return;
      if (error) return setErro(error.message);
      if (!data) return setEvento('nao-encontrado');

      analytics.registrar('evento_visto', {
        evento_slug: slug,
        categoria: data.category_key,
        // De onde veio exigiria carregar a origem pela rota. Enquanto o app
        // não a propaga, 'lista' é o caminho que de fato leva aqui.
        origem: 'lista',
      });

      setEvento({
        id: data.id,
        title: data.title,
        summary: data.summary,
        description: data.description,
        city: data.city,
        country: data.country,
        status: data.status,
        startsAt: data.starts_at,
        timezone: data.timezone,
        flyBenefit: data.fly_benefit,
      });

      const [p, c] = await Promise.all([
        supabase()
          .from('event_participants')
          .select('id, name, role')
          .eq('event_id', data.id)
          .order('sort_order'),
        supabase()
          .from('event_ctas')
          .select('id, kind, label, target_url')
          .eq('event_id', data.id)
          .order('sort_order'),
      ]);

      if (!vivo) return;

      // Participantes e CTAs sao complemento: se falharem, o evento ainda vale
      // a tela. O que nao pode e a falha passar despercebida no console.
      if (p.error || c.error) {
        console.warn('evento carregou sem participantes ou CTAs', {
          slug,
          participantes: p.error?.message,
          ctas: c.error?.message,
        });
      }

      setParticipantes((p.data ?? []).map((x) => ({ id: x.id, name: x.name, role: x.role })));
      setCtas(
        (c.data ?? []).map((x) => ({
          id: x.id,
          kind: x.kind,
          label: x.label,
          targetUrl: x.target_url,
        })),
      );
    })().catch((e: unknown) => {
      // Sem este catch, uma excecao dentro do IIFE era rejeicao nao tratada e
      // a tela ficava no esqueleto de carregamento para sempre.
      if (vivo) setErro(e instanceof Error ? e.message : 'nao consegui carregar');
    });

    return () => {
      vivo = false;
    };
  }, [slug, analytics, tentativa]);

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-evento">
        <AppHeader kicker="Eventos" title="Não carregou" onBack={() => router.back()} />
        <ErrorState description={erro} onRetry={() => setTentativa((n) => n + 1)} />
      </Screen>
    );
  }

  if (evento === 'nao-encontrado') {
    return (
      <Screen withBottomNav={false} testID="screen-evento">
        <AppHeader kicker="Eventos" title="Não encontrei" onBack={() => router.back()} />
        <EmptyState
          title="Este evento não está disponível"
          description="Ele pode não ter sido publicado ainda, ou o link estar desatualizado."
        />
      </Screen>
    );
  }

  if (!evento) {
    return (
      <Screen withBottomNav={false} testID="screen-evento">
        <LoadingSkeleton label="Carregando evento" />
      </Screen>
    );
  }

  const local = [evento.city, evento.country].filter(Boolean).join(', ');

  return (
    <Screen withBottomNav={false} testID="screen-evento">
      <AppHeader
        kicker="Eventos"
        title={evento.title}
        {...(evento.summary ? { subtitle: evento.summary } : {})}
        onBack={() => router.back()}
      />

      {local || evento.startsAt ? (
        <Card>
          <View style={styles.bloco}>
            {evento.startsAt ? (
              <Text variant="body" tone="muted">
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                  timeZone: evento.timezone,
                }).format(new Date(evento.startsAt))}
              </Text>
            ) : (
              <Text variant="body" tone="faint">
                Data ainda não anunciada.
              </Text>
            )}
            {local ? (
              <Text variant="body" tone="muted">
                {local}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      {evento.description ? (
        <View style={styles.secao}>
          <Text variant="body" tone="muted">
            {evento.description}
          </Text>
        </View>
      ) : null}

      {evento.flyBenefit ? (
        <View style={styles.secao}>
          <Kicker>Benefício Fly</Kicker>
          <Card>
            <Text variant="body">{evento.flyBenefit}</Text>
          </Card>
        </View>
      ) : null}

      {participantes.length > 0 ? (
        <View style={styles.secao}>
          <Kicker>Quem estará lá</Kicker>
          <Card>
            <View style={styles.bloco}>
              {participantes.map((p) => (
                <View key={p.id} style={styles.participante}>
                  <Text variant="body">{p.name}</Text>
                  {p.role ? (
                    <Text variant="body" tone="faint">
                      {p.role}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      {ctas.length > 0 ? (
        <View style={styles.secao}>
          {ctas.map((cta) => (
            <Pressable
              key={cta.id}
              accessibilityRole="button"
              accessibilityLabel={cta.label}
              onPress={() =>
                void abrirCta(cta, Linking.openURL, Linking.canOpenURL).then((r) =>
                  analytics.registrar('evento_cta_tocado', {
                    evento_slug: slug ?? '',
                    cta: cta.kind,
                    resultado: r.ok ? r.via : r.motivo,
                  }),
                )
              }
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              testID={`evento-cta-${cta.kind}`}
            >
              <Text variant="body" style={styles.ctaLabel}>
                {cta.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  secao: { gap: space.md, marginTop: space.section },
  participante: { gap: space.xxs },
  cta: {
    minHeight: touchTarget.min + space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: palette.text,
  },
  ctaPressed: { opacity: 0.8 },
  ctaLabel: { color: palette.background, fontWeight: '600' },
});
