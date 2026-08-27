/**
 * Identidade do aparelho (§9.5 e §38.10).
 *
 * A tabela `devices` não tinha chave natural. O resultado era que cada
 * `upsert` com `onConflict: 'id'` — sem `id` no payload — inseria uma linha
 * nova, e um único celular virava uma lista crescente de "aparelhos" na tela
 * de segurança. Encontrado na auditoria das Fases 0 a 3.
 *
 * A correção é ter um identificador estável **do lado do app**: um UUID
 * sorteado na primeira execução e guardado no SecureStore, que morre junto
 * com a desinstalação. Não é o identificador do sistema operacional de
 * propósito — o `identifierForVendor` do iOS e o `ANDROID_ID` seguem a pessoa
 * entre apps do mesmo fornecedor, e §23.1 não pede isso.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHAVE = 'fly.device.id';

/** Gera um UUID v4 sem depender de biblioteca. */
function novoId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Versão 4 e variante RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function ler(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(CHAVE) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(CHAVE);
}

async function gravar(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(CHAVE, id);
    } catch {
      // Navegador com armazenamento bloqueado: o app segue, com um id por
      // sessão. Pior que o ideal, melhor que travar a entrada.
    }
    return;
  }
  await SecureStore.setItemAsync(CHAVE, id);
}

let memoria: string | null = null;

/** O id deste aparelho, estável entre execuções. */
export async function idDoAparelho(): Promise<string> {
  if (memoria) return memoria;

  const guardado = await ler();
  if (guardado) {
    memoria = guardado;
    return guardado;
  }

  const id = novoId();
  await gravar(id);
  memoria = id;
  return id;
}

export type Plataforma = 'ios' | 'android' | 'web';

export function plataforma(): Plataforma {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/** Esquece a identidade. Só faz sentido no teste. */
export function esquecerEmMemoria(): void {
  memoria = null;
}
