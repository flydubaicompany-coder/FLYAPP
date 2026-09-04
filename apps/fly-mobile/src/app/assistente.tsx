import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { palette } from '@/theme';
import { AppHeader, EmptyState, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useAssistente, type Troca } from '@/assistente/useAssistente';

/**
 * Assistente Fly (§15.1 e §45).
 *
 * **Hoje ele está desligado, e a tela diz isso.** A §45 fecha com "integração
 * não homologada permanece desligada" e a §33 não deixa declarar integração
 * sem credencial — não há credencial de modelo neste projeto. Então a
 * resposta honesta é a que aparece: o assistente não está disponível, e a
 * equipe da Fly responde.
 *
 * A alternativa seria uma tela bonita respondendo de mentira. Ela existiria
 * até o dia da viagem, quando alguém perguntasse a que horas sai o transfer.
 *
 * Quando o dono ligar a flag e pôr a credencial, esta mesma tela passa a
 * mostrar resposta — sem release.
 */

function Bolha({ troca, onOpinar }: { troca: Troca; onOpinar: (util: boolean) => void }) {
  return (
    <View style={styles.troca}>
      <View style={styles.pergunta}>
        <Text variant="body" style={styles.perguntaTexto}>
          {troca.pergunta}
        </Text>
      </View>

      <View style={styles.resposta}>
        <Text variant="body" style={styles.respostaTexto}>
          {troca.resposta.texto ?? troca.resposta.motivo ?? 'Não consegui responder.'}
        </Text>
      </View>

      {/* "Recomendação pode ser recusada" (§45, entrega 4). Só faz sentido
          quando houve resposta de verdade. */}
      {troca.resposta.texto !== null ? (
        <View style={styles.opiniao}>
          {troca.util === null ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Esta resposta ajudou"
                onPress={() => onOpinar(true)}
              >
                {({ pressed }) => (
                  <View style={[styles.opcao, pressed && styles.pressionado]}>
                    <Text variant="body" style={styles.opcaoTexto}>
                      Ajudou
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Esta resposta não ajudou"
                onPress={() => onOpinar(false)}
              >
                {({ pressed }) => (
                  <View style={[styles.opcao, pressed && styles.pressionado]}>
                    <Text variant="body" style={styles.opcaoTexto}>
                      Não ajudou
                    </Text>
                  </View>
                )}
              </Pressable>
            </>
          ) : (
            <Text variant="body" style={styles.obrigado}>
              {troca.util ? 'Obrigado.' : 'Obrigado — a equipe vai olhar isto.'}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function AssistenteScreen() {
  const { state } = useSession();
  const { conversa, pensando, erro, perguntar, opinar } = useAssistente();
  const [texto, setTexto] = useState('');

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-assistente">
        <AppHeader kicker="Fly Assist" title="Assistente" onBack={() => router.back()} />
        <EmptyState
          title="Entre para perguntar"
          description="O assistente responde a partir da sua viagem."
        />
      </Screen>
    );
  }

  async function mandar() {
    const p = texto;
    setTexto('');
    await perguntar(p);
  }

  const indisponivel = conversa.some((t) => !t.resposta.disponivel);

  return (
    <Screen withBottomNav={false} testID="screen-assistente">
      <AppHeader
        kicker="Fly Assist"
        title="Assistente"
        subtitle="Pergunte sobre a sua viagem."
        onBack={() => router.back()}
      />

      <Text variant="body" style={styles.nota}>
        O assistente responde a partir do seu roteiro, dos seus pedidos e do catálogo da Fly. Ele
        não decide preço, horário nem política — quando não tem a informação, ele diz.
      </Text>

      {conversa.length === 0 ? (
        <EmptyState
          title="Pergunte o que quiser sobre a viagem"
          description="A que horas sai o transfer, o que está incluso, quanto custa um passeio."
        />
      ) : (
        conversa.map((t) => (
          <Bolha key={t.id} troca={t} onOpinar={(util) => void opinar(t, util)} />
        ))
      )}

      {erro ? (
        <View style={styles.erro}>
          <Text variant="body" style={styles.erroTexto}>
            {erro}
          </Text>
        </View>
      ) : null}

      {/* Handoff (§45, entrega 3). Aparece sempre, e não só no erro: o
          assistente não é o único caminho, e a equipe existe desde a Fase 8. */}
      {indisponivel || conversa.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Falar com a equipe da Fly"
          onPress={() => router.push({ pathname: '/assist/[choice]', params: { choice: 'chat' } })}
          testID="assistente-handoff"
        >
          {({ pressed }) => (
            <View style={[styles.handoff, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.handoffTexto}>
                Falar com a equipe da Fly
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}

      <View style={styles.campoLinha}>
        <TextInput
          accessibilityLabel="Sua pergunta"
          placeholder="A que horas sai o transfer amanhã?"
          placeholderTextColor={palette.textDisabled}
          value={texto}
          onChangeText={setTexto}
          style={styles.campo}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Perguntar"
          disabled={pensando || texto.trim() === ''}
          onPress={() => void mandar()}
          testID="assistente-perguntar"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                {pensando ? '…' : 'Perguntar'}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nota: { marginTop: 14, fontSize: 12, lineHeight: 18, color: palette.textFaint },

  troca: { marginTop: 18, gap: 8 },
  pergunta: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: palette.fillStrong,
  },
  perguntaTexto: { fontSize: 14, lineHeight: 20, color: palette.text },
  resposta: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
  },
  respostaTexto: { fontSize: 14, lineHeight: 21, color: palette.text },

  opiniao: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  opcao: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  opcaoTexto: { fontSize: 12.5, color: palette.textMuted },
  obrigado: { fontSize: 12.5, color: palette.textFaint },

  erro: {
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(233,162,59,.3)',
    backgroundColor: 'rgba(233,162,59,.1)',
  },
  erroTexto: { fontSize: 13, lineHeight: 19, color: palette.text },

  handoff: {
    marginTop: 18,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  handoffTexto: { fontSize: 14, fontWeight: '600', color: palette.text },

  campoLinha: { marginTop: 20, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  campo: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
    color: palette.text,
    fontSize: 14,
  },
  botao: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fillStrong,
  },
  botaoTexto: { fontSize: 14, fontWeight: '600', color: palette.text },
  pressionado: { opacity: 0.75 },
});
