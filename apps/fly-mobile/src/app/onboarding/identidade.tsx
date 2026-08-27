import { useState } from 'react';
import { Text } from '@/ui';
import { Field } from '@/ui';
import { StepScaffold } from '@/onboarding/StepScaffold';
import { useAdvance } from '@/onboarding/useAdvance';
import { supabase } from '@/auth/client';

/**
 * Etapa: como podemos te chamar.
 *
 * Um campo so. A §23.2 pede coleta minima, e o nome preferido e a unica coisa
 * que a equipe precisa saber antes de falar com voce pela primeira vez.
 */
export default function IdentidadeScreen() {
  const { advance, busy, erro, userId } = useAdvance('identity');
  const [nome, setNome] = useState('');

  const valido = nome.trim().length >= 2;

  return (
    <StepScaffold
      step="identity"
      canContinue={valido && !!userId}
      busy={busy}
      onContinue={() =>
        void advance(async () => {
          await supabase()
            .from('profiles')
            .update({ preferred_name: nome.trim() })
            .eq('id', userId as string);
        })
      }
    >
      <Field
        label="Como podemos te chamar"
        hint="É assim que a equipe vai falar com você"
        value={nome}
        onChangeText={setNome}
        placeholder="Seu nome ou apelido"
        autoCapitalize="words"
        autoFocus
        testID="onboarding-nome"
      />

      {erro ? (
        <Text variant="body" tone="danger" accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}
    </StepScaffold>
  );
}
