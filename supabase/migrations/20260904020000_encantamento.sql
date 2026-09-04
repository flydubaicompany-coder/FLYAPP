-- =============================================================================
-- Fase 9 — escuta ativa e tarefas de surpresa (§13.3, §13.4 e §44,
-- entregas 12, 13 e 14).
--
-- ## A policy mais importante deste arquivo e a que NAO tem `auth.uid()`
--
-- Todas as tabelas de cliente neste projeto seguem o mesmo molde: "a propria
-- pessoa, mais a equipe". `guest_insights` **quebra o molde de proposito**. A
-- §13.4 e literal: "O cliente nunca visualiza essas anotacoes internas."
--
-- Uma anotacao como "parece chateado com o guia" ou "comentou que o quarto
-- estava frio" existe para a Fly agir. Devolve-la ao cliente transformaria
-- escuta em vigilancia declarada, e a proxima anotacao seria escrita pensando
-- em quem vai ler — ou seja, nao seria escrita.
--
-- Copiar o molde aqui e o erro obvio, e ele passaria despercebido porque a
-- tela do app simplesmente nao pede essa tabela. Por isso ha asercao.
--
-- ## O que o cliente ve e um bit
--
-- A §13.3 pede exatamente isso: "No app, mostrar apenas um teaser, como 'Seu
-- proximo capitulo ja esta sendo preparado'. Nao revelar a surpresa fisica
-- antes da entrega." Entao existe uma funcao que responde **sim ou nao**, e
-- nada mais — nem titulo, nem orcamento, nem quem esta preparando.
--
-- ## Orcamento nao se inventa (§33)
--
-- "Orcamento de encantamento" esta na lista. O valor de cada tarefa e
-- digitado por quem aprova. O **teto** vive em `app_config` e nasce
-- `PENDENTE`: enquanto for, nao ha teto para conferir, e a funcao de
-- aprovacao diz isso em vez de fingir um limite.
-- =============================================================================

create type public.insight_category as enum (
  'preferencia',  -- "e fa do Travis Scott"
  'desejo',       -- "falou que queria uma camisa especifica"
  'celebracao',   -- "esta comemorando uma conquista"
  'incomodo',     -- "sentiu falta de Coca-Cola no quarto"
  'outro'
);

create type public.insight_urgency as enum ('baixa', 'normal', 'alta');

create type public.surprise_status as enum (
  'sugerida',   -- nasceu do insight, esperando aprovacao
  'aprovada',
  'recusada',
  'comprando',
  'pronta',
  'entregue',
  'cancelada'
);

/**
 * A escuta ativa (§13.4).
 *
 * Curta de proposito: "insight curto, categoria, urgencia e contexto". Quem
 * registra esta em pe, do lado do cliente, e um formulario longo vira um
 * formulario nao preenchido.
 */
create table public.guest_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,

  category public.insight_category not null default 'outro',
  urgency public.insight_urgency not null default 'normal',
  note text not null,
  context text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint guest_insights_nota_preenchida check (length(btrim(note)) between 1 and 500)
);

create index guest_insights_user_idx on public.guest_insights (user_id, created_at desc);
create index guest_insights_trip_idx on public.guest_insights (trip_id, created_at desc);
create index guest_insights_created_by_idx on public.guest_insights (created_by);
-- A fila da Gerencia da Experiencia: urgente primeiro, depois quem espera mais.
create index guest_insights_fila_idx on public.guest_insights (urgency desc, created_at);

comment on table public.guest_insights is
  'Anotacoes internas de encantamento (§13.4). O CLIENTE NUNCA LE — nem as proprias. Ver a policy.';

/**
 * A tarefa de surpresa (§13.3).
 *
 * O ciclo inteiro que a §13.3 lista: sugestao, orcamento, aprovacao,
 * responsavel, prazo, compra, preparacao, entrega, reacao e patrocinador.
 */
create table public.surprise_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  -- De onde nasceu. Nula = ideia da operacao, sem insight por tras.
  insight_id uuid references public.guest_insights (id) on delete set null,

  title text not null,
  description text,

  status public.surprise_status not null default 'sugerida',

  -- Orcamento em centavos, na moeda do pedido. Nulo ate alguem decidir (§33).
  budget_cents bigint,
  currency char(3),
  -- O que custou de verdade, quando se sabe.
  cost_cents bigint,
  sponsor text,

  owner_id uuid references auth.users (id) on delete set null,
  due_at timestamptz,

  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,

  delivered_at timestamptz,
  delivered_by uuid references auth.users (id) on delete set null,
  reaction text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint surprise_tasks_titulo_preenchido check (length(btrim(title)) > 0),
  constraint surprise_tasks_orcamento_nao_negativo
    check (budget_cents is null or budget_cents >= 0),
  constraint surprise_tasks_custo_nao_negativo
    check (cost_cents is null or cost_cents >= 0),
  -- Valor sem moeda nao e valor.
  constraint surprise_tasks_orcamento_tem_moeda
    check (budget_cents is null or currency is not null),
  constraint surprise_tasks_aprovacao_completa
    check ((approved_at is null) = (approved_by is null)),
  constraint surprise_tasks_entrega_completa
    check ((delivered_at is null) = (delivered_by is null))
);

create index surprise_tasks_user_idx on public.surprise_tasks (user_id, created_at desc);
create index surprise_tasks_trip_idx on public.surprise_tasks (trip_id, status);
create index surprise_tasks_owner_idx on public.surprise_tasks (owner_id);
create index surprise_tasks_insight_idx on public.surprise_tasks (insight_id);
create index surprise_tasks_approved_by_idx on public.surprise_tasks (approved_by);
create index surprise_tasks_delivered_by_idx on public.surprise_tasks (delivered_by);
create index surprise_tasks_created_by_idx on public.surprise_tasks (created_by);

create trigger surprise_tasks_touch before update on public.surprise_tasks
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Teto de orcamento — DELIBERADAMENTE PENDENTE (§33).
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'encantamento.budget_cap',
    '"PENDENTE"'::jsonb,
    'Teto por tarefa de surpresa, em centavos, por moeda: {"AED": 50000}. '
    || 'Nasce PENDENTE porque "orcamento de encantamento" esta na lista da §33 do que nunca se '
    || 'inventa. Enquanto for PENDENTE, a aprovacao nao confere teto nenhum e diz isso.',
    false
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Aprovar: papel e orcamento, os dois (§44, "surpresa segue papeis e orcamento").
-- -----------------------------------------------------------------------------
create or replace function public.aprovar_surpresa(
  p_task uuid,
  p_budget_cents bigint,
  p_currency char(3)
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.surprise_tasks;
  v_teto jsonb;
  v_limite bigint;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  /**
   * Quem aprova gasto e a Gerencia da Experiencia, e nao "a equipe".
   *
   * A §13.3 poe a aprovacao num papel especifico. Guia e midia registram
   * insight e entregam a surpresa; nenhum dos dois autoriza dinheiro.
   */
  if not (
    fly_private.has_role('experience')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'aprovacao de surpresa exige experiencia, trip_manager ou admin'
      using errcode = '42501';
  end if;

  select * into v_task from public.surprise_tasks t where t.id = p_task;
  if not found then
    raise exception 'tarefa nao encontrada' using errcode = 'P0002';
  end if;

  if v_task.status <> 'sugerida' then
    return query select false, 'Esta tarefa já saiu da fila de aprovação.'::text;
    return;
  end if;

  if p_budget_cents is null or p_budget_cents < 0 or p_currency is null then
    return query select false, 'Aprovar exige orçamento e moeda.'::text;
    return;
  end if;

  -- Teto, quando existir. Enquanto `PENDENTE`, nao ha limite para conferir —
  -- e inventar um seria exatamente o que a §33 proibe.
  select c.value into v_teto from public.app_config c where c.key = 'encantamento.budget_cap';
  if jsonb_typeof(v_teto) = 'object' then
    v_limite := (v_teto ->> p_currency)::bigint;
    if v_limite is not null and p_budget_cents > v_limite then
      return query select false,
        ('Acima do teto declarado para ' || p_currency || '.')::text;
      return;
    end if;
  end if;

  update public.surprise_tasks t
  set status = 'aprovada',
      budget_cents = p_budget_cents,
      currency = p_currency,
      approved_by = v_user,
      approved_at = now()
  where t.id = p_task;

  return query select true, null::text;
end;
$$;

/**
 * O unico bit que atravessa a parede (§13.3).
 *
 * "No app, mostrar apenas um teaser." Responde sim ou nao: ha alguma surpresa
 * aprovada e ainda nao entregue para esta pessoa. Nem titulo, nem orcamento,
 * nem quem esta preparando — porque a §13.3 manda nao revelar a surpresa
 * fisica antes da entrega.
 */
create or replace function public.tem_surpresa_a_caminho()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.surprise_tasks t
    where t.user_id = (select auth.uid())
      and t.status in ('aprovada', 'comprando', 'pronta')
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.guest_insights enable row level security;
alter table public.surprise_tasks enable row level security;

/**
 * ⚠️ NAO acrescente `(select auth.uid()) = user_id` aqui.
 *
 * Esta e a unica tabela de cliente do projeto que o proprio cliente **nao
 * le**, e e assim porque a §13.4 diz: "O cliente nunca visualiza essas
 * anotacoes internas." Ha teste guardando.
 */
create policy guest_insights_select_equipe on public.guest_insights for select to authenticated
  using (fly_private.is_staff());

create policy guest_insights_insert_equipe on public.guest_insights for insert to authenticated
  with check (fly_private.is_staff() and created_by = (select auth.uid()));

-- Anotacao nao se edita nem se apaga: o registro do que se ouviu e o valor.
-- Errou? Escreva outra. Nao ha GRANT de update nem de delete, abaixo.

/**
 * Tarefa de surpresa: equipe le, e a **operacao global** escreve.
 *
 * Guia e midia entregam, mas nao criam gasto. Quem cria e edita e quem
 * responde pelo orcamento.
 */
create policy surprise_tasks_select_equipe on public.surprise_tasks for select to authenticated
  using (fly_private.is_staff());

create policy surprise_tasks_write on public.surprise_tasks for all to authenticated
  using (
    fly_private.is_global_operator() or fly_private.has_role('experience')
  )
  with check (
    fly_private.is_global_operator() or fly_private.has_role('experience')
  );

revoke all on public.guest_insights from anon;
revoke all on public.surprise_tasks from anon;

grant select, insert on public.guest_insights to authenticated;
revoke update, delete on public.guest_insights from authenticated;

grant select, insert, update on public.surprise_tasks to authenticated;
-- Tarefa nao se apaga: cancelar e mudanca de estado, e o historico do gasto
-- precisa continuar existindo.
revoke delete on public.surprise_tasks from authenticated;

revoke all on function public.aprovar_surpresa(uuid, bigint, char) from public, anon;
grant execute on function public.aprovar_surpresa(uuid, bigint, char) to authenticated;

revoke all on function public.tem_surpresa_a_caminho() from public, anon;
grant execute on function public.tem_surpresa_a_caminho() to authenticated;
