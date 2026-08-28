-- =============================================================================
-- Fase 6 — beneficios, elegibilidade e resgate (§8 e §41, entrega 4).
--
-- Os dois criterios da §41 e o que os garante:
--
--   "resgate atomico nao permite saldo negativo"
--     Um `pg_advisory_xact_lock` por usuario serializa os resgates dele. Sem
--     isso, dois toques simultaneos leriam o mesmo saldo e gastariam duas
--     vezes o mesmo ponto — o classico. O lock e por usuario, e nao por
--     tabela: dois clientes diferentes nao esperam um pelo outro.
--
--   "beneficio sem estoque e recusado"
--     `select ... for update` na linha do beneficio antes de conferir o
--     estoque. Duas pessoas disputando a ultima unidade entram em fila.
--
-- O resgate **nao apaga ponto**: lanca um `redeem` negativo no ledger, que
-- continua append-only. Saldo e a soma, sempre.
-- =============================================================================

create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  title text not null,
  description text,

  points_cost int not null,

  /**
   * Estoque.
   *
   * Nulo = ilimitado. Zero = esgotado. A diferenca importa: um beneficio
   * digital (upgrade de mesa) nao tem estoque; um fisico (garrafa) tem.
   */
  stock int,

  -- Elegibilidade. Nulo = sem exigencia.
  min_package public.fly_package,
  min_level text,

  is_active boolean not null default false,
  valid_from timestamptz,
  valid_until timestamptz,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint benefits_key_unique unique (key),
  constraint benefits_cost_positive check (points_cost > 0),
  constraint benefits_stock_nonnegative check (stock is null or stock >= 0),
  constraint benefits_level_valido check (min_level is null or min_level in ('basic','prime','elite')),
  constraint benefits_janela_coerente check (
    valid_from is null or valid_until is null or valid_until > valid_from
  )
);

create index benefits_ativos_idx on public.benefits (is_active, sort_order);

-- O resgate feito. Append-only pela mesma razao do ledger: cancelar um resgate
-- e lancar a devolucao, nunca apagar a linha.
create table public.benefit_redemptions (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid not null references public.benefits (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- O lancamento que pagou. Liga o resgate ao extrato.
  ledger_entry_id uuid not null references public.points_ledger (id),
  points_spent int not null,
  -- Codigo curto para o cliente apresentar na Base Fly.
  code text not null,
  redeemed_at timestamptz not null default now(),

  constraint benefit_redemptions_code_unique unique (code),
  constraint benefit_redemptions_spent_positive check (points_spent > 0)
);

create index benefit_redemptions_user_idx on public.benefit_redemptions (user_id, redeemed_at desc);

comment on table public.benefit_redemptions is
  'Append-only. Cancelar um resgate e devolver os pontos no ledger, nunca apagar a linha.';

create or replace function fly_private.redemptions_is_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'benefit_redemptions e append-only: devolva os pontos no ledger em vez de apagar o resgate.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger benefit_redemptions_no_update
  before update on public.benefit_redemptions
  for each row execute function fly_private.redemptions_is_append_only();
create trigger benefit_redemptions_no_delete
  before delete on public.benefit_redemptions
  for each row execute function fly_private.redemptions_is_append_only();

-- -----------------------------------------------------------------------------
-- Nivel do cliente, no banco.
--
-- A mesma conta que `carteira/nivel.ts` faz no app. Duplicada de proposito: o
-- app decide o que **mostrar**, o banco decide o que **vale**. A §41 e clara
-- que saldo e elegibilidade nunca sao decididos so no cliente.
-- -----------------------------------------------------------------------------
create or replace function fly_private.nivel_do_usuario(p_user uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when (t.value ->> 'elite') is not null and b.saldo >= (t.value ->> 'elite')::int then 'elite'
    when (t.value ->> 'prime') is not null and b.saldo >= (t.value ->> 'prime')::int then 'prime'
    else 'basic'
  end
  from (select coalesce(sum(l.amount), 0)::int as saldo
        from public.points_ledger l where l.user_id = p_user) b
  cross join public.app_config t
  where t.key = 'points.level_thresholds';
$$;

-- -----------------------------------------------------------------------------
-- Resgate.
-- -----------------------------------------------------------------------------
create or replace function public.resgatar_beneficio(p_benefit uuid)
returns table (ok boolean, motivo text, codigo text, saldo_final int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_b public.benefits;
  v_saldo int;
  v_nivel text;
  v_pacote public.fly_package;
  v_ordem int;
  v_lanc uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  -- Serializa os resgates DESTE cliente. Dois toques simultaneos nao leem o
  -- mesmo saldo. Clientes diferentes nao esperam um pelo outro.
  perform pg_advisory_xact_lock(hashtext(v_user::text));

  -- Trava a linha do beneficio: dois clientes disputando a ultima unidade
  -- entram em fila em vez de levarem os dois.
  select * into v_b from public.benefits b where b.id = p_benefit for update;
  if not found then
    return query select false, 'beneficio nao encontrado', null::text, null::int;
    return;
  end if;

  if not v_b.is_active
     or (v_b.valid_from is not null and now() < v_b.valid_from)
     or (v_b.valid_until is not null and now() > v_b.valid_until) then
    return query select false, 'beneficio indisponivel', null::text, null::int;
    return;
  end if;

  if v_b.stock is not null and v_b.stock <= 0 then
    return query select false, 'beneficio esgotado', null::text, null::int;
    return;
  end if;

  -- Elegibilidade por pacote.
  if v_b.min_package is not null then
    select cp.package into v_pacote
    from public.customer_packages cp where cp.user_id = v_user;

    v_ordem := case v_b.min_package
                 when 'standard' then 1 when 'black' then 2 else 3 end;

    if v_pacote is null
       or (case v_pacote when 'standard' then 1 when 'black' then 2 else 3 end) < v_ordem then
      return query select false, 'pacote nao elegivel', null::text, null::int;
      return;
    end if;
  end if;

  -- Elegibilidade por nivel de pontos.
  if v_b.min_level is not null then
    v_nivel := fly_private.nivel_do_usuario(v_user);
    if (case v_nivel when 'basic' then 1 when 'prime' then 2 else 3 end)
       < (case v_b.min_level when 'basic' then 1 when 'prime' then 2 else 3 end) then
      return query select false, 'nivel nao elegivel', null::text, null::int;
      return;
    end if;
  end if;

  select coalesce(sum(l.amount), 0)::int into v_saldo
  from public.points_ledger l where l.user_id = v_user;

  if v_saldo < v_b.points_cost then
    return query select false, 'saldo insuficiente', null::text, v_saldo;
    return;
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.points_ledger
    (user_id, kind, amount, source, reference, occurred_at, rule_version, idempotency_key, reason)
  values (
    v_user, 'redeem', -v_b.points_cost, 'benefit', v_b.key, now(),
    fly_private.versao_da_regra(),
    'redeem:' || v_code,
    'Resgate: ' || v_b.title
  )
  returning id into v_lanc;

  insert into public.benefit_redemptions
    (benefit_id, user_id, ledger_entry_id, points_spent, code)
  values (p_benefit, v_user, v_lanc, v_b.points_cost, v_code);

  if v_b.stock is not null then
    update public.benefits set stock = stock - 1, updated_at = now() where id = p_benefit;
  end if;

  return query select true, 'resgatado'::text, v_code, v_saldo - v_b.points_cost;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.benefits            enable row level security;
alter table public.benefit_redemptions enable row level security;

-- Beneficio ativo e visivel para quem esta logado; rascunho so para a equipe.
create policy benefits_select on public.benefits for select to authenticated
  using (is_active or fly_private.is_staff());
create policy benefits_insert_operator on public.benefits for insert to authenticated
  with check (fly_private.is_global_operator());
create policy benefits_update_operator on public.benefits for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy benefits_delete_operator on public.benefits for delete to authenticated
  using (fly_private.is_global_operator());

create policy benefit_redemptions_select on public.benefit_redemptions for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

-- Sem policy de insert: resgatar so pela RPC, que confere estoque e saldo.
-- Sem policy de update/delete: append-only.

revoke all on public.benefits            from anon;
revoke all on public.benefit_redemptions from anon;

grant select on public.benefits to authenticated;
grant insert, update, delete on public.benefits to authenticated;
grant select on public.benefit_redemptions to authenticated;
revoke insert, update, delete on public.benefit_redemptions from authenticated;

revoke all on function fly_private.nivel_do_usuario(uuid) from public, anon, authenticated;
revoke all on function public.resgatar_beneficio(uuid) from public, anon;
grant execute on function public.resgatar_beneficio(uuid) to authenticated;
