import { describe, expect, it } from 'vitest';
import { slugValido, sugerirSlug } from './slug';

describe('sugerirSlug', () => {
  it('tira acento, espaco e maiuscula', () => {
    expect(sugerirSlug('Cêia no Deserto — Pôr do Sol')).toBe('ceia-no-deserto-por-do-sol');
  });

  it('nao deixa hifen sobrando nas pontas', () => {
    expect(sugerirSlug('  ...At The Top!!!  ')).toBe('at-the-top');
  });

  it('prefixa titulo que comeca com numero, porque o banco exige letra', () => {
    expect(sugerirSlug('360 graus no Burj')).toBe('p-360-graus-no-burj');
  });

  it('devolve vazio quando nao sobra nada aproveitavel', () => {
    expect(sugerirSlug('!!! ???')).toBe('');
  });

  it('respeita o limite de 64 sem terminar em hifen', () => {
    const s = sugerirSlug('a'.repeat(60) + ' ' + 'b'.repeat(20));
    expect(s.length).toBeLessThanOrEqual(64);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('slugValido', () => {
  it('aceita o que o gerador produz', () => {
    expect(slugValido(sugerirSlug('Chá da Tarde no Burj Al Arab'))).toBe(true);
  });

  it('recusa maiuscula, espaco, acento e comeco com numero', () => {
    expect(slugValido('At The Top')).toBe(false);
    expect(slugValido('ceia-no-deserto-ç')).toBe(false);
    expect(slugValido('360-graus')).toBe(false);
    expect(slugValido('a')).toBe(false);
  });
});
