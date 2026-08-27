-- =============================================================================
-- Criação e revogação de convite pelo Fly Ops
--
-- O token é gerado **no servidor** e devolvido em claro uma única vez, para o
-- painel montar o link. O banco guarda apenas o SHA-256, e não existe caminho
-- para recuperar o token depois. Isso é proposital: um token recuperável é um
-- token que vaza.
-- =============================================================================

create or replace function public.create_invitation(
  p_email text,
  p_role public.fly_role default 'customer',
  p_valid_days int default 7
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_token text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_actor is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  -- Só operador global convida. Um guia não cria acesso para ninguém.
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao para convidar' using errcode = '42501';
  end if;

  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'e-mail invalido' using errcode = '22023';
  end if;

  if p_valid_days < 1 or p_valid_days > 30 then
    raise exception 'validade deve ficar entre 1 e 30 dias' using errcode = '22023';
  end if;

  -- Convite pendente para o mesmo e-mail é revogado antes de criar outro: dois
  -- tokens válidos para a mesma pessoa dobram a superfície sem nenhum ganho.
  update public.invitations
  set revoked_at = now()
  where lower(email) = lower(p_email)
    and accepted_at is null
    and revoked_at is null;

  -- 32 bytes de aleatoriedade criptográfica, em base64 url-safe.
  v_token := replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
  v_token := replace(v_token, '=', '');
  v_expires := now() + (p_valid_days || ' days')::interval;

  insert into public.invitations (email, role, token_hash, invited_by, expires_at)
  values (
    lower(p_email),
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_actor,
    v_expires
  )
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'invitation.create', 'invitation', v_id::text,
          jsonb_build_object('role', p_role, 'valid_days', p_valid_days));

  return query select v_id, v_token, v_expires;
end;
$$;

revoke all on function public.create_invitation(text, public.fly_role, int) from public, anon;
grant execute on function public.create_invitation(text, public.fly_role, int) to authenticated;

create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  update public.invitations
  set revoked_at = now()
  where id = p_id and accepted_at is null and revoked_at is null;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (v_actor, 'invitation.revoke', 'invitation', p_id::text);
end;
$$;

revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
