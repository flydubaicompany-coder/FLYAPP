import { describe, expect, it } from 'vitest';
import { PREFERENCE_FIELDS, PREFERENCE_GROUPS, SENSITIVE_FIELD_KEYS } from './catalog';

describe('catalogo de preferencias', () => {
  it('nao repete chave', () => {
    const chaves = PREFERENCE_FIELDS.map((f) => f.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('usa chaves no formato que a constraint do banco aceita', () => {
    for (const campo of PREFERENCE_FIELDS) {
      expect(campo.key).toMatch(/^[a-z][a-z0-9_.]{2,63}$/);
    }
  });

  it('coloca todo campo em um grupo que existe', () => {
    const grupos = new Set(PREFERENCE_GROUPS.map((g) => g.key));
    for (const campo of PREFERENCE_FIELDS) {
      expect(grupos.has(campo.group)).toBe(true);
    }
  });

  it('nao deixa grupo vazio na tela', () => {
    for (const grupo of PREFERENCE_GROUPS) {
      expect(PREFERENCE_FIELDS.some((f) => f.group === grupo.key)).toBe(true);
    }
  });

  it('marca como sensivel exatamente o que e dado de saude', () => {
    for (const chave of SENSITIVE_FIELD_KEYS) {
      expect(chave.startsWith('saude.')).toBe(true);
    }
    const saude = PREFERENCE_FIELDS.filter((f) => f.group === 'saude');
    expect(saude.every((f) => f.isSensitive)).toBe(true);
  });

  it('nao marca como sensivel nada fora de saude', () => {
    const foraDeSaude = PREFERENCE_FIELDS.filter((f) => f.group !== 'saude');
    expect(foraDeSaude.every((f) => !f.isSensitive)).toBe(true);
  });

  it('avisa no grupo de saude que o dado depende de consentimento', () => {
    const grupo = PREFERENCE_GROUPS.find((g) => g.key === 'saude');
    expect(grupo?.note).toMatch(/autorizar|Privacidade/i);
  });

  it('da placeholder a todo campo — campo vazio sem exemplo nao e respondido', () => {
    for (const campo of PREFERENCE_FIELDS) {
      expect(campo.placeholder.length).toBeGreaterThan(0);
    }
  });
});
