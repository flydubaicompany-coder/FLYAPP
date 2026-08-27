/**
 * Exclusão de conta (§37.11 e §23.2).
 *
 * `verify_jwt: true`: só o próprio dono apaga a própria conta. O JWT prova
 * quem é, e a função ignora qualquer id que venha no corpo — aceitar um id do
 * cliente seria deixar qualquer um apagar a conta alheia.
 *
 * O que acontece, em ordem:
 *   1. anonimiza o perfil (nome, telefone, nascimento, avatar);
 *   2. apaga preferências, contatos de emergência e aparelhos;
 *   3. registra a exclusão na trilha **antes** de apagar a conta — depois não
 *      haveria mais actor para registrar;
 *   4. apaga o usuário do auth, o que encerra toda sessão e impede login.
 *
 * O consentimento **não** é apagado: ele é a prova do que valia em cada data.
 * Apagar a prova junto com o dado deixaria a Fly sem resposta numa auditoria.
 *
 * O que ainda não acontece: apagar registro financeiro ou fiscal. Esses
 * domínios não existem, e o período de retenção deles é decisão pendente
 * (§50.17). Quando existirem, a exclusão passa a anonimizar em vez de apagar
 * o que a lei obriga a guardar.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder(405, { erro: 'metodo nao permitido' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return responder(401, { erro: 'sem sessao' });

  const url = Deno.env.get('SUPABASE_URL')!;

  // Cliente com o JWT do usuário, apenas para descobrir QUEM está pedindo.
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: erroUser } = await comoUsuario.auth.getUser();
  if (erroUser || !userData.user) return responder(401, { erro: 'sessao invalida' });

  const userId = userData.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  await admin
    .from('profiles')
    .update({
      display_name: null,
      preferred_name: null,
      phone: null,
      birth_date: null,
      avatar_path: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  await admin.from('preference_items').delete().eq('user_id', userId);
  await admin.from('emergency_contacts').delete().eq('user_id', userId);
  await admin.from('push_tokens').delete().eq('user_id', userId);
  await admin.from('devices').delete().eq('user_id', userId);

  await admin.from('audit_logs').insert({
    actor_id: userId,
    action: 'account.delete',
    entity_type: 'profile',
    entity_id: userId,
    metadata: { motivo: 'pedido do titular' },
  });

  const { error: erroDelete } = await admin.auth.admin.deleteUser(userId);
  if (erroDelete) {
    return responder(500, { erro: 'nao foi possivel concluir a exclusao' });
  }

  return responder(200, { ok: true });
});
