-- =============================================================================
-- Demonstracao E prova ao vivo: uma compra que rende pontos sozinha.
--
-- O pedido nasce `pending_payment` e e confirmado logo depois — que e o
-- caminho real de um pagamento aprovado. O gatilho da 20260828030000 credita
-- os pontos; nada aqui insere lancamento na mao.
--
-- 1.800 AED (180.000 centavos) x 10 pontos por unidade = **18.000 pontos**.
-- =============================================================================

do $$
declare
  v_user uuid;
  v_order uuid;
  v_antes int;
  v_depois int;
begin
  select id into v_user from auth.users where email = 'cliente@fly.com' limit 1;
  if v_user is null then
    raise notice 'seed da compra: cliente@fly.com nao encontrado';
    return;
  end if;

  -- Ja rodou? Nao repete.
  if exists (select 1 from public.orders where reference = 'FLY-2026-0918') then
    raise notice 'seed da compra: pedido FLY-2026-0918 ja existe';
    return;
  end if;

  select coalesce(balance, 0) into v_antes
  from public.points_balance where user_id = v_user;
  v_antes := coalesce(v_antes, 0);

  insert into public.orders
    (user_id, reference, status, currency, subtotal_cents, discount_cents, total_cents)
  values (v_user, 'FLY-2026-0918', 'pending_payment', 'AED', 180000, 0, 180000)
  returning id into v_order;

  -- O pagamento foi aprovado. E aqui que o gatilho age.
  update public.orders set status = 'confirmed', confirmed_at = now() where id = v_order;

  select coalesce(balance, 0) into v_depois
  from public.points_balance where user_id = v_user;

  raise notice 'PROVA: saldo antes = %, depois = %, diferenca = %',
    v_antes, v_depois, v_depois - v_antes;
end $$;
