import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Field, Kicker, Text } from '@/ui';
import { StepScaffold } from '@/onboarding/StepScaffold';
import { useAdvance } from '@/onboarding/useAdvance';
import { supabase } from '@/auth/client';
import { PREFERENCE_FIELDS } from '@/preferences/catalog';

/**
 * Etapa: curadoria de preferencias (§9.4).
 *
 * Aqui aparecem poucos campos, escolhidos por serem os que a equipe usa no
 * primeiro dia. O resto fica no Perfil. Onboarding com dezoito perguntas nao e
 * curadoria, e formulario — e formulario recebe resposta chutada.
 *
 * Campos de saude ficam **fora** desta etapa de proposito: eles dependem de
 * consentimento, que so e pedido na etapa seguinte. Coletar antes de perguntar
 * seria coletar sem base.
 */
const CHAVES_INICIAIS = [
  'gosto.snacks',
  'gosto.comidas_favoritas',
  'gosto.comidas_recusadas',
  'tamanho.camisa',
] as const;

export default function PreferenciasScreen() {
  const { advance, busy, userId } = useAdvance('preferences');
  const [valores, setValores] = useState<Record<string, string>>({});

  const campos = PREFERENCE_FIELDS.filter((f) =>
    (CHAVES_INICIAIS as readonly string[]).includes(f.key),
  );

  async function salvar() {
    const linhas = campos
      .filter((c) => (valores[c.key] ?? '').trim().length > 0)
      .map((c) => ({
        user_id: userId as string,
        key: c.key,
        value: valores[c.key]!.trim(),
        is_sensitive: c.isSensitive,
      }));

    if (linhas.length > 0) {
      await supabase().from('preference_items').upsert(linhas, { onConflict: 'user_id,key' });
    }
  }

  return (
    <StepScaffold
      step="preferences"
      canContinue={!!userId}
      busy={busy}
      continueLabel="Salvar e continuar"
      onContinue={() => void advance(salvar)}
      onSkip={() => void advance()}
    >
      <ScrollView style={styles.rolagem} keyboardShouldPersistTaps="handled">
        <View style={styles.campos}>
          {campos.map((campo) => (
            <Field
              key={campo.key}
              label={campo.label}
              {...(campo.hint ? { hint: campo.hint } : {})}
              value={valores[campo.key] ?? ''}
              onChangeText={(t) => setValores((v) => ({ ...v, [campo.key]: t }))}
              placeholder={campo.placeholder}
              testID={`onboarding-pref-${campo.key}`}
            />
          ))}
        </View>

        <View style={styles.rodape}>
          <Kicker tone="muted">Depois</Kicker>
          <Text variant="body" tone="faint">
            Alergias, restrições e o resto ficam no Perfil, quando você quiser. Nada aqui é
            obrigatório.
          </Text>
        </View>
      </ScrollView>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  rolagem: { maxHeight: 420 },
  campos: { gap: space.xl },
  rodape: { gap: space.sm, marginTop: space.section },
});
