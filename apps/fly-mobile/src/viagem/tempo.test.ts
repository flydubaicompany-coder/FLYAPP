import { describe, expect, it } from 'vitest';
import { dataCurta, faltam, hora, saidaEminente } from './tempo';

/**
 * Estes testes existem porque, na máquina de quem escreve o app, o fuso do
 * aparelho e o do destino costumam ser o mesmo — e aí a conta errada passa
 * despercebida até alguém desembarcar.
 */

const DUBAI = 'Asia/Dubai'; // UTC+4, sem horário de verão
const SP = 'America/Sao_Paulo'; // UTC-3

describe('horario no fuso do destino', () => {
  it('mostra a hora de Dubai, e nao a do aparelho', () => {
    // 16h UTC = 20h em Dubai = 13h em São Paulo.
    expect(hora('2026-09-12T16:00:00Z', DUBAI)).toBe('20:00');
    expect(hora('2026-09-12T16:00:00Z', SP)).toBe('13:00');
  });

  it('vira o dia corretamente', () => {
    // 21h UTC do dia 12 ja e 01h do dia 13 em Dubai.
    expect(hora('2026-09-12T21:00:00Z', DUBAI)).toBe('01:00');
    expect(dataCurta('2026-09-12T21:00:00Z', DUBAI)).toContain('13');
    expect(dataCurta('2026-09-12T21:00:00Z', SP)).toContain('12');
  });

  it('devolve nulo em vez de inventar', () => {
    expect(hora(null, DUBAI)).toBeNull();
    expect(hora('nao e data', DUBAI)).toBeNull();
    expect(dataCurta(null, DUBAI)).toBeNull();
  });
});

describe('contagem regressiva', () => {
  const agora = new Date('2026-09-12T12:00:00Z');

  it('conta em minutos abaixo de uma hora', () => {
    expect(faltam('2026-09-12T12:40:00Z', agora)).toBe('em 40 min');
  });

  it('conta em horas acima de uma hora', () => {
    expect(faltam('2026-09-12T15:00:00Z', agora)).toBe('em 3h');
    expect(faltam('2026-09-12T15:30:00Z', agora)).toBe('em 3h30');
  });

  it('para de contar horas depois de um dia', () => {
    expect(faltam('2026-09-13T18:00:00Z', agora)).toBe('amanhã');
    expect(faltam('2026-09-15T12:00:00Z', agora)).toBe('em 3 dias');
  });

  it('o que ja comecou e "agora", nao um numero negativo', () => {
    expect(faltam('2026-09-12T11:00:00Z', agora)).toBe('agora');
  });

  it('devolve nulo sem data', () => {
    expect(faltam(null, agora)).toBeNull();
  });
});

describe('janela de saida', () => {
  const agora = new Date('2026-09-12T12:00:00Z');

  it('destaca a saida dentro da janela', () => {
    expect(saidaEminente('2026-09-12T13:30:00Z', agora)).toBe(true);
  });

  it('nao destaca saida distante', () => {
    expect(saidaEminente('2026-09-14T13:30:00Z', agora)).toBe(false);
  });

  // Uma saída que passou há cinco minutos ainda é a informação mais útil da
  // tela — quem está atrasado precisa vê-la, não perdê-la.
  it('continua destacando logo depois da hora', () => {
    expect(saidaEminente('2026-09-12T11:55:00Z', agora)).toBe(true);
  });

  it('deixa de destacar bem depois', () => {
    expect(saidaEminente('2026-09-12T11:00:00Z', agora)).toBe(false);
  });

  it('sem saida definida, nao destaca', () => {
    expect(saidaEminente(null, agora)).toBe(false);
  });
});
