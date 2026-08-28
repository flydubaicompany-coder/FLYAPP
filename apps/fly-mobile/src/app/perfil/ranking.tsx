import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { space } from '@/theme';
import { AppHeader, Card, Screen, Text, Toggle } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Ranking Fly (§9.3 e §37.7).
 *
 * **Opt-in**, sempre. O padrao e nao aparecer. A §9.3 tambem proibe expor
 * gasto exato publicamente — por isso a tela promete pontuacao normalizada, e
 * nao valor.
 */
export default function RankingScreen() {
  const { state } = useSession();
  const [participa, setParticipa] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  useEffect(() => {
    if (!userId) return;
    void supabase()
      .from('customer_preferences')
      .select('ranking_opt_in')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setParticipa(data?.ranking_opt_in ?? false));
  }, [userId]);

  async function alternar(valor: boolean) {
    if (!userId) return;
    setParticipa(valor);
    setSalvando(true);
    await supabase()
      .from('customer_preferences')
      .upsert({ user_id: userId, ranking_opt_in: valor }, { onConflict: 'user_id' });
    setSalvando(false);
  }

  return (
    <Screen withBottomNav={false} testID="screen-ranking">
      <AppHeader
        kicker="Perfil"
        title="Participação é sua escolha"
        subtitle="Por padrão, você não aparece."
        onBack={() => router.back()}
      />

      <Card padding={space.xs}>
        <Toggle
          label="Aparecer no ranking Fly"
          hint="Nome e foto que você autorizar, nível e conquistas."
          value={participa}
          disabled={!userId || salvando}
          onChange={(v) => void alternar(v)}
          testID="ranking-opt-in"
        />
      </Card>

      <Text variant="body" tone="muted" style={styles.nota}>
        O ranking mostra pontuação normalizada — nunca quanto você gastou.
      </Text>

      <Text variant="body" tone="faint" style={styles.nota}>
        Os critérios de cada período são publicados pelo Fly Ops antes de valer.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nota: { marginTop: space.xl },
});
