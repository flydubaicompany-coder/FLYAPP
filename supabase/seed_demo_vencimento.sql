-- =============================================================================
-- Demonstracao E prova ao vivo do vencimento FIFO.
--
-- Monta o caso dificil num cliente de teste: um lote de 10.000 pontos que ja
-- passou da validade, do qual 7.000 ja foram gastos. O vencimento correto
-- retira **3.000** — o que sobrou —, e nao 10.000. Errar isso cobraria duas
-- vezes pelo mesmo ponto.
--
-- O vencimento em si NAO acontece aqui: quem dispara e o botao do Fly Ops,
-- que exige papel de operador. Este arquivo so prepara o cenario.
-- =============================================================================

do $$
declare v_user uuid;
begin
  -- Um dos clientes de teste, sem nome e sem dado nenhum.
  select p.id into v_user
  from public.profiles p
  where p.public_id = 'ER34XBWGCC'
  limit 1;

  if v_user is null then
    raise notice 'seed de vencimento: cliente de teste nao encontrado';
    return;
  end if;

  insert into public.points_ledger
    (user_id, kind, amount, source, reference, occurred_at, expires_on, rule_version, idempotency_key)
  values (
    v_user, 'earn', 10000, 'order', 'Lote antigo (demonstração)',
    now() - interval '30 months', (current_date - 5), 'v1', 'demo:venc:lote'
  )
  on conflict (idempotency_key) do nothing;

  insert into public.points_ledger
    (user_id, kind, amount, source, occurred_at, idempotency_key, reason)
  values (
    v_user, 'redeem', -7000, 'benefit', now() - interval '2 months',
    'demo:venc:gasto', 'Resgate anterior (demonstração)'
  )
  on conflict (idempotency_key) do nothing;
end $$;
