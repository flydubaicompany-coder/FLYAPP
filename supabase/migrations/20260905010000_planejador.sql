-- =============================================================================
-- Fase 10 — planejador financeiro (§15.4 e §45, entrega 7).
--
-- ## A regra que decide o desenho inteiro
--
-- "Nao misturar gasto manual com extrato financeiro oficial" (§15.4, literal).
--
-- Por isso o gasto manual e **tabela separada**, e nao uma linha em
-- `wallet_entries` com uma flag dizendo "esta e de mentira". Uma coluna
-- `origem` naquele ledger convidaria, no primeiro relatorio, a um `sum()` sem
-- filtro — e o extrato financeiro da Fly passaria a incluir o cafe que o
-- cliente anotou no celular.
--
-- Os dois numeros vivem separados no banco, sao lidos separados e sao
-- mostrados separados. Somar os dois e uma escolha que a tela faz explicita,
-- com rotulo, e nunca o padrao.
--
-- ## O orcamento e do cliente, e nao da Fly
--
-- "Orcamento diario" e "alerta de limite" (§15.4) sao dinheiro **dele**. Nao e
-- a regra de encantamento da §33, que e orcamento da Fly — e por isso aqui o
-- valor pode ser digitado sem decisao do dono do produto. Quem define quanto
-- quer gastar por dia na viagem e quem vai gastar.
--
-- ## O que continua sem existir
--
-- **Tax-free estimado.** A §15.4 pede, e a P47 continua aberta: a regra de
-- tax-free esta na lista da §33 do que nunca se inventa. O planejador mostra
-- as notas registradas e diz que o valor a receber depende da regra — igual a
-- tela de notas da Fase 6 (D159).
--
-- **Cambio.** "Moedas" na §15.4 vira: cada gasto guarda a **sua** moeda, e os
-- totais sao por moeda. Nao ha conversao, porque taxa de cambio esta na lista
-- da §33 e um numero convertido por uma taxa inventada e pior do que dois
-- numeros em moedas diferentes.
-- =============================================================================

create type public.expense_category as enum (
  'alimentacao',
  'transporte',
  'compras',
  'lazer',
  'saude',
  'outro'
);

create table public.manual_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,

  amount_cents bigint not null,
  currency char(3) not null,
  category public.expense_category not null default 'outro',
  note text,
  spent_on date not null default current_date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint manual_expenses_valor_positivo check (amount_cents > 0),
  constraint manual_expenses_moeda_conhecida check (currency in ('BRL', 'AED', 'USD', 'EUR')),
  constraint manual_expenses_nota_curta check (note is null or length(note) <= 200)
);

create index manual_expenses_user_idx on public.manual_expenses (user_id, spent_on desc);
create index manual_expenses_trip_idx on public.manual_expenses (trip_id, spent_on);

comment on table public.manual_expenses is
  'Gasto que o CLIENTE anotou. Nunca entra em wallet_entries nem em nenhum total oficial (§15.4).';

/**
 * O orcamento diario que o cliente escolheu (§15.4).
 *
 * Um por viagem e por pessoa. Guardado em centavos e com moeda, como todo
 * dinheiro neste projeto — numero de dinheiro sem moeda ja causou bug aqui.
 */
create table public.trip_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,

  daily_limit_cents bigint not null,
  currency char(3) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trip_budgets_unico unique (user_id, trip_id),
  constraint trip_budgets_limite_positivo check (daily_limit_cents > 0),
  constraint trip_budgets_moeda_conhecida check (currency in ('BRL', 'AED', 'USD', 'EUR'))
);

create index trip_budgets_trip_idx on public.trip_budgets (trip_id);

create trigger manual_expenses_touch before update on public.manual_expenses
  for each row execute function fly_private.touch_updated_at();
create trigger trip_budgets_touch before update on public.trip_budgets
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.manual_expenses enable row level security;
alter table public.trip_budgets    enable row level security;

/**
 * Gasto anotado e **so do dono**. Nem a equipe le.
 *
 * Diferente de tudo o mais neste projeto, onde "a propria pessoa, mais a
 * equipe" e o molde. Aqui a equipe fica de fora de proposito: o que a pessoa
 * gastou por conta dela, no proprio dinheiro, anotado num caderno digital,
 * nao e operacao da Fly. A Fly ve o que a Fly cobrou — isso esta em `orders` e
 * `wallet_entries`, e continua visivel.
 *
 * A §9.3 ja tinha estabelecido a mesma linha ao proibir expor gasto exato no
 * ranking. Aqui ela vale contra a propria equipe.
 */
create policy manual_expenses_proprio on public.manual_expenses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy trip_budgets_proprio on public.trip_budgets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.manual_expenses from anon;
revoke all on public.trip_budgets    from anon;

grant select, insert, update, delete on public.manual_expenses to authenticated;
grant select, insert, update, delete on public.trip_budgets to authenticated;
