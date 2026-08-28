-- =============================================================================
-- Fase 6 — fundacao da Carteira: pacote, Fly Points e nivel.
--
-- Tres dominios separados, como a §41 exige. Aqui entram dois:
--
--   pacote adquirido  -> Standard, Black, Billionaire   (customer_packages)
--   nivel de pontos   -> basic, prime, elite            (derivado do saldo)
--
-- O terceiro, **saldo financeiro**, NAO entra. A §41 e explicita: "saldo
-- financeiro e Fly Card ficam desligados sem parceiro", e nao ha parceiro de
-- pagamento (P09/P38). Criar a tabela agora seria convidar alguem a preenche-la.
-- =============================================================================

create type public.fly_package as enum ('standard', 'black', 'billionaire');

create type public.points_entry_kind as enum (
  'earn',     -- compra elegivel, check-in, desafio, evento, indicacao
  'redeem',   -- resgate de beneficio
  'expire',   -- vencimento
  'adjust',   -- ajuste interno, sempre com responsavel e motivo
  'reverse'   -- estorno de um lancamento anterior
);

-- -----------------------------------------------------------------------------
-- Pacote do cliente.
--
-- **Nao mora em `profiles` de proposito.** A policy `profiles_update_own`
-- deixa o cliente editar a propria linha — se o pacote estivesse la, qualquer
-- um se promoveria a Billionaire com uma chamada direta. Mesma razao pela qual
-- o papel vive em `user_roles`.
-- -----------------------------------------------------------------------------
create table public.customer_packages (
  user_id uuid primary key references auth.users (id) on delete cascade,
  package public.fly_package not null,
  -- Por que este cliente tem este pacote. Contrato, cortesia, upgrade.
  note text,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null
);

comment on table public.customer_packages is
  'Pacote adquirido (Standard/Black/Billionaire). NAO e nivel de pontos — ver D95.';

-- -----------------------------------------------------------------------------
-- Ledger de Fly Points. Append-only, sem excecao.
--
-- A §8.3 lista o que todo lancamento precisa carregar, e cada coluna abaixo e
-- um item dessa lista. `amount` e assinado: ganho positivo, resgate negativo.
-- O saldo e a soma, nunca um campo guardado — campo guardado e a forma mais
-- comum de saldo divergir do extrato.
-- -----------------------------------------------------------------------------
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.points_entry_kind not null,
  amount int not null,

  -- De onde veio: 'order', 'checkin', 'challenge', 'event', 'referral', 'ops'.
  source text not null,
  -- Id da coisa que originou, quando existe (pedido, atividade, evento).
  reference text,

  occurred_at timestamptz not null default now(),
  -- Nulo enquanto a validade nao for decidida (§33 proibe inventar).
  expires_on date,

  -- Qual versao da regra gerou o lancamento. Sem isto, recalcular o passado
  -- com a regra de hoje produz numero diferente e ninguem sabe por que.
  rule_version text,

  -- Idempotencia: webhook repetido nao pontua duas vezes.
  idempotency_key text not null,

  -- Quem lancou. Nulo = sistema.
  created_by uuid references auth.users (id) on delete set null,
  -- Estorno aponta para o lancamento que reverte.
  reverses_id uuid references public.points_ledger (id),
  reason text,
  created_at timestamptz not null default now(),

  constraint points_ledger_idempotency_unique unique (idempotency_key),
  constraint points_ledger_amount_nonzero check (amount <> 0),
  -- Ganho soma, resgate e vencimento subtraem. Ajuste e estorno podem os dois.
  constraint points_ledger_sign_matches_kind check (
    (kind = 'earn' and amount > 0)
    or (kind in ('redeem', 'expire') and amount < 0)
    or (kind in ('adjust', 'reverse'))
  ),
  -- Estorno sem alvo nao e estorno, e lancamento solto.
  constraint points_ledger_reverse_has_target check (
    (kind = 'reverse') = (reverses_id is not null)
  ),
  -- Ajuste sem motivo e ajuste que ninguem consegue auditar depois.
  constraint points_ledger_adjust_has_reason check (
    kind <> 'adjust' or (reason is not null and length(btrim(reason)) > 0)
  )
);

create index points_ledger_user_idx on public.points_ledger (user_id, occurred_at desc);
create index points_ledger_reverses_idx on public.points_ledger (reverses_id);

comment on table public.points_ledger is
  'Append-only. Corrigir um lancamento e lancar o oposto, nunca editar ou apagar.';

-- -----------------------------------------------------------------------------
-- A regra de append-only nao pode depender so de GRANT.
--
-- GRANT protege o cliente; nao protege um bug no painel, uma funcao
-- `security definer` distraida, nem alguem com papel de servico. O gatilho
-- fecha o caminho para todos.
-- -----------------------------------------------------------------------------
create or replace function fly_private.points_ledger_is_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'points_ledger e append-only: para corrigir, lance um estorno (kind = reverse) apontando para o lancamento original.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger points_ledger_no_update
  before update on public.points_ledger
  for each row execute function fly_private.points_ledger_is_append_only();

create trigger points_ledger_no_delete
  before delete on public.points_ledger
  for each row execute function fly_private.points_ledger_is_append_only();

-- -----------------------------------------------------------------------------
-- Saldo. Soma do ledger, sempre.
-- -----------------------------------------------------------------------------
create view public.points_balance
with (security_invoker = true)
as
  select
    l.user_id,
    coalesce(sum(l.amount), 0)::int as balance,
    coalesce(sum(l.amount) filter (where l.amount > 0), 0)::int as earned,
    max(l.occurred_at) as last_entry_at
  from public.points_ledger l
  group by l.user_id;

comment on view public.points_balance is
  'Saldo derivado do ledger. Nao guarde saldo em coluna: ele diverge do extrato.';

-- -----------------------------------------------------------------------------
-- Limiares de nivel — DELIBERADAMENTE NULOS.
--
-- Quantos pontos separam basic de prime, e prime de elite, e decisao do dono
-- (P12, aberta). A §33 proibe inventar, entao o valor nasce nulo e a tela diz
-- "a definir" em vez de mostrar um numero chutado.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'points.level_thresholds',
    '{"prime": null, "elite": null}'::jsonb,
    'Pontos necessarios para prime e elite. NULO = ainda nao decidido (P12). O app mostra "a definir" enquanto for nulo.',
    true
  ),
  (
    'points.earning_rule',
    '{"version": null, "description": null}'::jsonb,
    'Como se ganha ponto. NULO = ainda nao decidido (P12). Nenhum lancamento automatico acontece enquanto for nulo.',
    false
  ),
  (
    'wallet.financial_balance_enabled',
    'false'::jsonb,
    'Saldo financeiro e Fly Card. Fica FALSO ate haver parceiro de pagamento homologado (P09/P38). A §41 exige que nasca desligado.',
    true
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS e GRANT. Sao controles diferentes: os dois precisam existir.
-- -----------------------------------------------------------------------------
alter table public.customer_packages enable row level security;
alter table public.points_ledger     enable row level security;

-- O cliente le o proprio pacote; a equipe le todos; so operador global escreve.
create policy customer_packages_select on public.customer_packages for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy customer_packages_insert_operator on public.customer_packages for insert to authenticated
  with check (fly_private.is_global_operator());
create policy customer_packages_update_operator on public.customer_packages for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy customer_packages_delete_operator on public.customer_packages for delete to authenticated
  using (fly_private.is_global_operator());

-- O cliente le o proprio extrato; a equipe le todos; so operador lanca.
create policy points_ledger_select on public.points_ledger for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy points_ledger_insert_operator on public.points_ledger for insert to authenticated
  with check (fly_private.is_global_operator());

-- Sem policy de UPDATE e DELETE: append-only comeca por nao existir caminho.

grant select on public.customer_packages to authenticated;
grant insert, update, delete on public.customer_packages to authenticated;

grant select on public.points_ledger to authenticated;
grant insert on public.points_ledger to authenticated;
-- UPDATE e DELETE nao sao concedidos. O gatilho acima e a segunda tranca.

grant select on public.points_balance to authenticated;
