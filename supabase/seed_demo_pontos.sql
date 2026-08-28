-- =============================================================================
-- Demonstracao: Fly Points do Rafael.
--
-- **Dado falso, isolado neste arquivo.** Apagar o arquivo e limpar
-- `points_ledger` devolve o app zerado — nada aqui vive em codigo.
--
-- Os numeros seguem a regra decidida em 28/08/2026 (D129): 10 pontos por
-- unidade de moeda gasta, 2.000 por check-in em evento, 5.000 por indicacao.
-- O saldo resultante deixa o Rafael em **prime**, com a barra a caminho de
-- elite — que e o estado interessante de olhar.
-- =============================================================================

do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where email = 'cliente@fly.com' limit 1;
  if v_user is null then
    raise notice 'seed de pontos: cliente@fly.com nao encontrado, nada a fazer';
    return;
  end if;

  insert into public.points_ledger
    (user_id, kind, amount, source, reference, occurred_at, expires_on, rule_version, idempotency_key)
  values
    (v_user, 'earn', 24800, 'order',    'At The Top · Burj Khalifa',
     now() - interval '4 days',  (now() + interval '24 months')::date, 'v1', 'demo:pontos:order-1'),
    (v_user, 'earn',  2000, 'event',    'Noite Fly no Atlantis',
     now() - interval '4 days',  (now() + interval '24 months')::date, 'v1', 'demo:pontos:event-1'),
    (v_user, 'earn', 16800, 'order',    'Marina Yacht Sunset',
     now() - interval '8 days',  (now() + interval '24 months')::date, 'v1', 'demo:pontos:order-2'),
    (v_user, 'earn',  5000, 'referral', 'Indicação · Família Ribeiro',
     now() - interval '12 days', (now() + interval '24 months')::date, 'v1', 'demo:pontos:referral-1'),
    (v_user, 'earn',  2500, 'order',    'Dubai Frame & Old Dubai',
     now() - interval '20 days', (now() + interval '24 months')::date, 'v1', 'demo:pontos:order-3')
  on conflict (idempotency_key) do nothing;
end $$;
