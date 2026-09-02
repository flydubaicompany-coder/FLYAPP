-- =============================================================================
-- Fase 8 — Bases Fly, atendimento e SOS (§12 e §43).
--
-- Os tres niveis da §12.3, num unico caminho: **conversa**, **ajuda urgente** e
-- **SOS**. Um caso so, com nivel diferente — e nao tres sistemas paralelos.
-- Quem escala de conversa para SOS nao pode perder o historico.
--
-- ## O que este arquivo deliberadamente NAO tem
--
-- **Tabela de localizacao de funcionario.** A §43 proibe mostrar a posicao
-- exata do funcionario ao cliente, e a §33 poe "localizacao de funcionario" na
-- lista do que nunca se inventa. A forma mais segura de nunca vazar e **nao
-- guardar** — entao nao ha coluna, e nenhuma tela futura consegue expor.
--
-- ## O SOS nao substitui emergencia publica
--
-- Requisito literal da §12.4. O texto e o numero vivem em `app_config`, porque
-- o numero muda com o pais e o texto e da Fly, nao do codigo. O dono confirmou
-- **999** para os Emirados em 27/08/2026.
-- =============================================================================

create type public.support_level as enum (
  'chat',    -- roupa, horario, indicacao
  'urgent',  -- perdeu o grupo, atraso, transfer
  'sos'      -- saude, risco, emergencia
);

create type public.support_status as enum (
  'open',        -- aberto, ninguem aceitou
  'accepted',    -- alguem assumiu
  'in_progress', -- em atendimento
  'escalated',   -- subiu de nivel ou de pessoa
  'resolved',
  'closed'
);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,

  level public.support_level not null default 'chat',
  subject text,
  status public.support_status not null default 'open',

  -- Contexto, quando o caso nasce de algo. Nulo = conversa solta.
  activity_id uuid references public.activities (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,

  /**
   * Tempos auditados (§43, "tempos ficam auditados").
   *
   * Colunas separadas, e nao um log a parte: a pergunta que a operacao faz e
   * "quanto demorou para alguem aceitar" e "quanto para a primeira resposta",
   * e as duas se respondem com uma subtracao.
   */
  opened_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  escalated_at timestamptz,
  escalation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Aceitar sem dizer quem aceitou nao serve para auditar nada.
  constraint support_cases_aceite_completo check (
    (accepted_at is null) = (accepted_by is null)
  ),
  constraint support_cases_resolucao_completa check (
    (resolved_at is null) = (resolved_by is null)
  ),
  -- Escalar sem motivo deixa o proximo sem saber o que ja foi tentado.
  constraint support_cases_escala_tem_motivo check (
    escalated_at is null
    or (escalation_reason is not null and length(btrim(escalation_reason)) > 0)
  )
);

create index support_cases_user_idx on public.support_cases (user_id, opened_at desc);
/**
 * A fila da operacao, ordenada por urgencia e depois por espera.
 *
 * O indice reproduz a ordem da tela de proposito: uma fila que a operacao le
 * numa ordem e o banco entrega em outra vira gente atendida fora de ordem.
 */
create index support_cases_fila_idx on public.support_cases (level desc, opened_at)
  where status in ('open', 'accepted', 'in_progress', 'escalated');

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases (id) on delete cascade,
  -- Nulo = mensagem do sistema ("a Fly recebeu seu SOS").
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),

  constraint support_messages_corpo_preenchido check (length(btrim(body)) > 0),
  constraint support_messages_sistema_sem_autor check (not is_system or author_id is null)
);

create index support_messages_caso_idx on public.support_messages (case_id, created_at);

/**
 * Localizacao do CLIENTE, e so dele.
 *
 * "localizacao minima e consentida" (§43): guardada apenas quando ele envia,
 * ligada ao caso que a motivou, e nunca continua. Nao ha rastreamento — ha
 * pontos que a pessoa decidiu mandar.
 */
create table public.case_locations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  captured_at timestamptz not null default now(),

  constraint case_locations_lat_valida check (latitude between -90 and 90),
  constraint case_locations_lng_valida check (longitude between -180 and 180)
);

create index case_locations_caso_idx on public.case_locations (case_id, captured_at desc);

comment on table public.case_locations is
  'Localizacao que o CLIENTE enviou, ligada a um caso. Nao ha localizacao de funcionario, nem rastreamento continuo.';

-- -----------------------------------------------------------------------------
-- Bases Fly (§12.2).
-- -----------------------------------------------------------------------------
create table public.fly_bases (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references public.destinations (id) on delete set null,

  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,

  -- Horario em texto: "24h", "9h as 21h", "durante os voos". A realidade de
  -- uma base no aeroporto nao cabe em duas colunas de hora.
  hours_note text,
  services text[] not null default '{}',

  is_active boolean not null default false,
  is_open boolean not null default false,
  notes text,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fly_bases_nome_preenchido check (length(btrim(name)) > 0),
  constraint fly_bases_lat_valida check (latitude is null or latitude between -90 and 90),
  constraint fly_bases_lng_valida check (longitude is null or longitude between -180 and 180)
);

create index fly_bases_ativas_idx on public.fly_bases (is_active, sort_order);

-- -----------------------------------------------------------------------------
-- Carimbos de tempo, sem ninguem precisar lembrar.
-- -----------------------------------------------------------------------------
create or replace function fly_private.carimbar_atendimento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status = 'open' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.accepted_by := coalesce(new.accepted_by, (select auth.uid()));
  end if;

  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;

  if new.status = 'escalated' and old.status <> 'escalated' then
    new.escalated_at := coalesce(new.escalated_at, now());
  end if;

  return new;
end;
$$;

create trigger support_cases_carimbam
  before update on public.support_cases
  for each row execute function fly_private.carimbar_atendimento();

/**
 * A primeira resposta da equipe carimba o caso.
 *
 * Medir "primeira resposta" contando mensagem a mensagem depois obrigaria a
 * varrer a thread inteira. Aqui o carimbo acontece uma vez, na hora.
 */
create or replace function fly_private.carimbar_primeira_resposta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_system or new.author_id is null then
    return new;
  end if;

  update public.support_cases c
  set first_response_at = now()
  where c.id = new.case_id
    and c.first_response_at is null
    and c.user_id <> new.author_id;

  return new;
end;
$$;

create trigger support_messages_carimbam_resposta
  after insert on public.support_messages
  for each row execute function fly_private.carimbar_primeira_resposta();

create trigger support_cases_touch before update on public.support_cases
  for each row execute function fly_private.touch_updated_at();
create trigger fly_bases_touch before update on public.fly_bases
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Abrir um caso, com confirmacao automatica no SOS.
--
-- "SOS confirma recebimento" (§43). A confirmacao e uma mensagem de sistema
-- gravada na hora, e nao um push que pode nao chegar: o cliente abre a thread
-- e ve que a Fly recebeu, mesmo sem notificacao.
-- -----------------------------------------------------------------------------
create or replace function public.abrir_atendimento(
  p_level public.support_level,
  p_subject text default null,
  p_trip uuid default null
)
returns table (ok boolean, caso uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  insert into public.support_cases (user_id, trip_id, level, subject)
  values (v_user, p_trip, p_level, nullif(btrim(coalesce(p_subject, '')), ''))
  returning id into v_id;

  if p_level = 'sos' then
    insert into public.support_messages (case_id, body, is_system)
    values (
      v_id,
      'A Fly recebeu seu SOS e já está acionando a equipe. '
      || 'Se houver risco de vida, ligue também para o número de emergência local.',
      true
    );
  elsif p_level = 'urgent' then
    insert into public.support_messages (case_id, body, is_system)
    values (v_id, 'A Fly recebeu seu pedido e ele entrou na fila prioritária.', true);
  end if;

  return query select true, v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Configuracao.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'support.emergency_numbers',
    '{"AE": "999"}'::jsonb,
    'Numero de emergencia publica por pais (ISO-2). 999 nos Emirados, confirmado pelo dono em 27/08/2026. Contato de emergencia esta na lista da §33 do que nunca se inventa — nao acrescente pais sem confirmacao.',
    true
  ),
  (
    'support.sos_disclaimer',
    '"O SOS da Fly aciona a equipe da Fly. Ele não substitui os serviços públicos de emergência: em risco de vida, ligue também para o número de emergência local."'::jsonb,
    'Aviso exigido pela §12.4 ("nao prometer substituicao de servicos publicos"). Editavel: o texto e da Fly, nao do codigo.',
    true
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.support_cases    enable row level security;
alter table public.support_messages enable row level security;
alter table public.case_locations   enable row level security;
alter table public.fly_bases        enable row level security;

-- "cliente so entra em threads autorizadas" (§43): a dele, e nada mais.
create policy support_cases_select on public.support_cases for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy support_cases_insert on public.support_cases for insert to authenticated
  with check ((select auth.uid()) = user_id or fly_private.is_staff());
-- So a equipe muda situacao: aceitar, resolver e escalar sao atos dela.
create policy support_cases_update_staff on public.support_cases for update to authenticated
  using (fly_private.is_staff()) with check (fly_private.is_staff());

/**
 * Mensagem so na thread de quem participa.
 *
 * O `case_id` vem do cliente, entao a policy confere a **dona do caso** — sem
 * isso alguem escreveria numa thread alheia mandando um id qualquer.
 */
create policy support_messages_select on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_cases c
      where c.id = support_messages.case_id
        and (c.user_id = (select auth.uid()) or fly_private.is_staff())
    )
  );

create policy support_messages_insert on public.support_messages for insert to authenticated
  with check (
    not is_system
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.support_cases c
      where c.id = support_messages.case_id
        and (c.user_id = (select auth.uid()) or fly_private.is_staff())
    )
  );

-- O cliente manda a propria localizacao; a equipe le para socorrer.
create policy case_locations_select on public.case_locations for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy case_locations_insert on public.case_locations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy fly_bases_select on public.fly_bases for select to authenticated
  using (is_active or fly_private.is_staff());
create policy fly_bases_write_operator on public.fly_bases for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

revoke all on public.support_cases    from anon;
revoke all on public.support_messages from anon;
revoke all on public.case_locations   from anon;
revoke all on public.fly_bases        from anon;

grant select, insert, update on public.support_cases to authenticated;
grant select, insert on public.support_messages to authenticated;
grant select, insert on public.case_locations to authenticated;
grant select on public.fly_bases to authenticated;
grant insert, update, delete on public.fly_bases to authenticated;

-- Conversa nao se apaga: some da thread e a operacao perde o historico.
revoke update, delete on public.support_messages from authenticated;
revoke update, delete on public.case_locations from authenticated;

revoke all on function fly_private.carimbar_atendimento() from public, anon, authenticated;
revoke all on function fly_private.carimbar_primeira_resposta() from public, anon, authenticated;
revoke all on function public.abrir_atendimento(public.support_level, text, uuid) from public, anon;
grant execute on function public.abrir_atendimento(public.support_level, text, uuid) to authenticated;

-- Realtime: o canal e privado porque a RLS acima vale para ele tambem.
alter publication supabase_realtime add table public.support_messages;
