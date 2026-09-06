import { describe, expect, it } from 'vitest';
import {
  alertasDoRoteiro,
  faltaTexto,
  proximoCompromisso,
  type AtividadeParaAlerta,
} from './alertas';

const AGORA = new Date('2026-09-12T10:00:00');

function atividade(p: Partial<AtividadeParaAlerta> & { id: string }): AtividadeParaAlerta {
  return {
    titulo: 'Atividade',
    saidaEm: null,
    comecaEm: null,
    local: null,
    levar: null,
    instrucoes: null,
    mudouEm: null,
    notaDaMudanca: null,
    ...p,
  };
}

describe('faltaTexto', () => {
  it('minutos, horas e a virada', () => {
    expect(faltaTexto(45)).toBe('em 45 minutos');
    expect(faltaTexto(1)).toBe('em 1 minuto');
    expect(faltaTexto(120)).toBe('em 2h');
    expect(faltaTexto(130)).toBe('em 2h10');
    expect(faltaTexto(0)).toBe('agora');
    expect(faltaTexto(-5)).toBe('agora');
  });
});

describe('alertasDoRoteiro', () => {
  it('o compromisso de daqui a 45 minutos vira AGORA', () => {
    const a = alertasDoRoteiro(
      [
        atividade({
          id: 'a1',
          titulo: 'Desert Safari',
          saidaEm: '2026-09-12T10:45:00',
          local: 'Lobby',
        }),
      ],
      AGORA,
    );
    expect(a[0]?.nivel).toBe('agora');
    expect(a[0]?.corpo).toBe('Desert Safari em 45 minutos — Lobby.');
  });

  /**
   * A tolerancia existe para quem se atrasou.
   *
   * Sumir com o alerta na hora exata da saida e o pior momento possivel: e
   * exatamente quando a pessoa esta correndo e precisa saber para onde.
   */
  it('continua valendo por meia hora depois da saida', () => {
    const a = alertasDoRoteiro(
      [atividade({ id: 'a1', titulo: 'Jet Ski', saidaEm: '2026-09-12T09:40:00' })],
      AGORA,
    );
    expect(a[0]?.nivel).toBe('agora');
    expect(a[0]?.corpo).toContain('agora');
  });

  it('e some depois disso', () => {
    const a = alertasDoRoteiro([atividade({ id: 'a1', saidaEm: '2026-09-12T09:00:00' })], AGORA);
    expect(a).toHaveLength(0);
  });

  it('mais tarde no mesmo dia vira HOJE, com a hora', () => {
    const a = alertasDoRoteiro(
      [atividade({ id: 'a1', titulo: 'Jantar no Atlantis', comecaEm: '2026-09-12T20:00:00' })],
      AGORA,
    );
    expect(a[0]?.nivel).toBe('hoje');
    expect(a[0]?.corpo).toBe('Hoje às 20:00: Jantar no Atlantis.');
  });

  it('amanha vira AMANHA', () => {
    const a = alertasDoRoteiro(
      [atividade({ id: 'a1', titulo: 'Aquaventure', comecaEm: '2026-09-13T10:00:00' })],
      AGORA,
    );
    expect(a[0]?.corpo).toBe('Amanhã às 10:00 temos Aquaventure.');
  });

  it('depois de amanha nao gera alerta — ainda nao e assunto', () => {
    expect(
      alertasDoRoteiro([atividade({ id: 'a1', comecaEm: '2026-09-15T10:00:00' })], AGORA),
    ).toHaveLength(0);
  });

  /**
   * O app NAO deduz o que levar.
   *
   * "Leve seu passaporte" so aparece porque alguem da operacao escreveu isso
   * em `what_to_bring`. E a regra da §33 aplicada a um texto de tela.
   */
  it('IMPORTANTE repete o que a operacao escreveu, e nada alem', () => {
    const a = alertasDoRoteiro(
      [
        atividade({
          id: 'a1',
          titulo: 'Passeio de barco',
          comecaEm: '2026-09-12T18:00:00',
          levar: 'Leve seu passaporte.',
        }),
      ],
      AGORA,
    );
    expect(a.some((x) => x.corpo === 'Passeio de barco: Leve seu passaporte.')).toBe(true);
  });

  it('sem orientacao escrita, nao ha alerta IMPORTANTE', () => {
    const a = alertasDoRoteiro([atividade({ id: 'a1', comecaEm: '2026-09-12T18:00:00' })], AGORA);
    expect(a.every((x) => x.nivel !== 'importante')).toBe(true);
  });

  it('mudanca recente aparece mesmo para atividade distante', () => {
    const a = alertasDoRoteiro(
      [
        atividade({
          id: 'a1',
          titulo: 'City tour',
          comecaEm: '2026-09-16T09:00:00',
          mudouEm: '2026-09-12T08:00:00',
          notaDaMudanca: 'Novo ponto de encontro.',
        }),
      ],
      AGORA,
    );
    expect(a[0]?.nivel).toBe('mudou');
    expect(a[0]?.corpo).toBe('City tour: Novo ponto de encontro.');
  });

  it('mudanca velha para de ser noticia', () => {
    const a = alertasDoRoteiro(
      [
        atividade({
          id: 'a1',
          comecaEm: '2026-09-16T09:00:00',
          mudouEm: '2026-09-08T08:00:00',
          notaDaMudanca: 'Mudou faz tempo.',
        }),
      ],
      AGORA,
    );
    expect(a).toHaveLength(0);
  });

  it('AGORA vem antes de tudo, e AMANHA por ultimo', () => {
    const a = alertasDoRoteiro(
      [
        atividade({ id: 'a3', titulo: 'C', comecaEm: '2026-09-13T10:00:00' }),
        atividade({ id: 'a1', titulo: 'A', saidaEm: '2026-09-12T10:30:00' }),
        atividade({ id: 'a2', titulo: 'B', comecaEm: '2026-09-12T20:00:00' }),
      ],
      AGORA,
    );
    expect(a.map((x) => x.nivel)).toEqual(['agora', 'hoje', 'amanha']);
  });

  it('data invalida nao derruba a lista', () => {
    const a = alertasDoRoteiro([atividade({ id: 'a1', comecaEm: 'nao-e-data' })], AGORA);
    expect(a).toHaveLength(0);
  });
});

describe('proximoCompromisso', () => {
  it('e o mais proximo que ainda nao venceu', () => {
    const p = proximoCompromisso(
      [
        atividade({ id: 'tarde', titulo: 'Tarde', comecaEm: '2026-09-12T20:00:00' }),
        atividade({ id: 'ja-foi', titulo: 'Passou', comecaEm: '2026-09-12T06:00:00' }),
        atividade({ id: 'logo', titulo: 'Logo', saidaEm: '2026-09-12T10:45:00' }),
      ],
      AGORA,
    );
    expect(p?.id).toBe('logo');
  });

  it('sem nada a frente, devolve null — a Home mostra outra coisa', () => {
    expect(
      proximoCompromisso([atividade({ id: 'x', comecaEm: '2026-09-11T10:00:00' })], AGORA),
    ).toBeNull();
  });
});
