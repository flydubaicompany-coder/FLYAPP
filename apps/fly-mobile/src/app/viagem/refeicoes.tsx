import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { palette } from '@/theme';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import {
  NOME_DA_REFEICAO,
  aindaDaParaEscolher,
  useRefeicoes,
  type Refeicao,
} from '@/refeicoes/useRefeicoes';

/**
 * Refeicoes da viagem (§11.1).
 *
 * A tela mostra o prazo **antes** das opcoes, e nao depois: quem abre esta
 * tela quer saber primeiro se ainda da tempo. Depois de fechado, a escolha
 * continua visivel — sumir com o que a pessoa pediu faria ela achar que o
 * pedido se perdeu — e o texto diz o que fazer: falar com a Fly.
 */

function horario(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function quantoFalta(fechaEm: string | null): string | null {
  if (!fechaEm) return null;
  const ms = new Date(fechaEm).getTime() - Date.now();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3_600_000);
  const min = Math.floor((ms % 3_600_000) / 60_000);
  if (horas >= 24) return `fecha em ${Math.floor(horas / 24)} dia${horas >= 48 ? 's' : ''}`;
  if (horas >= 1) return `fecha em ${horas}h${min > 0 ? ` ${min}min` : ''}`;
  return `fecha em ${min}min`;
}

export default function RefeicoesScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const { data, escolher } = useRefeicoes(tripId, userId);

  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [personalizacao, setPersonalizacao] = useState('');
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function confirmar(r: Refeicao) {
    if (!escolhida) return setRecado({ ok: false, texto: 'Escolha uma opção.' });
    setRecado(null);
    const res = await escolher(r.id, escolhida, personalizacao);
    if (res.ok) {
      setRecado({ ok: true, texto: 'Pedido registrado. A Fly já vê.' });
      setAbrindo(null);
      setPersonalizacao('');
      return;
    }
    setRecado({ ok: false, texto: res.motivo ?? 'não consegui registrar' });
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-refeicoes">
        <AppHeader kicker="Minha Viagem" title="Entre para escolher" onBack={() => router.back()} />
        <EmptyState title="Suas refeições" description="Entre na sua conta para escolher." />
      </Screen>
    );
  }

  if (viagem.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-refeicoes">
        <AppHeader kicker="Minha Viagem" title="Refeições" onBack={() => router.back()} />
        <EmptyState
          title="Sem viagem em andamento"
          description="As refeições aparecem quando sua próxima viagem começar."
        />
      </Screen>
    );
  }

  if (viagem.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-refeicoes">
        <ErrorState title="Não consegui carregar sua viagem" description={viagem.message} />
      </Screen>
    );
  }

  if (data.kind === 'loading' || viagem.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-refeicoes">
        <LoadingSkeleton label="Carregando suas refeições" />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-refeicoes">
        <ErrorState title="Não consegui carregar suas refeições" description={data.message} />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-refeicoes">
      <AppHeader
        kicker="Minha Viagem"
        title="Refeições"
        onBack={() => router.back()}
        subtitle="Escolha até o prazo. Depois disso, a Fly resolve com você."
      />

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {data.refeicoes.length === 0 ? (
        <Text variant="body" style={styles.vazio}>
          Nenhuma refeição publicada ainda. Elas aparecem aqui quando a Fly montar o cardápio.
        </Text>
      ) : (
        <View style={styles.lista}>
          {data.refeicoes.map((r) => {
            const aberta = aindaDaParaEscolher(r);
            const falta = quantoFalta(r.fechaEm);
            const minha = r.opcoes.find((o) => o.id === r.minhaEscolha?.opcaoId) ?? null;
            const emEdicao = abrindo === r.id;

            return (
              <View key={r.id} style={styles.refeicao}>
                <View style={styles.topo}>
                  <View style={styles.topoTexto}>
                    <Text variant="caption" tone="gold" style={styles.kicker}>
                      DIA {r.diaNumero} · {NOME_DA_REFEICAO[r.tipo].toUpperCase()}
                    </Text>
                    <Text variant="body" style={styles.titulo}>
                      {horario(r.serveEm) ?? 'Horário a confirmar'}
                      {r.local ? ` · ${r.local}` : ''}
                    </Text>
                  </View>
                  {/* O prazo vem antes das opcoes: e a primeira coisa que
                      quem abre esta tela quer saber. */}
                  <View style={[styles.prazo, !aberta && styles.prazoFechado]}>
                    <Text variant="body" style={styles.prazoTexto}>
                      {aberta ? (falta ?? 'aberto') : 'fechado'}
                    </Text>
                  </View>
                </View>

                {minha ? (
                  <View style={styles.escolhaAtual}>
                    <Text variant="body" style={styles.escolhaRotulo}>
                      Você pediu
                    </Text>
                    <Text variant="body" style={styles.escolhaNome}>
                      {minha.titulo}
                    </Text>
                    {r.minhaEscolha?.personalizacao ? (
                      <Text variant="body" style={styles.escolhaObs}>
                        {r.minhaEscolha.personalizacao}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {emEdicao ? (
                  <View style={styles.opcoes}>
                    {r.opcoes.map((o) => {
                      const sel = escolhida === o.id;
                      return (
                        <Pressable
                          key={o.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: sel }}
                          onPress={() => setEscolhida(o.id)}
                          testID={`opcao-${o.id}`}
                        >
                          {() => (
                            <View style={[styles.opcao, sel && styles.opcaoSel]}>
                              <View style={[styles.marca, sel && styles.marcaSel]} />
                              <View style={styles.opcaoTexto}>
                                <Text variant="body" style={styles.opcaoTitulo}>
                                  {o.titulo}
                                </Text>
                                {o.descricao ? (
                                  <Text variant="body" style={styles.opcaoDesc}>
                                    {o.descricao}
                                  </Text>
                                ) : null}
                                {o.personalizacao ? (
                                  <Text variant="body" style={styles.opcaoPers}>
                                    {o.personalizacao}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}

                    <TextInput
                      accessibilityLabel="Alguma observação"
                      placeholder="Alguma observação para a cozinha?"
                      placeholderTextColor={palette.textDisabled}
                      value={personalizacao}
                      onChangeText={setPersonalizacao}
                      style={styles.campo}
                      multiline
                    />

                    <View style={styles.acoes}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Confirmar pedido"
                        onPress={() => void confirmar(r)}
                        testID={`confirmar-${r.id}`}
                      >
                        {({ pressed }) => (
                          <View style={[styles.botao, pressed && styles.botaoPressionado]}>
                            <Text variant="body" style={styles.botaoTexto}>
                              Confirmar
                            </Text>
                          </View>
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Cancelar"
                        onPress={() => setAbrindo(null)}
                        style={styles.cancelar}
                      >
                        <Text variant="body" style={styles.cancelarTexto}>
                          Cancelar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : aberta ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={minha ? 'Trocar o pedido' : 'Escolher'}
                    onPress={() => {
                      setAbrindo(r.id);
                      setEscolhida(r.minhaEscolha?.opcaoId ?? null);
                      setPersonalizacao(r.minhaEscolha?.personalizacao ?? '');
                      setRecado(null);
                    }}
                    testID={`escolher-${r.id}`}
                  >
                    {({ pressed }) => (
                      <View style={[styles.secundario, pressed && styles.botaoPressionado]}>
                        <Text variant="body" style={styles.secundarioTexto}>
                          {minha ? 'Trocar o pedido' : `Escolher entre ${r.opcoes.length} opções`}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  /* Fechado, mas a escolha continua visivel: sumir com o que a
                     pessoa pediu faria ela achar que o pedido se perdeu. */
                  <Text variant="body" style={styles.fechadoNota}>
                    {minha
                      ? 'O prazo passou. Para mudar, fale com a Fly.'
                      : 'O prazo passou sem escolha. Fale com a Fly.'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  recado: { marginBottom: 16, padding: 13, borderRadius: 18, borderWidth: 1 },
  recadoOk: { backgroundColor: 'rgba(223,201,138,.1)', borderColor: 'rgba(223,201,138,.32)' },
  recadoErro: { backgroundColor: 'rgba(233,162,59,.1)', borderColor: 'rgba(233,162,59,.3)' },
  recadoTexto: { fontSize: 13, lineHeight: 19, letterSpacing: -0.1, color: palette.text },

  vazio: { fontSize: 13, lineHeight: 20, letterSpacing: -0.1, color: 'rgba(245,245,247,.4)' },
  lista: { gap: 12 },

  refeicao: {
    padding: 15,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  topoTexto: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.33 },
  titulo: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
    color: palette.text,
  },
  prazo: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.14)',
  },
  prazoFechado: {
    backgroundColor: 'rgba(233,162,59,.12)',
    borderColor: 'rgba(233,162,59,.26)',
  },
  prazoTexto: { fontSize: 10.5, fontWeight: '600', color: 'rgba(245,245,247,.86)' },

  escolhaAtual: {
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(223,201,138,.07)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.18)',
  },
  escolhaRotulo: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: palette.gold },
  escolhaNome: {
    marginTop: 4,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.23,
    color: palette.text,
  },
  escolhaObs: { marginTop: 3, fontSize: 12.5, color: 'rgba(245,245,247,.45)' },

  opcoes: { marginTop: 14, gap: 9 },
  opcao: {
    flexDirection: 'row',
    gap: 11,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  opcaoSel: {
    backgroundColor: 'rgba(223,201,138,.1)',
    borderColor: 'rgba(223,201,138,.34)',
  },
  marca: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.28)',
  },
  marcaSel: { borderColor: palette.gold, backgroundColor: palette.gold },
  opcaoTexto: { flex: 1, minWidth: 0 },
  opcaoTitulo: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.23, color: palette.text },
  opcaoDesc: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(245,245,247,.45)',
  },
  opcaoPers: { marginTop: 5, fontSize: 11.5, color: 'rgba(245,245,247,.34)' },

  campo: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: palette.text,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.09)',
  },

  acoes: { marginTop: 4, gap: 6 },
  botao: {
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F5',
  },
  botaoPressionado: { transform: [{ scale: 0.985 }] },
  botaoTexto: { fontSize: 15, fontWeight: '600', letterSpacing: -0.26, color: '#0A0A0B' },
  secundario: {
    marginTop: 13,
    height: 42,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.1)',
  },
  secundarioTexto: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.16,
    color: 'rgba(245,245,247,.86)',
  },
  cancelar: { alignSelf: 'center', paddingVertical: 8 },
  cancelarTexto: { fontSize: 13, color: 'rgba(245,245,247,.45)' },

  fechadoNota: {
    marginTop: 12,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.08,
    color: 'rgba(245,245,247,.4)',
  },
});
