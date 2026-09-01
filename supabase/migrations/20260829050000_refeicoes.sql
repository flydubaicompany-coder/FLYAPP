-- =============================================================================
-- Fase 7 — refeicoes da viagem (§11.1 e §42).
--
-- O fluxo da §11.1: o cliente ve almoco e jantar do dia seguinte, escolhe,
-- recebe lembrete, confirma **ate o prazo**, e a equipe acompanha pendencias e
-- totais por fornecedor.
--
-- ## "O prazo nunca pode ser hardcoded" — §11.1, palavra por palavra
--
-- O padrao vive em `app_config` (`meals.deadline_hours`, cinco horas, que e o
-- numero que a propria spec da como inicial), e cada refeicao pode ter o seu.
-- Mudar de cinco para tres horas e ato de operacao, e nao release.
--
-- ## O prazo e uma coluna, e nao uma conta na hora de ler
--
-- `choices_close_at` e gravado quando a refeicao abre. Se fosse calculado a
-- cada leitura, mudar a configuracao **fecharia retroativamente** refeicoes
-- que ja estavam abertas — e o cliente perderia a escolha sem ter feito nada.
-- =============================================================================

create type public.meal_kind as enum ('breakfast', 'lunch', 'dinner', 'snack');

create type public.meal_service_status as enum (
  'draft',      -- a equipe monta; o cliente nao ve
  'open',       -- o cliente escolhe
  'locked',     -- passou o prazo; so excecao muda
  'sent',       -- foi para o fornecedor
  'delivered',  -- entregue
  'cancelled'
);

create table public.meal_services (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  kind public.meal_kind not null,

  -- Quem prepara. Texto ate haver cadastro de fornecedor de refeicao — o
  -- `tour_suppliers` e de passeio, e misturar os dois seria forcar.
  supplier_name text,
  location text,

  serves_at timestamptz,
  /**
   * Quando fecha a escolha.
   *
   * Gravado, e nao calculado na leitura: calcular faria uma mudanca de
   * configuracao fechar retroativamente o que ja estava aberto.
   */
  choices_close_at timestamptz,

  status public.meal_service_status not null default 'draft',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meal_services_unica_por_dia unique (trip_day_id, kind),
  constraint meal_services_prazo_antes_de_servir check (
    choices_close_at is null or serves_at is null or choices_close_at <= serves_at
  )
);

create index meal_services_dia_idx on public.meal_services (trip_day_id, kind);

create table public.meal_options (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.meal_services (id) on delete cascade,
  label text not null,
  description text,

  /**
   * O que o cliente pode pedir para mudar, em portugues.
   *
   * Nulo = nao ha personalizacao. Texto livre e nao lista: o que se pode
   * trocar num prato depende do prato, e travar em enum obrigaria migration
   * para cada cozinha nova.
   */
  customization_note text,

  is_active boolean not null default true,
  sort_order int not null default 0,

  constraint meal_options_label_preenchido check (length(btrim(label)) > 0)
);

create index meal_options_servico_idx on public.meal_options (service_id, sort_order);

create table public.meal_choices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.meal_services (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option_id uuid not null references public.meal_options (id) on delete restrict,

  customization text,

  /**
   * Excecao: mudanca depois do prazo.
   *
   * A §42 exige que "excecao exige justificativa". Preenchido junto com quem
   * autorizou — sem os dois, o gatilho abaixo recusa.
   */
  exception_reason text,
  decided_by uuid references auth.users (id) on delete set null,

  chosen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meal_choices_uma_por_pessoa unique (service_id, user_id),
  constraint meal_choices_excecao_completa check (
    (exception_reason is null) = (decided_by is null)
  )
);

create index meal_choices_servico_idx on public.meal_choices (service_id);
create index meal_choices_usuario_idx on public.meal_choices (user_id);

-- -----------------------------------------------------------------------------
-- A opcao escolhida tem de ser deste servico.
--
-- A chave estrangeira garante que a opcao existe, e nao que ela pertence a
-- esta refeicao. Sem isto daria para escolher o jantar de terca no almoco de
-- quinta.
-- -----------------------------------------------------------------------------
create or replace function fly_private.opcao_e_do_servico()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.meal_options o
    where o.id = new.option_id and o.service_id = new.service_id
  ) then
    raise exception 'a opcao escolhida nao pertence a esta refeicao'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger meal_choices_opcao_coerente
  before insert or update on public.meal_choices
  for each row execute function fly_private.opcao_e_do_servico();

-- -----------------------------------------------------------------------------
-- Depois do prazo, so com justificativa.
--
-- O criterio da §42 e "prazo bloqueia alteracao comum" — **comum**, e nao
-- toda. A equipe pode mudar depois, e a mudanca fica marcada como excecao.
-- -----------------------------------------------------------------------------
create or replace function fly_private.prazo_da_refeicao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.meal_services;
  v_equipe boolean := fly_private.is_staff();
begin
  select * into v_s from public.meal_services s where s.id = new.service_id;

  if v_s.status = 'draft' then
    raise exception 'esta refeicao ainda nao abriu para escolha' using errcode = '23514';
  end if;

  if v_s.status in ('cancelled', 'delivered') then
    raise exception 'esta refeicao nao aceita mais mudanca' using errcode = '23514';
  end if;

  -- Dentro do prazo e com a refeicao aberta: qualquer um escolhe o proprio.
  if v_s.status = 'open'
     and (v_s.choices_close_at is null or now() < v_s.choices_close_at) then
    -- Uma escolha comum nao carrega excecao.
    if new.exception_reason is not null and not v_equipe then
      raise exception 'so a equipe registra excecao' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Passou o prazo. Daqui em diante, so a equipe e so com justificativa.
  if not v_equipe then
    raise exception 'o prazo desta refeicao passou: fale com a Fly para alterar'
      using errcode = '42501';
  end if;

  if new.exception_reason is null or length(btrim(new.exception_reason)) = 0 then
    raise exception 'mudanca depois do prazo exige justificativa'
      using errcode = '23514';
  end if;

  new.decided_by := coalesce(new.decided_by, (select auth.uid()));
  return new;
end;
$$;

create trigger meal_choices_respeitam_prazo
  before insert or update on public.meal_choices
  for each row execute function fly_private.prazo_da_refeicao();

create trigger meal_services_touch
  before update on public.meal_services
  for each row execute function fly_private.touch_updated_at();
create trigger meal_choices_touch
  before update on public.meal_choices
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Abrir a refeicao, aplicando o prazo configurado.
-- -----------------------------------------------------------------------------
create or replace function public.abrir_refeicao(p_service uuid, p_horas int default null)
returns table (ok boolean, motivo text, fecha_em timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.meal_services;
  v_horas int;
  v_fecha timestamptz;
begin
  if not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_s from public.meal_services s where s.id = p_service for update;
  if not found then
    return query select false, 'refeicao nao encontrada', null::timestamptz;
    return;
  end if;

  if not exists (select 1 from public.meal_options o
                 where o.service_id = p_service and o.is_active) then
    return query select false,
      'sem opcao ativa: abrir um cardapio vazio so gera pergunta', null::timestamptz;
    return;
  end if;

  v_horas := coalesce(
    p_horas,
    (select (c.value #>> '{}')::int from public.app_config c where c.key = 'meals.deadline_hours'),
    5
  );

  v_fecha := case when v_s.serves_at is null then null
                  else v_s.serves_at - make_interval(hours => v_horas) end;

  update public.meal_services
  set status = 'open', choices_close_at = v_fecha, updated_at = now()
  where id = p_service;

  return query select true, 'aberta'::text, v_fecha;
end;
$$;

insert into public.app_config (key, value, description, is_public) values
  (
    'meals.deadline_hours',
    '5'::jsonb,
    'Horas antes de servir em que a escolha fecha. A §11.1 da cinco como inicial e diz que o prazo NUNCA pode ser hardcoded. Cada refeicao pode ter o seu.',
    true
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.meal_services enable row level security;
alter table public.meal_options  enable row level security;
alter table public.meal_choices  enable row level security;

/**
 * "cliente ve apenas refeicoes elegiveis" (§42).
 *
 * Elegivel = da viagem dele, e ja aberta. Rascunho e da equipe: mostrar um
 * cardapio em construcao gera pergunta sobre prato que talvez nao exista.
 */
create policy meal_services_select on public.meal_services for select to authenticated
  using (
    fly_private.is_staff()
    or (
      status <> 'draft'
      and exists (
        select 1 from public.trip_days d
        where d.id = meal_services.trip_day_id
          and fly_private.is_trip_member(d.trip_id)
      )
    )
  );

create policy meal_services_write_operator on public.meal_services for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

create policy meal_options_select on public.meal_options for select to authenticated
  using (
    fly_private.is_staff()
    or exists (
      select 1 from public.meal_services s
      join public.trip_days d on d.id = s.trip_day_id
      where s.id = meal_options.service_id
        and s.status <> 'draft'
        and fly_private.is_trip_member(d.trip_id)
    )
  );

create policy meal_options_write_operator on public.meal_options for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

-- O cliente ve a propria escolha; a equipe ve todas, porque e ela que
-- consolida o total por fornecedor.
create policy meal_choices_select on public.meal_choices for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

create policy meal_choices_insert on public.meal_choices for insert to authenticated
  with check ((select auth.uid()) = user_id or fly_private.is_staff());

create policy meal_choices_update on public.meal_choices for update to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff())
  with check ((select auth.uid()) = user_id or fly_private.is_staff());

create policy meal_choices_delete on public.meal_choices for delete to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

revoke all on public.meal_services from anon;
revoke all on public.meal_options  from anon;
revoke all on public.meal_choices  from anon;

grant select on public.meal_services to authenticated;
grant insert, update, delete on public.meal_services to authenticated;
grant select on public.meal_options to authenticated;
grant insert, update, delete on public.meal_options to authenticated;
grant select on public.meal_choices to authenticated;
grant insert, update, delete on public.meal_choices to authenticated;

revoke all on function fly_private.opcao_e_do_servico() from public, anon, authenticated;
revoke all on function fly_private.prazo_da_refeicao() from public, anon, authenticated;
revoke all on function public.abrir_refeicao(uuid, int) from public, anon;
grant execute on function public.abrir_refeicao(uuid, int) to authenticated;
