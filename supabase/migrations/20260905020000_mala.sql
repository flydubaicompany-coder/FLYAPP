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
