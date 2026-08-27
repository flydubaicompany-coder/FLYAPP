import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, Field, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Dados pessoais (§9.2).
 *
 * Poucos campos de proposito. A §23.2 pede coleta minima, e cadastro longo em
 * onboarding e a forma mais rapida de perder o cliente antes da viagem
 * comecar. O resto vem por curadoria, quando fizer sentido.
 */
export default function DadosScreen() {
  const { state, refresh } = useSession();
  const [preferredName, setPreferredName] = useState('');
  const [phone, setPhone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const perfil = state.kind === 'signedIn' ? state.profile : null;

  useEffect(() => {
    if (perfil) setPreferredName(perfil.preferredName ?? '');
  }, [perfil]);

  const telefoneValido = phone.length === 0 || /^\+[1-9][0-9]{7,14}$/.test(phone);

  async function salvar() {
    if (!perfil || !telefoneValido) return;
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const { error } = await supabase()
      .from('profiles')
      .update({
        preferred_name: preferredName.trim() || null,
        phone: phone.trim() || null,
      })
      .eq('id', perfil.id);

    if (error) setErro('Não consegui salvar. Tente de novo.');
    else {
      setSalvo(true);
      await refresh();
    }
    setSalvando(false);
  }

  if (!perfil) {
    return (
      <Screen withBottomNav={false} testID="screen-dados">
        <AppHeader kicker="Dados" title="Entre para ver" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen withBottomNav={false} testID="screen-dados">
        <AppHeader kicker="Dados pessoais" title="Sobre você" />

        <View style={styles.campos}>
          <Field
            label="Como podemos te chamar"
            hint="É o nome que a equipe vai usar com você"
            value={preferredName}
            onChangeText={setPreferredName}
            placeholder="Seu nome"
            autoCapitalize="words"
            testID="dados-nome"
          />

          <Field
            label="Telefone"
            hint="Com código do país, por exemplo +5511999999999"
            value={phone}
            onChangeText={setPhone}
            placeholder="+55…"
            keyboardType="phone-pad"
            inputMode="tel"
            {...(telefoneValido ? {} : { error: 'Use o formato internacional, começando com +' })}
            testID="dados-telefone"
          />

          <View style={styles.somenteLeitura}>
            <Text variant="body" tone="muted">
              Seu Fly ID
            </Text>
            <Text variant="body">{perfil.publicId}</Text>
            <Text variant="body" tone="faint">
              Identificador do seu QR pessoal. Não muda com o nome.
            </Text>
          </View>
        </View>

        {erro ? (
          <Text variant="body" tone="danger" accessibilityRole="alert" style={styles.aviso}>
            {erro}
          </Text>
        ) : null}
        {salvo ? (
          <Text variant="body" tone="ok" accessibilityRole="alert" style={styles.aviso}>
            Salvo.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar"
          accessibilityState={{ disabled: salvando || !telefoneValido, busy: salvando }}
          disabled={salvando || !telefoneValido}
          onPress={() => void salvar()}
          style={({ pressed }) => [
            styles.botao,
            (salvando || !telefoneValido) && styles.botaoDesativado,
            pressed && styles.botaoPressionado,
          ]}
          testID="dados-salvar"
        >
          <Text variant="body" style={styles.botaoLabel}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  campos: { gap: space.xl, marginTop: space.lg },
  somenteLeitura: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.block,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  aviso: { marginTop: space.lg },
  botao: {
    minHeight: touchTarget.min + space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
    borderRadius: radius.chip,
    backgroundColor: palette.text,
  },
  botaoDesativado: { opacity: 0.4 },
  botaoPressionado: { opacity: 0.8 },
  botaoLabel: { color: palette.background, fontWeight: '600' },
});
