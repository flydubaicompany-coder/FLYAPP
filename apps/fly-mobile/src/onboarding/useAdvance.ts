import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { STEP_INFO, nextStep, type OnboardingStep } from '@/auth/onboarding';

/**
 * Avanca uma etapa do onboarding.
 *
 * O passo e gravado no banco antes de navegar. Se o cliente fechar o app no
 * meio, ele volta exatamente onde parou — e nao ao inicio, que e a forma mais
 * rapida de perder alguem que ja estava quase dentro.
 */
export function useAdvance(step: OnboardingStep) {
  const router = useRouter();
  const { refresh, state } = useSession();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  const advance = useCallback(
    async (before?: () => Promise<void>) => {
      if (!userId) return;
      setBusy(true);
      setErro(null);

      try {
        if (before) await before();

        const proximo = nextStep(step);

        // O avanco passa por funcao no servidor, e nao por update direto: o
        // cliente nao tem grant em `onboarding_step`, de proposito. Se
        // tivesse, poderia gravar 'done' e pular justamente a etapa de
        // privacidade. A funcao valida a transicao e audita.
        const { error } = await supabase().rpc('advance_onboarding', { p_to: proximo });

        if (error) throw new Error(error.message);

        await refresh();
        router.replace(STEP_INFO[proximo].path as never);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [userId, step, refresh, router],
  );

  return { advance, busy, erro, userId };
}
