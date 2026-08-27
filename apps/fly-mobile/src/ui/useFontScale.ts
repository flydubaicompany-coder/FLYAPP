import { useEffect, useState } from 'react';
import { AccessibilityInfo, PixelRatio } from 'react-native';
import { clampFontScale } from '@/theme';

/**
 * Escala de texto do sistema, com teto (§25.4 "tamanho de texto dinamico").
 * Sem o teto, acessibilidade maxima empurra a tab bar fora da tela.
 */
export function useFontScale(): number {
  return clampFontScale(PixelRatio.getFontScale());
}

/**
 * Preferencia de reduzir movimento (§25.4). Toda animacao consulta isto —
 * o estado final continua correto, so a transicao desaparece.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let ativo = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (ativo) setReduced(valor);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      ativo = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
