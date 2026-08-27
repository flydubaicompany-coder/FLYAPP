import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Card, Text, Toggle } from '@/ui';
import { StepScaffold } from '@/onboarding/StepScaffold';
import { useAdvance } from '@/onboarding/useAdvance';
import { supabase } from '@/auth/client';

/**
 * Etapa: privacidade (§23.2 e §37.6).
 *
 * A ultima etapa antes de entrar, e a unica que nao pode ser pulada. Um
 * cliente nao deveria comecar a usar o app sem ter decidido o que a Fly pode
 * fazer com os dados dele.
 *
 * Duas decisoes de desenho aqui:
 *
 * **Nada vem ligado por padrao**, exceto o que e obrigatorio para operar.
 * Marcar tudo de antemao e consentimento de fachada.
 *
 * **Os obrigatorios aparecem, mesmo sem poder desligar.** Esconder o que a
 * pessoa esta aceitando seria pior do que mostrar sem opcao.
 */
interface Finalidade {
  key: string;
  label: string;
  description: string;
  isRequired: boolean;
  isSensitive: boolean;
  version: number;
}

export default function PrivacidadeOnboardingScreen() {
  const { advance, busy, userId } = useAdvance('consents');
  const [finalidades, setFinalidades] = useState<Finalidade[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void supabase()
      .from('consent_purposes')
      .select('key, label, description, is_required, is_sensitive, current_version')
      .then(({ data }) => {
        const lista = (data ?? []).map((p) => ({
          key: p.key,
          label: p.label,
          description: p.description,
          isRequired: p.is_required,
          isSensitive: p.is_sensitive,
          version: p.current_version,
        }));
        setFinalidades(lista);
        // Só o obrigatório nasce marcado.
        setEscolhas(Object.fromEntries(lista.map((f) => [f.key, f.isRequired])));
      });
  }, []);

  const obrigatoriosAceitos = finalidades.filter((f) => f.isRequired).every((f) => escolhas[f.key]);

  async function gravar() {
    if (!userId || finalidades.length === 0) return;
    await supabase()
      .from('consents')
      .insert(
        finalidades.map((f) => ({
          user_id: userId,
          purpose_key: f.key,
          granted: escolhas[f.key] ?? false,
          version: f.version,
          source: 'app' as const,
        })),
      );
  }

  const comuns = finalidades.filter((f) => !f.isSensitive);
  const sensiveis = finalidades.filter((f) => f.isSensitive);

  return (
    <StepScaffold
      step="consents"
      canContinue={obrigatoriosAceitos && !!userId && finalidades.length > 0}
      busy={busy}
      continueLabel="Concluir"
      onContinue={() => void advance(gravar)}
    >
      <Card padding={space.xs}>
        {comuns.map((f) => (
          <Toggle
            key={f.key}
            label={f.label}
            hint={f.isRequired ? `${f.description} Necessário para usar o app.` : f.description}
            value={escolhas[f.key] ?? false}
            disabled={f.isRequired}
            onChange={(v) => setEscolhas((e) => ({ ...e, [f.key]: v }))}
            testID={`onboarding-consent-${f.key}`}
          />
        ))}
      </Card>

      {sensiveis.length > 0 ? (
        <View style={styles.secao}>
          <Text variant="body" tone="warning">
            Dados sensíveis
          </Text>
          <Text variant="body" tone="muted">
            Ficam desligados até você decidir. Pode ligar depois, no Perfil.
          </Text>
          <Card padding={space.xs}>
            {sensiveis.map((f) => (
              <Toggle
                key={f.key}
                label={f.label}
                hint={f.description}
                value={escolhas[f.key] ?? false}
                onChange={(v) => setEscolhas((e) => ({ ...e, [f.key]: v }))}
                testID={`onboarding-consent-${f.key}`}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <Text variant="body" tone="faint" style={styles.nota}>
        Guardamos suas escolhas com data. Você muda quando quiser, e a mudança vale na hora.
      </Text>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  secao: { gap: space.md },
  nota: { marginTop: space.md },
});
