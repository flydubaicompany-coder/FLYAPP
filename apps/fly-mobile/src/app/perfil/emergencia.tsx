import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, Field, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Contato de emergencia (§9.2).
 *
 * Este dado existe para ser usado no pior dia da viagem. Por isso a tela diz,
 * sem rodeio, quem vai poder ver: a equipe atribuida a sua viagem. Guardar
 * telefone de familiar sem explicar quem o acessa e coleta silenciosa.
 */
export default function EmergenciaScreen() {
  const { state } = useSession();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const telefoneValido = /^\+[1-9][0-9]{7,14}$/.test(telefone);
  const podeSalvar = nome.trim().length > 0 && telefoneValido && !salvando;

  useEffect(() => {
    if (!userId) return;
    void supabase()
      .from('emergency_contacts')
      .select('name, phone, relationship')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.name);
        setTelefone(data.phone);
        setParentesco(data.relationship ?? '');
      });
  }, [userId]);

  async function salvar() {
    if (!userId || !podeSalvar) return;
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    // Um principal por pessoa: em emergencia, ambiguidade custa tempo. O banco
    // garante isso com indice unico; aqui limpamos antes de gravar o novo.
    await supabase()
      .from('emergency_contacts')
      .delete()
      .eq('user_id', userId)
      .eq('is_primary', true);

    const { error } = await supabase()
      .from('emergency_contacts')
      .insert({
        user_id: userId,
        name: nome.trim(),
        phone: telefone.trim(),
        relationship: parentesco.trim() || null,
        is_primary: true,
      });

    if (error) setErro('Não consegui salvar. Tente de novo.');
    else setSalvo(true);
    setSalvando(false);
  }

  if (!userId) {
    return (
      <Screen withBottomNav={false} testID="screen-emergencia">
        <AppHeader kicker="Perfil" title="Entre para ver" onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen withBottomNav={false} testID="screen-emergencia">
        <AppHeader
          kicker="Perfil"
          title="Quem avisamos"
          subtitle="Só a equipe atribuída à sua viagem enxerga este contato."
          onBack={() => router.back()}
        />

        <View style={styles.campos}>
          <Field
            label="Nome"
            value={nome}
            onChangeText={setNome}
            placeholder="Nome completo"
            autoCapitalize="words"
            testID="emergencia-nome"
          />
          <Field
            label="Telefone"
            hint="Com código do país"
            value={telefone}
            onChangeText={setTelefone}
            placeholder="+55…"
            keyboardType="phone-pad"
            inputMode="tel"
            {...(telefone.length === 0 || telefoneValido
              ? {}
              : { error: 'Use o formato internacional, começando com +' })}
            testID="emergencia-telefone"
          />
          <Field
            label="Relação"
            hint="Opcional"
            value={parentesco}
            onChangeText={setParentesco}
            placeholder="Mãe, irmão, cônjuge…"
            testID="emergencia-relacao"
          />
        </View>

        {erro ? (
          <Text variant="body" tone="danger" accessibilityRole="alert" style={styles.aviso}>
            {erro}
          </Text>
        ) : null}
        {salvo ? (
          <Text variant="body" tone="ok" accessibilityRole="alert" style={styles.aviso}>
            Contato salvo.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar contato"
          accessibilityState={{ disabled: !podeSalvar, busy: salvando }}
          disabled={!podeSalvar}
          onPress={() => void salvar()}
          style={({ pressed }) => [
            styles.botao,
            !podeSalvar && styles.botaoDesativado,
            pressed && styles.botaoPressionado,
          ]}
          testID="emergencia-salvar"
        >
          <Text variant="body" style={styles.botaoLabel}>
            {salvando ? 'Salvando…' : 'Salvar contato'}
          </Text>
        </Pressable>

        <Text variant="body" tone="faint" style={styles.nota}>
          O Fly App não substitui os serviços públicos de emergência.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  campos: { gap: space.xl, marginTop: space.lg },
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
  nota: { marginTop: space.xl, textAlign: 'center' },
});
