import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { AppHeader, Card, Field, Kicker, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { PREFERENCE_FIELDS, PREFERENCE_GROUPS } from '@/preferences/catalog';

/**
 * Curadoria de preferencias (§9.4).
 *
 * A frase da spec, literal, e o contrato desta tela:
 * "Ajude a Fly a cuidar dos detalhes que fazem diferenca para voce."
 *
 * Isto nao e cadastro. Cada campo e opcional, salva sozinho ao sair do foco, e
 * pode ficar em branco para sempre. Campo marcado como sensivel — alergia,
 * restricao — so chega a equipe se houver consentimento vigente, e a tela diz
 * isso onde o dedo esta.
 */
export default function PreferenciasScreen() {
  const { state } = useSession();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregado, setCarregado] = useState(false);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  useEffect(() => {
    if (!userId) return;
    void supabase()
      .from('preference_items')
      .select('key, value')
      .eq('user_id', userId)
      .then(({ data }) => {
        const mapa: Record<string, string> = {};
        for (const item of data ?? []) {
          mapa[item.key] = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        }
        setValores(mapa);
        setCarregado(true);
      });
  }, [userId]);

  const salvar = useCallback(
    async (key: string, isSensitive: boolean) => {
      if (!userId) return;
      const bruto = (valores[key] ?? '').trim();

      if (bruto.length === 0) {
        await supabase().from('preference_items').delete().eq('user_id', userId).eq('key', key);
        return;
      }

      await supabase()
        .from('preference_items')
        .upsert(
          { user_id: userId, key, value: bruto, is_sensitive: isSensitive },
          { onConflict: 'user_id,key' },
        );
    },
    [userId, valores],
  );

  if (!userId) {
    return (
      <Screen withBottomNav={false} testID="screen-preferencias">
        <AppHeader kicker="Preferências" title="Entre para ver" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen withBottomNav={false} testID="screen-preferencias">
        <AppHeader
          kicker="Preferências"
          title="Os detalhes"
          subtitle="Ajude a Fly a cuidar dos detalhes que fazem diferença para você."
        />

        {PREFERENCE_GROUPS.map((grupo) => {
          const campos = PREFERENCE_FIELDS.filter((f) => f.group === grupo.key);
          return (
            <View key={grupo.key} style={styles.grupo}>
              <Kicker>{grupo.label}</Kicker>
              {grupo.note ? (
                <Text variant="body" tone={grupo.key === 'saude' ? 'warning' : 'muted'}>
                  {grupo.note}
                </Text>
              ) : null}

              <Card padding={space.lg}>
                <View style={styles.campos}>
                  {campos.map((campo) => (
                    <Field
                      key={campo.key}
                      label={campo.label}
                      {...(campo.hint ? { hint: campo.hint } : {})}
                      value={valores[campo.key] ?? ''}
                      onChangeText={(t) => setValores((v) => ({ ...v, [campo.key]: t }))}
                      onBlur={() => void salvar(campo.key, campo.isSensitive)}
                      placeholder={campo.placeholder}
                      editable={carregado}
                      testID={`pref-${campo.key}`}
                    />
                  ))}
                </View>
              </Card>
            </View>
          );
        })}

        <Text variant="body" tone="faint" style={styles.nota}>
          Tudo aqui é opcional e salva sozinho. Você pode deixar em branco e voltar quando quiser.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grupo: { gap: space.md, marginTop: space.section },
  campos: { gap: space.xl },
  nota: { marginTop: space.section },
});
