import { describe, expect, it } from 'vitest';
import {
  deIso,
  estaValido,
  folgaEmDias,
  normalizarNumero,
  paraIso,
  validar,
  type DadosDoPassaporte,
} from './passaporte';

/**
 * Não há OCR neste fluxo: a pessoa digita. Então o teste cobre o que a
 * digitação erra — número com espaço, data impossível, passaporte vencido.
 */

const HOJE = new Date('2026-08-25T12:00:00Z');

function dados(p: Partial<DadosDoPassaporte> = {}): DadosDoPassaporte {
  return {
    nomeCompleto: 'VICTOR DA SILVA',
    numero: 'AB123456',
    paisEmissor: 'BRA',
    nacionalidade: '',
    nascimento: '',
    emissao: '',
    validade: '01/10/2030',
    ...p,
  };
}

describe('normalizacao do numero', () => {
  it('tira espaco, hifen e caixa', () => {
    expect(normalizarNumero('ab 123-456')).toBe('AB123456');
  });

  // A mesma regra roda num gatilho do Postgres. Se divergirem, a pessoa vê o
  // que digitou e recebe um erro de duplicata que não explica nada.
  it('duas formatacoes do mesmo documento normalizam igual', () => {
    expect(normalizarNumero('AB-123-456')).toBe(normalizarNumero('ab 123 456'));
  });
});

describe('datas', () => {
  it('converte dd/mm/aaaa para ISO', () => {
    expect(paraIso('01/10/2030')).toBe('2030-10-01');
  });

  it('recusa dia que nao existe', () => {
    // `new Date('2026-02-31')` vira 3 de março em vez de lançar.
    expect(paraIso('31/02/2026')).toBeNull();
    expect(paraIso('32/01/2026')).toBeNull();
  });

  it('recusa formato errado', () => {
    expect(paraIso('2030-10-01')).toBeNull();
    expect(paraIso('1/10/2030')).toBeNull();
    expect(paraIso('')).toBeNull();
  });

  it('volta para dd/mm/aaaa', () => {
    expect(deIso('2030-10-01')).toBe('01/10/2030');
    expect(deIso(null)).toBe('');
  });
});

describe('validacao', () => {
  it('aceita o preenchimento minimo', () => {
    expect(estaValido(validar(dados(), HOJE))).toBe(true);
  });

  it('recusa passaporte vencido', () => {
    const e = validar(dados({ validade: '01/01/2020' }), HOJE);
    expect(e.validade).toContain('venceu');
  });

  it('recusa numero curto, mesmo com formatacao', () => {
    expect(validar(dados({ numero: 'A-1' }), HOJE).numero).toBeTruthy();
  });

  it('exige sigla de tres letras no pais', () => {
    expect(validar(dados({ paisEmissor: 'Brasil' }), HOJE).paisEmissor).toContain('BRA');
    expect(validar(dados({ paisEmissor: 'BR' }), HOJE).paisEmissor).toBeTruthy();
  });

  it('nacionalidade em branco e valida', () => {
    expect(validar(dados({ nacionalidade: '' }), HOJE).nacionalidade).toBeUndefined();
  });

  it('recusa emissao posterior a validade', () => {
    const e = validar(dados({ emissao: '01/11/2030', validade: '01/10/2030' }), HOJE);
    expect(e.emissao).toContain('anterior');
  });

  it('recusa nascimento no futuro', () => {
    expect(validar(dados({ nascimento: '01/01/2030' }), HOJE).nascimento).toContain('futuro');
  });

  it('recusa nome vazio', () => {
    expect(validar(dados({ nomeCompleto: '  ' }), HOJE).nomeCompleto).toBeTruthy();
  });
});

describe('folga depois da viagem', () => {
  it('conta os dias entre a validade e o fim da viagem', () => {
    expect(folgaEmDias('2026-12-31', '2026-09-17')).toBe(105);
  });

  it('devolve negativo quando vence antes do fim', () => {
    expect(folgaEmDias('2026-09-10', '2026-09-17')).toBe(-7);
  });
});
