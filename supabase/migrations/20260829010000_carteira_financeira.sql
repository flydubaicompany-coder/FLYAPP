-- =============================================================================
-- Fase 6 — saldo financeiro da Carteira (§8.2 e §41).
--
-- A §41 lista `wallet_entries` como tabela propria: **dinheiro, pontos e
-- status sao dominios separados**, e este arquivo constroi o primeiro.
--
-- ## O que a §41 desliga sem parceiro, e o que nao desliga
--
-- "saldo financeiro e Fly Card ficam desligados sem parceiro" trata de
-- **entrada de dinheiro do cliente**: recarga por Pix ou cartao, transferencia
-- e o cartao fisico. Nada disso funciona sem PSP, e continua desligado.
--
-- O que **nao** depende de parceiro e o credito que a **propria Fly** concede:
-- cortesia por um transfer atrasado, reembolso que volta como credito, ajuste
-- de operacao. Esse dinheiro ja e da Fly, ja mudou de mao, e o cliente precisa
-- ver. Sem esta tabela, esse valor viveria numa planilha.
--
-- ## Append-only, como o ledger de pontos
--
-- Saldo e soma, nunca coluna. Corrigir e lancar o oposto. Mesmas tres trancas:
-- sem policy de update/delete, sem GRANT, e gatilho que recusa ate para o dono
-- do banco.
-- =============================================================================

create type public.wallet_entry_kind as enum (
  'credit',   -- a Fly creditou (cortesia, campanha, ajuste a favor)
  'topup',    -- o cliente recarregou. Exige PSP; hoje nada gera.
  'debit',    -- gasto na Fly
  'refund',   -- devolucao que volta como credito
  'adjust',   -- ajuste de operacao, sempre com motivo
  'reverse'   -- estorno de um lancamento anterior
);

create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.wallet_entry_kind not null,

  -- Assinado: entrada positiva, saida negativa. Em centavos, sempre.
  amount_cents bigint not null,
  currency public.currency_code not null,

  source text not null,
  reference text,
  occurred_at timestamptz not null default now(),

  idempotency_key text not null,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  reverses_id uuid references public.wallet_entries (id),
  created_at timestamptz not null default now(),

  constraint wallet_entries_idempotency_unique unique (idempotency_key),
  constraint wallet_entries_amount_nonzero check (amount_cents <> 0),
  constraint wallet_entries_sign_matches_kind check (
    (kind in ('credit', 'topup', 'refund') and amount_cents > 0)
    or (kind = 'debit' and amount_cents < 0)
    or (kind in ('adjust', 'reverse'))
  ),
  constraint wallet_entries_reverse_has_target check (
    (kind = 'reverse') = (reverses_id is not null)
  ),
  constraint wallet_entries_adjust_has_reason check (
    kind <> 'adjust' or (reason is not null and length(btrim(reason)) > 0)
  )
);

create index wallet_entries_user_idx on public.wallet_entries (user_id, occurred_at desc);

comment on table public.wallet_entries is
  'Dinheiro. Dominio separado de pontos e de status (§41). Append-only.';

create or replace function fly_private.wallet_is_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'wallet_entries e append-only: para corrigir, lance o oposto (kind = reverse) apontando para o lancamento original.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger wallet_entries_no_update
  before update on public.wallet_entries
  for each row execute function fly_private.wallet_is_append_only();
create trigger wallet_entries_no_delete
  before delete on public.wallet_entries
  for each row execute function fly_private.wallet_is_append_only();

-- Saldo por moeda. Somar moedas diferentes exige cambio, e a §33 proibe
-- inventar cambio — entao o saldo e por moeda, e nao um total unico.
create view public.wallet_balance
with (security_invoker = true)
as
  select
    w.user_id,
    w.currency,
    coalesce(sum(w.amount_cents), 0)::bigint as balance_cents,
    max(w.occurred_at) as last_entry_at
  from public.wallet_entries w
  group by w.user_id, w.currency;

comment on view public.wallet_balance is
  'Saldo por moeda. Nao ha total unico: somar moedas exigiria cambio (§33).';

-- -----------------------------------------------------------------------------
-- Configuracao.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'wallet.topup_enabled',
    'false'::jsonb,
    'Recarga pelo cliente (Pix, cartao) e transferencia. Exige PSP homologado (P09/P38). A §41 manda nascer desligado.',
    true
  ),
  (
    'wallet.points_to_currency_rate',
    'null'::jsonb,
    'Quantos centavos vale 1 Fly Point, para a estimativa "≈ R$ X". NULO = nao decidido. Taxa financeira esta na lista da §33 do que nunca se inventa — o app omite a estimativa enquanto for nulo.',
    true
  )
on conflict (key) do nothing;

-- O saldo financeiro deixa de nascer desligado: a leitura passa a existir.
-- O que continua desligado e a **entrada de dinheiro do cliente**, acima.
update public.app_config
set value = 'true'::jsonb,
    description = 'Leitura do saldo financeiro na Carteira. O que exige parceiro e a recarga — ver wallet.topup_enabled.',
    updated_at = now()
where key = 'wallet.financial_balance_enabled';

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.wallet_entries enable row level security;

create policy wallet_entries_select on public.wallet_entries for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy wallet_entries_insert_operator on public.wallet_entries for insert to authenticated
  with check (fly_private.is_global_operator());

-- Sem policy de update/delete: append-only comeca por nao existir caminho.

revoke all on public.wallet_entries from anon;
revoke all on public.wallet_balance from anon;
grant select on public.wallet_entries to authenticated;
grant insert on public.wallet_entries to authenticated;
revoke update, delete on public.wallet_entries from authenticated;
grant select on public.wallet_balance to authenticated;
