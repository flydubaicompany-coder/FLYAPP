-- =============================================================================
-- O passaporte é visível para a Fly (correção de base legal)
--
-- Eu havia trancado o passaporte atrás de um consentimento opcional: sem
-- `travel_documents` concedido, nem a operação enxergava o número. Errado, e o
-- erro é de base legal, não de código.
--
-- Emitir a passagem **é o serviço que o cliente contratou**. Na LGPD isso é
-- execução de contrato (art. 7º, V), que não pede consentimento separado — e
-- tratar como consentimento produzia um absurdo prático: o cliente podia
-- recusar, e a Fly ficava impedida de fazer aquilo pelo que foi paga.
--
-- O que continua valendo, e não é a mesma coisa que trancar:
--
--   - **acesso mínimo**: quem opera a viagem daquela pessoa, e a operação
--     global que emite. Um guia de outra viagem continua sem ver.
--   - **auditável**: toda abertura de passaporte no painel deixa registro.
--   - **a Fly lê, não escreve**: conferir continua sendo RPC de duas colunas.
--
-- A finalidade `travel_documents` é removida. Um consentimento que não decide
-- nada é teatro, e teatro de consentimento é pior que a ausência dele: ensina
-- o cliente a clicar em "aceito" sem ler.
-- =============================================================================

/**
 * A equipe compartilha viagem com esta pessoa?
 *
 * Mais estreito que `has_active_assignment()`, que responde apenas "esta
 * pessoa é da equipe em alguma viagem". Aqui a pergunta é sobre **esta**
 * pessoa: um guia de outra viagem não tem o que fazer com o passaporte de
 * quem ele não embarca.
 */
create or replace function fly_private.shares_trip_with(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_assignments sa
    join public.trip_members tm on tm.trip_id = sa.trip_id
    where sa.user_id = (select auth.uid())
      and sa.revoked_at is null
      and tm.user_id = p_user
  );
$$;

drop policy if exists passports_select on public.passports;

create policy passports_select on public.passports for select to authenticated
  using (
    (select auth.uid()) = public.passports.user_id
    or fly_private.is_responsible_for(public.passports.user_id)
    -- A operação global emite passagem: precisa do número, e o precisa antes
    -- de existir viagem montada.
    or fly_private.is_global_operator()
    -- A equipe de campo vê o passaporte de quem ela embarca, e de mais ninguém.
    or fly_private.shares_trip_with(public.passports.user_id)
  );

-- A finalidade sai. Ninguém a concedeu, e nada mais depende dela.
delete from public.consent_purposes where key = 'travel_documents';

/**
 * Conferir o passaporte, agora sem a porta do consentimento.
 *
 * O resto continua igual, e é o que importa: a função toca `verified_at` e
 * `verified_by`, e mais nada. Não há política de UPDATE para a equipe, então
 * este é o único caminho — e ele não alcança `number` nem `full_name`.
 */
create or replace function public.conferir_passaporte(p_id uuid, p_confere boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_dono uuid;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select user_id into v_dono from public.passports where id = p_id;
  if v_dono is null then
    raise exception 'passaporte nao encontrado' using errcode = '22023';
  end if;

  update public.passports
  set verified_at = case when p_confere then now() end,
      verified_by = case when p_confere then v_user end
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user,
    case when p_confere then 'passport.verified' else 'passport.unverified' end,
    'passports',
    p_id::text,
    jsonb_build_object('owner_id', v_dono)
  );
end;
$$;

/**
 * Abrir o passaporte de um cliente no painel, com registro.
 *
 * "Acesso mínimo e auditável" (§3.9) não caiu junto com o consentimento. A
 * RLS resolve o mínimo; esta função resolve o auditável — quem da Fly olhou o
 * passaporte de quem, e quando.
 *
 * O painel chama isto ao abrir o detalhe. Ler a lista não registra: registrar
 * cada listagem encheria a auditoria de ruído e esconderia o que importa.
 *
 * **Devolve `permitido` em vez de lançar** — e a razão é sutil o bastante para
 * merecer estar escrita. `raise exception` desfaz tudo o que a função escreveu
 * na mesma transação, inclusive o registro da tentativa negada. Uma função que
 * loga e depois lança não loga nada: o Postgres não tem transação autônoma, e
 * o `insert` volta atrás junto com o resto.
 *
 * Como registrar a tentativa **é** o objetivo — quem tenta abrir um passaporte
 * que não pode é exatamente o que se quer enxergar —, a negativa vira dado de
 * retorno, e não exceção. Não encontrado continua lançando: isso não é evento
 * de segurança.
 */
create or replace function public.ver_passaporte(p_id uuid)
returns table (
  permitido boolean,
  id uuid,
  user_id uuid,
  full_name text,
  number text,
  issuing_country text,
  nationality text,
  birth_date date,
  issued_on date,
  expires_on date,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_dono uuid;
begin
  select p.user_id into v_dono from public.passports p where p.id = p_id;
  if v_dono is null then
    raise exception 'passaporte nao encontrado' using errcode = '22023';
  end if;

  if not (
    v_user = v_dono
    or fly_private.is_responsible_for(v_dono)
    or fly_private.is_global_operator()
    or fly_private.shares_trip_with(v_dono)
  ) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_user, 'passport.access_denied', 'passports', p_id::text, '{}'::jsonb);

    return query select false, null::uuid, null::uuid, null::text, null::text,
                        null::text, null::text, null::date, null::date, null::date,
                        null::timestamptz;
    return;
  end if;

  -- O dono abrindo o próprio documento não é evento de auditoria.
  if v_user <> v_dono then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_user, 'passport.viewed', 'passports', p_id::text,
            jsonb_build_object('owner_id', v_dono));
  end if;

  return query
    select true, p.id, p.user_id, p.full_name, p.number, p.issuing_country, p.nationality,
           p.birth_date, p.issued_on, p.expires_on, p.verified_at
    from public.passports p
    where p.id = p_id;
end;
$$;

revoke all on function public.ver_passaporte(uuid) from public, anon;
grant execute on function public.ver_passaporte(uuid) to authenticated;
