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
