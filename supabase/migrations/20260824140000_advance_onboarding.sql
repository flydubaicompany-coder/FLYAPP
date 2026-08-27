-- =============================================================================
-- Avanço do onboarding, decidido no servidor
--
-- O cliente **não** tem grant de update em `profiles.onboarding_step`. Se
-- tivesse, poderia gravar `done` direto e pular a etapa de privacidade — que é
-- justamente a única que não pode ser pulada.
--
-- Esta função é a única porta, e segue a §20: valida estado anterior, regra e
-- idempotência, e audita a transição.
-- =============================================================================

create or replace function public.advance_onboarding(p_to text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_atual text;
  v_ordem constant text[] := array['invited','account','identity','preferences','consents','done'];
  v_i_atual int;
  v_i_alvo int;
  v_linha public.profiles;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  select onboarding_step into v_atual from public.profiles where id = v_user;
  if v_atual is null then
    raise exception 'perfil nao encontrado' using errcode = 'P0002';
  end if;

  v_i_atual := array_position(v_ordem, v_atual);
  v_i_alvo := array_position(v_ordem, p_to);

  if v_i_alvo is null then
    raise exception 'etapa desconhecida: %', p_to using errcode = '22023';
  end if;

  -- Idempotente: repetir a etapa atual não é erro, só não faz nada. Sem isso,
  -- um toque duplo no botão viraria erro em tela.
  if v_i_alvo = v_i_atual then
    select * into v_linha from public.profiles where id = v_user;
    return v_linha;
  end if;

  -- Só avança uma etapa por vez. Pular é recusado, inclusive por deep link.
  if v_i_alvo <> v_i_atual + 1 then
    raise exception 'transicao invalida: % para %', v_atual, p_to using errcode = '22023';
  end if;

  update public.profiles
  set onboarding_step = p_to,
      onboarding_completed_at = case when p_to = 'done' then now() else onboarding_completed_at end
  where id = v_user
  returning * into v_linha;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'onboarding.advance', 'profile', v_user::text,
          jsonb_build_object('from', v_atual, 'to', p_to));

  return v_linha;
end;
$$;

revoke all on function public.advance_onboarding(text) from public, anon;
grant execute on function public.advance_onboarding(text) to authenticated;
