import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Onde a sessao mora.
 *
 * No aparelho, Keychain (iOS) e Keystore (Android) via SecureStore — o token
 * fica criptografado pelo sistema e some quando o app e desinstalado.
 *
 * Na web nao existe equivalente: `localStorage` e legivel por qualquer script
 * na origem. Aceitamos isso porque a web e superficie de contingencia
 * (§21.1), nao o produto principal, e a sessao web e de curta duracao.
 *
 * O SecureStore tem limite pratico de 2 KB por chave. Uma sessao do Supabase
 * com claims grandes passa disso, entao o valor e fatiado — sem isso a
 * gravacao falha em silencio e o usuario e deslogado sem explicacao.
 */

const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = '__partes';

function isWeb(): boolean {
  return Platform.OS === 'web';
}

async function getWeb(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb()) return getWeb(key);

    const contagem = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
    if (!contagem) return SecureStore.getItemAsync(key);

    const partes: string[] = [];
    for (let i = 0; i < Number(contagem); i += 1) {
      const parte = await SecureStore.getItemAsync(`${key}__${i}`);
      // Uma parte faltando significa gravacao interrompida: a sessao inteira
      // e invalida, e devolver metade produziria um erro pior mais adiante.
      if (parte === null) return null;
      partes.push(parte);
    }
    return partes.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb()) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }

    await limparPartes(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const total = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < total; i += 1) {
      await SecureStore.setItemAsync(
        `${key}__${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(total));
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb()) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await limparPartes(key);
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};

async function limparPartes(key: string): Promise<void> {
  const contagem = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
  if (!contagem) return;
  for (let i = 0; i < Number(contagem); i += 1) {
    await SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => undefined);
  }
  await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`).catch(() => undefined);
}

/** Divide como o storage divide. Exposto para teste. */
export function chunk(value: string, size: number = CHUNK_SIZE): string[] {
  if (value.length <= size) return [value];
  const partes: string[] = [];
  for (let i = 0; i < Math.ceil(value.length / size); i += 1) {
    partes.push(value.slice(i * size, (i + 1) * size));
  }
  return partes;
}

export const CHUNK_LIMIT = CHUNK_SIZE;
