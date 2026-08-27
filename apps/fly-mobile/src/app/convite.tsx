import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, EmptyState, Field, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { loadEnv } from '@/env';

/**
 * Ativação de convite (§37.1).
 *
 * A Fly é por convite: esta é a única porta de entrada. O link chega como
 * `fly://convite?token=…`, e o token viaja em claro apenas ali — o banco
 * guarda o SHA-256.
 *
 * A ativação passa por Edge Function, não por chamada direta ao banco. A
 * tabela `invitations` não é legível por cliente algum: se fosse, daria para
 * enumerar quem a Fly está prestes a convidar. Criar a conta exige
 * `service_role`, e `service_role` nunca entra em um app.
 */
export default function ConviteScreen() {
  const router = useRouter();
  const { refresh } = useSession();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhaCurta = senha.length > 0 && senha.length < 8;
  const senhasDiferem = confirmacao.length > 0 && senha !== confirmacao;
  const pode = email.trim().length > 3 && senha.length >= 8 && senha === confirmacao && !enviando;

  async function ativar() {
    if (!token) return;
    setEnviando(true);
    setErro(null);

    const env = loadEnv();

    try {
      const resposta = await fetch(`${env.supabaseUrl}/functions/v1/aceitar-convite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.supabaseKey },
        body: JSON.stringify({
          token,
          email: email.trim().toLowerCase(),
          password: senha,
        }),
      });

      const corpo = (await resposta.json()) as { ok?: boolean; erro?: string };

      if (!resposta.ok || !corpo.ok) {
        setErro(corpo.erro ?? 'Não consegui ativar o convite.');
        setEnviando(false);
        return;
      }

      // Conta criada; agora entramos com ela e seguimos para o onboarding.
      const { error } = await supabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (error) {
        setErro('Conta criada, mas não consegui entrar. Tente pela tela de login.');
        setEnviando(false);
        return;
      }

      await refresh();
      router.replace('/onboarding/identidade');
    } catch {
      setErro('Sem conexão. Tente de novo em instantes.');
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <Screen withBottomNav={false} testID="screen-convite">
        <AppHeader kicker="Convite" title="Link incompleto" />
        <EmptyState
          title="Este link não tem convite"
          description="Abra o link exatamente como a Fly enviou. Se ele expirou, sua equipe gera outro."
          actionLabel="Já tenho conta"
          onAction={() => router.replace('/entrar')}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen withBottomNav={false} testID="screen-convite">
        <AppHeader
          kicker="Convite"
          title="Bem-vindo à Fly"
          subtitle="Confirme seu e-mail e crie um acesso."
        />

        <View style={styles.campos}>
          <Field
            label="E-mail"
            hint="O mesmo endereço para onde a Fly enviou o convite"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="voce@exemplo.com"
            testID="convite-email"
          />

          <Field
            label="Crie uma senha"
            hint="Ao menos 8 caracteres"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Sua senha"
            {...(senhaCurta ? { error: 'Use ao menos 8 caracteres' } : {})}
            testID="convite-senha"
          />

          <Field
            label="Repita a senha"
            value={confirmacao}
            onChangeText={setConfirmacao}
            secureTextEntry
            autoComplete="new-password"
            placeholder="A mesma senha"
            {...(senhasDiferem ? { error: 'As senhas não são iguais' } : {})}
            testID="convite-senha-confirma"
          />
        </View>

        {erro ? (
          <Text variant="body" tone="danger" accessibilityRole="alert" style={styles.erro}>
            {erro}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ativar convite"
          accessibilityState={{ disabled: !pode, busy: enviando }}
          aria-disabled={!pode}
          disabled={!pode}
          onPress={() => void ativar()}
          style={({ pressed }) => [
            styles.botao,
            !pode && styles.desativado,
            pressed && styles.pressionado,
          ]}
          testID="convite-ativar"
        >
          <Text variant="body" style={styles.botaoLabel}>
            {enviando ? 'Ativando…' : 'Ativar convite'}
          </Text>
        </Pressable>

        <Text variant="body" tone="faint" style={styles.nota}>
          Convites são de uso único e expiram. Se este não funcionar, sua equipe Fly gera outro.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  campos: { gap: space.xl, marginTop: space.lg },
  erro: { marginTop: space.lg },
  botao: {
    minHeight: touchTarget.min + space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
    borderRadius: radius.chip,
    backgroundColor: palette.text,
  },
  desativado: { opacity: 0.4 },
  pressionado: { opacity: 0.8 },
  botaoLabel: { color: palette.background, fontWeight: '600' },
  nota: { marginTop: space.xl, textAlign: 'center' },
});
