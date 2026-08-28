import { readPublicEnv, type PublicEnv } from '@fly/config';

/**
 * Ambiente publico do Fly App. No Expo, apenas variaveis com o prefixo
 * EXPO_PUBLIC_ chegam ao bundle — o que e exatamente o que queremos: nenhum
 * segredo de servidor pode entrar aqui por descuido.
 *
 * Cada variavel e lida por **referencia estatica**, uma a uma, e nao passando
 * `process.env` inteiro. O Metro nao popula `process.env` em tempo de
 * execucao: ele **substitui no codigo**, durante o bundle, cada ocorrencia
 * literal de `process.env.EXPO_PUBLIC_*` pelo valor. Um acesso dinamico
 * (`raw[chave]`) nao casa com essa substituicao, entao no bundle de producao
 * nada e inlinado e o app sobe sem ambiente nenhum.
 *
 * No servidor de desenvolvimento isso passa despercebido, porque ali
 * `process.env` existe de verdade. Custou um deploy quebrado para aparecer:
 * a web do Fly App so foi publicada em 28/08/2026, e a primeira coisa que ela
 * fez foi morrer com `MissingEnvError`.
 */
export function loadEnv(): PublicEnv {
  const raw: Record<string, string | undefined> = {
    EXPO_PUBLIC_FLY_ENVIRONMENT: process.env.EXPO_PUBLIC_FLY_ENVIRONMENT,
    EXPO_PUBLIC_FLY_SUPABASE_URL: process.env.EXPO_PUBLIC_FLY_SUPABASE_URL,
    EXPO_PUBLIC_FLY_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_FLY_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_FLY_APP_VERSION: process.env.EXPO_PUBLIC_FLY_APP_VERSION,
    EXPO_PUBLIC_FLY_COMMIT_SHA: process.env.EXPO_PUBLIC_FLY_COMMIT_SHA,
  };

  return readPublicEnv(raw, 'EXPO_PUBLIC_FLY_');
}
