import { describe, expect, it } from 'vitest';
import { formatar, soletrar } from './flyId';

describe('apresentacao do Fly ID', () => {
  it('parte o codigo ao meio para ficar mais facil de ditar', () => {
    expect(formatar('TTA7Q4S7HR')).toBe('TTA7Q 4S7HR');
  });

  it('lida com comprimento impar sem perder caractere', () => {
    const saida = formatar('ABCDE');
    expect(saida.replace(' ', '')).toBe('ABCDE');
  });

  it('soletra para o leitor de tela nao ler como palavra', () => {
    expect(soletrar('AB3F')).toBe('A B 3 F');
  });
});
