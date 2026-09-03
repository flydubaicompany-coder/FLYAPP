import { describe, expect, it } from 'vitest';
import { espera, lerAlvos, media, minutosEntre } from './tempo';

describe('minutosEntre', () => {
  it('mede até o instante informado', () => {
    expect(minutosEntre('2026-09-03T10:00:00Z', '2026-09-03T10:42:00Z')).toBe(42);
  });

  it('mede até agora quando o fim é nulo', () => {
    const agora = new Date('2026-09-03T10:30:00Z');
    expect(minutosEntre('2026-09-03T10:00:00Z', null, agora)).toBe(30);
  });

  // Relógio do cliente atrasado não vira "esperando -3 min" na tela.
  it('nunca devolve negativo', () => {
    expect(minutosEntre('2026-09-03T10:00:00Z', '2026-09-03T09:50:00Z')).toBe(0);
  });
});

describe('espera', () => {
  it('mostra minutos, horas e dias', () => {
    expect(espera(0)).toBe('agora');
    expect(espera(1)).toBe('1 min');
    expect(espera(59)).toBe('59 min');
    expect(espera(60)).toBe('1 h');
    expect(espera(125)).toBe('2 h 5 min');
    expect(espera(1440)).toBe('1 dia');
    expect(espera(2880)).toBe('2 dias');
  });
});

describe('media', () => {
  it('não inventa média de nada', () => {
    expect(media([])).toBeNull();
  });

  it('arredonda para minuto inteiro', () => {
    expect(media([1, 2])).toBe(2);
    expect(media([10, 20, 30])).toBe(20);
  });
});

describe('lerAlvos', () => {
  it('não inventa prazo quando a configuração está PENDENTE', () => {
    expect(lerAlvos('PENDENTE')).toBeNull();
    expect(lerAlvos(null)).toBeNull();
    expect(lerAlvos([])).toBeNull();
    expect(lerAlvos({})).toBeNull();
  });

  it('objeto sem número útil também não é prazo', () => {
    expect(lerAlvos({ sos: { accept: 'já' } })).toBeNull();
  });

  it('lê o que está declarado e deixa o resto nulo', () => {
    const alvos = lerAlvos({ sos: { accept: 5, first_response: 10 }, urgent: { accept: 30 } });
    expect(alvos).not.toBeNull();
    expect(alvos?.sos).toEqual({ aceite: 5, primeiraResposta: 10 });
    expect(alvos?.urgent).toEqual({ aceite: 30, primeiraResposta: null });
    expect(alvos?.chat).toEqual({ aceite: null, primeiraResposta: null });
  });

  it('recusa minuto negativo', () => {
    expect(lerAlvos({ sos: { accept: -1 } })).toBeNull();
  });
});
