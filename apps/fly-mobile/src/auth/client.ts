import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fly/domain-types';
import { loadEnv } from '@/env';
import { sessionStorage } from './storage';

/**
 * Cliente Supabase do app.
 *
 * `loadEnv` ja recusa subir se qualquer variavel parecer segredo de servidor,
 * entao o cliente so pode nascer com a chave publicavel — a regra da §21.4
 * vira erro de execucao, nao recomendacao.
 */
let cliente: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> {
  if (cliente) return cliente;

  const env = loadEnv();
  cliente = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Deep link de convite e tratado pelo Expo Router, nao pela detecao
      // automatica de URL — que so existe para web e atrapalharia no app.
      detectSessionInUrl: false,
    },
  });
  return cliente;
}

/** Descarta o cliente. Usado no logout, para nao vazar sessao entre contas. */
export function resetSupabase(): void {
  cliente = null;
}
