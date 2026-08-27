import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { Kicker, Text } from '@/ui';
import type { HomeEvent } from './useHome';

/**
 * Card de "Acontece na Fly" (§5.6).
 *
 * O kicker dourado aqui é um dos cinco usos permitidos do dourado. Nenhum
 * outro elemento do card usa a cor.
 *
 * Data, cidade e horário aparecem **só quando existem**. Um evento anunciado
 * sem data ainda é notícia; inventar "em breve" com cara de data seria pior
 * que a ausência.
 */

const ROTULO_STATUS: Record<string, string> = {
  announced: 'Anunciado',
  registration_open: 'Inscrições abertas',
  happening: 'Acontecendo',
  finished: 'Encerrado',
};

function formatarData(iso: string | null, timezone?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function EventCard({ event }: { event: HomeEvent }) {
  const data = formatarData(event.startsAt);
  const encerrado = event.status === 'finished';

  const detalhes = [ROTULO_STATUS[event.status] ?? event.status, data, event.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={`/eventos/${event.slug}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${event.title}. ${detalhes}`}
        style={({ pressed }) => [
          styles.card,
          encerrado && styles.encerrado,
          pressed && styles.pressed,
        ]}
        testID={`event-card-${event.slug}`}
      >
        <Kicker>{ROTULO_STATUS[event.status] ?? event.status}</Kicker>

        <Text variant="section" numberOfLines={2}>
          {event.title}
        </Text>

        {event.summary ? (
          <Text variant="body" tone="muted" numberOfLines={2}>
            {event.summary}
          </Text>
        ) : null}

        {data || event.city ? (
          <Text variant="body" tone="faint">
            {[data, event.city].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {event.flyBenefit ? (
          <View style={styles.beneficio}>
            <Text variant="body" tone="gold" numberOfLines={2}>
              {event.flyBenefit}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    minHeight: touchTarget.min * 2,
    padding: space.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  encerrado: { opacity: 0.65 },
  pressed: { opacity: 0.8 },
  beneficio: {
    marginTop: space.xs,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
  },
});
