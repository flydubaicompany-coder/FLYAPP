import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette } from '@/theme';
import { AppHeader, EmptyState, ErrorState, Field, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { ROTULO_SITUACAO, useNotas, type SituacaoDaNota } from '@/notas/useNotas';

/**
 * Notas e Tax-Free (§8.1 e §41, entregas 11 e 12).
 *
 * **Sem scanner**, por decisao do dono em 29/08: a pessoa fotografa e digita.
 * Um OCR de mentira seria pior — numero extraido errado parece conferido.
 *
 * A tela deixa claro que os campos sao **declarados**: ate a Fly revisar, o
 * que esta ali e o que a pessoa leu, e nao o que o sistema apurou.
 *
 * **A estimativa de tax-free nao aparece.** A §41 proibe prometer 5% integral
 * e a §33 poe regra de tax-free na lista do que nunca se inventa. Enquanto
 * `taxfree.rule` for nula, a tela mostra a nota e o status, e diz que o valor
 * sai quando a Fly publicar a regra — em vez de exibir um numero que ninguem
 * pode honrar.
 */

const COR_SITUACAO: Record<SituacaoDaNota, { fundo: string; borda: string; ponto: string }> = {
  received: {
    fundo: 'rgba(255,255,255,.07)',
    borda: 'rgba(255,255,255,.12)',
    ponto: 'rgba(245,245,247,.7)',
  },
  in_review: {
    fundo: 'rgba(233,162,59,.12)',
    borda: 'rgba(233,162,59,.26)',
    ponto: '#E9A23B',
  },
  approved: {
    fundo: 'rgba(255,255,255,.1)',
    borda: 'rgba(255,255,255,.16)',
    ponto: '#F5F5F7',
  },
  rejected: {
    fundo: 'rgba(240,84,84,.12)',
    borda: 'rgba(240,84,84,.26)',
    ponto: '#F05454',
  },
  duplicate: {
    fundo: 'rgba(255,255,255,.05)',
    borda: 'rgba(255,255,255,.09)',
    ponto: 'rgba(245,245,247,.45)',
  },
};

function dinheiro(centavos: number | null, moeda: string | null): string | null {
  if (centavos === null || !moeda) return null;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(
      centavos / 100,
    );
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

export default function NotasScreen() {
  const { state } = useSession();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const { data, enviar, enviando } = useNotas(userId);

  const [aberto, setAberto] = useState(false);
  const [estabelecimento, setEstabelecimento] = useState('');
  const [valor, setValor] = useState('');
  const [emitidaEm, setEmitidaEm] = useState('');
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function mandar() {
    setRecado(null);
    const r = await enviar({ estabelecimento, valor, moeda: 'AED', emitidaEm });
    if (r.ok) {
      setRecado({ ok: true, texto: 'Nota enviada. A Fly confere e te avisa.' });
      setEstabelecimento('');
      setValor('');
      setEmitidaEm('');
      setAberto(false);
      return;
    }
    if (r.motivo) setRecado({ ok: false, texto: r.motivo });
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-notas">
        <AppHeader kicker="Carteira" title="Entre para enviar" onBack={() => router.back()} />
        <EmptyState
          title="Suas notas são suas"
          description="Entre na sua conta para enviar e acompanhar."
        />
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-notas">
        <ErrorState title="Não consegui carregar sua conta" description={state.message} />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-notas">
        <LoadingSkeleton label="Carregando suas notas" />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-notas">
        <ErrorState title="Não consegui carregar suas notas" description={data.message} />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-notas">
      <AppHeader
        kicker="Carteira"
        title="Notas e Tax-Free"
        onBack={() => router.back()}
        subtitle="Fotografe a nota e diga o que está nela. A Fly confere."
      />

      {/* A honestidade sobre o tax-free vem antes de tudo: e a primeira
          pergunta de quem abre esta tela. */}
      <View style={styles.aviso}>
        <Text variant="body" style={styles.avisoTitulo}>
          {data.regraTaxFree === null
            ? 'O valor a receber ainda não aparece'
            : 'Como a Fly calcula'}
        </Text>
        <Text variant="body" style={styles.avisoTexto}>
          {data.regraTaxFree === null
            ? 'A Fly ainda não publicou a regra de tax-free — quanto volta, o mínimo por nota e o prazo. Enquanto isso, guarde as notas aqui: elas ficam registradas e entram no cálculo assim que a regra existir.'
            : 'A estimativa é aproximada e depende da conferência na saída do país.'}
        </Text>
      </View>

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {aberto ? (
        <View style={styles.formulario}>
          <Text variant="body" style={styles.formNota}>
            O que você digitar vale como <Text style={styles.forte}>o que você leu na nota</Text> —
            a Fly confere depois contra a foto.
          </Text>

          <Field
            label="Estabelecimento"
            placeholder="Galeries Lafayette"
            value={estabelecimento}
            onChangeText={setEstabelecimento}
            autoCapitalize="words"
          />
          <Field
            label="Valor (AED)"
            placeholder="450,00"
            value={valor}
            onChangeText={setValor}
            inputMode="decimal"
            hint="Como está na nota. Vírgula ou ponto, tanto faz."
          />
          <Field
            label="Data da nota"
            placeholder="2026-08-27"
            value={emitidaEm}
            onChangeText={setEmitidaEm}
            hint="No formato ano-mês-dia."
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher a foto e enviar"
            onPress={() => void mandar()}
            disabled={enviando}
            testID="nota-enviar"
          >
            {({ pressed }) => (
              <View style={[styles.botao, pressed && styles.botaoPressionado]}>
                <Text variant="body" style={styles.botaoTexto}>
                  {enviando ? 'Enviando…' : 'Escolher foto e enviar'}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            onPress={() => setAberto(false)}
            style={styles.cancelar}
          >
            <Text variant="body" style={styles.cancelarTexto}>
              Cancelar
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar uma nota"
          onPress={() => {
            setAberto(true);
            setRecado(null);
          }}
          testID="nota-abrir"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.botaoPressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                Enviar uma nota
              </Text>
            </View>
          )}
        </Pressable>
      )}

      <Text variant="section" style={styles.secao}>
        Suas notas
      </Text>

      {data.notas.length === 0 ? (
        <Text variant="body" style={styles.vazio}>
          Nenhuma nota ainda. As compras que você fizer em Dubai entram aqui.
        </Text>
      ) : (
        <View style={styles.lista}>
          {data.notas.map((n) => {
            const cor = COR_SITUACAO[n.situacao];
            const valorFmt = dinheiro(n.centavos, n.moeda);
            return (
              <View key={n.id} style={styles.nota}>
                <View style={styles.notaTopo}>
                  <Text variant="body" numberOfLines={1} style={styles.notaNome}>
                    {n.estabelecimento ?? 'Sem estabelecimento'}
                  </Text>
                  {valorFmt ? (
                    <Text variant="body" style={styles.notaValor}>
                      {valorFmt}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.notaRodape}>
                  <View
                    style={[styles.selo, { backgroundColor: cor.fundo, borderColor: cor.borda }]}
                  >
                    <View style={[styles.seloPonto, { backgroundColor: cor.ponto }]} />
                    <Text variant="body" style={styles.seloTexto}>
                      {ROTULO_SITUACAO[n.situacao]}
                    </Text>
                  </View>
                  {n.emitidaEm ? (
                    <Text variant="body" style={styles.notaData}>
                      {new Date(`${n.emitidaEm}T12:00:00`).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  ) : null}
                </View>

                {n.observacao ? (
                  <Text variant="body" style={styles.notaObs}>
                    {n.observacao}
                  </Text>
                ) : null}

                {n.situacao === 'duplicate' ? (
                  <Text variant="body" style={styles.notaObs}>
                    Já existe uma nota igual enviada por você. A Fly confere as duas.
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  aviso: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  avisoTitulo: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: palette.text },
  avisoTexto: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.08,
    color: 'rgba(245,245,247,.45)',
  },

  recado: { marginTop: 14, padding: 13, borderRadius: 18, borderWidth: 1 },
  recadoOk: { backgroundColor: 'rgba(223,201,138,.1)', borderColor: 'rgba(223,201,138,.32)' },
  recadoErro: { backgroundColor: 'rgba(233,162,59,.1)', borderColor: 'rgba(233,162,59,.3)' },
  recadoTexto: { fontSize: 13, lineHeight: 19, letterSpacing: -0.1, color: palette.text },

  formulario: { marginTop: 18, gap: 14 },
  formNota: {
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: -0.08,
    color: 'rgba(245,245,247,.45)',
  },
  forte: { color: palette.text, fontWeight: '600' },

  botao: {
    marginTop: 18,
    height: 50,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F5',
  },
  botaoPressionado: { transform: [{ scale: 0.985 }] },
  botaoTexto: { fontSize: 15.5, fontWeight: '600', letterSpacing: -0.28, color: '#0A0A0B' },
  cancelar: { alignSelf: 'center', paddingVertical: 8 },
  cancelarTexto: { fontSize: 13.5, color: 'rgba(245,245,247,.45)' },

  secao: { marginTop: 30, fontSize: 20, fontWeight: '600', letterSpacing: -0.56 },
  vazio: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: 'rgba(245,245,247,.4)',
  },

  lista: { marginTop: 14, gap: 10 },
  nota: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  notaTopo: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  notaNome: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.23,
    color: palette.text,
  },
  notaValor: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.26,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  notaRodape: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 21,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  seloPonto: { width: 5, height: 5, borderRadius: 3 },
  seloTexto: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    color: 'rgba(245,245,247,.86)',
  },
  notaData: { fontSize: 11.5, color: 'rgba(245,245,247,.36)' },
  notaObs: {
    marginTop: 9,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.42)',
  },
});
