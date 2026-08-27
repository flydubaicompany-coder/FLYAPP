import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { FlyRole } from '@fly/domain-types';
import { createLogger } from '@fly/config';
import { resetSupabase, supabase } from './client';
import { isOnboardingStep, type OnboardingStep } from './onboarding';

/**
 * Sessao do Fly ID.
 *
 * O perfil e os papeis vem de tabela protegida, nunca de `user_metadata`
 * (§37, regra explicita). Um `user_metadata` e editavel pelo proprio usuario:
 * confiar nele para autorizacao seria deixar o cliente escolher o proprio
 * papel. O que esta aqui e apenas cache de leitura para a UI — o servidor
 * decide de novo, sempre, via RLS.
 */

const logger = createLogger({ service: 'Fly App' });

export interface FlyProfile {
  id: string;
  /** Identificador opaco do QR pessoal. Nunca use `id` para isso. */
  publicId: string;
  displayName: string | null;
  preferredName: string | null;
  locale: string;
  onboardingStep: OnboardingStep;
  onboardingCompletedAt: string | null;
  isMinor: boolean;
}

export type SessionState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; session: Session; profile: FlyProfile; roles: readonly FlyRole[] }
  | { kind: 'error'; message: string };

interface SessionContextValue {
  state: SessionState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}

/** Atalho para quando a tela so faz sentido com alguem logado. */
export function useSignedIn(): Extract<SessionState, { kind: 'signedIn' }> | null {
  const { state } = useSession();
  return state.kind === 'signedIn' ? state : null;
}

async function loadProfileAndRoles(
  session: Session,
): Promise<{ profile: FlyProfile; roles: FlyRole[] }> {
  const db = supabase();

  const [perfil, papeis] = await Promise.all([
    db
      .from('profiles')
      .select(
        'id, public_id, display_name, preferred_name, locale, onboarding_step, onboarding_completed_at, is_minor',
      )
      .eq('id', session.user.id)
      .single(),
    db.from('user_roles').select('role').eq('user_id', session.user.id),
  ]);

  if (perfil.error) throw new Error(perfil.error.message);
  if (papeis.error) throw new Error(papeis.error.message);

  const linha = perfil.data;
  const passo = isOnboardingStep(linha.onboarding_step) ? linha.onboarding_step : 'invited';

  return {
    profile: {
      id: linha.id,
      publicId: linha.public_id,
      displayName: linha.display_name,
      preferredName: linha.preferred_name,
      locale: linha.locale,
      onboardingStep: passo,
      onboardingCompletedAt: linha.onboarding_completed_at,
      isMinor: linha.is_minor,
    },
    roles: papeis.data.map((p) => p.role),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });

  const applySession = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ kind: 'signedOut' });
      return;
    }
    try {
      const { profile, roles } = await loadProfileAndRoles(session);
      setState({ kind: 'signedIn', session, profile, roles });
      // Sem PII: o logger redige, mas nem chegamos a passar nome ou e-mail.
      logger.info('sessao ativa', { onboardingStep: profile.onboardingStep });
    } catch (error) {
      setState({ kind: 'error', message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (ativo) void applySession(data.session);
      })
      .catch((error: Error) => {
        if (ativo) setState({ kind: 'error', message: error.message });
      });

    // Cobre refresh de token, login em outra aba e expiracao.
    const { data: sub } = supabase().auth.onAuthStateChange((_event, session) => {
      if (ativo) void applySession(session);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const refresh = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  const signOut = useCallback(async () => {
    // `scope: 'global'` revoga a sessao em todos os aparelhos (§37.11), e nao
    // apenas neste. Sair da conta em um celular perdido precisa valer para o
    // celular perdido.
    await supabase().auth.signOut({ scope: 'global' });
    resetSupabase();
    setState({ kind: 'signedOut' });
    logger.info('sessao encerrada');
  }, []);

  const value = useMemo(() => ({ state, refresh, signOut }), [state, refresh, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
