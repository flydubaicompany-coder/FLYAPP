/**
 * Registro de aparelho e token de push (§38.10).
 *
 * O que importa aqui, e que não é óbvio:
 *
 * - **Um aparelho, uma linha.** O `id` vem do próprio app (`./aparelho`), e
 *   não do banco, para o `upsert` ter em que conflitar.
 * - **Token trocado é token revogado.** O Expo emite um token novo quando o
 *   app é reinstalado ou o sistema decide reciclar. Deixar o antigo ativo faz
 *   a Fly enviar para um endereço morto e contar como entregue.
 * - **Trocar de conta no mesmo aparelho revoga o token da conta anterior.**
 *   Sem isso, o próximo aviso do cliente A toca no celular que agora é do
 *   cliente B.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fly/domain-types';
import { idDoAparelho, plataforma } from './aparelho';

export interface DadosAparelho {
  appVersion: string | null;
  model: string | null;
}

export type ResultadoRegistro =
  { ok: true; deviceId: string; tokenNovo: boolean } | { ok: false; motivo: string };

/**
 * Garante que este aparelho existe em `devices` e devolve o id.
 *
 * `biometric_enabled` fica **de fora** do upsert de propósito: quem registra
 * push não decide biometria, e incluir a coluna aqui desligaria a proteção a
 * cada abertura do app.
 */
export async function registrarAparelho(
  db: SupabaseClient<Database>,
  userId: string,
  dados: DadosAparelho,
): Promise<string | null> {
  const deviceId = await idDoAparelho();

  const { error } = await db.from('devices').upsert(
    {
      id: deviceId,
      user_id: userId,
      platform: plataforma(),
      model: dados.model,
      app_version: dados.appVersion,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: 'id' },
  );

  return error ? null : deviceId;
}

/**
 * Grava o token de push, revogando o que ele substitui.
 *
 * Idempotente: chamar de novo com o mesmo token não gera linha nova nem
 * marca nada como revogado. O app chama isso a cada abertura.
 */
export async function registrarToken(
  db: SupabaseClient<Database>,
  userId: string,
  token: string,
  dados: DadosAparelho,
): Promise<ResultadoRegistro> {
  const deviceId = await registrarAparelho(db, userId, dados);
  if (!deviceId) return { ok: false, motivo: 'aparelho' };

  const { data: atuais, error: erroLeitura } = await db
    .from('push_tokens')
    .select('id, token, user_id')
    .eq('device_id', deviceId)
    .is('revoked_at', null);

  if (erroLeitura) return { ok: false, motivo: erroLeitura.message };

  const jaAtivo = (atuais ?? []).some((t) => t.token === token && t.user_id === userId);
  if (jaAtivo) return { ok: true, deviceId, tokenNovo: false };

  // Tudo que estava ativo neste aparelho e não é este token sai de cena —
  // inclusive tokens de outra conta que usou o mesmo celular.
  const aRevogar = (atuais ?? []).filter((t) => t.token !== token).map((t) => t.id);
  if (aRevogar.length > 0) {
    await db
      .from('push_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .in('id', aRevogar);
  }

  const { error } = await db
    .from('push_tokens')
    .upsert(
      { device_id: deviceId, user_id: userId, token, revoked_at: null },
      { onConflict: 'token' },
    );

  if (error) return { ok: false, motivo: error.message };
  return { ok: true, deviceId, tokenNovo: true };
}

/**
 * Revoga o token deste aparelho.
 *
 * Chamado no logout. Sem isso, sair da conta não para os avisos — e o aviso
 * seguinte chega na tela de bloqueio de quem já saiu.
 */
export async function revogarToken(db: SupabaseClient<Database>, userId: string): Promise<void> {
  const deviceId = await idDoAparelho();
  await db
    .from('push_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('device_id', deviceId)
    .eq('user_id', userId)
    .is('revoked_at', null);
}
