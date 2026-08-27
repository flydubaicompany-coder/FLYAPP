/**
 * A maquina de estados do onboarding (§37.6).
 *
 * Modulo puro: nada aqui importa React nem Supabase, entao o fluxo inteiro e
 * testavel sem montar tela. A §20 da spec e explicita — processo importante
 * nao se representa com boolean — e onboarding e processo importante: ele
 * decide se o cliente ja pode usar o app.
 */

export const ONBOARDING_STEPS = [
  'invited',
  'account',
  'identity',
  'preferences',
  'consents',
  'done',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

interface StepInfo {
  /** Titulo da etapa, mostrado ao cliente. */
  title: string;
  /** Uma frase dizendo por que a etapa existe. */
  purpose: string;
  /** Rota da etapa. */
  path: string;
  /** Pode ser pulada agora e retomada depois. */
  skippable: boolean;
}

export const STEP_INFO: Record<OnboardingStep, StepInfo> = {
  invited: {
    title: 'Ative seu convite',
    purpose: 'A Fly é por convite. Confirme que este é você.',
    path: '/convite',
    skippable: false,
  },
  account: {
    title: 'Crie seu acesso',
    purpose: 'Um jeito seguro de voltar à sua conta.',
    path: '/onboarding/acesso',
    skippable: false,
  },
  identity: {
    title: 'Como podemos te chamar?',
    purpose: 'O nome que a equipe vai usar com você.',
    path: '/onboarding/identidade',
    skippable: false,
  },
  preferences: {
    title: 'Os detalhes que fazem diferença',
    purpose: 'Ajude a Fly a cuidar do que importa para você.',
    path: '/onboarding/preferencias',
    // Preferencia e curadoria, nao cadastro. Quem esta com pressa completa
    // depois, pelo Perfil — travar aqui so produziria resposta chutada.
    skippable: true,
  },
  consents: {
    title: 'Privacidade',
    purpose: 'Você decide o que a Fly pode usar, e muda quando quiser.',
    path: '/onboarding/privacidade',
    skippable: false,
  },
  done: {
    title: 'Tudo pronto',
    purpose: '',
    path: '/',
    skippable: false,
  },
};

/** Etapas que aparecem na barra de progresso — `done` não é etapa, é chegada. */
export const VISIBLE_STEPS = ONBOARDING_STEPS.filter((s) => s !== 'done');

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

/** Progresso de 0 a 1, para a barra do onboarding. */
export function stepProgress(step: OnboardingStep): number {
  return stepIndex(step) / (ONBOARDING_STEPS.length - 1);
}

export function nextStep(step: OnboardingStep): OnboardingStep {
  const i = stepIndex(step);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)] as OnboardingStep;
}

export function previousStep(step: OnboardingStep): OnboardingStep {
  return ONBOARDING_STEPS[Math.max(stepIndex(step) - 1, 0)] as OnboardingStep;
}

export function isComplete(step: OnboardingStep): boolean {
  return step === 'done';
}

/**
 * Avancar so e permitido para a etapa seguinte.
 *
 * Sem esta regra, um deep link poderia pular a etapa de privacidade e o
 * cliente entraria no app sem ter decidido nada sobre os proprios dados.
 * Voltar, ao contrario, e sempre livre — revisar o que ja respondeu nao faz
 * mal a ninguem.
 */
export function canNavigateTo(current: OnboardingStep, target: OnboardingStep): boolean {
  const atual = stepIndex(current);
  const alvo = stepIndex(target);
  return alvo <= atual || alvo === atual + 1;
}

/**
 * Para onde mandar alguem que abriu o app.
 *
 * Devolve null quando o onboarding acabou — ai o destino e o app de verdade.
 */
export function resumePath(step: OnboardingStep): string | null {
  return isComplete(step) ? null : STEP_INFO[step].path;
}
