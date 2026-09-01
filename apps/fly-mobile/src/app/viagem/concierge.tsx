import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { palette } from '@/theme';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { NOME_DO_TIPO, ROTULO_RESERVA, ROTULO_SERVICO, useConcierge } from '@/concierge/usePedidos';

/**
 * Restaurantes e servicos (§11.2 e §11.3).
 *
 * As duas metades tem o mesmo desenho porque a promessa e a mesma: **voce
 * pede, a Fly resolve**. Por isso os botoes dizem "Pedir mesa" e "Pedir", e
 * nunca "Reservar" — reservar sugere que ficou reservado, e nao ficou: quem
 * confirma e o restaurante, via Fly.
 *
 * O que ja foi pedido aparece **antes** do catalogo. Quem volta a esta tela
 * quase sempre volta para saber em que pe ficou o pedido de ontem, e nao para
 * pedir outra coisa.
 */

const ABAS = [
  { chave: 'restaurantes', rotulo: 'Restaurantes' },
  { chave: 'servicos', rotulo: 'Serviços' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConciergeScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const { data, pedirMesa, pedirServico, cancelarReserva } = useConcierge(userId, tripId);

  const [aba, setAba] = useState<Aba>('restaurantes');
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState('2');
  const [dataHora, setDataHora] = useState('');
  const [ocasiao, setOcasiao] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [entregarEm, setEntregarEm] = useState('');
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  function limpar() {
    setAbrindo(null);
    setDataHora('');
    setOcasiao('');
    setDetalhes('');
    setEntregarEm('');
  }

  async function mandarMesa(restauranteId: string) {
    const n = Number(pessoas);
    if (!Number.isInteger(n) || n < 1) {
      return setRecado({ ok: false, texto: 'Diga para quantas pessoas.' });
    }
    if (!dataHora.trim()) {
      return setRecado({ ok: false, texto: 'Diga o dia e a hora que você quer.' });
    }
    const iso = new Date(dataHora.replace(' ', 'T')).toISOString();
    const r = await pedirMesa(restauranteId, n, iso, ocasiao);
    if (r.ok) {
      setRecado({ ok: true, texto: 'Pedido enviado. A Fly fala com o restaurante e te avisa.' });
      limpar();
      return;
    }
    setRecado({ ok: false, texto: r.motivo ?? 'não consegui enviar' });
  }

  async function mandarServico(servicoId: string) {
    const r = await pedirServico(servicoId, detalhes, entregarEm);
    if (r.ok) {
      setRecado({ ok: true, texto: 'Pedido enviado. A Fly resolve e te avisa.' });
      limpar();
      return;
    }
    setRecado({ ok: false, texto: r.motivo ?? 'não consegui enviar' });
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-concierge">
        <AppHeader kicker="Minha Viagem" title="Entre para pedir" onBack={() => router.back()} />
        <EmptyState title="A Fly resolve" description="Entre na sua conta para pedir." />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-concierge">
        <LoadingSkeleton label="Carregando" />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-concierge">
        <ErrorState title="Não consegui carregar" description={data.message} />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-concierge">
      <AppHeader
        kicker="Minha Viagem"
        title="Restaurantes e serviços"
        onBack={() => router.back()}
        subtitle="Você pede, a Fly resolve com o restaurante ou o fornecedor."
      />

      <View style={styles.abas}>
        {ABAS.map((a) => {
          const ativa = a.chave === aba;
          return (
            <Pressable
              key={a.chave}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              onPress={() => {
                setAba(a.chave);
                limpar();
              }}
              style={styles.abaArea}
              testID={`aba-${a.chave}`}
            >
              <View style={[styles.aba, ativa && styles.abaAtiva]}>
                <Text variant="body" style={[styles.abaTexto, ativa && styles.abaTextoAtivo]}>
                  {a.rotulo}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {aba === 'restaurantes' ? (
        <>
          {/* O que ja foi pedido vem antes: quem volta aqui quer saber em que
              pe ficou, e nao pedir outra coisa. */}
          {data.reservas.length > 0 ? (
            <>
              <Text variant="section" style={styles.secao}>
                Seus pedidos
              </Text>
              <View style={styles.lista}>
                {data.reservas.map((r) => (
                  <View key={r.id} style={styles.pedido}>
                    <View style={styles.pedidoTopo}>
                      <Text variant="body" numberOfLines={1} style={styles.pedidoNome}>
                        {r.restaurante}
                      </Text>
                      <Text variant="body" style={styles.pedidoSituacao}>
                        {ROTULO_RESERVA[r.situacao]}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.pedidoDetalhe}>
                      {quando(r.quando)} · {r.pessoas} pessoa{r.pessoas > 1 ? 's' : ''}
                      {r.ocasiao ? ` · ${r.ocasiao}` : ''}
                    </Text>
                    {r.motivoRecusa ? (
                      <Text variant="body" style={styles.pedidoObs}>
                        {r.motivoRecusa}
                      </Text>
                    ) : null}
                    {r.situacao === 'requested' || r.situacao === 'waitlist' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Cancelar o pedido em ${r.restaurante}`}
                        onPress={() => void cancelarReserva(r.id)}
                        style={styles.cancelarLinha}
                      >
                        <Text variant="body" style={styles.cancelarTexto}>
                          Cancelar este pedido
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text variant="section" style={styles.secao}>
            A Fly recomenda
          </Text>

          {data.restaurantes.length === 0 ? (
            <Text variant="body" style={styles.vazio}>
              A curadoria de restaurantes ainda não foi publicada.
            </Text>
          ) : (
            <View style={styles.lista}>
              {data.restaurantes.map((r) => (
                <View key={r.id} style={styles.cartao}>
                  <View style={styles.cartaoTopo}>
                    <View style={styles.cartaoTexto}>
                      <Text variant="body" style={styles.cartaoNome}>
                        {r.nome}
                      </Text>
                      <Text variant="body" style={styles.cartaoMeta}>
                        {[r.cozinha, r.bairro].filter(Boolean).join(' · ') || 'Dubai'}
                      </Text>
                    </View>
                  </View>

                  {r.notaDaFly ? (
                    <Text variant="body" style={styles.notaFly}>
                      {r.notaDaFly}
                    </Text>
                  ) : null}

                  {r.exigeDeposito ? (
                    <Text variant="body" style={styles.deposito}>
                      Este restaurante pede depósito. A Fly explica o valor antes de confirmar.
                    </Text>
                  ) : null}

                  {abrindo === r.id ? (
                    <View style={styles.form}>
                      <TextInput
                        accessibilityLabel="Para quantas pessoas"
                        placeholder="2"
                        placeholderTextColor={palette.textDisabled}
                        value={pessoas}
                        onChangeText={setPessoas}
                        inputMode="numeric"
                        style={styles.campo}
                      />
                      <TextInput
                        accessibilityLabel="Dia e hora"
                        placeholder="2026-09-12 20:30"
                        placeholderTextColor={palette.textDisabled}
                        value={dataHora}
                        onChangeText={setDataHora}
                        style={styles.campo}
                      />
                      <TextInput
                        accessibilityLabel="Ocasião especial"
                        placeholder="Alguma ocasião especial?"
                        placeholderTextColor={palette.textDisabled}
                        value={ocasiao}
                        onChangeText={setOcasiao}
                        style={styles.campo}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Pedir mesa em ${r.nome}`}
                        onPress={() => void mandarMesa(r.id)}
                        testID={`pedir-${r.id}`}
                      >
                        {({ pressed }) => (
                          <View style={[styles.botao, pressed && styles.pressionado]}>
                            <Text variant="body" style={styles.botaoTexto}>
                              Pedir mesa
                            </Text>
                          </View>
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Fechar"
                        onPress={limpar}
                        style={styles.cancelarLinha}
                      >
                        <Text variant="body" style={styles.cancelarTexto}>
                          Fechar
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Pedir mesa em ${r.nome}`}
                      onPress={() => {
                        setAbrindo(r.id);
                        setRecado(null);
                      }}
                    >
                      {({ pressed }) => (
                        <View style={[styles.secundario, pressed && styles.pressionado]}>
                          <Text variant="body" style={styles.secundarioTexto}>
                            Pedir mesa
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          {data.pedidos.length > 0 ? (
            <>
              <Text variant="section" style={styles.secao}>
                Seus pedidos
              </Text>
              <View style={styles.lista}>
                {data.pedidos.map((p) => (
                  <View key={p.id} style={styles.pedido}>
                    <View style={styles.pedidoTopo}>
                      <Text variant="body" numberOfLines={1} style={styles.pedidoNome}>
                        {p.servico}
                      </Text>
                      <Text variant="body" style={styles.pedidoSituacao}>
                        {ROTULO_SERVICO[p.situacao]}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.pedidoDetalhe}>
                      {p.detalhes}
                      {p.entregarEm ? ` · ${p.entregarEm}` : ''}
                    </Text>
                    {p.resposta ? (
                      <Text variant="body" style={styles.pedidoObs}>
                        {p.resposta}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text variant="section" style={styles.secao}>
            O que a Fly resolve
          </Text>

          {data.servicos.length === 0 ? (
            <Text variant="body" style={styles.vazio}>
              O catálogo de serviços ainda não foi publicado.
            </Text>
          ) : (
            <View style={styles.lista}>
              {data.servicos.map((s) => (
                <View key={s.id} style={styles.cartao}>
                  <Text variant="caption" tone="gold" style={styles.tipoKicker}>
                    {NOME_DO_TIPO[s.tipo].toUpperCase()}
                  </Text>
                  <Text variant="body" style={styles.cartaoNome}>
                    {s.nome}
                  </Text>
                  {s.descricao ? (
                    <Text variant="body" style={styles.cartaoMeta}>
                      {s.descricao}
                    </Text>
                  ) : null}

                  {abrindo === s.id ? (
                    <View style={styles.form}>
                      <TextInput
                        accessibilityLabel="O que você precisa"
                        placeholder="O que você precisa?"
                        placeholderTextColor={palette.textDisabled}
                        value={detalhes}
                        onChangeText={setDetalhes}
                        style={[styles.campo, styles.campoAlto]}
                        multiline
                      />
                      <TextInput
                        accessibilityLabel="Onde entregar"
                        placeholder="Onde entregar? Quarto, base, lobby…"
                        placeholderTextColor={palette.textDisabled}
                        value={entregarEm}
                        onChangeText={setEntregarEm}
                        style={styles.campo}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Pedir ${s.nome}`}
                        onPress={() => void mandarServico(s.id)}
                        testID={`pedir-${s.id}`}
                      >
                        {({ pressed }) => (
                          <View style={[styles.botao, pressed && styles.pressionado]}>
                            <Text variant="body" style={styles.botaoTexto}>
                              Pedir
                            </Text>
                          </View>
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Fechar"
                        onPress={limpar}
                        style={styles.cancelarLinha}
                      >
                        <Text variant="body" style={styles.cancelarTexto}>
                          Fechar
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Pedir ${s.nome}`}
                      onPress={() => {
                        setAbrindo(s.id);
                        setRecado(null);
                      }}
                    >
                      {({ pressed }) => (
                        <View style={[styles.secundario, pressed && styles.pressionado]}>
                          <Text variant="body" style={styles.secundarioTexto}>
                            Pedir
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {!data.parceirosLigados ? (
            <Text variant="body" style={styles.rodapeNota}>
              Pedidos são atendidos por uma pessoa da Fly. Entrega automática por parceiro entra
              quando houver contrato — e a Fly prefere avisar a fingir que já tem.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  abas: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  abaArea: { flex: 1 },
  aba: {
    height: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  abaAtiva: { backgroundColor: 'rgba(255,255,255,.13)', borderColor: 'rgba(255,255,255,.1)' },
  abaTexto: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.16,
    color: 'rgba(245,245,247,.45)',
  },
  abaTextoAtivo: { color: palette.text },

  recado: { marginTop: 16, padding: 13, borderRadius: 18, borderWidth: 1 },
  recadoOk: { backgroundColor: 'rgba(223,201,138,.1)', borderColor: 'rgba(223,201,138,.32)' },
  recadoErro: { backgroundColor: 'rgba(233,162,59,.1)', borderColor: 'rgba(233,162,59,.3)' },
  recadoTexto: { fontSize: 13, lineHeight: 19, letterSpacing: -0.1, color: palette.text },

  secao: { marginTop: 26, marginBottom: 12, fontSize: 20, fontWeight: '600', letterSpacing: -0.56 },
  vazio: { fontSize: 13, lineHeight: 20, color: 'rgba(245,245,247,.4)' },
  lista: { gap: 10 },

  pedido: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  pedidoTopo: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  pedidoNome: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.23,
    color: palette.text,
  },
  pedidoSituacao: { fontSize: 11.5, fontWeight: '600', color: 'rgba(245,245,247,.55)' },
  pedidoDetalhe: { marginTop: 5, fontSize: 12.5, lineHeight: 18, color: 'rgba(245,245,247,.45)' },
  pedidoObs: { marginTop: 7, fontSize: 12, lineHeight: 18, color: 'rgba(233,162,59,.85)' },
  cancelarLinha: { marginTop: 9, alignSelf: 'flex-start' },
  cancelarTexto: { fontSize: 12.5, color: 'rgba(245,245,247,.42)' },

  cartao: {
    padding: 15,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cartaoTexto: { flex: 1, minWidth: 0 },
  tipoKicker: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.33 },
  cartaoNome: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: palette.text,
  },
  cartaoMeta: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: 'rgba(245,245,247,.42)' },
  notaFly: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.62)',
  },
  deposito: { marginTop: 9, fontSize: 12, lineHeight: 18, color: 'rgba(233,162,59,.85)' },

  form: { marginTop: 13, gap: 9 },
  campo: {
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
    color: palette.text,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.09)',
  },
  campoAlto: { height: 76, paddingTop: 12, textAlignVertical: 'top' },

  botao: {
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F5',
  },
  botaoTexto: { fontSize: 15, fontWeight: '600', letterSpacing: -0.26, color: '#0A0A0B' },
  pressionado: { transform: [{ scale: 0.985 }] },
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

  rodapeNota: {
    marginTop: 22,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.34)',
  },
});
