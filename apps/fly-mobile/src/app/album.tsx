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
import { useAlbum, type Capitulo, type Figurinha } from '@/album/useAlbum';
import { comoMostrar, faltamParaODia, ROTULO_RARIDADE } from '@/album/raridade';

/**
 * O álbum da viagem (§13.1 e §13.2).
 *
 * "Cada viagem é uma temporada; cada dia é um capítulo." A tela é a
 * temporada: um bloco por capítulo, a grade de figurinhas dentro, e o Dia
 * Completo quando o servidor diz que fechou — **nunca** quando a tela acha
 * que fechou.
 *
 * O contador "faltam N" existe para explicar, e não para decidir. Quem decide
 * é o gatilho `sticker_unlocks_fecham_dia`, e é por isso que a linha de
 * conclusão vem de `chapter_completions` e não de uma conta feita aqui.
 */

function Casa({ f, onPress }: { f: Figurinha; onPress: () => void }) {
  const modo = comoMostrar(f.raridade, f.desbloqueada);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        modo === 'aberta'
          ? `${f.nome}, conquistada`
          : modo === 'misterio'
            ? 'Figurinha secreta, ainda não conquistada'
            : `${f.nome}, ainda não conquistada`
      }
      onPress={onPress}
      style={styles.casaAlvo}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.casa,
            modo !== 'aberta' && styles.casaFechada,
            f.raridade === 'holographic' && modo === 'aberta' && styles.casaHolo,
            pressed && styles.pressionado,
          ]}
        >
          <Text variant="body" style={[styles.casaTexto, modo !== 'aberta' && styles.casaTextoOff]}>
            {modo === 'misterio' ? '?' : modo === 'silhueta' ? '·' : f.nome}
          </Text>
          {f.obrigatoria && modo !== 'aberta' ? (
            <Text variant="body" style={styles.obrigatoria}>
              obrigatória
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function BlocoDoCapitulo({ c }: { c: Capitulo }) {
  const faltam = faltamParaODia(c.figurinhas);
  const conquistadas = c.figurinhas.filter((f) => f.desbloqueada).length;

  return (
    <View style={styles.capitulo}>
      <View style={styles.capituloTopo}>
        <Text variant="caption" tone="gold" style={styles.capituloKicker}>
          {`DIA ${c.diaNumero}`}
        </Text>
        <Text variant="body" style={styles.capituloContagem}>
          {conquistadas} de {c.figurinhas.length}
        </Text>
      </View>

      <Text variant="section" style={styles.capituloTitulo}>
        {c.titulo}
      </Text>

      <View style={styles.grade}>
        {c.figurinhas.map((f) => (
          <Casa
            key={f.id}
            f={f}
            onPress={() =>
              router.push({ pathname: '/album/[figurinha]', params: { figurinha: f.id } })
            }
          />
        ))}
      </View>

      {/* O Dia Completo vem do servidor. Se a linha existe, aconteceu. */}
      {c.completoEm ? (
        <View style={styles.diaCompleto}>
          <Text variant="body" style={styles.diaCompletoTexto}>
            Dia Completo
          </Text>
          {c.recompensa ? (
            <Text variant="body" style={styles.diaCompletoNota}>
              {c.recompensa}
            </Text>
          ) : null}
        </View>
      ) : faltam > 0 ? (
        <Text variant="body" style={styles.faltam}>
          {faltam === 1
            ? 'Falta 1 figurinha obrigatória para o Dia Completo.'
            : `Faltam ${faltam} figurinhas obrigatórias para o Dia Completo.`}
        </Text>
      ) : null}

      {/* "Seu próximo capítulo já está sendo preparado" (§13.3). Nunca a
          surpresa em si — a §13.3 manda não revelar antes da entrega. */}
      {c.completoEm && c.teaser ? (
        <Text variant="body" style={styles.teaser}>
          {c.teaser}
        </Text>
      ) : null}
    </View>
  );
}

export default function AlbumScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const { data, resgatar, recarregar } = useAlbum(tripId, userId);

  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function mandarCodigo() {
    setOcupado(true);
    const r = await resgatar(codigo);
    setOcupado(false);
    if (!r.ok) {
      return setRecado({ ok: false, texto: r.motivo ?? 'Não consegui usar este código.' });
    }
    setCodigo('');
    const nome = r.figurinhaNome ?? r.missaoTitulo ?? 'Conquista';
    setRecado({
      ok: true,
      texto: r.jaTinha ? `Você já tinha: ${nome}.` : `Você conquistou: ${nome}!`,
    });
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-album">
        <AppHeader kicker="Minha Viagem" title="Álbum" onBack={() => router.back()} />
        <EmptyState
          title="Seu álbum começa na viagem"
          description="Entre na sua conta para ver a sua temporada."
        />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-album">
        <LoadingSkeleton label="Abrindo o álbum" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-album">
        <AppHeader kicker="Minha Viagem" title="Álbum" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-album">
        <AppHeader kicker="Minha Viagem" title="Álbum" onBack={() => router.back()} />
        <ErrorState title="Não consegui abrir o álbum" description={data.message} />
      </Screen>
    );
  }

  if (data.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-album">
        <AppHeader kicker="Minha Viagem" title="Álbum" onBack={() => router.back()} />
        <EmptyState
          title="Sua temporada ainda não começou"
          description="O álbum abre junto com a viagem. Cada dia vira um capítulo."
        />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-album">
      <AppHeader
        kicker="Minha Viagem"
        title="Álbum"
        subtitle="Cada dia da viagem é um capítulo."
        onBack={() => router.back()}
      />

      {/* Código digitado, e não câmera: ler QR exigiria dependência nativa
          que este projeto ainda não compila. Mesma escolha do Leitor do Fly
          Ops, que recebe o token por campo desde a Fase 4. */}
      <View style={styles.resgate}>
        <TextInput
          accessibilityLabel="Código da figurinha"
          placeholder="Tem um código? Digite aqui"
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
          testID="album-resgatar"
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

      {data.capitulos.length === 0 ? (
        <EmptyState
          title="O primeiro capítulo ainda não abriu"
          description="Cada dia da viagem vira um capítulo, e ele aparece aqui na hora marcada."
        />
      ) : (
        data.capitulos.map((c) => <BlocoDoCapitulo key={c.id} c={c} />)
      )}
    </Screen>
  );
}

const CASA = 104;

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

  capitulo: { marginTop: 28 },
  capituloTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capituloKicker: { letterSpacing: 1.2 },
  capituloContagem: { fontSize: 12.5, color: palette.textMuted },
  capituloTitulo: { marginTop: 6, marginBottom: 14 },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  casaAlvo: { width: CASA },
  casa: {
    width: CASA,
    height: CASA,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  casaFechada: {
    borderStyle: 'dashed',
    backgroundColor: palette.fill,
  },
  // Holográfica não vira o sexto uso do dourado (regra do CLAUDE.md): ela se
  // distingue por borda clara e fundo mais vivo.
  casaHolo: { borderColor: palette.strokeStrong, backgroundColor: palette.fillStrong },
  casaTexto: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
    color: palette.text,
  },
  casaTextoOff: { fontSize: 22, color: palette.textDisabled },
  obrigatoria: { fontSize: 10, letterSpacing: 0.3, color: palette.textFaint },

  diaCompleto: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.goldBorder,
    backgroundColor: palette.goldFill,
    gap: 4,
  },
  diaCompletoTexto: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.24,
    color: palette.gold,
  },
  diaCompletoNota: { fontSize: 12.5, lineHeight: 18, color: palette.text },
  faltam: { marginTop: 12, fontSize: 12.5, lineHeight: 18, color: palette.textMuted },
  teaser: { marginTop: 10, fontSize: 12.5, lineHeight: 18, color: palette.textFaint },
  pressionado: { opacity: 0.75 },
});

export { ROTULO_RARIDADE };
