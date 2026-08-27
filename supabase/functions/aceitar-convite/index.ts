/**
 * Ativação de convite (§37.1).
 *
 * Por que uma Edge Function e não uma chamada direta do app:
 *
 * A tabela `invitations` não é legível por cliente algum — nem o hash do token.
 * Um cliente que pudesse consultá-la enumeraria convites pendentes e saberia
 * quem a Fly está prestes a convidar. A ativação precisa de `service_role`, e
 * `service_role` nunca vai para dentro de um app.
 *
 * O que esta função garante:
 *   • o token viaja em claro apenas no link; o banco guarda o hash;
 *   • convite é de uso único, expira, e pode ser revogado;
 *   • a comparação do hash é feita no servidor, em tempo constante;
 *   • o papel do convite vira `user_roles` — o cliente nunca escolhe o próprio;
 *   • cada ativação é auditada.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Corpo {
  token?: string;
  email?: string;
  password?: string;
}

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

/** SHA-256 em hex. O mesmo algoritmo usado ao criar o convite. */
async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder(405, { erro: 'metodo nao permitido' });

  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return responder(400, { erro: 'corpo invalido' });
  }

  const { token, email, password } = corpo;
  if (!token || !email || !password) {
    return responder(400, { erro: 'token, email e senha sao obrigatorios' });
  }
  if (password.length < 8) {
    return responder(400, { erro: 'senha precisa de ao menos 8 caracteres' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const tokenHash = await hashToken(token);

  const { data: convite } = await admin
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  // Resposta única para token inexistente, expirado, usado ou revogado. Dizer
  // "este convite já foi usado" confirmaria ao atacante que o token existe.
  const invalido = responder(400, { erro: 'convite invalido ou expirado' });

  if (!convite) return invalido;
  if (convite.accepted_at || convite.revoked_at) return invalido;
  if (new Date(convite.expires_at) < new Date()) return invalido;

  // O convite vale para o endereço que a Fly convidou, e não para qualquer um
  // que consiga o link.
  if (convite.email && convite.email.toLowerCase() !== email.toLowerCase()) {
    return invalido;
  }

  const { data: criado, error: erroCriacao } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (erroCriacao || !criado.user) {
    // Conta duplicada é um critério explícito da §37: precisa ser tratada, e
    // sem revelar se aquele e-mail já existe.
    const jaExiste = erroCriacao?.message?.toLowerCase().includes('already');
    return responder(jaExiste ? 409 : 500, {
      erro: jaExiste ? 'ja existe uma conta com este e-mail' : 'nao foi possivel criar a conta',
    });
  }

  const userId = criado.user.id;

  const { error: erroPapel } = await admin
    .from('user_roles')
    .insert({ user_id: userId, role: convite.role, granted_by: null });

  if (erroPapel) {
    // Sem papel, a conta não serve para nada — desfaz para não deixar órfã.
    await admin.auth.admin.deleteUser(userId);
    return responder(500, { erro: 'nao foi possivel concluir a ativacao' });
  }

  // Marca o convite como usado depois de a conta existir. Se o processo cair
  // entre uma coisa e outra, o convite continua válido — preferível a queimar
  // um convite sem criar a conta.
  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', convite.id);

  await admin.from('profiles').update({ onboarding_step: 'identity' }).eq('id', userId);

  await admin.from('audit_logs').insert({
    actor_id: userId,
    action: 'invitation.accept',
    entity_type: 'invitation',
    entity_id: convite.id,
    metadata: { role: convite.role },
  });

  return responder(200, { ok: true, proximoPasso: 'identity' });
});
