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
import {
  useInfluenciador,
  type Entregavel,
  type SituacaoEntregavel,
} from '@/album/useInfluenciador';

/**
 * Modo Influenciador (§13.6).
 *
 * A tela só existe para quem foi habilitado **naquela viagem** — e quem
 * garante isso não é este arquivo: é a RLS, que devolve zero linhas para todo
 * mundo que não tem perfil ativo. Sem perfil, sem tela.
 *
 * **As métricas são declaradas pelo criador, e a tela diz isso.** Não há
 * integração com rede social: a §33 proíbe declarar integração sem
 * credencial, contrato e homologação. Número declarado que se apresenta como
 * medido é pior do que número nenhum.
 *
 * Não há pagamento nem contrapartida aqui. Isso é taxa e parceiro financeiro,
 * os dois na lista da §33, e o PSP continua sendo a P09/P38. O que existe é o
 * texto do combinado, escrito pela operação.
 */

const ROTULO: Record<SituacaoEntregavel, string> = {
  pendente: 'A fazer',
  enviado: 'Enviado, aguardando a Fly',
  aprovado: 'Aprovado',
  recusado: 'Precisa de ajuste',
  publicado: 'Publicado',
};

function Bloco({
  e,
  onEnviar,
  ocupado,
}: {
  e: Entregavel;
  onEnviar: (id: string, url: string, alcance: string, engajamento: string) => void;
  ocupado: boolean;
}) {
  const [url, setUrl] = useState(e.url ?? '');
  const [alcance, setAlcance] = useState(
    e.alcanceDeclarado === null ? '' : String(e.alcanceDeclarado),
  );
  const [engajamento, setEngajamento] = useState(
    e.engajamentoDeclarado === null ? '' : String(e.engajamentoDeclarado),
  );

  const fechado = e.situacao === 'aprovado' || e.situacao === 'publicado';

  return (
    <View style={styles.entregavel}>
      <View style={styles.entregavelTopo}>
        <Text variant="body" style={styles.entregavelTitulo}>
          {e.titulo}
        </Text>
        <View style={[styles.selo, fechado && styles.seloOk]}>
          <Text variant="body" style={styles.seloTexto}>
            {ROTULO[e.situacao]}
          </Text>
        </View>
      </View>

      {e.descricao ? (
        <Text variant="body" style={styles.entregavelMeta}>
          {e.descricao}
        </Text>
      ) : null}

      {e.prazo ? (
        <Text variant="body" style={styles.entregavelMeta}>
          Até {new Date(e.prazo).toLocaleDateString('pt-BR')}
        </Text>
      ) : null}

      {/* Recusar exige motivo, por constraint. Sem ele o criador não saberia
          o que refazer. */}
      {e.situacao === 'recusado' && e.observacao ? (
        <View style={styles.ajuste}>
          <Text variant="body" style={styles.ajusteTexto}>
            {e.observacao}
          </Text>
        </View>
      ) : null}

      {fechado ? (
        e.url ? (
          <Text variant="body" style={styles.entregavelMeta}>
            {e.url}
          </Text>
        ) : null
      ) : (
        <>
          <TextInput
            accessibilityLabel="Link do conteúdo"
            placeholder="Link do post ou do story"
            placeholderTextColor={palette.textDisabled}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.campo}
          />
          <View style={styles.linha}>
            <TextInput
              accessibilityLabel="Alcance declarado"
              placeholder="Alcance"
              placeholderTextColor={palette.textDisabled}
              value={alcance}
              onChangeText={setAlcance}
              keyboardType="number-pad"
              style={[styles.campo, styles.campoMetade]}
            />
            <TextInput
              accessibilityLabel="Engajamento declarado"
              placeholder="Engajamento"
              placeholderTextColor={palette.textDisabled}
              value={engajamento}
              onChangeText={setEngajamento}
              keyboardType="number-pad"
              style={[styles.campo, styles.campoMetade]}
            />
          </View>
          <Text variant="body" style={styles.nota}>
            Os números são os que você informa. A Fly não lê a sua conta.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Enviar ${e.titulo}`}
            disabled={ocupado}
            onPress={() => onEnviar(e.id, url, alcance, engajamento)}
            testID={`entregavel-enviar-${e.id}`}
          >
            {({ pressed }) => (
              <View style={[styles.botao, pressed && styles.pressionado]}>
                <Text variant="body" style={styles.botaoTexto}>
                  {e.situacao === 'enviado' ? 'Reenviar' : 'Enviar'}
                </Text>
              </View>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function InfluenciadorScreen() {
  const { state } = useSession();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const { data, enviar, recarregar } = useInfluenciador(userId);

  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function mandar(id: string, url: string, alcance: string, engajamento: string) {
    setOcupado(true);
    const r = await enviar(id, url, alcance, engajamento);
    setOcupado(false);
    setRecado(
      r.ok
        ? { ok: true, texto: 'Enviado. A Fly avisa quando revisar.' }
        : { ok: false, texto: r.motivo ?? 'Não consegui enviar.' },
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-influenciador">
        <LoadingSkeleton label="Carregando" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-influenciador">
        <AppHeader kicker="Minha Viagem" title="Modo Criador" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-influenciador">
        <AppHeader kicker="Minha Viagem" title="Modo Criador" onBack={() => router.back()} />
        <ErrorState title="Não consegui carregar" description={data.message} />
      </Screen>
    );
  }

  if (data.kind === 'naoHabilitado') {
    return (
      <Screen withBottomNav={false} testID="screen-influenciador">
        <AppHeader kicker="Minha Viagem" title="Modo Criador" onBack={() => router.back()} />
        <EmptyState
          title="Este modo é por convite"
          description="A Fly habilita o Modo Criador por viagem, para quem vai produzir conteúdo com a equipe."
        />
      </Screen>
    );
  }

  const { perfil } = data;

  return (
    <Screen withBottomNav={false} testID="screen-influenciador">
      <AppHeader
        kicker="Minha Viagem"
        title="Modo Criador"
        {...(perfil.arroba ? { subtitle: perfil.arroba } : {})}
        onBack={() => router.back()}
      />

      {recado ? (
        <View style={[styles.recado, recado.ok ? styles.recadoOk : styles.recadoErro]}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado.texto}
          </Text>
        </View>
      ) : null}

      {perfil.briefing ? (
        <View style={styles.briefing}>
          <Text variant="body" style={styles.briefingTitulo}>
            Briefing
          </Text>
          <Text variant="body" style={styles.briefingTexto}>
            {perfil.briefing}
          </Text>
        </View>
      ) : null}

      {perfil.collab ? (
        <View style={styles.briefing}>
          <Text variant="body" style={styles.briefingTitulo}>
            Combinado
          </Text>
          <Text variant="body" style={styles.briefingTexto}>
            {perfil.collab}
          </Text>
        </View>
      ) : null}

      <Text variant="section" style={styles.secao}>
        Entregáveis
      </Text>

      {perfil.entregaveis.length === 0 ? (
        <EmptyState
          title="Nada combinado ainda"
          description="A equipe da Fly cadastra os entregáveis desta viagem aqui."
        />
      ) : (
        perfil.entregaveis.map((e) => (
          <Bloco key={e.id} e={e} onEnviar={(...a) => void mandar(...a)} ocupado={ocupado} />
        ))
      )}

      {perfil.direitosDeUso ? (
        <>
          <Text variant="section" style={styles.secao}>
            Direitos de uso
          </Text>
          <Text variant="body" style={styles.direitos}>
            {perfil.direitosDeUso}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  recado: { marginTop: 14, padding: 13, borderRadius: 18, borderWidth: 1 },
  recadoOk: { backgroundColor: 'rgba(223,201,138,.1)', borderColor: 'rgba(223,201,138,.32)' },
  recadoErro: { backgroundColor: 'rgba(233,162,59,.1)', borderColor: 'rgba(233,162,59,.3)' },
  recadoTexto: { fontSize: 13, lineHeight: 19, color: palette.text },

  briefing: {
    marginTop: 16,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    gap: 6,
  },
  briefingTitulo: { fontSize: 12, letterSpacing: 0.6, color: palette.textFaint },
  briefingTexto: { fontSize: 14, lineHeight: 21, color: palette.text },

  secao: { marginTop: 28, marginBottom: 12 },

  entregavel: {
    marginBottom: 12,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    gap: 8,
  },
  entregavelTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entregavelTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
    color: palette.text,
  },
  entregavelMeta: { fontSize: 12.5, lineHeight: 18, color: palette.textMuted },

  ajuste: {
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(233,162,59,.3)',
    backgroundColor: 'rgba(233,162,59,.1)',
  },
  ajusteTexto: { fontSize: 12.5, lineHeight: 18, color: palette.text },

  linha: { flexDirection: 'row', gap: 8 },
  campo: {
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
    color: palette.text,
    fontSize: 14,
  },
  campoMetade: { flex: 1 },
  nota: { fontSize: 11.5, lineHeight: 17, color: palette.textFaint },

  botao: {
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fillStrong,
  },
  botaoTexto: { fontSize: 14, fontWeight: '600', color: palette.text },

  selo: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  seloOk: { borderColor: 'rgba(74,201,155,.35)', backgroundColor: 'rgba(74,201,155,.12)' },
  seloTexto: { fontSize: 10.5, letterSpacing: 0.2, color: palette.textMuted },

  direitos: { fontSize: 12.5, lineHeight: 19, color: palette.textMuted },
  pressionado: { opacity: 0.75 },
});
