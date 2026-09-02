import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { palette } from '@/theme';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { ROTULO_SITUACAO, useAtendimento, type Nivel } from '@/assist/useAtendimento';

/**
 * Os tres niveis do Fly Assist (§12.3 e §12.4).
 *
 * A tela abre no **caso em aberto**, se houver: quem toca no SOS pela segunda
 * vez quase sempre quer saber o que aconteceu com o primeiro, e nao abrir
 * outro. Abrir dois SOS da mesma pessoa divide a atencao da equipe no pior
 * momento possivel.
 *
 * **O aviso de que o SOS nao substitui emergencia publica aparece antes do
 * botao**, e nao depois. A §12.4 exige o aviso; poe-lo embaixo seria cumprir a
 * letra e perder o ponto.
 */

const CONTEUDO: Record<Nivel, { kicker: string; titulo: string; resumo: string; cta: string }> = {
  chat: {
    kicker: 'Fly Assist',
    titulo: 'Falar com a Fly',
    resumo: 'Roupa, horário, indicação — o que você precisar saber.',
    cta: 'Começar conversa',
  },
  urgent: {
    kicker: 'Ajuda urgente',
    titulo: 'Precisa de ajuda agora',
    resumo: 'Perdeu o grupo, atraso, transfer. Entra na fila prioritária.',
    cta: 'Pedir ajuda urgente',
  },
  sos: {
    kicker: 'SOS',
    titulo: 'Emergência',
    resumo: 'Saúde, risco ou emergência. A equipe é acionada na hora.',
    cta: 'Acionar SOS',
  },
};

function ehNivel(v: string | undefined): v is Nivel {
  return v === 'chat' || v === 'urgent' || v === 'sos';
}

export default function AssistScreen() {
  const { choice } = useLocalSearchParams<{ choice: string }>();
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const { data, abrir, responder, enviarLocalizacao } = useAtendimento(userId);

  const [texto, setTexto] = useState('');
  const [assunto, setAssunto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  const nivel: Nivel = ehNivel(choice) ? choice : 'chat';
  const c = CONTEUDO[nivel];

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-assist">
        <AppHeader kicker={c.kicker} title="Entre para falar" onBack={() => router.back()} />
        <EmptyState title="A Fly a um toque" description="Entre na sua conta para falar." />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-assist">
        <LoadingSkeleton label="Carregando" />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-assist">
        <ErrorState title="Não consegui carregar" description={data.message} />
      </Screen>
    );
  }

  // O caso em aberto deste nivel. Abrir um segundo divide a atencao da equipe.
  const aberto =
    data.casos.find(
      (x) => x.nivel === nivel && x.situacao !== 'resolved' && x.situacao !== 'closed',
    ) ?? null;

  async function comecar() {
    setOcupado(true);
    setRecado(null);
    const r = await abrir(nivel, assunto, tripId);
    setOcupado(false);
    if (!r.ok) return setRecado({ ok: false, texto: r.motivo ?? 'não consegui abrir' });
    setAssunto('');
  }

  async function mandar() {
    if (!aberto) return;
    setOcupado(true);
    const r = await responder(aberto.id, texto);
    setOcupado(false);
    if (!r.ok) return setRecado({ ok: false, texto: r.motivo ?? 'não consegui enviar' });
    setTexto('');
  }

  /** Uma vez, e so quando a pessoa toca. Nao ha rastreamento. */
  async function mandarLocal() {
    if (!aberto) return;
    if (!('geolocation' in navigator)) {
      return setRecado({ ok: false, texto: 'Este aparelho não informa localização.' });
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await enviarLocalizacao(
          aberto.id,
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy ?? null,
        );
        setRecado(
          r.ok
            ? { ok: true, texto: 'Localização enviada para a equipe.' }
            : { ok: false, texto: r.motivo ?? 'não consegui enviar' },
        );
      },
      () =>
        setRecado({
          ok: false,
          texto: 'Não consegui a localização. Você pode descrever onde está na conversa.',
        }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-assist">
      <AppHeader
        kicker={c.kicker}
        title={c.titulo}
        onBack={() => router.back()}
        subtitle={c.resumo}
      />

      {/* O aviso vem ANTES do botao. Poe-lo embaixo cumpriria a letra da
          §12.4 e perderia o ponto. */}
      {nivel === 'sos' && data.aviso ? (
        <View style={styles.aviso}>
          <Text variant="body" style={styles.avisoTexto}>
            {data.aviso}
          </Text>
          {data.emergencia ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ligar para a emergência ${data.emergencia}`}
              onPress={() => void Linking.openURL(`tel:${data.emergencia}`)}
              testID="ligar-emergencia"
            >
              {({ pressed }) => (
                <View style={[styles.emergencia, pressed && styles.pressionado]}>
                  <Text variant="body" style={styles.emergenciaTexto}>
                    Ligar {data.emergencia}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {aberto ? (
        <>
          <View style={styles.situacao}>
            <Text variant="caption" tone="gold" style={styles.situacaoKicker}>
              {ROTULO_SITUACAO[aberto.situacao].toUpperCase()}
            </Text>
            {aberto.assunto ? (
              <Text variant="body" style={styles.situacaoAssunto}>
                {aberto.assunto}
              </Text>
            ) : null}
          </View>

          <View style={styles.thread}>
            {aberto.mensagens.map((m) => {
              const minha = m.autorId === userId;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.balao,
                    m.doSistema ? styles.balaoSistema : minha ? styles.balaoMeu : styles.balaoFly,
                  ]}
                >
                  <Text variant="body" style={styles.balaoTexto}>
                    {m.corpo}
                  </Text>
                </View>
              );
            })}
          </View>

          <TextInput
            accessibilityLabel="Escrever para a Fly"
            placeholder="Escreva para a Fly"
            placeholderTextColor={palette.textDisabled}
            value={texto}
            onChangeText={setTexto}
            style={styles.campo}
            multiline
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            onPress={() => void mandar()}
            disabled={ocupado}
            testID="assist-enviar"
          >
            {({ pressed }) => (
              <View style={[styles.botao, pressed && styles.pressionado]}>
                <Text variant="body" style={styles.botaoTexto}>
                  Enviar
                </Text>
              </View>
            )}
          </Pressable>

          {nivel !== 'chat' && Platform.OS === 'web' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar minha localização"
              onPress={() => void mandarLocal()}
              testID="assist-localizacao"
            >
              {({ pressed }) => (
                <View style={[styles.secundario, pressed && styles.pressionado]}>
                  <Text variant="body" style={styles.secundarioTexto}>
                    Enviar minha localização agora
                  </Text>
                </View>
              )}
            </Pressable>
          ) : null}

          <Text variant="body" style={styles.nota}>
            A localização é enviada só quando você toca — uma vez, e ligada a este atendimento. A
            Fly não acompanha onde você está.
          </Text>
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel="O que está acontecendo"
            placeholder={nivel === 'sos' ? 'O que está acontecendo?' : 'Como a Fly pode ajudar?'}
            placeholderTextColor={palette.textDisabled}
            value={assunto}
            onChangeText={setAssunto}
            style={[styles.campo, styles.campoAlto]}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.cta}
            onPress={() => void comecar()}
            disabled={ocupado}
            testID="assist-abrir"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.botao,
                  nivel === 'sos' && styles.botaoSos,
                  pressed && styles.pressionado,
                ]}
              >
                <Text variant="body" style={styles.botaoTexto}>
                  {ocupado ? 'Enviando…' : c.cta}
                </Text>
              </View>
            )}
          </Pressable>
        </>
      )}

      {data.bases.length > 0 ? (
        <>
          <Text variant="section" style={styles.secao}>
            Bases Fly
          </Text>
          <View style={styles.bases}>
            {data.bases.map((b) => (
              <View key={b.id} style={styles.base}>
                <View style={styles.baseTopo}>
                  <Text variant="body" style={styles.baseNome}>
                    {b.nome}
                  </Text>
                  <View style={[styles.selo, b.aberta ? styles.seloAberta : styles.seloFechada]}>
                    <Text variant="body" style={styles.seloTexto}>
                      {b.aberta ? 'aberta' : 'fechada'}
                    </Text>
                  </View>
                </View>
                {b.endereco ? (
                  <Text variant="body" style={styles.baseMeta}>
                    {b.endereco}
                  </Text>
                ) : null}
                {b.horario ? (
                  <Text variant="body" style={styles.baseMeta}>
                    {b.horario}
                  </Text>
                ) : null}
                {b.servicos.length > 0 ? (
                  <Text variant="body" style={styles.baseServicos}>
                    {b.servicos.join(' · ')}
                  </Text>
                ) : null}
                <View style={styles.baseAcoes}>
                  {b.telefone ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ligar para ${b.nome}`}
                      onPress={() => void Linking.openURL(`tel:${b.telefone}`)}
                    >
                      {() => (
                        <View style={styles.baseBotao}>
                          <Text variant="body" style={styles.baseBotaoTexto}>
                            Ligar
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ) : null}
                  {b.latitude !== null && b.longitude !== null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver rota até ${b.nome}`}
                      onPress={() =>
                        void Linking.openURL(
                          `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`,
                        )
                      }
                    >
                      {() => (
                        <View style={styles.baseBotao}>
                          <Text variant="body" style={styles.baseBotaoTexto}>
                            Rota
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  aviso: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(240,84,84,.1)',
    borderWidth: 1,
    borderColor: 'rgba(240,84,84,.3)',
    gap: 12,
  },
  avisoTexto: { fontSize: 13, lineHeight: 20, letterSpacing: -0.1, color: palette.text },
  emergencia: {
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F05454',
  },
  emergenciaTexto: { fontSize: 15, fontWeight: '700', letterSpacing: -0.24, color: '#fff' },

  recado: { marginTop: 14, padding: 13, borderRadius: 18, borderWidth: 1 },
  recadoOk: { backgroundColor: 'rgba(223,201,138,.1)', borderColor: 'rgba(223,201,138,.32)' },
  recadoErro: { backgroundColor: 'rgba(233,162,59,.1)', borderColor: 'rgba(233,162,59,.3)' },
  recadoTexto: { fontSize: 13, lineHeight: 19, color: palette.text },

  situacao: { marginTop: 18 },
  situacaoKicker: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.33 },
  situacaoAssunto: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
    color: palette.text,
  },

  thread: { marginTop: 14, gap: 8 },
  balao: { padding: 12, borderRadius: 18, maxWidth: '92%' },
  balaoMeu: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(223,201,138,.13)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.26)',
  },
  balaoFly: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.09)',
  },
  balaoSistema: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  balaoTexto: { fontSize: 13.5, lineHeight: 20, letterSpacing: -0.1, color: palette.text },

  campo: {
    marginTop: 16,
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
  campoAlto: { minHeight: 90, textAlignVertical: 'top' },

  botao: {
    marginTop: 12,
    height: 50,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F5',
  },
  botaoSos: { backgroundColor: '#F05454' },
  botaoTexto: { fontSize: 15.5, fontWeight: '600', letterSpacing: -0.28, color: '#0A0A0B' },
  pressionado: { transform: [{ scale: 0.985 }] },
  secundario: {
    marginTop: 10,
    height: 44,
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
  nota: {
    marginTop: 12,
    fontSize: 11.5,
    lineHeight: 17,
    letterSpacing: -0.04,
    color: 'rgba(245,245,247,.36)',
  },

  secao: { marginTop: 30, marginBottom: 12, fontSize: 20, fontWeight: '600', letterSpacing: -0.56 },
  bases: { gap: 10 },
  base: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  baseTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baseNome: { flex: 1, fontSize: 15, fontWeight: '600', letterSpacing: -0.24, color: palette.text },
  selo: {
    paddingHorizontal: 9,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    borderWidth: 1,
  },
  seloAberta: { backgroundColor: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.16)' },
  seloFechada: { backgroundColor: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.08)' },
  seloTexto: { fontSize: 10.5, fontWeight: '600', color: 'rgba(245,245,247,.7)' },
  baseMeta: { marginTop: 5, fontSize: 12.5, lineHeight: 18, color: 'rgba(245,245,247,.45)' },
  baseServicos: { marginTop: 7, fontSize: 12, color: 'rgba(245,245,247,.34)' },
  baseAcoes: { marginTop: 11, flexDirection: 'row', gap: 8 },
  baseBotao: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.11)',
  },
  baseBotaoTexto: { fontSize: 13, fontWeight: '600', color: 'rgba(245,245,247,.86)' },
});
