-- =============================================================================
-- Fases 10 e 11 — as SETE migrations que faltam no projeto ptmifjnfskwipjjxauns.
--
-- As Fases 8 e 9 JA ESTAO aplicadas: conferido em 06/09/2026 pelo PostgREST.
-- `map_places`, `stickers`, `quest_missions`, `guest_insights`,
-- `influencer_profiles` e `media_tags` respondem 401/42501 (existem e a RLS
-- recusa o anonimo), e `abrir_atendimento` resolve com `p_activity`/`p_order`.
-- Por isso elas NAO estao aqui: reaplica-las derrubaria a transacao inteira.
--
-- Prefira `npx supabase db push` se puder fazer login na CLI. Este arquivo e o
-- caminho alternativo, e tambem registra as sete no historico, no fim.
--
-- Rode inteiro, de uma vez. Esta em transacao: ou entra tudo, ou nada.
--
-- ⚠️ DUAS COISAS AQUI TIRAM PERMISSAO, ao contrario de tudo o que veio antes:
--
--   • `20260906000000_operacao` remove as policies de escrita de `app_config`
--     e de `feature_flags`, e revoga insert/update/delete de `authenticated`
--     nas duas. A partir dai a unica porta e RPC, e a RPC grava a trilha com o
--     valor anterior. Nenhum codigo escrevia nelas direto — conferido.
--   • A mesma migration troca a policy de leitura de `audit_logs`: era admin,
--     passa a ser operador global.
-- =============================================================================

begin;

-- >>>>> 20260905000000_assistente.sql >>>>>
-- =============================================================================
-- Fase 10 — Assistente Fly (§15.1 e §45, entregas 1, 2, 3, 4, 10 e 11).
--
-- ## O assistente nasce desligado, e nao e falta de vontade
--
-- A §45 fecha com "integracao nao homologada permanece desligada", e a §33
-- proibe declarar integracao real sem credencial, contrato, homologacao e
-- teste. Nao ha credencial de modelo neste projeto. Entao a flag nasce
-- desligada, o provedor nasce `PENDENTE`, e a tela do app **diz isso** em vez
-- de fingir que o assistente esta pensando.
--
-- Mesmo desenho que o checkout da Fase 5, pelo mesmo motivo: duas chaves, uma
-- para o interruptor e outra para qual adapter. Desligar um provedor com
-- problema, sem apagar qual provedor era, e uma operacao que se faz as tres da
-- manha.
--
-- ## O que este arquivo NAO tem: uma tool que escreve
--
-- A §45 pede "acao mutavel exige confirmacao". A leitura aqui e mais estreita
-- do que a regra permite: **nao ha acao mutavel**. O assistente le e responde;
-- quando a pessoa quer que algo aconteca, ele abre um atendimento — a Fase 8
-- ja tem fila, SLA e gente do outro lado. Confirmar uma acao que o modelo
-- propos e uma superficie de erro que ainda nao precisa existir.
--
-- ## Por que ha tabela de auditoria antes de haver assistente
--
-- "Custos e falhas sao observaveis" e criterio da §45, e observabilidade que
-- se acrescenta depois nunca cobre o comeco. As tabelas nascem junto: a
-- primeira pergunta que o assistente responder ja vai estar medida.
-- =============================================================================

create type public.assistant_outcome as enum (
  'respondeu',
  'sem_provedor',   -- flag desligada, provedor PENDENTE ou sem credencial
  'sem_resposta',   -- o modelo nao encontrou base nas ferramentas
  'handoff',        -- virou atendimento humano
  'erro'
);

/**
 * Uma pergunta e o que ela custou (§45, entrega 11).
 *
 * A pergunta e a resposta ficam gravadas porque **o cliente le a propria
 * conversa** e porque o handoff precisa levar contexto (§45, "handoff preserva
 * contexto permitido"). O que NAO fica gravado aqui e o contexto que foi ao
 * modelo: ele e derivado das ferramentas, e guardar uma segunda copia dele
 * seria guardar o roteiro inteiro por pergunta.
 */
create table public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,

  pergunta text not null,
  resposta text,

  provedor text not null,
  modelo text,
  resultado public.assistant_outcome not null default 'erro',
  erro text,

  -- Consumo e custo estimado. **Estimado** esta no nome da coluna: a fatura e
  -- do provedor, e isto e o que a operacao ve sem esperar o fim do mes.
  tokens_entrada int,
  tokens_saida int,
  custo_estimado_centavos int,
  duracao_ms int,

  -- Quando virou gente (§45, entrega 3).
  support_case_id uuid references public.support_cases (id) on delete set null,

  created_at timestamptz not null default now(),

  constraint assistant_runs_pergunta_preenchida
    check (length(btrim(pergunta)) between 1 and 2000),
  constraint assistant_runs_consumo_nao_negativo check (
    (tokens_entrada is null or tokens_entrada >= 0)
    and (tokens_saida is null or tokens_saida >= 0)
    and (custo_estimado_centavos is null or custo_estimado_centavos >= 0)
  )
);

create index assistant_runs_user_idx on public.assistant_runs (user_id, created_at desc);
create index assistant_runs_custo_idx on public.assistant_runs (created_at desc)
  where custo_estimado_centavos is not null;
create index assistant_runs_trip_idx on public.assistant_runs (trip_id);
create index assistant_runs_caso_idx on public.assistant_runs (support_case_id);

/**
 * Toda chamada de ferramenta, autorizada ou nao (§45, "toda tool tem
 * autorizacao").
 *
 * Guardar tambem a **recusada** e o ponto. Uma sequencia de recusas e o sinal
 * de que alguem esta tentando alcancar dado que nao e dele pelo assistente —
 * e guardar so o sucesso apagaria o sinal. E a mesma razao de `qr_scans`
 * registrar tentativa, e nao so leitura boa.
 */
create table public.assistant_tool_calls (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.assistant_runs (id) on delete cascade,

  ferramenta text not null,
  autorizada boolean not null,
  -- Quantas linhas o banco devolveu **depois** da RLS. Zero num pedido que o
  -- modelo achou que faria sentido e o sinal mais barato de tentativa de
  -- alcance indevido.
  linhas int,
  erro text,
  created_at timestamptz not null default now()
);

create index assistant_tool_calls_run_idx on public.assistant_tool_calls (run_id);
create index assistant_tool_calls_recusadas_idx
  on public.assistant_tool_calls (created_at desc) where not autorizada;

/**
 * "Recomendacao pode ser recusada" (§45, entrega 4).
 *
 * Sem isto, "recomendacoes com motivo e feedback" seria so recomendacao com
 * motivo. O `util = false` com texto e o unico jeito de a operacao descobrir
 * que o assistente esta respondendo bonito e errado.
 */
create table public.assistant_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.assistant_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  util boolean not null,
  motivo text,
  created_at timestamptz not null default now(),

  constraint assistant_feedback_unico unique (run_id, user_id)
);

create index assistant_feedback_run_idx on public.assistant_feedback (run_id);
create index assistant_feedback_ruins_idx on public.assistant_feedback (created_at desc)
  where not util;

-- -----------------------------------------------------------------------------
-- Configuracao — tudo desligado e pendente.
-- -----------------------------------------------------------------------------
insert into public.feature_flags (key, is_enabled, description) values
  ('assistant.enabled', false,
   'Assistente Fly. Nasce desligada: nao ha credencial de modelo, e a §45 manda integracao nao homologada ficar desligada. Com ela desligada a tela diz que o assistente nao esta disponivel e oferece a equipe.')
on conflict (key) do nothing;

insert into public.app_config (key, value, description, is_public) values
  (
    'assistant.provider',
    '"PENDENTE"'::jsonb,
    'Qual adapter atende o assistente. O unico escrito e "claude". Nome desconhecido cai no desligado, de proposito: erro de digitacao na configuracao nao pode virar chamada paga em producao.',
    false
  ),
  (
    'assistant.model',
    '"claude-opus-5"'::jsonb,
    'Modelo usado quando o provedor e "claude". Fica em configuracao para trocar de modelo nao exigir release.',
    false
  ),
  (
    'assistant.pricing_usd_per_million',
    '{"input": 5, "output": 25}'::jsonb,
    'Preco por milhao de tokens, em dolar, usado SO para estimar custo em `assistant_runs`. E preco de fornecedor, nao taxa cobrada do cliente — confira na pagina de precos da Anthropic antes de confiar no numero.',
    false
  ),
  (
    'assistant.max_output_tokens',
    '4000'::jsonb,
    'Teto de saida por resposta. Resposta de concierge e curta; o teto existe como controle de custo, e nao como limite de qualidade.',
    false
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.assistant_runs       enable row level security;
alter table public.assistant_tool_calls enable row level security;
alter table public.assistant_feedback   enable row level security;

/**
 * O cliente le a propria conversa; a equipe le todas.
 *
 * Diferente de `guest_insights` (D212), aqui o cliente **le**: a conversa e
 * dele, ele acabou de ter, e esconde-la seria esconder o que ele mesmo
 * escreveu.
 */
create policy assistant_runs_select on public.assistant_runs for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

/**
 * Quem grava e a Edge Function, com `service_role`.
 *
 * Nao ha policy nem GRANT de insert para `authenticated`, e isso e o desenho:
 * se o cliente pudesse inserir em `assistant_runs`, ele escreveria a propria
 * medicao de custo — e a auditoria de gasto viraria ficcao.
 */
create policy assistant_tool_calls_select on public.assistant_tool_calls
  for select to authenticated
  using (
    exists (
      select 1 from public.assistant_runs r
      where r.id = assistant_tool_calls.run_id
        and (r.user_id = (select auth.uid()) or fly_private.is_staff())
    )
  );

create policy assistant_feedback_select on public.assistant_feedback for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

-- O feedback e a unica coisa que o cliente escreve aqui — e so sobre a
-- propria conversa.
create policy assistant_feedback_insert on public.assistant_feedback for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.assistant_runs r
      where r.id = assistant_feedback.run_id and r.user_id = (select auth.uid())
    )
  );

revoke all on public.assistant_runs       from anon;
revoke all on public.assistant_tool_calls from anon;
revoke all on public.assistant_feedback   from anon;

grant select on public.assistant_runs to authenticated;
grant select on public.assistant_tool_calls to authenticated;
grant select, insert on public.assistant_feedback to authenticated;
-- Medicao de custo nao se edita nem se apaga por quem foi medido.
revoke insert, update, delete on public.assistant_runs from authenticated;
revoke insert, update, delete on public.assistant_tool_calls from authenticated;
revoke update, delete on public.assistant_feedback from authenticated;

-- >>>>> 20260905010000_planejador.sql >>>>>
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

-- >>>>> 20260905020000_mala.sql >>>>>
-- =============================================================================
-- Fase 10 — Mala Pronta (§30 item 5 e §45, entrega 8).
--
-- ## De onde vem a lista, e por que nao ha "inteligencia" aqui
--
-- A §45 pede "Mala Pronta por roteiro/clima". O **roteiro** ja tem a resposta
-- desde a Fase 4: `activities.what_to_bring` e `activities.dress_code` sao
-- campos que a operacao preenche por atividade. Um passeio de deserto que pede
-- casaco ja diz isso na propria atividade — a Mala Pronta so junta.
--
-- O **clima** nao entra, e nao e esquecimento: exigiria provedor de
-- meteorologia, e a §33 nao deixa declarar integracao sem credencial,
-- contrato e homologacao. A tela diz que a lista vem do roteiro e nao do
-- tempo. Uma lista que se apresenta como "pelo clima" e foi montada por
-- adivinhacao e pior do que uma lista honesta.
--
-- ## Uma tabela de marcacao, e nao uma de lista
--
-- A lista e **derivada**: sai do roteiro e dos itens curados. Guardar uma
-- copia dela por pessoa criaria a divergencia classica — a operacao muda o que
-- levar numa atividade, e a mala de quem ja abriu a tela continua com o texto
-- velho.
--
-- O que se guarda e o que a pessoa **fez**: marcou, ou acrescentou. A chave e
-- o texto do item, normalizado, porque item derivado nao tem id estavel.
-- =============================================================================

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  -- Um dos dois, ou nenhum: item de uma viagem, de um destino, ou geral.
  trip_id uuid references public.trips (id) on delete cascade,
  destination_id uuid references public.destinations (id) on delete cascade,

  label text not null,
  note text,
  sort_order int not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint packing_items_label_preenchido check (length(btrim(label)) between 1 and 120)
);

create index packing_items_trip_idx on public.packing_items (trip_id, sort_order);
create index packing_items_destino_idx on public.packing_items (destination_id, sort_order);

/**
 * O que a pessoa marcou ou acrescentou.
 *
 * `item` guarda o texto normalizado (minusculas, sem espaco nas pontas) porque
 * item vindo do roteiro nao tem id estavel — ele e a string que a operacao
 * escreveu em `what_to_bring`. Trocar o texto la desmarca aqui, e isso e o
 * comportamento certo: e outro item.
 */
create table public.packing_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,

  item text not null,
  -- true = a pessoa acrescentou este item; false = veio do roteiro ou da Fly.
  proprio boolean not null default false,
  marcado boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint packing_checks_unico unique (user_id, trip_id, item),
  constraint packing_checks_item_preenchido check (length(btrim(item)) between 1 and 120)
);

create index packing_checks_user_idx on public.packing_checks (user_id, trip_id);

create trigger packing_items_touch before update on public.packing_items
  for each row execute function fly_private.touch_updated_at();
create trigger packing_checks_touch before update on public.packing_checks
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.packing_items  enable row level security;
alter table public.packing_checks enable row level security;

-- Item curado: quem esta na viagem le o ativo; quem opera escreve.
create policy packing_items_select on public.packing_items for select to authenticated
  using (
    (is_active and (trip_id is null or fly_private.is_trip_member(trip_id)))
    or fly_private.is_global_operator()
  );

create policy packing_items_write on public.packing_items for all to authenticated
  using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

/**
 * A marcacao e so do dono, e nem a equipe le.
 *
 * Mesma linha do planejador financeiro: o que a pessoa separou para a mala nao
 * e operacao da Fly. Saber que alguem ainda nao marcou "passaporte" seria util
 * — e seria exatamente o tipo de utilidade que transforma uma lista pessoal em
 * cobranca.
 */
create policy packing_checks_proprio on public.packing_checks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.packing_items  from anon;
revoke all on public.packing_checks from anon;

grant select, insert, update, delete on public.packing_items to authenticated;
grant select, insert, update, delete on public.packing_checks to authenticated;

-- >>>>> 20260906000000_operacao.sql >>>>>
-- =============================================================================
-- Fase 11 — a operação para de precisar de SQL (§46, entregas 5, 10 e 11)
--
-- A auditoria de paridade (`docs/quality/PARIDADE.md`) achou quatro coisas que
-- só existiam por dentro do banco:
--
--   • dar e tirar papel da equipe;
--   • atribuir alguém a uma viagem;
--   • mudar `app_config` e `feature_flags`;
--   • mandar um aviso para o cliente — `notifications` só tinha GRANT de
--     leitura, e o app tem uma caixa de avisos que ninguém conseguia encher.
--
-- O critério da §46 é literal: "nenhuma mudança comum exige editar código".
-- Hoje três delas exigem abrir o banco, que é pior.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. A trilha, num lugar só
--
-- `audit_logs` existe desde a Fase 0 e catorze funções escrevem nela à mão.
-- Nenhuma preenche `actor_role`, porque descobrir o papel de quem age dá três
-- linhas e ninguém as escreveu duas vezes.
--
-- O papel gravado é o **maior** de quem agiu. A ordem do enum `fly_role` foi
-- declarada do menor para o maior privilégio (`customer` … `admin`), então
-- `max(role)` é exatamente isso — e essa é a razão de a ordem do enum não ser
-- alfabética. Quem acrescentar papel novo no meio precisa saber disso.
-- -----------------------------------------------------------------------------
create or replace function fly_private.papel_maior(p_user uuid)
returns public.fly_role
language sql
security definer
stable
set search_path = ''
as $$
  select max(ur.role) from public.user_roles ur where ur.user_id = p_user;
$$;

create or replace function fly_private.registrar(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    fly_private.papel_maior((select auth.uid())),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

comment on function fly_private.registrar(text, text, text, jsonb) is
  'Trilha padrao. NUNCA passe PII em p_metadata (§23.2) — id e status, nao nome nem documento.';

revoke all on function fly_private.papel_maior(uuid) from public, anon, authenticated;
revoke all on function fly_private.registrar(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function fly_private.papel_maior(uuid) to authenticated;
grant execute on function fly_private.registrar(text, text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Papéis da equipe (§46, entrega 5)
--
-- `user_roles` continua sem policy de escrita: o comentário da Fase 0 —
-- "nenhum cliente escreve aqui, só o servidor, com auditoria" — vira verdade
-- agora que existe o servidor. As duas funções abaixo são a única porta.
-- -----------------------------------------------------------------------------

/** Papéis que esta porta administra. `customer` não é um deles. */
create or replace function fly_private.papel_de_equipe(p_role public.fly_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in (
    'creator', 'guide', 'base', 'media', 'experience', 'support', 'finance',
    'trip_manager', 'admin'
  );
$$;

create or replace function public.conceder_papel(p_user uuid, p_role public.fly_role)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not fly_private.has_role('admin') then
    raise exception 'conceder papel exige admin' using errcode = '42501';
  end if;

  /**
   * `customer` e `family_lead` vêm do convite aceito, e não daqui.
   *
   * Quem aceita convite recebe o papel que o convite carregava — é a
   * Edge Function `aceitar-convite`, com `service_role`. Deixar o painel
   * conceder `customer` criaria um segundo caminho para virar cliente, sem
   * convite e sem consentimento registrado.
   */
  if not fly_private.papel_de_equipe(p_role) then
    return query select false, 'Este papel vem do convite aceito, não do painel.'::text;
    return;
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user) then
    return query select false, 'Não existe perfil para esta pessoa.'::text;
    return;
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user, p_role, (select auth.uid()))
  on conflict (user_id, role) do nothing;

  if not found then
    return query select true, 'Já tinha esse papel.'::text;
    return;
  end if;

  perform fly_private.registrar(
    'papel.concedido', 'user_roles', p_user::text,
    jsonb_build_object('role', p_role)
  );

  return query select true, null::text;
end;
$$;

create or replace function public.revogar_papel(p_user uuid, p_role public.fly_role)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admins int;
begin
  if not fly_private.has_role('admin') then
    raise exception 'revogar papel exige admin' using errcode = '42501';
  end if;

  if not fly_private.papel_de_equipe(p_role) then
    return query select false, 'Este papel não é administrado por aqui.'::text;
    return;
  end if;

  /**
   * O último admin não sai.
   *
   * Sem esta trava, uma pessoa cansada às onze da noite tira o próprio papel
   * e ninguém mais consegue conceder papel nenhum — inclusive de volta. A
   * saída seria abrir o banco, que é justamente o que esta migration existe
   * para não precisar. A trava conta admins, e não "é você mesmo": tirar o
   * próprio admin havendo outro é legítimo.
   */
  if p_role = 'admin' then
    select count(*) into v_admins from public.user_roles ur where ur.role = 'admin';
    if v_admins <= 1 then
      return query select false,
        'Este é o último admin. Conceda o papel a outra pessoa antes de tirar este.'::text;
      return;
    end if;
  end if;

  delete from public.user_roles ur where ur.user_id = p_user and ur.role = p_role;
  if not found then
    return query select false, 'Essa pessoa não tinha esse papel.'::text;
    return;
  end if;

  perform fly_private.registrar(
    'papel.revogado', 'user_roles', p_user::text,
    jsonb_build_object('role', p_role)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Atribuição a viagem (§46, entrega 5)
--
-- Papel diz o que a pessoa faz; atribuição diz **onde**. Um guia sem
-- atribuição não enxerga viagem nenhuma — é assim que a RLS de `trips` foi
-- escrita desde a Fase 2, e foi o bug corrigido na auditoria das Fases 0-3.
-- -----------------------------------------------------------------------------
create or replace function public.atribuir_a_viagem(
  p_user uuid,
  p_trip uuid,
  p_role public.fly_role
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not fly_private.is_global_operator() then
    raise exception 'atribuir exige admin ou trip_manager' using errcode = '42501';
  end if;

  if not fly_private.papel_de_equipe(p_role) then
    return query select false, 'Atribuição é de papel de equipe.'::text;
    return;
  end if;

  -- A atribuição não confere o papel: são controles diferentes, e uma
  -- atribuição sem papel deixaria a pessoa dentro da viagem sem poder fazer
  -- nada — confuso de operar e difícil de auditar.
  if not exists (
    select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = p_role
  ) then
    return query select false, 'Conceda o papel antes de atribuir à viagem.'::text;
    return;
  end if;

  if not exists (select 1 from public.trips t where t.id = p_trip) then
    return query select false, 'Viagem não encontrada.'::text;
    return;
  end if;

  -- Reatribuir alguém revogado é o caso comum: o mesmo guia, na viagem
  -- seguinte, com o mesmo papel. `unique (user_id, trip_id, role)` faria isso
  -- falhar; o upsert reabre a linha e mantém uma linha por trio.
  insert into public.staff_assignments (user_id, trip_id, role, assigned_by)
  values (p_user, p_trip, p_role, (select auth.uid()))
  on conflict (user_id, trip_id, role)
    do update set revoked_at = null, assigned_at = now(), assigned_by = (select auth.uid())
  returning id into v_id;

  perform fly_private.registrar(
    'atribuicao.criada', 'staff_assignments', v_id::text,
    jsonb_build_object('user', p_user, 'trip', p_trip, 'role', p_role)
  );

  return query select true, null::text;
end;
$$;

create or replace function public.revogar_atribuicao(p_assignment uuid)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.staff_assignments;
begin
  if not fly_private.is_global_operator() then
    raise exception 'revogar atribuicao exige admin ou trip_manager' using errcode = '42501';
  end if;

  select * into v_linha from public.staff_assignments sa where sa.id = p_assignment;
  if not found then
    return query select false, 'Atribuição não encontrada.'::text;
    return;
  end if;

  if v_linha.revoked_at is not null then
    return query select true, 'Já estava revogada.'::text;
    return;
  end if;

  update public.staff_assignments sa set revoked_at = now() where sa.id = p_assignment;

  perform fly_private.registrar(
    'atribuicao.revogada', 'staff_assignments', p_assignment::text,
    jsonb_build_object('user', v_linha.user_id, 'trip', v_linha.trip_id, 'role', v_linha.role)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Configuração e flags (§46, entrega 10)
--
-- As policies de escrita de `app_config` e `feature_flags` saem. Não porque
-- estivessem largas — eram `admin` — mas porque escrita por policy é escrita
-- **sem trilha**: o admin muda `support.sla_minutes` e não fica registro de
-- quem, quando, nem de qual era o valor antes. Config é o painel de controle
-- do produto inteiro; a pergunta "quem mudou isso?" precisa ter resposta.
--
-- A partir daqui a única porta é RPC, e a RPC grava o valor anterior.
-- -----------------------------------------------------------------------------
drop policy if exists app_config_insert_admin on public.app_config;
drop policy if exists app_config_update_admin on public.app_config;
drop policy if exists app_config_delete_admin on public.app_config;
drop policy if exists feature_flags_insert_admin on public.feature_flags;
drop policy if exists feature_flags_update_admin on public.feature_flags;
drop policy if exists feature_flags_delete_admin on public.feature_flags;

revoke insert, update, delete on public.app_config from authenticated;
revoke insert, update, delete on public.feature_flags from authenticated;

create or replace function public.definir_config(
  p_key text,
  p_value jsonb,
  p_description text default null,
  p_is_public boolean default null
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_existia boolean;
begin
  if not fly_private.has_role('admin') then
    raise exception 'mudar configuracao exige admin' using errcode = '42501';
  end if;

  if p_key is null or p_key !~ '^[a-z][a-z0-9_.]{2,99}$' then
    return query select false, 'Chave fora do formato (minúsculas, ponto e sublinhado).'::text;
    return;
  end if;

  if p_value is null then
    return query select false, 'Valor é obrigatório. Para remover, apague a chave.'::text;
    return;
  end if;

  select c.value, true into v_antes, v_existia
  from public.app_config c where c.key = p_key;

  insert into public.app_config (key, value, description, is_public, updated_by)
  values (p_key, p_value, p_description, coalesce(p_is_public, false), (select auth.uid()))
  on conflict (key) do update set
    value = excluded.value,
    description = coalesce(p_description, app_config.description),
    is_public = coalesce(p_is_public, app_config.is_public),
    updated_by = (select auth.uid()),
    updated_at = now();

  /**
   * O valor entra na trilha, e é o único lugar do projeto onde conteúdo entra.
   *
   * `app_config` guarda parâmetro de operação — prazo, horário, teto, texto de
   * aviso. Não guarda dado de cliente. Se algum dia guardar, esta linha vira
   * vazamento, e é por isso que ela está comentada e não só escrita.
   */
  perform fly_private.registrar(
    case when v_existia then 'config.alterada' else 'config.criada' end,
    'app_config', p_key,
    jsonb_build_object('antes', v_antes, 'depois', p_value)
  );

  return query select true, null::text;
end;
$$;

create or replace function public.definir_flag(
  p_key text,
  p_enabled boolean,
  p_description text default null
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes boolean;
begin
  if not fly_private.has_role('admin') then
    raise exception 'mudar flag exige admin' using errcode = '42501';
  end if;

  if p_key is null or p_key !~ '^[a-z][a-z0-9_.]{2,99}$' then
    return query select false, 'Chave fora do formato.'::text;
    return;
  end if;

  select f.is_enabled into v_antes from public.feature_flags f where f.key = p_key;

  insert into public.feature_flags (key, is_enabled, description, updated_by)
  values (p_key, coalesce(p_enabled, false), p_description, (select auth.uid()))
  on conflict (key) do update set
    is_enabled = excluded.is_enabled,
    description = coalesce(p_description, feature_flags.description),
    updated_by = (select auth.uid()),
    updated_at = now();

  perform fly_private.registrar(
    'flag.alterada', 'feature_flags', p_key,
    jsonb_build_object('antes', v_antes, 'depois', coalesce(p_enabled, false))
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Flag por viagem (§46, entrega 10)
--
-- "Por ambiente" já está resolvido e não vira coluna: ambiente é **projeto do
-- Supabase separado**, e a linha da flag naquele banco é o valor daquele
-- ambiente. Uma coluna `environment` aqui seria a produção guardando a
-- configuração da homologação, e a primeira consulta que esquecesse o filtro
-- leria a flag errada.
--
-- "Por viagem" precisa existir de verdade: um piloto liga uma função para uma
-- viagem antes de ligar para todas.
-- -----------------------------------------------------------------------------
create table public.trip_feature_flags (
  trip_id uuid not null references public.trips (id) on delete cascade,
  key text not null references public.feature_flags (key) on delete cascade,
  is_enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  primary key (trip_id, key)
);

comment on table public.trip_feature_flags is
  'Sobreposicao por viagem. Ausencia de linha = vale a flag global, e nao "desligado".';

create index trip_feature_flags_key_idx on public.trip_feature_flags (key);

/**
 * O valor que vale para uma viagem: a sobreposição, se houver; senão a global;
 * senão desligado.
 *
 * `security invoker`: a RLS de `feature_flags` já libera leitura para
 * `authenticated`, e a de `trip_feature_flags` (abaixo) faz o mesmo. Não há
 * nada aqui que precise contornar RLS, e DEFINER sem necessidade só amplia
 * superfície — foi a correção 1 da auditoria das Fases 0-3.
 */
create or replace function public.flag_da_viagem(p_key text, p_trip uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce(
    (select tf.is_enabled from public.trip_feature_flags tf
      where tf.trip_id = p_trip and tf.key = p_key),
    (select f.is_enabled from public.feature_flags f where f.key = p_key),
    false
  );
$$;

create or replace function public.definir_flag_da_viagem(
  p_trip uuid,
  p_key text,
  p_enabled boolean
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sobrepor flag numa viagem é operação de viagem, não de plataforma: quem
  -- responde pela viagem decide. Criar a flag continua sendo do admin.
  if not fly_private.is_global_operator() then
    raise exception 'flag por viagem exige admin ou trip_manager' using errcode = '42501';
  end if;

  if not exists (select 1 from public.feature_flags f where f.key = p_key) then
    return query select false, 'Essa flag não existe. Crie a flag global antes.'::text;
    return;
  end if;

  if p_enabled is null then
    delete from public.trip_feature_flags tf where tf.trip_id = p_trip and tf.key = p_key;
    perform fly_private.registrar(
      'flag_viagem.removida', 'trip_feature_flags', p_key,
      jsonb_build_object('trip', p_trip)
    );
    return query select true, null::text;
    return;
  end if;

  insert into public.trip_feature_flags (trip_id, key, is_enabled, updated_by)
  values (p_trip, p_key, p_enabled, (select auth.uid()))
  on conflict (trip_id, key) do update set
    is_enabled = excluded.is_enabled,
    updated_by = (select auth.uid()),
    updated_at = now();

  perform fly_private.registrar(
    'flag_viagem.alterada', 'trip_feature_flags', p_key,
    jsonb_build_object('trip', p_trip, 'depois', p_enabled)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Avisos (lacuna 2 da auditoria de paridade)
--
-- O aviso é **por viagem**. Não existe botão de mandar para todo mundo, e a
-- ausência é deliberada: um broadcast global é a ação de mais alcance do
-- produto inteiro, e não há nenhum fluxo do cliente que precise dele. Quando
-- precisar, entra com aprovação de duas pessoas — não como parâmetro nulo
-- deste RPC.
-- -----------------------------------------------------------------------------
create or replace function public.enviar_aviso(
  p_trip uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_deep_link text default null,
  p_users uuid[] default null,
  p_expires_at timestamptz default null,
  p_dedupe text default null
)
returns table (ok boolean, enviados int, silenciados int, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_critica boolean;
  v_alvo uuid[];
  v_permitidos uuid[];
  v_enviados int := 0;
  v_silenciados int := 0;
begin
  if not (fly_private.is_global_operator() or fly_private.has_role('support')) then
    raise exception 'enviar aviso exige admin, trip_manager ou support' using errcode = '42501';
  end if;

  if not fly_private.can_operate_trip(p_trip) then
    return query select false, 0, 0, 'Você não opera esta viagem.'::text;
    return;
  end if;

  select nc.is_critical into v_critica
  from public.notification_categories nc where nc.key = p_category;
  if not found then
    return query select false, 0, 0, 'Categoria de aviso desconhecida.'::text;
    return;
  end if;

  if p_title is null or btrim(p_title) = '' then
    return query select false, 0, 0, 'O aviso precisa de título.'::text;
    return;
  end if;

  -- A audiência é sempre a lista de participantes da viagem. `p_users` só
  -- **restringe** — nunca acrescenta alguém de fora.
  select array_agg(tm.user_id) into v_alvo
  from public.trip_members tm
  where tm.trip_id = p_trip
    and (p_users is null or tm.user_id = any (p_users));

  if v_alvo is null then
    return query select false, 0, 0, 'Ninguém nessa viagem corresponde à seleção.'::text;
    return;
  end if;

  /**
   * A preferência do cliente vale, menos para categoria crítica.
   *
   * A §26 é literal: "marketing nunca pode silenciar alertas operacionais
   * críticos". O outro lado da mesma frase é que o resto **pode** ser
   * silenciado — e o painel precisa dizer quantas pessoas não receberam, ou o
   * operador acha que avisou todo mundo.
   */
  select array_agg(a.user_id) into v_permitidos
  from unnest(v_alvo) as a(user_id)
  where v_critica or coalesce(
    (select np.is_enabled from public.notification_preferences np
      where np.user_id = a.user_id and np.category_key = p_category),
    true
  );

  v_silenciados := coalesce(array_length(v_alvo, 1), 0)
                 - coalesce(array_length(v_permitidos, 1), 0);

  if v_permitidos is null then
    perform fly_private.registrar(
      'aviso.enviado', 'notifications', p_trip::text,
      jsonb_build_object('categoria', p_category, 'enviados', 0,
                         'silenciados', v_silenciados)
    );
    return query select true, 0, v_silenciados, null::text;
    return;
  end if;

  -- O CTE que escreve é referenciado direto no FROM do SELECT, e não dentro de
  -- um sub-select: é a forma canônica, e a única que não depende de como o
  -- plpgsql resolve o INTO de uma consulta que começa com WITH.
  with inseridos as (
    insert into public.notifications
      (category_key, user_id, title, body, deep_link, expires_at, dedupe_key)
    select p_category, p.user_id, btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''),
           p_deep_link, p_expires_at, p_dedupe
    from unnest(v_permitidos) as p(user_id)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into v_enviados from inseridos;

  perform fly_private.registrar(
    'aviso.enviado', 'notifications', p_trip::text,
    jsonb_build_object(
      'categoria', p_category, 'enviados', v_enviados, 'silenciados', v_silenciados
    )
  );

  return query select true, v_enviados, v_silenciados, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Exportação (§46, entrega 11)
--
-- Isto **não é um porteiro**, e chamar de "exportação autorizada" sem dizer
-- isso seria mentir sobre o controle. Quem exporta já leu as linhas — a RLS
-- decidiu isso antes, e é lá que a autorização acontece. O CSV é montado no
-- navegador, com dados que já estavam na tela.
--
-- O que esta função faz é deixar rastro: que relatório, com que escopo,
-- quantas linhas, por quem, quando. É o que transforma "alguém baixou a base
-- de clientes" de suposição em fato.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_exportacao(
  p_relatorio text,
  p_escopo jsonb default '{}'::jsonb,
  p_linhas int default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not fly_private.is_staff() then
    raise exception 'exportacao e da equipe' using errcode = '42501';
  end if;

  perform fly_private.registrar(
    'exportacao', 'relatorio', p_relatorio,
    jsonb_build_object('escopo', coalesce(p_escopo, '{}'::jsonb), 'linhas', p_linhas)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS e GRANT — controles diferentes, configurados os dois
-- -----------------------------------------------------------------------------
alter table public.trip_feature_flags enable row level security;
alter table public.trip_feature_flags force row level security;

-- Leitura para `authenticated`, como a flag global: o app precisa resolver a
-- própria flag. Escrita só pela RPC — não há policy de insert/update/delete, e
-- a ausência é o controle.
create policy trip_feature_flags_select on public.trip_feature_flags for select to authenticated
  using (true);

revoke all on public.trip_feature_flags from anon;
grant select on public.trip_feature_flags to authenticated;

/**
 * `audit_logs` passa a ser legível por quem opera, e não só por admin.
 *
 * A trilha existe para ser lida quando algo dá errado, e quem está no lugar
 * onde deu errado é o gerente da viagem. O que continua fechado é a escrita:
 * não há policy de insert, update nem delete — nem para admin — e é por isso
 * que `fly_private.registrar` é DEFINER.
 */
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (fly_private.is_global_operator());

revoke all on function public.conceder_papel(uuid, public.fly_role) from public, anon;
revoke all on function public.revogar_papel(uuid, public.fly_role) from public, anon;
revoke all on function public.atribuir_a_viagem(uuid, uuid, public.fly_role) from public, anon;
revoke all on function public.revogar_atribuicao(uuid) from public, anon;
revoke all on function public.definir_config(text, jsonb, text, boolean) from public, anon;
revoke all on function public.definir_flag(text, boolean, text) from public, anon;
revoke all on function public.definir_flag_da_viagem(uuid, text, boolean) from public, anon;
revoke all on function public.flag_da_viagem(text, uuid) from public, anon;
revoke all on function public.enviar_aviso(uuid, text, text, text, text, uuid[], timestamptz, text)
  from public, anon;
revoke all on function public.registrar_exportacao(text, jsonb, int) from public, anon;

grant execute on function public.conceder_papel(uuid, public.fly_role) to authenticated;
grant execute on function public.revogar_papel(uuid, public.fly_role) to authenticated;
grant execute on function public.atribuir_a_viagem(uuid, uuid, public.fly_role) to authenticated;
grant execute on function public.revogar_atribuicao(uuid) to authenticated;
grant execute on function public.definir_config(text, jsonb, text, boolean) to authenticated;
grant execute on function public.definir_flag(text, boolean, text) to authenticated;
grant execute on function public.definir_flag_da_viagem(uuid, text, boolean) to authenticated;
grant execute on function public.flag_da_viagem(text, uuid) to authenticated;
grant execute on function public.enviar_aviso(uuid, text, text, text, text, uuid[], timestamptz, text)
  to authenticated;
grant execute on function public.registrar_exportacao(text, jsonb, int) to authenticated;

-- >>>>> 20260906010000_escala_e_inventario.sql >>>>>
-- =============================================================================
-- Fase 11 — escala, passagem de turno e inventário (§46, entregas 7 e 8)
--
-- Duas coisas que a operação faz todo dia e que não existiam em lugar nenhum:
--
--   • quem está de plantão agora, e o que ficou aberto quando trocou;
--   • quantos press kits sobraram, e para quem foi o brinde.
--
-- Nenhuma delas inventa conteúdo: o que o kit contém, quanto custa e quem
-- recebe é a operação que escreve. A §33 vale aqui como em todo o resto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Escala (§46, entrega 8)
--
-- Turno é diferente de atribuição. `staff_assignments` diz que o guia trabalha
-- **nesta viagem**; o turno diz que ele está de plantão **das 8 às 16 de
-- quinta**. Sem a segunda, "quem eu chamo agora" não tem resposta, e a §43 já
-- pedia essa resposta para o SOS.
-- -----------------------------------------------------------------------------
create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  role public.fly_role not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint staff_shifts_ordem check (ends_at > starts_at),
  constraint staff_shifts_notes_length check (notes is null or char_length(notes) <= 2000)
);

/**
 * Turno sem viagem existe: plantão de plataforma — suporte, financeiro — não é
 * de uma viagem. Por isso `trip_id` é anulável, e por isso o índice de busca
 * cobre os dois casos.
 */
create index staff_shifts_janela_idx on public.staff_shifts (starts_at, ends_at);
create index staff_shifts_user_idx on public.staff_shifts (user_id, starts_at desc);
create index staff_shifts_trip_idx on public.staff_shifts (trip_id, starts_at)
  where trip_id is not null;

comment on table public.staff_shifts is
  'Plantao. Atribuicao diz em que viagem; turno diz em que horas.';

-- -----------------------------------------------------------------------------
-- 2. Passagem de turno (§46, entrega 8)
--
-- Aceitação é separada do envio, pela mesma razão que na fila de atendimento:
-- deixar um bilhete não é a mesma coisa que alguém ter lido. Um handoff sem
-- `accepted_at` é uma pendência, e a tela precisa poder mostrar isso.
-- -----------------------------------------------------------------------------
create table public.shift_handoffs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid references auth.users (id) on delete set null,
  summary text not null,
  open_items text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,

  constraint shift_handoffs_summary_length check (char_length(summary) between 1 and 4000),
  constraint shift_handoffs_open_length check (open_items is null or char_length(open_items) <= 4000),
  -- Aceite é quem e quando, sempre juntos. A mesma restrição de
  -- `support_cases_atribuicao_completa`, pela mesma razão: metade preenchida
  -- é um estado que ninguém sabe ler.
  constraint shift_handoffs_aceite_completo check ((accepted_at is null) = (accepted_by is null))
);

create index shift_handoffs_abertos_idx on public.shift_handoffs (created_at desc)
  where accepted_at is null;
create index shift_handoffs_trip_idx on public.shift_handoffs (trip_id, created_at desc);

comment on column public.shift_handoffs.to_user is
  'Nulo = passagem para quem assumir. Nem toda troca tem sucessor nomeado.';

create or replace function public.aceitar_passagem(p_handoff uuid)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.shift_handoffs;
begin
  if not fly_private.is_staff() then
    raise exception 'aceitar passagem e da equipe' using errcode = '42501';
  end if;

  select * into v_linha from public.shift_handoffs h where h.id = p_handoff;
  if not found then
    return query select false, 'Passagem não encontrada.'::text;
    return;
  end if;

  if v_linha.accepted_at is not null then
    return query select false, 'Alguém já assumiu esta passagem.'::text;
    return;
  end if;

  -- Nomear sucessor não impede outra pessoa de assumir: às onze da noite, o
  -- que importa é que alguém leia. O registro guarda quem assumiu de fato.
  update public.shift_handoffs h
  set accepted_at = now(), accepted_by = (select auth.uid())
  where h.id = p_handoff and h.accepted_at is null;

  if not found then
    return query select false, 'Alguém assumiu enquanto você lia.'::text;
    return;
  end if;

  perform fly_private.registrar(
    'passagem.aceita', 'shift_handoffs', p_handoff::text,
    jsonb_build_object('de', v_linha.from_user, 'trip', v_linha.trip_id)
  );

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Inventário (§46, entrega 7)
--
-- Press kit, brinde e recompensa. Os três nomes são os da §46, e não há um
-- quarto: "material" genérico viraria depósito de tudo, e o relatório de
-- entrega perderia o sentido.
-- -----------------------------------------------------------------------------
create type public.inventory_kind as enum ('press_kit', 'gift', 'reward');

create type public.inventory_reason as enum (
  'entrada',    -- chegou
  'entrega',    -- saiu para alguém
  'perda',      -- sumiu, quebrou
  'devolucao',  -- voltou
  'ajuste'      -- contagem física corrigiu o número
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  kind public.inventory_kind not null,
  name text not null,
  description text,
  trip_id uuid references public.trips (id) on delete set null,
  -- Estoque mínimo para o painel avisar. Nulo = não avisa. Nasce nulo porque
  -- "quantos press kits são poucos" é decisão de quem opera, não do código.
  low_stock_at int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint inventory_items_name_length check (char_length(name) between 1 and 160),
  constraint inventory_items_low_stock check (low_stock_at is null or low_stock_at >= 0)
);

create index inventory_items_kind_idx on public.inventory_items (kind, name);
create index inventory_items_trip_idx on public.inventory_items (trip_id) where trip_id is not null;

/**
 * O movimento é append-only, como todo ledger deste projeto.
 *
 * Estoque não é uma coluna que se edita: é a soma do que entrou e saiu. Uma
 * coluna `quantidade` seria o mesmo erro do saldo de pontos — dois números
 * para a mesma verdade, e o dia em que discordarem ninguém saberá qual vale.
 */
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  delta int not null,
  reason public.inventory_reason not null,
  -- Para quem foi. Anulável: entrada e perda não têm destinatário.
  recipient_id uuid references auth.users (id) on delete set null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint inventory_movements_delta check (delta <> 0),
  constraint inventory_movements_note_length check (note is null or char_length(note) <= 500),
  -- Entrega tira do estoque; entrada põe. Deixar o sinal livre faria um
  -- 'entrega' positivo virar reposição silenciosa no relatório.
  constraint inventory_movements_sinal check (
    (reason = 'entrada'   and delta > 0) or
    (reason = 'devolucao' and delta > 0) or
    (reason = 'entrega'   and delta < 0) or
    (reason = 'perda'     and delta < 0) or
    (reason = 'ajuste')
  ),
  constraint inventory_movements_destinatario check (
    recipient_id is null or reason in ('entrega', 'devolucao')
  )
);

create index inventory_movements_item_idx on public.inventory_movements (item_id, occurred_at desc);
create index inventory_movements_recipient_idx on public.inventory_movements (recipient_id)
  where recipient_id is not null;

create or replace function fly_private.inventory_is_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'inventory_movements e append-only: para corrigir, lance um ajuste com o sinal contrario.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger inventory_movements_no_update
  before update on public.inventory_movements
  for each row execute function fly_private.inventory_is_append_only();

create trigger inventory_movements_no_delete
  before delete on public.inventory_movements
  for each row execute function fly_private.inventory_is_append_only();

create view public.inventory_balance
with (security_invoker = true)
as
  select
    i.id as item_id,
    i.kind,
    i.name,
    i.trip_id,
    i.low_stock_at,
    i.is_active,
    coalesce(sum(m.delta), 0)::int as saldo,
    coalesce(sum(-m.delta) filter (where m.reason = 'entrega'), 0)::int as entregues,
    max(m.occurred_at) as ultimo_movimento
  from public.inventory_items i
  left join public.inventory_movements m on m.item_id = i.id
  group by i.id;

comment on view public.inventory_balance is
  'Saldo derivado do ledger. Nao guarde quantidade em coluna: ela diverge do movimento.';

/**
 * A única porta de escrita do movimento.
 *
 * Existe por causa do saldo negativo. Um `insert` direto deixaria entregar
 * trinta kits havendo dez, e o erro só apareceria na contagem física — depois
 * da viagem. O `ajuste` é a exceção deliberada: contagem física que achou
 * menos do que o sistema tem que poder registrar o que achou.
 */
create or replace function public.movimentar_estoque(
  p_item uuid,
  p_delta int,
  p_reason public.inventory_reason,
  p_recipient uuid default null,
  p_note text default null
)
returns table (ok boolean, saldo int, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo int;
begin
  if not (fly_private.is_staff()) then
    raise exception 'movimentar estoque e da equipe' using errcode = '42501';
  end if;

  if not exists (select 1 from public.inventory_items i where i.id = p_item) then
    return query select false, 0, 'Item não encontrado.'::text;
    return;
  end if;

  if p_delta is null or p_delta = 0 then
    return query select false, 0, 'Movimento precisa de quantidade.'::text;
    return;
  end if;

  -- `for update` no item serializa duas entregas simultâneas do mesmo kit:
  -- sem isso, duas transações leem o mesmo saldo dez e entregam vinte.
  perform 1 from public.inventory_items i where i.id = p_item for update;

  select coalesce(sum(m.delta), 0) into v_saldo
  from public.inventory_movements m where m.item_id = p_item;

  if v_saldo + p_delta < 0 and p_reason <> 'ajuste' then
    return query select false, v_saldo,
      ('Não há tanto em estoque: restam ' || v_saldo || '.')::text;
    return;
  end if;

  insert into public.inventory_movements (item_id, delta, reason, recipient_id, note, created_by)
  values (p_item, p_delta, p_reason, p_recipient, nullif(btrim(coalesce(p_note, '')), ''),
          (select auth.uid()));

  perform fly_private.registrar(
    'estoque.movimento', 'inventory_items', p_item::text,
    jsonb_build_object('delta', p_delta, 'motivo', p_reason)
  );

  return query select true, v_saldo + p_delta, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS e GRANT — controles diferentes, configurados os dois
-- -----------------------------------------------------------------------------
alter table public.staff_shifts        enable row level security;
alter table public.shift_handoffs      enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.inventory_movements enable row level security;

alter table public.inventory_movements force row level security;

/**
 * A escala é da equipe, e o cliente não a lê.
 *
 * Onde está um funcionário é dado da lista da §33 que nunca se inventa, e é
 * também dado que não se expõe: `staff_shifts` diz onde a pessoa está e a que
 * horas. Nenhuma policy dá isso a `customer`.
 */
create policy staff_shifts_select on public.staff_shifts for select to authenticated
  using (fly_private.is_staff());
create policy staff_shifts_insert on public.staff_shifts for insert to authenticated
  with check (fly_private.is_global_operator());
create policy staff_shifts_update on public.staff_shifts for update to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());
create policy staff_shifts_delete on public.staff_shifts for delete to authenticated
  using (fly_private.is_global_operator());

-- A passagem é escrita por quem sai e lida por toda a equipe. Quem escreve
-- assina: `from_user` é quem está logado, e não um campo livre.
create policy shift_handoffs_select on public.shift_handoffs for select to authenticated
  using (fly_private.is_staff());
create policy shift_handoffs_insert on public.shift_handoffs for insert to authenticated
  with check (fly_private.is_staff() and from_user = (select auth.uid()));
-- Sem policy de update: o aceite passa pela RPC, e o texto não se reescreve.
create policy shift_handoffs_delete on public.shift_handoffs for delete to authenticated
  using (fly_private.has_role('admin'));

create policy inventory_items_select on public.inventory_items for select to authenticated
  using (fly_private.is_staff());
create policy inventory_items_insert on public.inventory_items for insert to authenticated
  with check (fly_private.is_global_operator() or fly_private.has_role('experience'));
create policy inventory_items_update on public.inventory_items for update to authenticated
  using (fly_private.is_global_operator() or fly_private.has_role('experience'))
  with check (fly_private.is_global_operator() or fly_private.has_role('experience'));
-- Sem delete: item com movimento é histórico. Desative em vez de apagar.

/**
 * O movimento é lido pela equipe e escrito só pela RPC.
 *
 * Não há policy de insert, e a ausência é o controle: `movimentar_estoque` é
 * DEFINER e é a única porta. Um insert direto passaria por cima da conferência
 * de saldo, que é a única razão de a RPC existir.
 */
create policy inventory_movements_select on public.inventory_movements for select to authenticated
  using (fly_private.is_staff());

revoke all on public.staff_shifts        from anon;
revoke all on public.shift_handoffs      from anon;
revoke all on public.inventory_items     from anon;
revoke all on public.inventory_movements from anon;
revoke all on public.inventory_balance   from anon;

grant select, insert, update, delete on public.staff_shifts to authenticated;
grant select, insert on public.shift_handoffs to authenticated;
grant delete on public.shift_handoffs to authenticated;
revoke update on public.shift_handoffs from authenticated;
grant select, insert, update on public.inventory_items to authenticated;
revoke delete on public.inventory_items from authenticated;
grant select on public.inventory_movements to authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
grant select on public.inventory_balance to authenticated;

revoke all on function public.aceitar_passagem(uuid) from public, anon;
revoke all on function public.movimentar_estoque(uuid, int, public.inventory_reason, uuid, text)
  from public, anon;
grant execute on function public.aceitar_passagem(uuid) to authenticated;
grant execute on function public.movimentar_estoque(uuid, int, public.inventory_reason, uuid, text)
  to authenticated;

-- >>>>> 20260906020000_relatorios.sql >>>>>
-- =============================================================================
-- Fase 11 — relatórios (§46, entrega 6)
--
-- Seis relatórios foram pedidos: viagem, comércio, suporte, experiência,
-- eventos e patrocinadores. Cinco existem aqui. O sexto não:
--
--   **Não há domínio de patrocinador neste projeto.** Não há tabela, não há
--   contrato, não há cota. O que existe é `surprise_tasks.sponsor`, um texto
--   livre que a operação digita ao registrar quem bancou uma surpresa. O
--   relatório abaixo agrupa exatamente isso e chama pelo nome. Inventar uma
--   entidade de patrocinador seria inventar termo comercial, e termo comercial
--   está na lista da §33. Registrado como P56.
--
-- O critério da §46 que manda é este: "relatório reconcilia com ledgers". O de
-- comércio não soma pedidos e pronto — ele compara o que o pedido diz com o
-- que os pagamentos e estornos dizem, e devolve a diferença numa coluna. Um
-- relatório que sempre fecha é um relatório que não confere nada.
--
-- Todos são `security definer` com papel conferido dentro, e não `invoker`
-- sobre as tabelas: agregado não passa pela RLS linha a linha sem virar uma
-- consulta lenta e cheia de furos de escopo. Quem pode ver o quê é decidido
-- aqui, uma vez, explicitamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Viagem — a foto do dia de operação
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_viagem(p_trip uuid)
returns table (
  participantes int,
  dias int,
  atividades int,
  presencas int,
  presenca_esperada int,
  refeicoes_servicos int,
  refeicoes_escolhidas int,
  casos_abertos int,
  pedidos int,
  midia_liberada int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not fly_private.can_operate_trip(p_trip) then
    raise exception 'relatorio exige operar a viagem' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::int from public.trip_members tm where tm.trip_id = p_trip),
    (select count(*)::int from public.trip_days td where td.trip_id = p_trip),
    (select count(*)::int from public.activities a
       join public.trip_days td on td.id = a.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.activity_checkins ac
       join public.activities a on a.id = ac.activity_id
       join public.trip_days td on td.id = a.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.activity_participants ap
       join public.activities a on a.id = ap.activity_id
       join public.trip_days td on td.id = a.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.meal_services ms
       join public.trip_days td on td.id = ms.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.meal_choices mc
       join public.meal_services ms on ms.id = mc.service_id
       join public.trip_days td on td.id = ms.trip_day_id
      where td.trip_id = p_trip),
    (select count(*)::int from public.support_cases sc
      where sc.trip_id = p_trip
        and sc.status in ('open', 'accepted', 'in_progress', 'escalated')),
    (select count(*)::int from public.orders o where o.trip_id = p_trip),
    (select count(*)::int from public.trip_media m
      where m.trip_id = p_trip and m.is_released);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Comércio — e a reconciliação
--
-- Uma linha por moeda, porque somar moedas exige câmbio e câmbio está na §33.
-- É a mesma razão de `criar_pedido` recusar carrinho com moedas misturadas.
--
-- `divergencia_cents` é o coração do relatório: para os pedidos que já
-- deveriam estar pagos, é o que o pedido diz menos o que foi capturado menos o
-- que foi estornado. Zero é o esperado. Qualquer outro número é um pedido para
-- alguém olhar — e `pedidos_divergentes` diz quantos são.
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_comercio(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  currency public.currency_code,
  pedidos int,
  bruto_cents bigint,
  desconto_cents bigint,
  liquido_cents bigint,
  capturado_cents bigint,
  estornado_cents bigint,
  divergencia_cents bigint,
  pedidos_divergentes int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('finance')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'relatorio de comercio exige finance, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  with pedido as (
    select
      o.id,
      o.currency,
      o.status,
      o.subtotal_cents,
      o.discount_cents,
      o.total_cents,
      coalesce((
        select sum(p.amount_cents) from public.payments p
        where p.order_id = o.id and p.status = 'captured'
      ), 0) as capturado,
      coalesce((
        select sum(r.amount_cents) from public.refunds r where r.order_id = o.id
      ), 0) as estornado
    from public.orders o
    where o.placed_at >= p_de
      and o.placed_at < p_ate
      and (p_trip is null or o.trip_id = p_trip)
  ),
  -- Pedido pendente ou falho não entra na conta: ele **deve** estar sem
  -- captura, e contá-lo como divergência encheria o relatório de ruído.
  conferido as (
    select
      pd.*,
      case
        when pd.status in ('paid', 'confirmed', 'refunded', 'partially_refunded')
        then pd.total_cents - pd.capturado + pd.estornado
        else 0
      end as diferenca
    from pedido pd
  )
  select
    c.currency,
    count(*)::int,
    sum(c.subtotal_cents)::bigint,
    sum(c.discount_cents)::bigint,
    sum(c.total_cents)::bigint,
    sum(c.capturado)::bigint,
    sum(c.estornado)::bigint,
    sum(c.diferenca)::bigint,
    (count(*) filter (where c.diferenca <> 0))::int
  from conferido c
  group by c.currency
  order by c.currency;
end;
$$;

/**
 * Os pedidos que não fecham, um a um.
 *
 * O número agregado só serve se der para chegar às linhas. Sem isto, o
 * operador vê "3 pedidos divergentes" e não tem como agir.
 */
create or replace function public.comercio_divergencias(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  order_id uuid,
  reference text,
  status public.order_status,
  currency public.currency_code,
  total_cents bigint,
  capturado_cents bigint,
  estornado_cents bigint,
  diferenca_cents bigint,
  placed_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('finance')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'conferencia de comercio exige finance, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.reference,
    o.status,
    o.currency,
    o.total_cents,
    coalesce(pg.capturado, 0)::bigint,
    coalesce(rf.estornado, 0)::bigint,
    (o.total_cents - coalesce(pg.capturado, 0) + coalesce(rf.estornado, 0))::bigint,
    o.placed_at
  from public.orders o
  left join lateral (
    select sum(p.amount_cents) as capturado from public.payments p
    where p.order_id = o.id and p.status = 'captured'
  ) pg on true
  left join lateral (
    select sum(r.amount_cents) as estornado from public.refunds r where r.order_id = o.id
  ) rf on true
  where o.placed_at >= p_de
    and o.placed_at < p_ate
    and (p_trip is null or o.trip_id = p_trip)
    and o.status in ('paid', 'confirmed', 'refunded', 'partially_refunded')
    and o.total_cents - coalesce(pg.capturado, 0) + coalesce(rf.estornado, 0) <> 0
  order by o.placed_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Suporte — e o SLA que ainda não existe
--
-- Os tempos saem em minutos. O relatório **não** compara com alvo nenhum:
-- `support.sla_minutes` está `PENDENTE` desde a Fase 8 (P20), e um "dentro do
-- prazo" medido contra prazo inventado é pior do que nenhum.
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_suporte(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  level public.support_level,
  abertos int,
  resolvidos int,
  sem_aceite int,
  aceite_medio_min numeric,
  aceite_p90_min numeric,
  resposta_media_min numeric,
  resolucao_media_min numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('support')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'relatorio de suporte exige support, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  select
    sc.level,
    count(*)::int,
    (count(*) filter (where sc.status in ('resolved', 'closed')))::int,
    (count(*) filter (where sc.accepted_at is null))::int,
    round(avg(extract(epoch from (sc.accepted_at - sc.opened_at)) / 60.0)::numeric, 1),
    round(
      percentile_cont(0.9) within group (
        order by extract(epoch from (sc.accepted_at - sc.opened_at)) / 60.0
      )::numeric, 1
    ),
    round(avg(extract(epoch from (sc.first_response_at - sc.opened_at)) / 60.0)::numeric, 1),
    round(avg(extract(epoch from (sc.resolved_at - sc.opened_at)) / 60.0)::numeric, 1)
  from public.support_cases sc
  where sc.opened_at >= p_de
    and sc.opened_at < p_ate
    and (p_trip is null or sc.trip_id = p_trip)
  group by sc.level
  order by sc.level desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Experiência
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_experiencia(p_trip uuid)
returns table (
  figurinhas int,
  figurinhas_desbloqueadas int,
  pessoas_com_figurinha int,
  dias_completos int,
  missoes int,
  missoes_concluidas int,
  insights int,
  surpresas_sugeridas int,
  surpresas_entregues int,
  midia_liberada int,
  midia_com_revogacao int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('experience')
    or fly_private.has_role('trip_manager')
    or fly_private.has_role('admin')
  ) then
    raise exception 'relatorio de experiencia exige experience, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  with cap as (
    select c.id from public.album_chapters c where c.trip_id = p_trip
  ),
  fig as (
    select s.id from public.stickers s where s.chapter_id in (select cap.id from cap)
  )
  select
    (select count(*)::int from fig),
    (select count(*)::int from public.sticker_unlocks u
      where u.sticker_id in (select fig.id from fig)),
    (select count(distinct u.user_id)::int from public.sticker_unlocks u
      where u.sticker_id in (select fig.id from fig)),
    (select count(*)::int from public.chapter_completions cc
      where cc.chapter_id in (select cap.id from cap)),
    (select count(*)::int from public.quest_missions qm where qm.trip_id = p_trip),
    (select count(*)::int from public.quest_completions qc
       join public.quest_missions qm on qm.id = qc.mission_id
      where qm.trip_id = p_trip),
    (select count(*)::int from public.guest_insights gi where gi.trip_id = p_trip),
    (select count(*)::int from public.surprise_tasks st where st.trip_id = p_trip),
    (select count(*)::int from public.surprise_tasks st
      where st.trip_id = p_trip and st.status = 'entregue'),
    (select count(*)::int from public.trip_media m where m.trip_id = p_trip and m.is_released),
    (select count(*)::int from public.trip_media m
      where m.trip_id = p_trip and fly_private.midia_tem_revogacao(m.id));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Eventos
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_eventos(p_de timestamptz, p_ate timestamptz)
returns table (
  event_id uuid,
  slug text,
  title text,
  status public.event_status,
  is_published boolean,
  starts_at timestamptz,
  interessados int,
  na_home boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not fly_private.is_global_operator() then
    raise exception 'relatorio de eventos exige admin ou trip_manager' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.slug,
    e.title,
    e.status,
    e.is_published,
    e.starts_at,
    (select count(*)::int from public.event_interests ei where ei.event_id = e.id),
    e.home_order is not null
  from public.events e
  where e.starts_at is null or (e.starts_at >= p_de and e.starts_at < p_ate)
  order by e.starts_at nulls last;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Patrocínio — o que existe, com o nome que tem
--
-- Agrupa `surprise_tasks.sponsor`, que é **texto digitado**. "Rolex" e
-- "rolex " são duas linhas, e o relatório mostra as duas em vez de fingir que
-- normalizou: normalizar aqui esconderia o problema de cadastro em vez de
-- expô-lo, e o cadastro é que precisa de dono (P56).
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_patrocinio(
  p_de timestamptz,
  p_ate timestamptz,
  p_trip uuid default null
)
returns table (
  sponsor text,
  tarefas int,
  entregues int,
  currency char(3),
  orcado_cents bigint,
  custo_cents bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (
    fly_private.has_role('experience')
    or fly_private.has_role('finance')
    or fly_private.is_global_operator()
  ) then
    raise exception 'relatorio de patrocinio exige experience, finance, trip_manager ou admin'
      using errcode = '42501';
  end if;

  return query
  select
    st.sponsor,
    count(*)::int,
    (count(*) filter (where st.status = 'entregue'))::int,
    st.currency,
    coalesce(sum(st.budget_cents), 0)::bigint,
    coalesce(sum(st.cost_cents), 0)::bigint
  from public.surprise_tasks st
  where st.sponsor is not null
    and st.created_at >= p_de
    and st.created_at < p_ate
    and (p_trip is null or st.trip_id = p_trip)
  group by st.sponsor, st.currency
  order by count(*) desc, st.sponsor;
end;
$$;

-- -----------------------------------------------------------------------------
-- GRANT
-- -----------------------------------------------------------------------------
revoke all on function public.relatorio_viagem(uuid) from public, anon;
revoke all on function public.relatorio_comercio(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.comercio_divergencias(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.relatorio_suporte(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.relatorio_experiencia(uuid) from public, anon;
revoke all on function public.relatorio_eventos(timestamptz, timestamptz) from public, anon;
revoke all on function public.relatorio_patrocinio(timestamptz, timestamptz, uuid) from public, anon;

grant execute on function public.relatorio_viagem(uuid) to authenticated;
grant execute on function public.relatorio_comercio(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.comercio_divergencias(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.relatorio_suporte(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.relatorio_experiencia(uuid) to authenticated;
grant execute on function public.relatorio_eventos(timestamptz, timestamptz) to authenticated;
grant execute on function public.relatorio_patrocinio(timestamptz, timestamptz, uuid) to authenticated;

-- >>>>> 20260906030000_cofre_da_equipe.sql >>>>>
-- =============================================================================
-- Fase 11 — a equipe deposita no cofre, e continua sem ler (lacuna 8)
--
-- A auditoria de paridade achou uma contradição entre duas migrations da Fase 4:
--
--   • `public.documents` diz, em comentário e em policy, que a equipe envia
--     documento para o cliente — "a equipe envia voucher para o cliente, e o
--     dono continua sendo o cliente", e `documents_insert` aceita quem opera a
--     viagem;
--
--   • a policy do bucket `documentos` aceita `insert` só na pasta de quem está
--     logado: `(storage.foldername(name))[1] = auth.uid()`.
--
-- Resultado: dava para criar a **linha** do voucher e não dava para subir o
-- **arquivo**. A linha apontava para um caminho vazio. Ninguém percebeu porque
-- nenhum painel tentava — não havia tela de cofre, que é a lacuna 8.
--
-- A correção é abrir o depósito, e **só** o depósito. Quem opera a viagem passa
-- a poder gravar na pasta de quem está nela; continua sem poder ler, editar ou
-- apagar. A policy de `select` não é tocada: ler documento alheio segue
-- exigindo `document_grants`, e cada leitura segue virando linha em
-- `document_access_log`.
--
-- Depositar sem poder abrir é a assimetria certa aqui. É a caixa de correio do
-- prédio: o carteiro põe dentro, e não tem a chave.
-- =============================================================================

create policy documentos_insert_equipe on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    -- A primeira pasta precisa **ser** um uuid antes de virar um: um nome de
    -- arquivo qualquer derrubaria a policy com erro de conversão, e uma policy
    -- que lança exceção é uma policy que ninguém consegue depurar.
    and (storage.foldername(name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.trip_members tm
      where tm.user_id = ((storage.foldername(name))[1])::uuid
        and fly_private.can_operate_trip(tm.trip_id)
    )
  );

comment on policy documentos_insert_equipe on storage.objects is
  'A equipe deposita na pasta de quem esta na viagem. Ler continua exigindo grant.';

-- >>>>> registro no historico de migrations >>>>>
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260905000000', 'assistente'),
  ('20260905010000', 'planejador'),
  ('20260905020000', 'mala'),
  ('20260906000000', 'operacao'),
  ('20260906010000', 'escala_e_inventario'),
  ('20260906020000', 'relatorios'),
  ('20260906030000', 'cofre_da_equipe')
on conflict (version) do nothing;

commit;
