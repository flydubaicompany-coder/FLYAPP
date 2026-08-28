import { describe, expect, it } from 'vitest';
import { flyPackage } from '@fly/design-tokens';
import { ROTULO_PACOTE, ehPacote } from './pacote';

/**
 * O selo do pacote (D120). O dono foi explicito: Standard **azul**, Black
 * **branco**, Billionaire **dourado** — e isso nao pode escorregar sem
 * alguem perceber.
 */

describe('ehPacote', () => {
  it('aceita os tres pacotes', () => {
    expect(ehPacote('standard')).toBe(true);
    expect(ehPacote('black')).toBe(true);
    expect(ehPacote('billionaire')).toBe(true);
  });

  it('recusa nivel de pontos, que e outra escala (D95)', () => {
    // basic, prime e elite sao nivel; standard, black e billionaire sao
    // pacote. Confundir os dois foi o bug que a D95 corrigiu.
    expect(ehPacote('prime')).toBe(false);
    expect(ehPacote('elite')).toBe(false);
    expect(ehPacote(null)).toBe(false);
    expect(ehPacote('')).toBe(false);
  });
});

describe('cores do pacote', () => {
  it('Standard e azul', () => {
    expect(flyPackage.standard.dot).toBe('#5B8CFF');
  });

  it('Black e branco', () => {
    expect(flyPackage.black.dot).toBe('#F5F5F7');
  });

  it('Billionaire e dourado', () => {
    expect(flyPackage.billionaire.dot).toBe('#DFC98A');
  });

  it('os tres sao distintos: um selo que nao distingue nao e selo', () => {
    const pontos = [flyPackage.standard.dot, flyPackage.black.dot, flyPackage.billionaire.dot];
    expect(new Set(pontos).size).toBe(3);
  });
});

describe('rotulos', () => {
  it('mostram o nome do pacote em caixa alta', () => {
    expect(ROTULO_PACOTE.standard).toBe('STANDARD');
    expect(ROTULO_PACOTE.black).toBe('FLY BLACK');
    expect(ROTULO_PACOTE.billionaire).toBe('BILLIONAIRE');
  });
});
