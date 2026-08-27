/**
 * Cálculo de contraste WCAG 2.1.
 *
 * A §36.1 da spec pede tokens "com contraste validado" e a §25.4 exige
 * "contraste adequado". Isso só é verificável com número — por isso o cálculo
 * vive aqui e é exercitado por teste, em vez de ser uma promessa em documento.
 *
 * Limiares WCAG AA:
 *   • texto normal        4.5:1
 *   • texto grande (>=18pt, ou >=14pt bold)  3:1
 *   • componentes de UI e ícones  3:1
 */

export const WCAG_AA = {
  normalText: 4.5,
  largeText: 3,
  uiComponent: 3,
} as const;

export const WCAG_AAA = {
  normalText: 7,
  largeText: 4.5,
} as const;

export interface Rgb {
  r: number;
  g: number;
  b: number;
  /** 0 a 1. Cores com alpha precisam ser compostas antes de medir. */
  a: number;
}

/**
 * Aceita `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb(...)` e `rgba(...)`.
 * Lança em entrada que não reconhece — falhar alto é melhor que medir errado.
 */
export function parseColor(input: string): Rgb {
  const value = input.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (hex) {
    const digits = hex[1] as string;
    if (digits.length === 3) {
      return {
        r: parseInt((digits[0] as string).repeat(2), 16),
        g: parseInt((digits[1] as string).repeat(2), 16),
        b: parseInt((digits[2] as string).repeat(2), 16),
        a: 1,
      };
    }
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = /^rgba?\(\s*([^)]+)\)$/i.exec(value);
  if (rgb) {
    const parts = (rgb[1] as string).split(/[,/\s]+/).filter(Boolean);
    const [r, g, b, a] = parts;
    return {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: a === undefined ? 1 : Number(a),
    };
  }

  throw new Error(`Cor nao reconhecida: "${input}"`);
}

/**
 * Compõe uma cor translúcida sobre um fundo opaco.
 *
 * Isto importa: metade da paleta do Fly é `rgba(245,245,247,.42)` e afins.
 * Medir contraste sem compor primeiro dá um número que não existe na tela.
 */
export function composite(foreground: Rgb, background: Rgb): Rgb {
  const alpha = foreground.a;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa, conforme a definição da WCAG. */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/**
 * Razão de contraste entre duas cores, de 1:1 a 21:1.
 * Cores com alpha são compostas sobre `background` antes da medição.
 */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background);
  if (bg.a < 1) {
    throw new Error('O fundo precisa ser opaco para medir contraste.');
  }

  const fgRaw = parseColor(foreground);
  const fg = fgRaw.a < 1 ? composite(fgRaw, bg) : fgRaw;

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Arredonda para duas casas, como as ferramentas de acessibilidade reportam. */
export function contrastRatioRounded(foreground: string, background: string): number {
  return Math.round(contrastRatio(foreground, background) * 100) / 100;
}

export type ContrastUse = 'normalText' | 'largeText' | 'uiComponent';

export function meetsAA(foreground: string, background: string, use: ContrastUse): boolean {
  return contrastRatio(foreground, background) >= WCAG_AA[use];
}
