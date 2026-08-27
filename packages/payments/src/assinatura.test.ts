import { describe, expect, it } from 'vitest';
// Importa o arquivo que as Edge Functions realmente usam. Copiar a logica
// para ca daria um teste verde sobre uma copia — e a copia e justamente o que
// nao pode divergir: uma assinatura que confere no teste e nao em producao e
// um webhook que recusa pagamento de verdade.
import {
  assinar,
  conferir,
  TOLERANCIA_SEGUNDOS,
} from '../../../supabase/functions/_shared/assinatura.ts';

/**
 * Este arquivo protege o único ponto do sistema em que "não" precisa ser
 * definitivo: um webhook que aceita evento forjado confirma pedidos que
 * ninguém pagou.
 */

const SEGREDO = 'segredo-de-teste-do-webhook';
const CORPO = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded' });
const AGORA = 1_800_000_000;

describe('assinatura do webhook', () => {
  it('aceita o que ela mesma assinou', async () => {
    const cabecalho = await assinar(CORPO, SEGREDO, AGORA);

    await expect(conferir(CORPO, cabecalho, SEGREDO, AGORA)).resolves.toEqual({ valida: true });
  });

  it('recusa quando o corpo muda um byte', async () => {
    const cabecalho = await assinar(CORPO, SEGREDO, AGORA);
    const adulterado = CORPO.replace('payment.succeeded', 'payment.captured');

    await expect(conferir(adulterado, cabecalho, SEGREDO, AGORA)).resolves.toEqual({
      valida: false,
      motivo: 'nao_confere',
    });
  });

  it('recusa com o segredo errado', async () => {
    const cabecalho = await assinar(CORPO, SEGREDO, AGORA);

    await expect(conferir(CORPO, cabecalho, 'outro-segredo', AGORA)).resolves.toEqual({
      valida: false,
      motivo: 'nao_confere',
    });
  });

  it('recusa sem cabecalho', async () => {
    await expect(conferir(CORPO, null, SEGREDO, AGORA)).resolves.toEqual({
      valida: false,
      motivo: 'ausente',
    });
  });

  it('recusa cabecalho sem v1 ou sem t', async () => {
    await expect(conferir(CORPO, 't=123', SEGREDO, AGORA)).resolves.toMatchObject({
      motivo: 'malformado',
    });
    await expect(conferir(CORPO, 'v1=abc', SEGREDO, AGORA)).resolves.toMatchObject({
      motivo: 'malformado',
    });
  });

  it('recusa evento velho — a janela de replay fecha aqui', async () => {
    const cabecalho = await assinar(CORPO, SEGREDO, AGORA);
    const tarde = AGORA + TOLERANCIA_SEGUNDOS + 1;

    await expect(conferir(CORPO, cabecalho, SEGREDO, tarde)).resolves.toEqual({
      valida: false,
      motivo: 'expirado',
    });
  });

  it('recusa evento do futuro: relogio adiantado do outro lado tambem e suspeito', async () => {
    const cabecalho = await assinar(CORPO, SEGREDO, AGORA + TOLERANCIA_SEGUNDOS + 1);

    await expect(conferir(CORPO, cabecalho, SEGREDO, AGORA)).resolves.toMatchObject({
      motivo: 'expirado',
    });
  });

  it('nao aceita o mesmo v1 com outro t — o timestamp entra no que e assinado', async () => {
    const cabecalho = await assinar(CORPO, SEGREDO, AGORA);
    const v1 = cabecalho.split('v1=')[1];

    // Um atacante que capturou o evento tenta renovar o timestamp para burlar
    // a tolerancia, mantendo a assinatura. Nao funciona.
    await expect(conferir(CORPO, `t=${AGORA + 10},v1=${v1}`, SEGREDO, AGORA + 10)).resolves.toEqual(
      { valida: false, motivo: 'nao_confere' },
    );
  });

  it('assina de forma estavel: mesmo corpo e mesmo t dao a mesma assinatura', async () => {
    const a = await assinar(CORPO, SEGREDO, AGORA);
    const b = await assinar(CORPO, SEGREDO, AGORA);

    expect(a).toBe(b);
  });
});
