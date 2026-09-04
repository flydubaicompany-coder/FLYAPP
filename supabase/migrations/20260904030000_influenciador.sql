-- =============================================================================
-- Fase 9 — Modo Influenciador (§13.6 e §44, entrega 15).
--
-- ## "Ativado por perfil e viagem" — as duas coisas
--
-- Requisito literal da §13.6. Nao e um papel do Fly ID: um criador convidado
-- para a viagem de setembro nao vira criador da Fly para sempre, e a viagem
-- seguinte precisa de um convite novo. Por isso a habilitacao e uma linha por
-- **pessoa e viagem**, e nao uma coluna em `profiles`.
--
-- E por isso o criterio da §44 — "modo Influenciador aparece so para
-- habilitados" — vira uma consulta que devolve zero linhas, e nao um `if` na
-- tela.
--
-- ## O que este arquivo NAO tem, e nao e esquecimento
--
-- **Pagamento e contrapartida.** A §13.6 lista "status de pagamento ou
-- contrapartida quando aplicavel". Isso e taxa e parceiro financeiro, os dois
-- na lista da §33, e o PSP continua sendo a P09/P38. Ha um campo de texto
-- para a operacao escrever o combinado; nao ha valor, nao ha status de
-- pagamento, e nao ha ledger.
--
-- **Metricas coletadas de rede social.** "Metricas antes e depois" viraria
-- integracao com Instagram ou TikTok — e a §33 proibe declarar integracao sem
-- credencial, contrato e homologacao. O que existe e o numero que **o proprio
-- criador declara**, marcado como declarado na coluna e na tela. Numero
-- declarado que se apresenta como medido e pior do que numero nenhum.
--
-- **Direitos de uso.** Texto juridico e do dono do produto (§33). Ha o campo;
-- o conteudo nao nasce preenchido.
-- =============================================================================

create type public.deliverable_status as enum (
  'pendente',
  'enviado',
  'aprovado',
  'recusado',
  'publicado'
);

create table public.influencer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,

  -- Desligar sem apagar: o historico do que foi combinado continua existindo.
  is_active boolean not null default false,

  -- "briefing" (§13.6). Texto da operacao.
  briefing text,
  -- "direitos de uso" (§13.6). Texto juridico — do dono do produto (§33).
  usage_rights text,
  -- "links e codigos" e "campanhas": o combinado, em texto, ate haver contrato.
  collab_note text,
  -- Perfil profissional, como o criador o informa.
  handle text,

  enabled_by uuid references auth.users (id) on delete set null,
  enabled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint influencer_profiles_unico unique (user_id, trip_id),
  constraint influencer_profiles_ativacao_completa check (
    (enabled_at is null) = (is_active is false)
  )
);

create index influencer_profiles_user_idx on public.influencer_profiles (user_id, is_active);
create index influencer_profiles_trip_idx on public.influencer_profiles (trip_id);
create index influencer_profiles_enabled_by_idx on public.influencer_profiles (enabled_by);

create table public.influencer_deliverables (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.influencer_profiles (id) on delete cascade,

  title text not null,
  description text,
  due_at timestamptz,

  status public.deliverable_status not null default 'pendente',

  -- O que o criador entregou. Link, porque o conteudo vive na rede dele.
  submitted_url text,
  submitted_at timestamptz,

  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,

  /**
   * Metricas **declaradas pelo criador** (§13.6, "metricas antes e depois").
   *
   * Nao sao medidas: nao ha integracao com rede social, e a §33 proibe
   * declarar integracao sem credencial, contrato e homologacao. O sufixo
   * `_declared` esta no nome da coluna de proposito — para ninguem somar
   * isto num relatorio achando que mediu.
   */
  reach_declared bigint,
  engagement_declared bigint,
  metrics_declared_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint influencer_deliverables_titulo_preenchido check (length(btrim(title)) > 0),
  constraint influencer_deliverables_envio_completo check (
    (submitted_at is null) = (submitted_url is null)
  ),
  constraint influencer_deliverables_revisao_completa check (
    (reviewed_at is null) = (reviewed_by is null)
  ),
  -- Recusar sem dizer por que deixa o criador sem saber o que refazer.
  constraint influencer_deliverables_recusa_tem_motivo check (
    status <> 'recusado' or (review_note is not null and length(btrim(review_note)) > 0)
  ),
  constraint influencer_deliverables_metricas_nao_negativas check (
    (reach_declared is null or reach_declared >= 0)
    and (engagement_declared is null or engagement_declared >= 0)
  )
);

create index influencer_deliverables_perfil_idx
  on public.influencer_deliverables (profile_id, status);
create index influencer_deliverables_reviewed_by_idx
  on public.influencer_deliverables (reviewed_by);

create trigger influencer_profiles_touch before update on public.influencer_profiles
  for each row execute function fly_private.touch_updated_at();
create trigger influencer_deliverables_touch before update on public.influencer_deliverables
  for each row execute function fly_private.touch_updated_at();

/** Habilitar carimba quem e quando; desabilitar apaga o carimbo. */
create or replace function fly_private.carimbar_habilitacao_de_criador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and not coalesce(old.is_active, false) then
    new.enabled_at := coalesce(new.enabled_at, now());
    new.enabled_by := coalesce(new.enabled_by, (select auth.uid()));
  elsif not new.is_active then
    new.enabled_at := null;
    new.enabled_by := null;
  end if;
  return new;
end;
$$;

create trigger influencer_profiles_carimba
  before update on public.influencer_profiles
  for each row execute function fly_private.carimbar_habilitacao_de_criador();

/**
 * O criador envia o proprio entregavel, e nada mais.
 *
 * Sem esta funcao, dar `update` ao criador na tabela deixaria ele mudar o
 * proprio `status` para `aprovado`. RLS por linha nao resolve isso — ela
 * decide **qual linha**, nao **qual coluna**.
 */
create or replace function public.enviar_entregavel(
  p_deliverable uuid,
  p_url text,
  p_reach bigint default null,
  p_engagement bigint default null
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_dono uuid;
  v_status public.deliverable_status;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  select p.user_id, d.status into v_dono, v_status
  from public.influencer_deliverables d
  join public.influencer_profiles p on p.id = d.profile_id
  where d.id = p_deliverable and p.is_active;

  if v_dono is null then
    raise exception 'entregavel nao encontrado' using errcode = 'P0002';
  end if;

  if v_dono <> v_user then
    raise exception 'este entregavel nao e seu' using errcode = '42501';
  end if;

  if v_status = 'aprovado' or v_status = 'publicado' then
    return query select false, 'Este entregável já foi aprovado.'::text;
    return;
  end if;

  if p_url is null or length(btrim(p_url)) = 0 then
    return query select false, 'Mande o link do conteúdo.'::text;
    return;
  end if;

  update public.influencer_deliverables d
  set submitted_url = btrim(p_url),
      submitted_at = now(),
      status = 'enviado',
      -- Números declarados pelo criador. Só carimba a data quando vem algum.
      reach_declared = coalesce(p_reach, d.reach_declared),
      engagement_declared = coalesce(p_engagement, d.engagement_declared),
      metrics_declared_at = case
        when p_reach is not null or p_engagement is not null then now()
        else d.metrics_declared_at
      end
  where d.id = p_deliverable;

  return query select true, null::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.influencer_profiles enable row level security;
alter table public.influencer_deliverables enable row level security;

/**
 * "Modo Influenciador aparece so para habilitados" (§44).
 *
 * O criterio e esta policy: quem nao tem linha ativa recebe **zero linhas**,
 * e a tela some por falta de dado — nao por um `if` que alguem pode remover.
 */
create policy influencer_profiles_select on public.influencer_profiles for select to authenticated
  using (
    ((select auth.uid()) = user_id and is_active)
    or fly_private.can_operate_trip(trip_id)
  );

create policy influencer_profiles_write on public.influencer_profiles for all to authenticated
  using (fly_private.can_operate_trip(trip_id))
  with check (fly_private.can_operate_trip(trip_id));

create policy influencer_deliverables_select on public.influencer_deliverables
  for select to authenticated
  using (
    exists (
      select 1 from public.influencer_profiles p
      where p.id = influencer_deliverables.profile_id
        and (
          (p.user_id = (select auth.uid()) and p.is_active)
          or fly_private.can_operate_trip(p.trip_id)
        )
    )
  );

/**
 * So a operacao escreve direto. O criador passa por `enviar_entregavel`.
 *
 * A diferenca importa: RLS decide qual **linha**, e nao qual **coluna**. Com
 * update direto, o criador aprovaria o proprio conteudo.
 */
create policy influencer_deliverables_write on public.influencer_deliverables
  for all to authenticated
  using (
    exists (
      select 1 from public.influencer_profiles p
      where p.id = influencer_deliverables.profile_id
        and fly_private.can_operate_trip(p.trip_id)
    )
  )
  with check (
    exists (
      select 1 from public.influencer_profiles p
      where p.id = influencer_deliverables.profile_id
        and fly_private.can_operate_trip(p.trip_id)
    )
  );

revoke all on public.influencer_profiles from anon;
revoke all on public.influencer_deliverables from anon;

grant select, insert, update, delete on public.influencer_profiles to authenticated;
grant select, insert, update, delete on public.influencer_deliverables to authenticated;

revoke all on function fly_private.carimbar_habilitacao_de_criador()
  from public, anon, authenticated;
revoke all on function public.enviar_entregavel(uuid, text, bigint, bigint) from public, anon;
grant execute on function public.enviar_entregavel(uuid, text, bigint, bigint) to authenticated;
