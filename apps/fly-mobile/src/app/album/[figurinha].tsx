import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { palette } from '@/theme';
import { AppHeader, EmptyState, LoadingSkeleton, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { ROTULO_RARIDADE, type Raridade } from '@/album/raridade';

/**
 * A figurinha, e o card vertical de compartilhamento (§13.1, passos 5 e 6).
 *
 * **A arte só carrega se a figurinha estiver conquistada** — e quem decide
 * isso não é esta tela. O bucket `album` é privado e a policy do Storage
 * confere `sticker_unlocks` antes de assinar a URL. Se a pessoa não
 * conquistou, a assinatura falha e não há imagem para mostrar. É o critério
 * "cliente vê somente mídia liberada" (§44) implementado onde não dá para
 * contornar.
 *
 * O card é vertical porque é o formato de story. **Não é exportado como
 * imagem**: gerar PNG exigiria `react-native-view-shot`, dependência nativa
 * que este ambiente não compila. O que existe hoje é o card na tela, para
 * print, e o `Share` do sistema com o texto.
 */

interface Detalhe {
  id: string;
  nome: string;
  descricao: string | null;
  raridade: Raridade;
  arte: string | null;
  capitulo: string;
  desbloqueada: boolean;
  conquistadaEm: string | null;
}

export default function FigurinhaScreen() {
  const { figurinha } = useLocalSearchParams<{ figurinha?: string }>();
  const { state } = useSession();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  const [d, setD] = useState<Detalhe | null | 'nao-encontrada'>(null);
  const [arteUrl, setArteUrl] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!figurinha || !userId) return;
    const db = supabase();

    const { data, error } = await db
      .from('stickers')
      .select('id, name, description, rarity, image_path, album_chapters(title)')
      .eq('id', figurinha)
      .maybeSingle();

    if (error || !data) return setD('nao-encontrada');

    const { data: unlock } = await db
      .from('sticker_unlocks')
      .select('unlocked_at')
      .eq('sticker_id', figurinha)
      .eq('user_id', userId)
      .maybeSingle();

    const detalhe: Detalhe = {
      id: data.id,
      nome: data.name,
      descricao: data.description,
      raridade: data.rarity as Raridade,
      arte: data.image_path,
      capitulo: (data.album_chapters as { title: string } | null)?.title ?? 'Capítulo',
      desbloqueada: unlock !== null,
      conquistadaEm: unlock?.unlocked_at ?? null,
    };
    setD(detalhe);

    // A assinatura só é tentada quando há desbloqueio — e mesmo assim é o
    // Storage que decide. Falhar aqui é o comportamento correto, não um bug.
    if (detalhe.desbloqueada && detalhe.arte) {
      const { data: assinada } = await db.storage
        .from('album')
        .createSignedUrl(detalhe.arte, 60 * 10);
      setArteUrl(assinada?.signedUrl ?? null);
    }
  }, [figurinha, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-figurinha">
        <AppHeader kicker="Álbum" title="Figurinha" onBack={() => router.back()} />
        <EmptyState title="Entre para ver" description="A figurinha é sua, e a conta prova isso." />
      </Screen>
    );
  }

  if (d === null) {
    return (
      <Screen withBottomNav={false} testID="screen-figurinha">
        <LoadingSkeleton label="Carregando" />
      </Screen>
    );
  }

  if (d === 'nao-encontrada') {
    return (
      <Screen withBottomNav={false} testID="screen-figurinha">
        <AppHeader kicker="Álbum" title="Figurinha" onBack={() => router.back()} />
        <EmptyState
          title="Esta figurinha não é do seu álbum"
          description="Ela pode ser de outra viagem, ou ainda não ter sido publicada."
        />
      </Screen>
    );
  }

  const secretaFechada = !d.desbloqueada && d.raridade === 'secret';

  return (
    <Screen withBottomNav={false} testID="screen-figurinha">
      <AppHeader
        kicker="Álbum"
        title={secretaFechada ? 'Figurinha secreta' : d.nome}
        onBack={() => router.back()}
      />

      {/* O card vertical (§13.1, passo 6). Proporção de story: 9 por 16. */}
      <View style={[styles.card, d.desbloqueada && styles.cardAberto]}>
        {arteUrl ? (
          <Image
            source={{ uri: arteUrl }}
            style={styles.arte}
            contentFit="cover"
            transition={220}
          />
        ) : (
          <View style={styles.artePlaceholder}>
            <Text variant="body" style={styles.artePlaceholderTexto}>
              {d.desbloqueada ? '' : secretaFechada ? '?' : '·'}
            </Text>
          </View>
        )}

        <View style={styles.cardRodape}>
          <Text variant="caption" tone="gold" style={styles.cardKicker}>
            {d.capitulo.toUpperCase()}
          </Text>
          <Text variant="section" style={styles.cardNome}>
            {secretaFechada ? 'Ainda é segredo' : d.nome}
          </Text>
          <Text variant="body" style={styles.cardMeta}>
            {ROTULO_RARIDADE[d.raridade]}
            {d.conquistadaEm
              ? ` · conquistada em ${new Date(d.conquistadaEm).toLocaleDateString('pt-BR')}`
              : ' · ainda não conquistada'}
          </Text>
        </View>
      </View>

      {d.descricao && d.desbloqueada ? (
        <Text variant="body" style={styles.descricao}>
          {d.descricao}
        </Text>
      ) : null}

      {d.desbloqueada ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartilhar esta conquista"
          onPress={() =>
            void Share.share({
              message: `Conquistei "${d.nome}" no meu álbum da Fly — ${d.capitulo}.`,
            })
          }
          testID="figurinha-compartilhar"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                Compartilhar
              </Text>
            </View>
          )}
        </Pressable>
      ) : (
        <Text variant="body" style={styles.comoConseguir}>
          {secretaFechada
            ? 'Esta é uma figurinha secreta. Ela aparece quando você a encontrar.'
            : 'Ela abre quando o check-in desta experiência for validado, ou quando você usar o código dela.'}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    aspectRatio: 9 / 16,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
    justifyContent: 'flex-end',
  },
  cardAberto: { borderColor: palette.strokeStrong },
  // `absoluteFill` e o objeto pronto desta versao do RN; `absoluteFillObject`
  // nao existe mais no tipo.
  arte: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  artePlaceholder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.fill,
  },
  artePlaceholderTexto: { fontSize: 56, color: palette.textDisabled },
  cardRodape: {
    padding: 20,
    gap: 5,
    backgroundColor: 'rgba(8,8,10,.72)',
  },
  cardKicker: { letterSpacing: 1.2 },
  cardNome: { fontSize: 24, letterSpacing: -0.6 },
  cardMeta: { fontSize: 12.5, color: palette.textMuted },

  descricao: { marginTop: 16, fontSize: 14, lineHeight: 21, color: palette.text },
  comoConseguir: { marginTop: 16, fontSize: 13, lineHeight: 20, color: palette.textMuted },

  botao: {
    marginTop: 18,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fillStrong,
  },
  botaoTexto: { fontSize: 15, fontWeight: '600', color: palette.text },
  pressionado: { opacity: 0.75 },
});
