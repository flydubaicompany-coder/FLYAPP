import { describe, expect, it } from 'vitest';
import { ehFalhaDeRede } from './falha';

describe('ehFalhaDeRede', () => {
  it('reconhece a falha de cada plataforma', () => {
    expect(ehFalhaDeRede(new TypeError('Failed to fetch'))).toBe(true);
    expect(ehFalhaDeRede({ message: 'Network request failed' })).toBe(true);
    expect(ehFalhaDeRede({ message: 'Load failed' })).toBe(true);
    expect(ehFalhaDeRede('NetworkError when attempting to fetch resource.')).toBe(true);
  });

  // Estes precisam continuar sendo erro de verdade: mostrar "você está
  // offline" para uma recusa de RLS esconderia um problema de permissão.
  it('não confunde erro do servidor com falta de conexão', () => {
    expect(ehFalhaDeRede({ message: 'new row violates row-level security policy' })).toBe(false);
    expect(ehFalhaDeRede({ message: 'permission denied for table support_cases' })).toBe(false);
    expect(ehFalhaDeRede(null)).toBe(false);
    expect(ehFalhaDeRede({})).toBe(false);
    expect(ehFalhaDeRede('')).toBe(false);
  });
});
