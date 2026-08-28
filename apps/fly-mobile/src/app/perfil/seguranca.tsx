import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, Card, Kicker, Screen, Text, Toggle } from '@/ui';
import { supabase } from '@/auth/client';
import { idDoAparelho, plataforma } from '@/push/aparelho';
import { useSession } from '@/auth/session';
import { loadEnv } from '@/env';
import {
  biometricLabel,
  checkBiometricSupport,
  requestBiometric,
  type BiometricSupport,
} from '@/auth/biometrics';

/**
 * Segurança da conta (§37.2 e §37.11).
 *
 * Duas coisas moram aqui, e as duas exigem cuidado com a linguagem:
 *
 * **Biometria** protege o acesso ao app e, mais adiante, ao cofre da viagem.
 * A chave nunca sai do aparelho — o que vai ao banco é só um booleano dizendo
 * que aquele aparelho tem a proteção ligada. Isto não é reconhecimento facial
 * para organizar fotos: aquilo é outra finalidade, exige consentimento
 * separado, e não está aqui (§23.4).
 *
 * **Excluir a conta** é irreversível, e a tela diz isso sem eufemismo. A
 * confirmação pede o Fly ID digitado, não um "tem certeza?" — o segundo toque
 * automático de um "sim" é exatamente o que produz exclusão acidental.
 */
export default function SegurancaScreen() {
  const router = useRouter();
  const { state, signOut } = useSession();

  const [suporte, setSuporte] = useState<BiometricSupport | null>(null);
  const [biometriaLigada, setBiometriaLigada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const perfil = state.kind === 'signedIn' ? state.profile : null;
  const sessao = state.kind === 'signedIn' ? state.session : null;

  useEffect(() => {
    void checkBiometricSupport().then(setSuporte);
  }, []);

  const carregarAparelho = useCallback(async () => {
    if (!perfil) return;
    const { data } = await supabase()
      .from('devices')
      .select('biometric_enabled')
      .eq('user_id', perfil.id)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setBiometriaLigada(data?.biometric_enabled ?? false);
  }, [perfil]);

  useEffect(() => {
    void carregarAparelho();
  }, [carregarAparelho]);

  async function alternarBiometria(ligar: boolean) {
    if (!perfil) return;
    setAviso(null);
    setSalvando(true);

    // Ligar exige provar a biometria agora. Sem isso, alguém com o celular
    // destravado ligaria a proteção usando a digital de outra pessoa.
    if (ligar) {
      const r = await requestBiometric('Confirme para proteger o Fly App');
      if (!r.ok) {
        setAviso(
          r.reason === 'cancelled'
            ? 'Cancelado. Nada foi alterado.'
            : 'Não consegui confirmar a biometria neste aparelho.',
        );
        setSalvando(false);
        return;
      }
    }

    // O `id` vem do proprio app. Sem ele, `onConflict: 'id'` nunca encontra
    // conflito e cada toque neste botao criava um "aparelho" novo na lista.
    const { error } = await supabase()
      .from('devices')
      .upsert(
        {
          id: await idDoAparelho(),
          user_id: perfil.id,
          platform: plataforma(),
          model: Application.nativeApplicationVersion ?? null,
          app_version: Application.nativeApplicationVersion ?? null,
          biometric_enabled: ligar,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (error) setAviso('Não consegui salvar. Tente de novo.');
    else setBiometriaLigada(ligar);
    setSalvando(false);
  }

  async function excluir() {
    if (!perfil || !sessao) return;
    setExcluindo(true);
    setErroExclusao(null);

    try {
      const env = loadEnv();
      const resposta = await fetch(`${env.supabaseUrl}/functions/v1/excluir-conta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseKey,
          Authorization: `Bearer ${sessao.access_token}`,
        },
      });

      if (!resposta.ok) {
        setErroExclusao('Não consegui concluir a exclusão. Fale com a Fly.');
        setExcluindo(false);
        return;
      }

      await signOut();
      router.replace('/');
    } catch {
      setErroExclusao('Sem conexão. Tente de novo em instantes.');
      setExcluindo(false);
    }
  }

  if (!perfil) {
    return (
      <Screen withBottomNav={false} testID="screen-seguranca">
        <AppHeader kicker="Perfil" title="Entre para ver" onBack={() => router.back()} />
      </Screen>
    );
  }

  const podeExcluir = confirmacao.trim().toUpperCase() === perfil.publicId && !excluindo;

  return (
    <Screen withBottomNav={false} testID="screen-seguranca">
      <AppHeader kicker="Perfil" title="Sua conta" onBack={() => router.back()} />

      <View style={styles.secao}>
        <Kicker>Biometria</Kicker>
        {suporte?.kind === 'available' ? (
          <Card padding={space.xs}>
            <Toggle
              label={`Proteger com ${biometricLabel(suporte).toLowerCase()}`}
              hint="Pedimos ao abrir o app e antes de mostrar documentos."
              value={biometriaLigada}
              disabled={salvando}
              onChange={(v) => void alternarBiometria(v)}
              testID="seguranca-biometria"
            />
          </Card>
        ) : (
          <Card>
            <Text variant="body" tone="muted">
              {suporte ? biometricLabel(suporte) : 'Verificando…'}
            </Text>
          </Card>
        )}

        {aviso ? (
          <Text variant="body" tone="warning" accessibilityRole="alert">
            {aviso}
          </Text>
        ) : null}

        <Text variant="body" tone="faint">
          A biometria fica no aparelho e nunca é enviada à Fly. Reconhecimento facial para organizar
          fotos é outra coisa, e você decide separado.
        </Text>
      </View>

      <View style={styles.secao}>
        <Kicker>Sessão</Kicker>
        <Card>
          <View style={styles.bloco}>
            <Text variant="body" tone="muted">
              Sair encerra a sessão em todos os aparelhos, e não só neste.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sair de todos os aparelhos"
              onPress={() => void signOut()}
              style={styles.acao}
              testID="seguranca-sair"
            >
              <Text variant="body" tone="gold">
                Sair de todos os aparelhos
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>

      <View style={styles.secao}>
        <Kicker tone="danger">Excluir conta</Kicker>
        <Card style={styles.perigo}>
          <View style={styles.bloco}>
            <Text variant="body" tone="muted">
              Apagamos seu nome, contato, preferências e aparelhos. Não dá para desfazer, e você
              perde acesso ao histórico das suas viagens.
            </Text>
            <Text variant="body" tone="faint">
              Guardamos o registro das suas decisões de privacidade — é a prova do que valia em cada
              data, e apagá-la deixaria a Fly sem resposta numa auditoria.
            </Text>

            <Text variant="body" tone="muted" style={styles.instrucao}>
              Para confirmar, digite seu Fly ID: <Text variant="body">{perfil.publicId}</Text>
            </Text>

            <View style={styles.campoConfirmacao}>
              <Text
                variant="body"
                accessibilityRole="text"
                style={styles.valorDigitado}
                testID="seguranca-confirmacao-valor"
              >
                {confirmacao || ' '}
              </Text>
            </View>

            <View style={styles.teclas}>
              {perfil.publicId.split('').map((c, i) => (
                <Pressable
                  key={`${c}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Digitar ${c}`}
                  onPress={() => setConfirmacao((v) => v + c)}
                  style={styles.tecla}
                >
                  <Text variant="body">{c}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Apagar"
                onPress={() => setConfirmacao('')}
                style={styles.tecla}
              >
                <Text variant="body" tone="muted">
                  ⌫
                </Text>
              </Pressable>
            </View>

            {erroExclusao ? (
              <Text variant="body" tone="danger" accessibilityRole="alert">
                {erroExclusao}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Excluir minha conta definitivamente"
              accessibilityState={{ disabled: !podeExcluir, busy: excluindo }}
              aria-disabled={!podeExcluir}
              disabled={!podeExcluir}
              onPress={() => void excluir()}
              style={[styles.acao, styles.acaoPerigo, !podeExcluir && styles.desativado]}
              testID="seguranca-excluir"
            >
              <Text variant="body" tone="danger">
                {excluindo ? 'Excluindo…' : 'Excluir minha conta'}
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: { gap: space.md, marginTop: space.section },
  bloco: { gap: space.md },
  perigo: { borderColor: 'rgba(240,84,84,.3)' },
  instrucao: { marginTop: space.sm },
  campoConfirmacao: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.background,
  },
  valorDigitado: { letterSpacing: 3 },
  teclas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tecla: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  acao: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  acaoPerigo: { borderColor: 'rgba(240,84,84,.4)' },
  desativado: { opacity: 0.4 },
});
