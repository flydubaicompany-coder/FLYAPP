import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { palette } from '@/theme';
import {
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OfflineState,
  Screen,
  Text,
} from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { useGaleria } from '@/album/useGaleria';

/**
 * A galeria da viagem (§13.5).
 *
 * A tela não filtra nada: o que chega aqui já passou pela RLS, que exige
 * mídia liberada, pessoa na viagem e ninguém marcado tendo revogado o uso da
 * própria imagem. Uma segunda regra escrita aqui seria a que envelhece.
 *
 * A faixa de autorização no topo existe porque a revogação só é uma escolha
 * de verdade quando a pessoa sabe que ela existe e o que ela faz.
 */
export default function GaleriaScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const { data, recarregar } = useGaleria(tripId, userId);

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-galeria">
        <AppHeader kicker="Minha Viagem" title="Galeria" onBack={() => router.back()} />
        <EmptyState title="Entre para ver" description="A galeria é da sua viagem." />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-galeria">
        <LoadingSkeleton label="Carregando a galeria" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-galeria">
        <AppHeader kicker="Minha Viagem" title="Galeria" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-galeria">
        <AppHeader kicker="Minha Viagem" title="Galeria" onBack={() => router.back()} />
        <ErrorState title="Não consegui carregar a galeria" description={data.message} />
      </Screen>
    );
  }

  const apareco = data.fotos.filter((f) => f.euApareco).length;

  return (
    <Screen withBottomNav={false} testID="screen-galeria">
      <AppHeader
        kicker="Minha Viagem"
        title="Galeria"
        subtitle={
          data.fotos.length > 0
            ? `${data.fotos.length} da viagem · você aparece em ${apareco}`
            : 'As fotos da viagem.'
        }
        onBack={() => router.back()}
      />

      {/* A autorização de imagem é opt-in: sem resposta, você não aparece. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver e mudar sua autorização de uso de imagem"
        onPress={() => router.push('/perfil/privacidade')}
      >
        {({ pressed }) => (
          <View style={[styles.consent, pressed && styles.pressionado]}>
            <Text variant="body" style={styles.consentTexto}>
              {data.autorizaImagem === true
                ? 'Você autoriza o uso da sua imagem. Pode mudar de ideia quando quiser — as fotos em que você aparece saem da galeria.'
                : data.autorizaImagem === false
                  ? 'Você retirou a autorização de uso de imagem. As fotos em que você aparece não são exibidas.'
                  : 'Você ainda não respondeu sobre uso de imagem. Enquanto não responder, as fotos em que você aparece não são exibidas.'}
            </Text>
            <Text variant="body" style={styles.consentLink}>
              Ver em Privacidade
            </Text>
          </View>
        )}
      </Pressable>

      {data.fotos.length === 0 ? (
        <EmptyState
          title="A galeria ainda está vazia"
          description="As fotos aparecem aqui depois que a equipe da Fly libera cada uma."
        />
      ) : (
        <View style={styles.grade}>
          {data.fotos.map((f) => (
            <View key={f.id} style={styles.celula}>
              {f.url ? (
                <Image
                  source={{ uri: f.url }}
                  style={styles.foto}
                  contentFit="cover"
                  transition={180}
                />
              ) : (
                <View style={styles.fotoVazia}>
                  <Text variant="body" style={styles.fotoVaziaTexto}>
                    {f.tipo === 'video' ? 'vídeo' : 'foto'}
                  </Text>
                </View>
              )}
              {f.euApareco ? (
                <View style={styles.marcado}>
                  <Text variant="body" style={styles.marcadoTexto}>
                    você
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {data.fotos.some((f) => f.credito) ? (
        <Text variant="body" style={styles.creditos}>
          Fotos:{' '}
          {[
            ...new Set(data.fotos.map((f) => f.credito).filter((c): c is string => c !== null)),
          ].join(', ')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  consent: {
    marginTop: 16,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.fill,
    gap: 8,
  },
  consentTexto: { fontSize: 12.5, lineHeight: 18, color: palette.textMuted },
  consentLink: { fontSize: 13, fontWeight: '600', color: palette.text },

  grade: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  celula: { width: '32%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  fotoVazia: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.fill,
  },
  fotoVaziaTexto: { fontSize: 11, color: palette.textDisabled },
  marcado: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(8,8,10,.7)',
  },
  marcadoTexto: { fontSize: 10, color: palette.text },

  creditos: { marginTop: 18, fontSize: 12, lineHeight: 18, color: palette.textFaint },
  pressionado: { opacity: 0.75 },
});
