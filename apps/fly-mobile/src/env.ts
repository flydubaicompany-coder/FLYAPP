import { readPublicEnv, type PublicEnv } from '@fly/config';

/**
 * Ambiente publico do Fly App. No Expo, apenas variaveis com o prefixo
 * EXPO_PUBLIC_ chegam ao bundle — o que e exatamente o que queremos: nenhum
 * segredo de servidor pode entrar aqui por descuido.
 */
export function loadEnv(): PublicEnv {
  return readPublicEnv(
    process.env as unknown as Record<string, string | undefined>,
    'EXPO_PUBLIC_FLY_',
  );
}
