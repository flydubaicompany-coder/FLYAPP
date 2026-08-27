import { useState } from 'react';
import { Field, Text } from '@/ui';
import { StepScaffold } from '@/onboarding/StepScaffold';
import { useAdvance } from '@/onboarding/useAdvance';
import { supabase } from '@/auth/client';

/**
 * Etapa: criar o acesso.
 *
 * A senha e definida aqui, depois que o convite ja provou quem e a pessoa. O
 * minimo de 8 caracteres e do Supabase; nao inventamos regra de complexidade
 * — exigir simbolo e maiuscula produz senha anotada em papel, nao senha forte.
 */
export default function AcessoScreen() {
  const { advance, busy, userId } = useAdvance('account');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const curta = senha.length > 0 && senha.length < 8;
  const difere = confirmacao.length > 0 && senha !== confirmacao;
  const valida = senha.length >= 8 && senha === confirmacao;

  async function definir() {
    const { error } = await supabase().auth.updateUser({ password: senha });
    if (error) {
      setErro('Não consegui definir a senha. Tente de novo.');
      throw new Error(error.message);
    }
  }

  return (
    <StepScaffold
      step="account"
      canContinue={valida && !!userId}
      busy={busy}
      onContinue={() => void advance(definir)}
    >
      <Field
        label="Crie uma senha"
        hint="Ao menos 8 caracteres"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Sua senha"
        {...(curta ? { error: 'Use ao menos 8 caracteres' } : {})}
        testID="onboarding-senha"
      />

      <Field
        label="Repita a senha"
        value={confirmacao}
        onChangeText={setConfirmacao}
        secureTextEntry
        autoComplete="new-password"
        placeholder="A mesma senha"
        {...(difere ? { error: 'As senhas não são iguais' } : {})}
        testID="onboarding-senha-confirma"
      />

      {erro ? (
        <Text variant="body" tone="danger" accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}
    </StepScaffold>
  );
}
