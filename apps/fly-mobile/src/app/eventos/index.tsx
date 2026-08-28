import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { EventCard } from '@/home/EventCard';
import type { HomeEvent } from '@/home/useHome';

/**
 * Acontece na Fly — listagem completa (§5.6).
 *
 * A Home mostra até três em destaque; aqui aparecem todos os publicados,
 * inclusive os encerrados. A regra de "sumir do destaque" vale para a Home,
 * não para a listagem: um evento que aconteceu continua fazendo parte da
 * história do ecossistema.
 */
export default function EventosScreen() {
  const [eventos, setEventos] = useState<HomeEvent[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void supabase()
      .from('events')
      .select('id, slug, title, summary, city, status, starts_at, fly_benefit')
      .order('starts_at', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) return setErro(error.message);
        setEventos(
          (data ?? []).map((e) => ({
            id: e.id,
            slug: e.slug,
            title: e.title,
            summary: e.summary,
            city: e.city,
            status: e.status,
            startsAt: e.starts_at,
            flyBenefit: e.fly_benefit,
            // A listagem nao usa capa; o banner da Home usa.
            imagem: null,
          })),
        );
      });
  }, []);

  return (
    <Screen withBottomNav={false} testID="screen-eventos">
      <AppHeader kicker="Acontece na Fly" title="Eventos" />

      {erro ? (
        <ErrorState description={erro} />
      ) : !eventos ? (
        <LoadingSkeleton label="Carregando eventos" />
      ) : eventos.length === 0 ? (
        <EmptyState
          title="Nada publicado ainda"
          description="Quando a Fly publicar um evento, ele aparece aqui — sem você precisar atualizar o app."
        />
      ) : (
        <View style={styles.lista}>
          {eventos.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
          <Text variant="body" tone="faint" style={styles.nota}>
            {`${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'} publicados.`}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.lg },
  nota: { textAlign: 'center', marginTop: space.lg },
});
