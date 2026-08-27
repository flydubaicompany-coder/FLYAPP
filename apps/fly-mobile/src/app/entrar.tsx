import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { palette, radius, space, textStyle, touchTarget } from '@/theme';
import { AppHeader, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { consumirPendente } from '@/push/destino';

/**
 * Entrar (§37.1).
 *
 * A Fly e por convite: esta tela e para quem **ja ativou** a conta. Quem
 * chegou pelo link de convite passa por `/convite`, que cria o acesso.
 *
 * O erro do Supabase nao vai para a tela cru. "Invalid login credentials" nao
 * diz nada a um cliente, e mensagens tecnicas em tela de login sao um vetor
 * classico de enumeracao de contas — a resposta e a mesma para e-mail
 * inexistente e senha errada, de proposito.
 *
 * Depois de entrar, esta tela **retoma o contexto pendente** se houver um. E o
 * que fecha o criterio da §38.10: quem tocou numa notificacao deslogado volta
 * ao aviso, e nao ao perfil.
 */
export default function EntrarScreen() {
  const router = useRouter();
  const { refresh } = useSession();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = email.trim().length > 3 && senha.length >= 8 && !enviando;

  async function entrar() {
    setEnviando(true);
    setErro(null);

    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    if (error) {
      setErro('E-mail ou senha não conferem. Se precisar, a Fly ajuda.');
      setEnviando(false);
      return;
    }

    await refresh();
    setEnviando(false);

    // Quem chegou aqui por um toque em notificacao volta para onde queria ir.
    const pendente = consumirPendente();
    router.replace((pendente ?? '/perfil') as never);
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen withBottomNav={false} testID="screen-entrar">
        <AppHeader
          kicker="Fly ID"
          title="Entrar"
          subtitle="Use o acesso que você criou pelo convite."
        />

        <View style={styles.campos}>
          <View style={styles.campo}>
            <Text variant="body" tone="muted">
              E-mail
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              textContentType="emailAddress"
              placeholder="voce@exemplo.com"
              placeholderTextColor={palette.textDisabled}
              style={styles.input}
              accessibilityLabel="E-mail"
              testID="entrar-email"
            />
          </View>

          <View style={styles.campo}>
            <Text variant="body" tone="muted">
              Senha
            </Text>
            <TextInput
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              placeholder="Ao menos 8 caracteres"
              placeholderTextColor={palette.textDisabled}
              style={styles.input}
              accessibilityLabel="Senha"
              testID="entrar-senha"
              onSubmitEditing={() => podeEnviar && void entrar()}
            />
          </View>
        </View>

        {erro ? (
          <Text variant="body" tone="danger" accessibilityRole="alert" style={styles.erro}>
            {erro}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Entrar"
          accessibilityState={{ disabled: !podeEnviar, busy: enviando }}
          disabled={!podeEnviar}
          onPress={() => void entrar()}
          style={({ pressed }) => [
            styles.botao,
            !podeEnviar && styles.botaoDesativado,
            pressed && styles.botaoPressionado,
          ]}
          testID="entrar-enviar"
        >
          <Text variant="body" style={styles.botaoLabel}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Text>
        </Pressable>

        <Text variant="body" tone="faint" style={styles.nota}>
          Ainda não tem acesso? A Fly é por convite — fale com a sua equipe.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  campos: {
    gap: space.xl,
    marginTop: space.lg,
  },
  campo: {
    gap: space.sm,
  },
  input: {
    ...textStyle('body'),
    color: palette.text,
    minHeight: touchTarget.min + space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  erro: {
    marginTop: space.lg,
  },
  botao: {
    minHeight: touchTarget.min + space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
    borderRadius: radius.chip,
    backgroundColor: palette.text,
  },
  botaoDesativado: {
    opacity: 0.4,
  },
  botaoPressionado: {
    opacity: 0.8,
  },
  botaoLabel: {
    color: palette.background,
    fontWeight: '600',
  },
  nota: {
    textAlign: 'center',
    marginTop: space.xl,
  },
});
