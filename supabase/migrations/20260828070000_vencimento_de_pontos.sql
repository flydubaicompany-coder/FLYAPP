-- =============================================================================
-- Fase 6 — os pontos vencem de verdade.
--
-- Achado revisando o app: a Carteira diz ao cliente "cada ponto vale por 24
-- meses", `expires_on` e gravado em todo credito e o tipo `expire` existe no
-- enum — mas **nada nunca criou um lancamento de vencimento**. A promessa
-- ficaria sem cumprir por dois anos e so entao apareceria, com saldo alto
-- demais e ninguem sabendo por que.
--
-- ## O modelo: lotes FIFO
--
-- Cada credito e um **lote** com data de vencimento propria. Todo debito
-- (resgate, estorno, vencimento anterior) consome os lotes **do mais antigo
-- para o mais novo** — que e o padrao de programa de fidelidade e o que
-- favorece o cliente, porque gasta primeiro o que venceria antes.
--
-- Vence apenas o **saldo remanescente** de um lote ja vencido. Um lote de
-- 10.000 do qual 7.000 ja foram gastos vence 3.000, nao 10.000.
--
-- ## Idempotencia
--
-- A chave e `expire:<id do lote>`. Rodar duas vezes no mesmo dia, ou duas
-- vezes no mesmo minuto, nao tira ponto duas vezes.
-- =============================================================================

create or replace function public.vencer_pontos(p_ate date default null)
returns table (ok boolean, lotes int, pontos int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corte date := coalesce(p_ate, current_date);
  v_lotes int := 0;
  v_pontos int := 0;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  with
  -- Tudo que ja saiu da conta de cada cliente, em valor absoluto.
  debitos as (
    select l.user_id, coalesce(sum(-l.amount), 0)::bigint as gasto
    from public.points_ledger l
    where l.amount < 0
    group by l.user_id
  ),
  -- Os creditos, do mais antigo para o mais novo, com o acumulado ANTES de
  -- cada um. E esse acumulado que diz quanto do lote o gasto ja alcancou.
  lotes as (
    select
      l.id, l.user_id, l.amount, l.expires_on,
      coalesce(
        sum(l.amount) over (
          partition by l.user_id order by l.occurred_at, l.id
          rows between unbounded preceding and 1 preceding
        ), 0
      )::bigint as antes
    from public.points_ledger l
    where l.kind = 'earn' and l.expires_on is not null
  ),
  vencidos as (
    select
      lo.id, lo.user_id,
      -- O que sobra do lote: o que ele vale menos o que o gasto ja comeu
      -- dele. `greatest(0, …)` porque o gasto pode ter passado do lote
      -- inteiro, e `least(amount, …)` porque nao pode sobrar mais do que ele
      -- tinha.
      least(
        lo.amount,
        greatest(0, lo.amount - greatest(0, coalesce(d.gasto, 0) - lo.antes))
      )::int as resta
    from lotes lo
    left join debitos d on d.user_id = lo.user_id
    where lo.expires_on < v_corte
  )
  insert into public.points_ledger
    (user_id, kind, amount, source, occurred_at, rule_version, idempotency_key, reason)
  select
    v.user_id, 'expire', -v.resta, 'system', now(),
    fly_private.versao_da_regra(),
    'expire:' || v.id::text,
    'Vencimento de pontos'
  from vencidos v
  where v.resta > 0
  on conflict (idempotency_key) do nothing;

  get diagnostics v_lotes = row_count;

  select coalesce(sum(-l.amount), 0)::int into v_pontos
  from public.points_ledger l
  where l.kind = 'expire' and l.created_at > now() - interval '1 minute';

  return query select true, v_lotes, v_pontos;
end;
$$;

comment on function public.vencer_pontos(date) is
  'Vence o saldo remanescente de lotes ja vencidos, em FIFO. Idempotente por lote.';

revoke all on function public.vencer_pontos(date) from public, anon;
grant execute on function public.vencer_pontos(date) to authenticated;
