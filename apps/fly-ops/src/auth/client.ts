import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fly/domain-types';
import { loadEnv } from '../env';

/**
 * Cliente Supabase do Fly Ops.
 *
 * Mesma regra do app: chave publicavel apenas. O painel enxerga mais porque o
 * operador tem papel `admin` no banco, e nao porque o cliente web tem chave
 * mais forte — a diferenca de poder vive na RLS, nunca no bundle.
 */
let cliente: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> {
  if (cliente) return cliente;
  const env = loadEnv();
  cliente = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return cliente;
}
