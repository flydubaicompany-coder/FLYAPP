import { readPublicEnv, type PublicEnv } from '@fly/config';

/**
 * Ambiente publico do app. `readPublicEnv` recusa o boot se alguma variavel
 * parecer segredo de servidor — a falha e proposital e barulhenta.
 */
export function loadEnv(): PublicEnv {
  return readPublicEnv(
    import.meta.env as unknown as Record<string, string | undefined>,
    'VITE_FLY_',
  );
}
