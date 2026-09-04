import { describe, expect, it } from 'vitest';
import {
  NIVEIS_DE_ATENDIMENTO,
  PESO_DO_NIVEL,
  SITUACOES_EM_ABERTO,
  estaEmAberto,
  ordenarFila,
  type NaFila,
} from './atendimento';

describe('prioridade', () => {
  it('SOS vem antes de urgente, que vem antes de conversa', () => {
    expect(PESO_DO_NIVEL.sos).toBeGreaterThan(PESO_DO_NIVEL.urgent);
    expect(PESO_DO_NIVEL.urgent).toBeGreaterThan(PESO_DO_NIVEL.chat);
  });

  // O peso sai da posição na lista. Se alguém trocar a ordem da lista sem
  // querer, é aqui que aparece.
  it('todo nível tem peso', () => {
    for (const nivel of NIVEIS_DE_ATENDIMENTO) {
      expect(PESO_DO_NIVEL[nivel]).toBeGreaterThan(0);
    }
  });
});

describe('ordenarFila', () => {
  const casos: NaFila[] = [
    { nivel: 'chat', abertoEm: '2026-09-03T08:00:00Z' },
    { nivel: 'sos', abertoEm: '2026-09-03T12:00:00Z' },
    { nivel: 'urgent', abertoEm: '2026-09-03T10:00:00Z' },
    { nivel: 'sos', abertoEm: '2026-09-03T11:00:00Z' },
  ];

  it('urgência primeiro, e dentro dela quem espera há mais tempo', () => {
    expect(ordenarFila(casos).map((c) => `${c.nivel}@${c.abertoEm.slice(11, 16)}`)).toEqual([
      'sos@11:00',
      'sos@12:00',
      'urgent@10:00',
      'chat@08:00',
    ]);
  });

  // A tela costuma ter outra lista apontando para os mesmos objetos.
  it('não mexe no array recebido', () => {
    const original = [...casos];
    ordenarFila(casos);
    expect(casos).toEqual(original);
  });

  it('lista vazia continua vazia', () => {
    expect(ordenarFila([])).toEqual([]);
  });
});

describe('estaEmAberto', () => {
  it('resolvido e encerrado saem da fila', () => {
    expect(estaEmAberto('resolved')).toBe(false);
    expect(estaEmAberto('closed')).toBe(false);
  });

  it('o resto continua pedindo alguém', () => {
    for (const s of SITUACOES_EM_ABERTO) {
      expect(estaEmAberto(s)).toBe(true);
    }
  });
});
