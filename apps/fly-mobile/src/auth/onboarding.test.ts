import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  STEP_INFO,
  VISIBLE_STEPS,
  canNavigateTo,
  isComplete,
  isOnboardingStep,
  nextStep,
  previousStep,
  resumePath,
  stepProgress,
} from './onboarding';

describe('etapas do onboarding', () => {
  it('reconhece etapa valida e recusa invento', () => {
    expect(isOnboardingStep('preferences')).toBe(true);
    expect(isOnboardingStep('pagamento')).toBe(false);
  });

  it('descreve toda etapa, sem sobrar nenhuma', () => {
    expect(Object.keys(STEP_INFO).sort()).toEqual([...ONBOARDING_STEPS].sort());
  });

  it('termina em done, e done nao aparece na barra de progresso', () => {
    expect(ONBOARDING_STEPS.at(-1)).toBe('done');
    expect(VISIBLE_STEPS).not.toContain('done');
  });

  it('coloca privacidade antes do fim — ninguem entra sem decidir sobre os proprios dados', () => {
    const i = ONBOARDING_STEPS.indexOf('consents');
    expect(i).toBeGreaterThan(-1);
    expect(i).toBe(ONBOARDING_STEPS.length - 2);
  });
});

describe('avancar e voltar', () => {
  it('avanca uma etapa por vez', () => {
    expect(nextStep('invited')).toBe('account');
    expect(nextStep('consents')).toBe('done');
  });

  it('nao passa do fim', () => {
    expect(nextStep('done')).toBe('done');
  });

  it('volta uma etapa por vez e nao passa do inicio', () => {
    expect(previousStep('identity')).toBe('account');
    expect(previousStep('invited')).toBe('invited');
  });

  it('cresce o progresso de 0 a 1', () => {
    expect(stepProgress('invited')).toBe(0);
    expect(stepProgress('done')).toBe(1);
    expect(stepProgress('preferences')).toBeGreaterThan(stepProgress('account'));
  });
});

describe('navegacao permitida', () => {
  it('deixa voltar para qualquer etapa ja vista', () => {
    expect(canNavigateTo('consents', 'account')).toBe(true);
    expect(canNavigateTo('consents', 'invited')).toBe(true);
  });

  it('deixa avancar apenas para a proxima', () => {
    expect(canNavigateTo('account', 'identity')).toBe(true);
    expect(canNavigateTo('account', 'preferences')).toBe(false);
  });

  it('impede pular a privacidade por deep link', () => {
    expect(canNavigateTo('identity', 'done')).toBe(false);
    expect(canNavigateTo('preferences', 'done')).toBe(false);
  });

  it('permite ficar onde esta', () => {
    expect(canNavigateTo('identity', 'identity')).toBe(true);
  });
});

describe('retomar', () => {
  it('devolve a rota da etapa pendente', () => {
    expect(resumePath('preferences')).toBe(STEP_INFO.preferences.path);
  });

  it('devolve null quando acabou — o destino passa a ser o app', () => {
    expect(resumePath('done')).toBeNull();
    expect(isComplete('done')).toBe(true);
  });

  it('so preferencias pode ser pulada', () => {
    const puláveis = ONBOARDING_STEPS.filter((s) => STEP_INFO[s].skippable);
    expect(puláveis).toEqual(['preferences']);
  });
});
