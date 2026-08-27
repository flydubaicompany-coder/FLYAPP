import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, Screen, Text } from '@/ui';
import { STEP_INFO, VISIBLE_STEPS, stepIndex, type OnboardingStep } from '@/auth/onboarding';

/**
 * Casca de uma etapa do onboarding (§37.6).
 *
 * Duas coisas que ela garante e que cada tela sozinha esqueceria:
 *
 * **Progresso visível.** Onboarding sem indicação de quanto falta é onde as
 * pessoas desistem. A barra mostra as cinco etapas, não uma porcentagem
 * abstrata.
 *
 * **Saída sempre disponível.** Voltar é livre, e a etapa de preferências pode
 * ser pulada. Formulário que prende produz resposta chutada, e resposta
 * chutada em preferência é pior que campo vazio: a equipe age em cima dela.
 */
export interface StepScaffoldProps {
  step: OnboardingStep;
  children: ReactNode;
  /** Ação principal. Desabilitada enquanto a etapa não estiver válida. */
  onContinue: () => void;
  continueLabel?: string;
  canContinue: boolean;
  busy?: boolean;
  onSkip?: () => void;
}

export function StepScaffold({
  step,
  children,
  onContinue,
  continueLabel = 'Continuar',
  canContinue,
  busy = false,
  onSkip,
}: StepScaffoldProps) {
  const router = useRouter();
  const info = STEP_INFO[step];
  const atual = stepIndex(step);
  const podePular = info.skippable && onSkip;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen withBottomNav={false} testID={`onboarding-${step}`}>
        <View
          style={styles.progresso}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: VISIBLE_STEPS.length, now: atual + 1 }}
          accessibilityLabel={`Etapa ${atual + 1} de ${VISIBLE_STEPS.length}`}
        >
          {VISIBLE_STEPS.map((s, i) => (
            <View key={s} style={[styles.trecho, i <= atual && styles.trechoFeito]} />
          ))}
        </View>

        <AppHeader
          kicker={`Etapa ${atual + 1} de ${VISIBLE_STEPS.length}`}
          title={info.title}
          subtitle={info.purpose}
        />

        <View style={styles.corpo}>{children}</View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
          accessibilityState={{ disabled: !canContinue || busy, busy }}
          aria-disabled={!canContinue || busy}
          disabled={!canContinue || busy}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.principal,
            (!canContinue || busy) && styles.desativado,
            pressed && styles.pressionado,
          ]}
          testID={`onboarding-${step}-continuar`}
        >
          <Text variant="body" style={styles.principalLabel}>
            {busy ? 'Salvando…' : continueLabel}
          </Text>
        </Pressable>

        {podePular ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pular por enquanto"
            accessibilityHint="Você pode completar depois, pelo Perfil"
            onPress={onSkip}
            style={styles.secundario}
            testID={`onboarding-${step}-pular`}
          >
            <Text variant="body" tone="muted">
              Pular por enquanto
            </Text>
          </Pressable>
        ) : null}

        {atual > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
            style={styles.secundario}
          >
            <Text variant="body" tone="faint">
              Voltar
            </Text>
          </Pressable>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  progresso: {
    flexDirection: 'row',
    gap: space.xs,
    marginBottom: space.xxl,
  },
  trecho: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.fillStrong,
  },
  trechoFeito: {
    backgroundColor: palette.gold,
  },
  corpo: {
    gap: space.xl,
    marginTop: space.lg,
  },
  principal: {
    minHeight: touchTarget.min + space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.section,
    borderRadius: radius.chip,
    backgroundColor: palette.text,
  },
  desativado: { opacity: 0.4 },
  pressionado: { opacity: 0.8 },
  principalLabel: {
    color: palette.background,
    fontWeight: '600',
  },
  secundario: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
});
