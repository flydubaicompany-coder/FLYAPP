import { describe, expect, it } from 'vitest';
import { dataMrz, digitoVerificador, linhasMrz, normalizar } from './mrz';

describe('normalizar', () => {
  it('tira acento e deixa so A-Z', () => {
    expect(normalizar('João Conceição')).toBe('JOAO<CONCEICAO');
  });
  it('numero e pontuacao viram preenchimento', () => {
    expect(normalizar("O'Brien-2")).toBe('O<BRIEN<<');
  });
});

describe('digitoVerificador', () => {
  /**
   * Os tres exemplos da propria norma ICAO 9303. Se um deles quebrar, o que
   * esta errado e a conta — nao o teste.
   */
  it('confere com os exemplos da norma', () => {
    expect(digitoVerificador('520727')).toBe(3);
    expect(digitoVerificador('AB2134<<<')).toBe(5);
    expect(digitoVerificador('W620126G')).toBe(9);
  });
  it('preenchimento vale zero', () => {
    expect(digitoVerificador('<<<<<<')).toBe(0);
  });
});

describe('dataMrz', () => {
  it('YYYY-MM-DD vira YYMMDD', () => {
    expect(dataMrz('2029-09-12')).toBe('290912');
  });
  it('sem data, preenchimento — e nao uma data inventada', () => {
    expect(dataMrz(null)).toBe('<<<<<<');
  });
});

describe('linhasMrz', () => {
  const base = {
    nomeCompleto: 'Rafael Mendes Oliveira',
    numero: 'FN482913',
    paisEmissor: 'BRA',
    nacionalidade: 'BRA',
    nascimento: '1988-03-14',
    validade: '2029-09-12',
  };

  it('as duas linhas tem 44 caracteres, como a norma exige', () => {
    const [a, b] = linhasMrz(base);
    expect(a).toHaveLength(44);
    expect(b).toHaveLength(44);
  });

  it('o sobrenome vem primeiro, separado por dois sinais', () => {
    expect(linhasMrz(base)[0]).toBe('P<BRAOLIVEIRA<<RAFAEL<MENDES<<<<<<<<<<<<<<<<');
  });

  it('comeca com P< e o pais emissor', () => {
    expect(linhasMrz(base)[0].startsWith('P<BRA')).toBe(true);
  });

  /**
   * O sexo nao e inventado.
   *
   * O projeto nao guarda a informacao, e a norma reserva `<` para isso. Um `M`
   * fixo seria um dado de documento fabricado.
   */
  it('o campo de sexo fica em branco, e nao em M', () => {
    const linha = linhasMrz(base)[1];
    expect(linha[20]).toBe('<');
  });

  it('sem data de nascimento, o campo vira preenchimento', () => {
    const linha = linhasMrz({ ...base, nascimento: null })[1];
    expect(linha.slice(13, 19)).toBe('<<<<<<');
  });

  it('nome de uma palavra so nao quebra', () => {
    const [a] = linhasMrz({ ...base, nomeCompleto: 'Madonna' });
    expect(a).toContain('MADONNA');
    expect(a).toHaveLength(44);
  });
});
