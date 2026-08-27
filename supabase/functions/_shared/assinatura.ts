/**
 * Assinatura de webhook (§40, "segredo só no servidor").
 *
 * HMAC-SHA256 sobre `${timestamp}.${corpo cru}`, no formato que os PSPs
 * conhecidos usam. Três decisões, e todas têm um ataque do outro lado:
 *
 * 1. **Sobre o corpo cru, não sobre o JSON reparseado.** `JSON.parse` seguido
 *    de `JSON.stringify` reordena chaves e normaliza números; a assinatura
 *    deixa de bater por motivo nenhum, e a saída típica é alguém desligar a
 *    conferência para "destravar".
 *
 * 2. **O timestamp entra no que é assinado, e é conferido.** Sem ele, um
 *    evento legítimo capturado uma vez pode ser reenviado para sempre. A
 *    idempotência do banco já impede duplicar o pedido, mas a janela fecha
 *    aqui, antes de o evento existir.
 *
 * 3. **Comparação em tempo constante.** `a === b` sai no primeiro byte
 *    diferente, e a diferença de tempo entre "errou no byte 1" e "errou no
 *    byte 30" é medível pela rede. Comparar por OR acumulado não sai cedo.
 *
 * Este arquivo é `_shared`: o `_` impede o Supabase de tentar publicá-lo como
 * função. Ele é duplicado do lado do app? Não — o app não assina nada. Só o
 * PSP (aqui, o sandbox) e o webhook conhecem o segredo.
 */

/** Além disto, o evento é velho demais para ser aceito. */
export const TOLERANCIA_SEGUNDOS = 300;

export const CABECALHO_ASSINATURA = 'x-fly-signature';

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function chave(segredo: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/**
 * Monta o cabeçalho `t=<unix>,v1=<hex>`.
 *
 * Usado pelo sandbox, que faz o papel do provedor. Um PSP real assina do lado
 * dele; nós só conferimos.
 */
export async function assinar(
  corpoCru: string,
  segredo: string,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<string> {
  const mac = await crypto.subtle.sign(
    'HMAC',
    await chave(segredo),
    new TextEncoder().encode(`${timestamp}.${corpoCru}`),
  );
  return `t=${timestamp},v1=${hex(mac)}`;
}

/** Compara sem sair cedo. O tempo não pode contar quantos bytes bateram. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

export type ResultadoDaConferencia =
  | { valida: true }
  | { valida: false; motivo: 'ausente' | 'malformado' | 'expirado' | 'nao_confere' };

export async function conferir(
  corpoCru: string,
  cabecalho: string | null,
  segredo: string,
  agoraSegundos = Math.floor(Date.now() / 1000),
): Promise<ResultadoDaConferencia> {
  if (!cabecalho) return { valida: false, motivo: 'ausente' };

  const partes = new Map(
    cabecalho.split(',').map((p) => {
      const i = p.indexOf('=');
      return i < 0 ? ['', ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );

  const t = Number(partes.get('t'));
  const v1 = partes.get('v1');
  if (!v1 || !Number.isFinite(t)) return { valida: false, motivo: 'malformado' };

  // Vale nos dois sentidos: relógio adiantado do outro lado também é suspeito.
  if (Math.abs(agoraSegundos - t) > TOLERANCIA_SEGUNDOS) {
    return { valida: false, motivo: 'expirado' };
  }

  const mac = await crypto.subtle.sign(
    'HMAC',
    await chave(segredo),
    new TextEncoder().encode(`${t}.${corpoCru}`),
  );

  return iguaisEmTempoConstante(hex(mac), v1)
    ? { valida: true }
    : { valida: false, motivo: 'nao_confere' };
}
