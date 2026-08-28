import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import { AppHeader, Card, EmptyState, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Familia e acompanhantes (§7.10 e §37.8).
 *
 * Duas regras que a tela precisa deixar visiveis, e nao so respeitar em
 * silencio:
 *   • vinculo tem **escopo** — ser responsavel nao da acesso irrestrito;
 *   • criar vinculo passa pela equipe, porque envolve consentimento e, no caso
 *     de menor, regra propria (§37, "dados de menores exigem regra especifica").
 */

const ROTULO_ESCOPO: Record<string, string> = {
  itinerary: 'Roteiro',
  documents: 'Documentos',
  meals: 'Refeições',
  tickets: 'Ingressos',
  location: 'Localização',
  health: 'Saúde',
};

interface Vinculo {
  id: string;
  dependentId: string;
  kind: string;
  scopes: string[];
}

export default function AcompanhantesScreen() {
  const { state } = useSession();
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  useEffect(() => {
    if (!userId) return;
    void supabase()
      .from('companionships')
      .select('id, dependent_id, kind, scopes')
      .eq('responsible_id', userId)
      .is('revoked_at', null)
      .then(({ data }) =>
        setVinculos(
          (data ?? []).map((v) => ({
            id: v.id,
            dependentId: v.dependent_id,
            kind: v.kind,
            scopes: v.scopes,
          })),
        ),
      );
  }, [userId]);

  return (
    <Screen withBottomNav={false} testID="screen-acompanhantes">
      <AppHeader kicker="Perfil" title="Acompanhantes" onBack={() => router.back()} />

      {vinculos && vinculos.length > 0 ? (
        <View style={styles.lista}>
          {vinculos.map((v) => (
            <Card key={v.id}>
              <View style={styles.vinculo}>
                <Text variant="body">{v.kind === 'guardian' ? 'Dependente' : 'Acompanhante'}</Text>
                <View style={styles.escopos}>
                  {v.scopes.map((s) => (
                    <View key={s} style={styles.chip}>
                      <Text variant="body" tone="muted">
                        {ROTULO_ESCOPO[s] ?? s}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text variant="body" tone="faint">
                  Você enxerga apenas o que está listado acima.
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Nenhum acompanhante vinculado"
          description="Vincular alguém envolve consentimento — e, no caso de menores, uma autorização específica. Fale com a sua equipe Fly."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.lg },
  vinculo: { gap: space.md },
  escopos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
});
