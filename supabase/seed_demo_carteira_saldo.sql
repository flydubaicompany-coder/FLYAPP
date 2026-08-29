-- =============================================================================
-- Demonstracao: saldo financeiro do Rafael.
--
-- **Credito que a propria Fly concede** — cortesia e reembolso. E o unico tipo
-- que existe hoje: recarga pelo cliente exige parceiro de pagamento, e nada
-- gera `topup` enquanto ele nao existir.
--
-- Valores em centavos, moeda AED (P43).
-- =============================================================================

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'cliente@fly.com' limit 1;
  if v_user is null then return; end if;

  insert into public.wallet_entries
    (user_id, kind, amount_cents, currency, source, reference, occurred_at, idempotency_key, reason)
  values
    (v_user, 'credit', 500000, 'AED', 'ops', 'Cortesia Fly',
     now() - interval '10 days', 'demo:wallet:cortesia',
     'Cortesia por atraso no transfer de chegada'),
    (v_user, 'refund', 168000, 'AED', 'order', 'Marina Yacht Sunset',
     now() - interval '6 days', 'demo:wallet:reembolso',
     'Reembolso convertido em crédito'),
    (v_user, 'debit', -124000, 'AED', 'order', 'At The Top · Burj Khalifa',
     now() - interval '4 days', 'demo:wallet:gasto', null)
  on conflict (idempotency_key) do nothing;
end $$;
