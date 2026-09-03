import { describe, expect, it } from 'vitest';
import { lerContatos, serializarContatos, type ContatosSalvos } from './cache';

const CONTATOS: ContatosSalvos = {
  emergencia: '999',
  aviso: 'O SOS da Fly não substitui os serviços públicos de emergência.',
  bases: [{ nome: 'Base Aeroporto', telefone: '+971000000', endereco: 'Terminal 3' }],
  salvoEm: '2026-09-03T10:00:00.000Z',
};

describe('cache de contatos', () => {
  it('vai e volta inteiro', () => {
    expect(lerContatos(serializarContatos(CONTATOS))).toEqual(CONTATOS);
  });

  it('recusa qualquer coisa que não seja o formato esperado', () => {
    expect(lerContatos(null)).toBeNull();
    expect(lerContatos('')).toBeNull();
    expect(lerContatos('não é json')).toBeNull();
    expect(lerContatos('[]')).toBeNull();
    expect(lerContatos('{"emergencia":"999"}')).toBeNull(); // sem salvoEm
  });

  // Um cache sem nenhum telefone diria "salvo" e não teria o que discar.
  it('não guarda cache que não dá para discar', () => {
    expect(
      lerContatos(
        JSON.stringify({
          emergencia: null,
          aviso: 'oi',
          bases: [],
          salvoEm: '2026-09-03T10:00:00Z',
        }),
      ),
    ).toBeNull();
  });

  it('sobrevive a base malformada de uma versão antiga', () => {
    const c = lerContatos(
      JSON.stringify({
        emergencia: '999',
        bases: [{ telefone: '+9710000' }, null, 'lixo'],
        salvoEm: '2026-09-03T10:00:00Z',
      }),
    );
    expect(c?.bases).toEqual([{ nome: 'Base Fly', telefone: '+9710000', endereco: null }]);
  });
});
