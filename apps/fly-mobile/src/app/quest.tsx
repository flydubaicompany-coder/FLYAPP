import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
import { useQuest } from '@/album/useQuest';
import { useAlbum } from '@/album/useAlbum';

/**
 * Fly Quest (§14.1).
 *
 * A prova aceita é o **código**, e só. A §14.1 lista geofence — e ela própria
 * condiciona: "geofence quando confiável". Não há provedor de mapa (P16), e a
 * §14.2 pede o oposto de confiar no aparelho: "validação no servidor",
 * "sinais de localização falsa". Aceitar a posição que o celular informa como
 * prova de presença é o furo clássico desse tipo de jogo.
 *
 * O mesmo campo de código do álbum. É deliberado: quem está na rua não deve
 * ter que lembrar em qual das duas telas digita.
 */
export default function QuestScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;

  const { data, recarregar } = useQuest(userId);
  // O resgate é o mesmo do álbum: um código pode entregar figurinha ou missão,
  // e quem decide qual é o escopo do token, no servidor.
  const { resgatar } = useAlbum(tripId, userId);

  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function mandarCodigo() {
    setOcupado(true);
    const r = await resgatar(codigo);
    setOcupado(false);
    await recarregar();
    if (!r.ok) {
      return setRecado({ ok: false, texto: r.motivo ?? 'Não consegui usar este código.' });
    }
    setCodigo('');
    const nome = r.missaoTitulo ?? r.figurinhaNome ?? 'Conquista';
    setRecado({
      ok: true,
      texto: r.jaTinha ? `Você já tinha concluído: ${nome}.` : `Missão concluída: ${nome}!`,
    });
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-quest">
        <AppHeader kicker="Minha Viagem" title="Fly Quest" onBack={() => router.back()} />
        <EmptyState
          title="O Fly Quest é da sua viagem"
          description="Entre na sua conta para ver as missões."
        />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-quest">
        <LoadingSkeleton label="Carregando missões" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-quest">
        <AppHeader kicker="Minha Viagem" title="Fly Quest" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-quest">
        <AppHeader kicker="Minha Viagem" title="Fly Quest" onBack={() => router.back()} />
        <ErrorState title="Não consegui carregar as missões" description={data.message} />
      </Screen>
    );
  }

  const feitas = data.missoes.filter((m) => m.concluidaEm !== null).length;

  return (
    <Screen withBottomNav={false} testID="screen-quest">
      <AppHeader
        kicker="Minha Viagem"
        title="Fly Quest"
        subtitle={
          data.missoes.length > 0
            ? `${feitas} de ${data.missoes.length} concluídas`
            : 'Missões pela cidade.'
        }
        onBack={() => router.back()}
      />

      <View style={styles.resgate}>
        <TextInput
          accessibilityLabel="Código da missão"
          placeholder="Achou um código? Digite aqui"
          placeholderTextColor={palette.textDisabled}
          value={codigo}
          onChangeText={setCodigo}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.campo}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usar código"
          onPress={() => void mandarCodigo()}
          disabled={ocupado}
          testID="quest-resgatar"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                {ocupado ? 'Conferindo…' : 'Usar'}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {data.missoes.length === 0 ? (
        <EmptyState
          title="Nenhuma missão valendo agora"
          description="As missões do Fly Quest aparecem aqui quando a Fly publica uma para o seu destino."
        />
      ) : (
        data.missoes.map((m) => (
          <View key={m.id} style={[styles.missao, m.concluidaEm !== null && styles.missaoFeita]}>
            <View style={styles.missaoTopo}>
              <Text variant="body" style={styles.missaoTitulo}>
                {m.titulo}
              </Text>
              {m.concluidaEm !== null ? (
                <View style={styles.selo}>
                  <Text variant="body" style={styles.seloTexto}>
                    concluída
                  </Text>
                </View>
              ) : null}
            </View>

            {m.briefing ? (
              <Text variant="body" style={styles.missaoBriefing}>
                {m.briefing}
              </Text>
            ) : null}

            <Text variant="body" style={styles.missaoPremio}>
              {[
                m.pontos > 0 ? `${m.pontos} Fly Points` : null,
                m.temFigurinha ? 'figurinha do álbum' : null,
              ]
                .filter((x) => x !== null)
                .join(' · ')}
            </Text>

            {m.terminaEm ? (
              <Text variant="body" style={styles.missaoPrazo}>
                Vale até {new Date(m.terminaEm).toLocaleDateString('pt-BR')}
              </Text>
            ) : null}
          </View>
        ))
      )}

      <Text variant="body" style={styles.nota}>
        As missões são validadas pelo código, no servidor. A Fly não usa a localização do seu
        aparelho como prova de que você esteve em algum lugar.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  resgate: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  campo: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
    color: palette.text,
    fontSize: 14,
  },
  botao: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fillStrong,
  },
  botaoTexto: { fontSize: 14, fontWeight: '600', color: palette.text },

  recado: { marginTop: 12, padding: 13, borderRadius: 18, borderWidth: 1 },
  recadoOk: { backgroundColor: 'rgba(223,201,138,.1)', borderColor: 'rgba(223,201,138,.32)' },
  recadoErro: { backgroundColor: 'rgba(233,162,59,.1)', borderColor: 'rgba(233,162,59,.3)' },
  recadoTexto: { fontSize: 13, lineHeight: 19, color: palette.text },

  missao: {
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    gap: 6,
  },
  missaoFeita: { borderColor: palette.stroke, backgroundColor: palette.fill },
  missaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missaoTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
    color: palette.text,
  },
  missaoBriefing: { fontSize: 13, lineHeight: 19, color: palette.textMuted },
  missaoPremio: { fontSize: 12.5, color: palette.textFaint },
  missaoPrazo: { fontSize: 12, color: palette.textFaint },
  selo: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(74,201,155,.35)',
    backgroundColor: 'rgba(74,201,155,.12)',
  },
  seloTexto: { fontSize: 10.5, letterSpacing: 0.2, color: palette.textMuted },

  nota: { marginTop: 24, fontSize: 12, lineHeight: 18, color: palette.textFaint },
  pressionado: { opacity: 0.75 },
});
