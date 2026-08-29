import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, space } from '@/theme';
import { AppHeader, Card, Screen, Text, Toggle } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useRanking } from '@/carteira/useRanking';

/**
 * Ranking Fly (§9.3 e §37.7).
 *
 * **Opt-in, sempre.** O padrao e nao aparecer, e sair tira a pessoa da lista
 * na hora — sem esperar recalculo, porque quem filtra e a policy e nao uma
 * coluna gravada.
 *
 * A §9.3 proibe expor gasto exato. A pontuacao mostrada e **normalizada de 0 a
 * 1000** contra o primeiro colocado, e a tabela de origem nem tem coluna de
 * dinheiro. A tela diz isso ao cliente, em vez de deixa-lo supor.
 */

function formatarJanela(comeca: string, termina: string): string {
  const f = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${f(comeca)} – ${f(termina)}`;
}

export default function RankingScreen() {
  const { state } = useSession();
  const [participa, setParticipa] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const ranking = useRanking(userId);

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

  const periodo = ranking.kind === 'ready' ? ranking.periodo : null;
  const colocacoes = ranking.kind === 'ready' ? ranking.colocacoes : [];

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

      {periodo ? (
        <View style={styles.periodo}>
          <View style={styles.periodoCabecalho}>
            <Text variant="section" style={styles.periodoTitulo}>
              {periodo.rotulo}
            </Text>
            <Text variant="body" style={styles.periodoJanela}>
              {formatarJanela(periodo.comeca, periodo.termina)}
            </Text>
          </View>

          {periodo.criterio ? (
            <Text variant="body" style={styles.criterio}>
              {periodo.criterio}
            </Text>
          ) : null}

          {colocacoes.length === 0 ? (
            <Text variant="body" style={styles.vazio}>
              {participa
                ? 'Ninguém pontuou neste período ainda.'
                : 'Ative sua participação para ver e aparecer aqui.'}
            </Text>
          ) : (
            <View style={styles.lista}>
              {colocacoes.map((c) => (
                <View
                  key={c.userId}
                  style={[styles.linha, c.euMesmo && styles.linhaEu]}
                  testID={`ranking-${c.posicao}`}
                >
                  <Text variant="body" style={[styles.posicao, c.euMesmo && styles.posicaoEu]}>
                    {c.posicao}
                  </Text>
                  <Text variant="body" numberOfLines={1} style={styles.nome}>
                    {c.nome}
                    {c.euMesmo ? ' · você' : ''}
                  </Text>
                  <Text variant="body" style={styles.pontuacao}>
                    {c.pontuacao}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text variant="body" tone="faint" style={styles.nota}>
          Nenhum período publicado ainda. Os critérios de cada período são publicados pelo Fly Ops
          antes de valer.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nota: { marginTop: space.xl },

  periodo: { marginTop: space.section },
  periodoCabecalho: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  periodoTitulo: { fontSize: 20, fontWeight: '600', letterSpacing: -0.56 },
  periodoJanela: { fontSize: 12.5, letterSpacing: -0.06, color: 'rgba(245,245,247,.36)' },
  criterio: {
    marginTop: 7,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.44)',
  },

  lista: {
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.05)',
  },
  // A propria linha ganha destaque: numa lista longa, achar-se sem isso
  // significa rolar contando posicoes.
  linhaEu: { backgroundColor: 'rgba(223,201,138,.08)' },
  posicao: {
    width: 26,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: 'rgba(245,245,247,.4)',
    fontVariant: ['tabular-nums'],
  },
  posicaoEu: { color: palette.gold },
  nome: { flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: '600', letterSpacing: -0.23 },
  pontuacao: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: 'rgba(245,245,247,.6)',
    fontVariant: ['tabular-nums'],
  },

  vazio: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.38)',
  },
});
