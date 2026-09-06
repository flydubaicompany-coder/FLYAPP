import { describe, expect, it } from 'vitest';
import { celula, paraCsv } from './csv';

describe('celula', () => {
  it('poe tudo entre aspas', () => {
    expect(celula('Marina')).toBe('"Marina"');
  });

  it('dobra a aspa de dentro', () => {
    expect(celula('Hotel "Palm"')).toBe('"Hotel ""Palm"""');
  });

  it('nulo vira vazio, e nao a palavra null', () => {
    expect(celula(null)).toBe('""');
    expect(celula(undefined)).toBe('""');
  });

  it('objeto vira JSON — e o JSON tambem tem as aspas dobradas', () => {
    expect(celula({ antes: 'PENDENTE' })).toBe('"{""antes"":""PENDENTE""}"');
  });

  it('numero e booleano saem legiveis', () => {
    expect(celula(0)).toBe('"0"');
    expect(celula(false)).toBe('"false"');
  });
});

describe('paraCsv', () => {
  it('lista vazia vira arquivo vazio, e nao um cabecalho sozinho', () => {
    expect(paraCsv([])).toBe('');
  });

  it('cabecalho vem da primeira linha', () => {
    expect(paraCsv([{ acao: 'papel.concedido', quem: 'Ana' }])).toBe(
      '"acao","quem"\n"papel.concedido","Ana"',
    );
  });

  /**
   * O caso que motiva o arquivo: uma observacao com quebra de linha.
   *
   * Sem as aspas, a planilha le uma linha a mais e ninguem repara — o total
   * bate, o numero de linhas nao, e a conferencia acontece semanas depois.
   */
  it('quebra de linha no valor nao vira linha nova', () => {
    const csv = paraCsv([{ nota: 'primeira\nsegunda' }]);
    expect(csv).toBe('"nota"\n"primeira\nsegunda"');
    expect(csv.split('"').length).toBe(5);
  });

  it('coluna que falta numa linha sai vazia, sem deslocar o arquivo', () => {
    expect(paraCsv([{ a: 1, b: 2 }, { a: 3 }])).toBe('"a","b"\n"1","2"\n"3",""');
  });

  it('virgula no valor nao cria coluna', () => {
    expect(paraCsv([{ nome: 'Silva, Marina' }])).toBe('"nome"\n"Silva, Marina"');
  });
});
