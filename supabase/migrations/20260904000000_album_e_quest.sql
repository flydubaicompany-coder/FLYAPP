-- =============================================================================
-- Fase 9 — album, figurinhas, Dia Completo e Fly Quest (§13.1, §13.2, §14.1
-- e §44, entregas 1 a 6 e 11).
--
-- ## O que este arquivo reaproveita, de proposito
--
-- Tres coisas ja provadas nas fases anteriores, e nenhuma reescrita:
--
--   - **`qr_kind` ja tem `'album'` e `'city_point'`** (Fase 4). Nenhum enum
--     novo: os codigos do album e dos pontos de cidade sao `qr_tokens` como
--     qualquer outro, com validade, revogacao e limite de uso.
--   - **`ler_qr` continua sendo quem valida o check-in** do guia. A figurinha
--     nao ganha um segundo caminho de validacao — ela **escuta** o resultado.
--   - **`points_ledger` ja e append-only e idempotente** (Fase 6). Ponto de
--     missao entra por ele, com chave derivada, e nao por tabela paralela.
--
-- ## O que NAO se inventa aqui (§33)
--
-- **Quanto vale cada figurinha e cada missao em pontos.** A coluna existe,
-- nasce **zero**, e quem preenche e a operacao no Fly Ops. E o freio da D136
-- continua valendo: enquanto `points.earning_rule` tiver `version` nula,
-- **nada e creditado** — nem aqui.
--
-- **A recompensa do capitulo.** "Premio" esta na lista da §33. O capitulo tem
-- um texto de recompensa que alguem escreve, e nao um catalogo que o codigo
-- imagina.
--
-- ## O Dia Completo acontece no servidor
--
-- Requisito literal da §13.2: "O Dia Completo so acontece no servidor e
-- conforme configuracao do Fly Ops. Nao pode ser inferido apenas pelo
-- aplicativo." Aqui ele e um **gatilho** sobre `sticker_unlocks`: o app nunca
-- decide, e nem precisa perguntar.
-- =============================================================================

create type public.sticker_rarity as enum (
  'common',
  'rare',
  'secret',       -- nao aparece na grade ate ser desbloqueada
  'holographic'
);

create type public.sticker_unlock_kind as enum (
  'activity_checkin', -- o guia validou o check-in por QR
  'qr',               -- o cliente leu um codigo do album ou da cidade
  'manual'            -- acao autorizada, registrada por quem opera a viagem
);

-- -----------------------------------------------------------------------------
-- Capitulo = dia da viagem (§13.1, "cada dia e um capitulo").
-- -----------------------------------------------------------------------------
create table public.album_chapters (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Um capitulo por dia, e o dia ja existe desde a Fase 4.
  trip_day_id uuid not null unique references public.trip_days (id) on delete cascade,

  title text not null,
  /**
   * O teaser do capitulo (§13.3).
   *
   * "No app, mostrar apenas um teaser." E o texto que o cliente le sobre o
   * capitulo **seguinte** — nunca a surpresa fisica, que a §13.3 manda nao
   * revelar antes da entrega.
   */
  teaser text,

  -- "recompensa" (§13.2). Texto, porque premio esta na lista da §33.
  reward_note text,
  -- Pontos do capitulo. Nasce zero: quanto vale e decisao do dono.
  reward_points int not null default 0,

  /**
   * Regra de conclusao (§13.2).
   *
   * Hoje ha uma: **todas as figurinhas obrigatorias do capitulo**. O check
   * existe para a segunda regra precisar de migration e de decisao registrada,
   * em vez de aparecer como texto solto numa coluna livre.
   */
  completion_rule text not null default 'all_required',

  -- "horario de liberacao" (§13.2). Nulo = liberado com o capitulo.
  release_at timestamptz,

  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint album_chapters_titulo_preenchido check (length(btrim(title)) > 0),
  constraint album_chapters_regra_conhecida check (completion_rule in ('all_required')),
  constraint album_chapters_pontos_nao_negativos check (reward_points >= 0)
);

create index album_chapters_trip_idx on public.album_chapters (trip_id, sort_order);

-- -----------------------------------------------------------------------------
-- Figurinhas (§13.1).
-- -----------------------------------------------------------------------------
create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.album_chapters (id) on delete cascade,

  -- Codigo estavel: entra no escopo do QR e no album fisico impresso.
  code text not null,
  name text not null,
  description text,

  rarity public.sticker_rarity not null default 'common',
  -- "figurinhas obrigatorias" e "opcionais" (§13.2) sao a mesma tabela.
  is_required boolean not null default false,

  unlock_kind public.sticker_unlock_kind not null default 'activity_checkin',
  -- Qual atividade libera, quando o desbloqueio e por check-in.
  activity_id uuid references public.activities (id) on delete set null,

  /**
   * A arte fica no bucket privado `album`, sob `<sticker_id>/`.
   *
   * Privado, e nao publico como `passeios`: a §44 exige que "o cliente veja
   * somente midia liberada", e uma figurinha secreta num bucket publico e uma
   * URL adivinhavel de distancia. A policy de Storage confere o desbloqueio.
   */
  image_path text,

  -- Pontos da figurinha. Nasce zero — §33.
  points_reward int not null default 0,

  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stickers_code_unico_no_capitulo unique (chapter_id, code),
  constraint stickers_code_formato check (code ~ '^[a-z][a-z0-9-]{1,63}$'),
  constraint stickers_nome_preenchido check (length(btrim(name)) > 0),
  constraint stickers_pontos_nao_negativos check (points_reward >= 0),
  -- Desbloqueio por check-in sem atividade nao tem o que escutar.
  constraint stickers_checkin_tem_atividade
    check (unlock_kind <> 'activity_checkin' or activity_id is not null)
);

create index stickers_capitulo_idx on public.stickers (chapter_id, sort_order);
create index stickers_atividade_idx on public.stickers (activity_id)
  where unlock_kind = 'activity_checkin';

/**
 * Desbloqueios. Append-only, e **unico por pessoa e figurinha**.
 *
 * "Repeticao nao duplica unlock/pontos" (§44) e uma constraint, e nao uma
 * checagem no codigo: o `unique` decide, e todo caminho de desbloqueio usa
 * `on conflict do nothing`.
 */
create table public.sticker_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sticker_id uuid not null references public.stickers (id) on delete cascade,

  -- Como foi: 'checkin', 'qr', 'ops'.
  source text not null,
  -- O que provou: id do scan, id do token, id de quem liberou a mao.
  reference text,

  unlocked_at timestamptz not null default now(),

  constraint sticker_unlocks_unico unique (user_id, sticker_id)
);

create index sticker_unlocks_user_idx on public.sticker_unlocks (user_id, unlocked_at desc);
create index sticker_unlocks_sticker_idx on public.sticker_unlocks (sticker_id);

/** Dia Completo. Tambem unico, e tambem escrito so pelo servidor. */
create table public.chapter_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid not null references public.album_chapters (id) on delete cascade,
  completed_at timestamptz not null default now(),

  constraint chapter_completions_unico unique (user_id, chapter_id)
);

create index chapter_completions_user_idx on public.chapter_completions (user_id, completed_at desc);
create index chapter_completions_chapter_idx on public.chapter_completions (chapter_id);

-- -----------------------------------------------------------------------------
-- Fly Quest (§14.1).
--
-- Nome proprio da Fly. A §14.1 e explicita: "Nao usar nome, personagens ou
-- identidade Pokemon."
-- -----------------------------------------------------------------------------
create table public.quest_missions (
  id uuid primary key default gen_random_uuid(),
  -- Nula = missao da cidade, para qualquer viagem naquele destino.
  trip_id uuid references public.trips (id) on delete cascade,
  destination_id uuid references public.destinations (id) on delete set null,

  code text not null unique,
  title text not null,
  briefing text,

  -- Hoje o codigo e a unica prova aceita. Geofence e foto sao §14.1 futuro:
  -- "geofence quando confiavel" — e nao ha provedor de mapa (P16).
  points_reward int not null default 0,
  -- Missao pode entregar figurinha, e ai o album e o premio.
  sticker_id uuid references public.stickers (id) on delete set null,

  starts_at timestamptz,
  ends_at timestamptz,

  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint quest_missions_code_formato check (code ~ '^[a-z][a-z0-9-]{1,63}$'),
  constraint quest_missions_titulo_preenchido check (length(btrim(title)) > 0),
  constraint quest_missions_pontos_nao_negativos check (points_reward >= 0),
  constraint quest_missions_janela_coerente
    check (ends_at is null or starts_at is null or ends_at > starts_at),
  -- Missao que nao da ponto nem figurinha nao e missao, e so texto.
  constraint quest_missions_entrega_alguma_coisa
    check (points_reward > 0 or sticker_id is not null)
);

create index quest_missions_publicadas_idx on public.quest_missions (is_published, sort_order);
create index quest_missions_trip_idx on public.quest_missions (trip_id);
create index quest_missions_sticker_idx on public.quest_missions (sticker_id);

create table public.quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null references public.quest_missions (id) on delete cascade,
  completed_at timestamptz not null default now(),
  reference text,

  constraint quest_completions_unico unique (user_id, mission_id)
);

create index quest_completions_user_idx on public.quest_completions (user_id, completed_at desc);
create index quest_completions_mission_idx on public.quest_completions (mission_id);

create trigger album_chapters_touch before update on public.album_chapters
  for each row execute function fly_private.touch_updated_at();
create trigger stickers_touch before update on public.stickers
  for each row execute function fly_private.touch_updated_at();
create trigger quest_missions_touch before update on public.quest_missions
  for each row execute function fly_private.touch_updated_at();

-- =============================================================================
-- O motor.
--
-- Tres caminhos de desbloqueio (§44, entrega 5) e **um** lugar que grava:
-- `fly_private.desbloquear_figurinha`. Sem isso, cada caminho teria a sua
-- versao da idempotencia e da pontuacao, e elas divergiriam.
-- =============================================================================

/**
 * Credita ponto de album ou de missao, uma vez so.
 *
 * A chave de idempotencia e derivada do que originou (`album:<sticker>:<user>`),
 * entao repetir o caminho nao pontua duas vezes — e o `unique` do ledger
 * decide, nao um `if` aqui.
 *
 * **Nada e creditado enquanto `points.earning_rule` tiver `version` nula**
 * (D136). O freio da §33 vale para o album como vale para a compra.
 */
create or replace function fly_private.creditar_pontos_de_encantamento(
  p_user uuid,
  p_pontos int,
  p_source text,
  p_reference text,
  p_chave text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meses int := fly_private.validade_dos_pontos();
begin
  if p_pontos <= 0 then
    return;
  end if;

  -- Sem regra decidida, o sistema nao inventa uma.
  if fly_private.versao_da_regra() is null then
    return;
  end if;

  insert into public.points_ledger
    (user_id, kind, amount, source, reference, occurred_at, expires_on, rule_version, idempotency_key)
  values (
    p_user, 'earn', p_pontos, p_source, p_reference, now(),
    case when v_meses is null then null
         else (now() + make_interval(months => v_meses))::date end,
    fly_private.versao_da_regra(),
    p_chave
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

/**
 * Desbloqueia uma figurinha para alguem. O unico lugar que grava.
 *
 * Devolve `true` quando o desbloqueio aconteceu **agora**, e `false` quando
 * ja existia. Quem chama usa isso para decidir o que dizer na tela — e nao
 * para decidir se pontua, porque o ponto tambem e idempotente por conta
 * propria.
 */
create or replace function fly_private.desbloquear_figurinha(
  p_user uuid,
  p_sticker uuid,
  p_source text,
  p_reference text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- `row_count` e inteiro. Declarar isto como boolean faz o `get diagnostics`
  -- estourar em tempo de execucao: nao ha cast implicito de int para boolean.
  v_linhas int;
  v_pontos int;
begin
  insert into public.sticker_unlocks (user_id, sticker_id, source, reference)
  values (p_user, p_sticker, p_source, p_reference)
  on conflict (user_id, sticker_id) do nothing;

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    return false;
  end if;

  select s.points_reward into v_pontos from public.stickers s where s.id = p_sticker;

  perform fly_private.creditar_pontos_de_encantamento(
    p_user,
    coalesce(v_pontos, 0),
    'challenge',
    p_sticker::text,
    'sticker:' || p_sticker::text || ':' || p_user::text
  );

  return true;
end;
$$;

/**
 * Dia Completo, no servidor (§13.2).
 *
 * Gatilho sobre `sticker_unlocks`: cada desbloqueio pergunta se o capitulo
 * fechou. O app nunca decide, e nem precisa perguntar — quando ele le o
 * album, a linha ja esta la.
 *
 * A regra e `all_required`: **toda figurinha obrigatoria e publicada** do
 * capitulo. Figurinha nao publicada nao conta, senao um rascunho da operacao
 * impediria o dia de fechar sem ninguem entender por que.
 *
 * Capitulo **sem nenhuma obrigatoria nao fecha sozinho**: `not exists` sobre
 * uma lista vazia e verdadeiro, e o dia fecharia no primeiro desbloqueio
 * opcional. Um capitulo assim ainda esta sendo montado.
 */
create or replace function fly_private.fechar_dia_completo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapter uuid;
  v_regra text;
  v_obrigatorias int;
  v_faltando int;
  v_pontos int;
  v_linhas int;
begin
  select s.chapter_id into v_chapter from public.stickers s where s.id = new.sticker_id;
  if v_chapter is null then
    return null;
  end if;

  select c.completion_rule, c.reward_points into v_regra, v_pontos
  from public.album_chapters c where c.id = v_chapter;

  if v_regra is distinct from 'all_required' then
    return null;
  end if;

  select count(*) into v_obrigatorias
  from public.stickers s
  where s.chapter_id = v_chapter and s.is_required and s.is_published;

  if v_obrigatorias = 0 then
    return null;
  end if;

  select count(*) into v_faltando
  from public.stickers s
  where s.chapter_id = v_chapter
    and s.is_required
    and s.is_published
    and not exists (
      select 1 from public.sticker_unlocks u
      where u.sticker_id = s.id and u.user_id = new.user_id
    );

  if v_faltando > 0 then
    return null;
  end if;

  insert into public.chapter_completions (user_id, chapter_id)
  values (new.user_id, v_chapter)
  on conflict (user_id, chapter_id) do nothing;

  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    perform fly_private.creditar_pontos_de_encantamento(
      new.user_id,
      coalesce(v_pontos, 0),
      'challenge',
      v_chapter::text,
      'chapter:' || v_chapter::text || ':' || new.user_id::text
    );
  end if;

  return null;
end;
$$;

create trigger sticker_unlocks_fecham_dia
  after insert on public.sticker_unlocks
  for each row execute function fly_private.fechar_dia_completo();

/**
 * Caminho 1: o guia validou o check-in.
 *
 * Gatilho sobre `qr_scans`, e nao um segundo caminho de validacao. A
 * figurinha **escuta** o resultado do `ler_qr` que ja existe desde a Fase 4:
 * so libera quando o scan deu `ok`, e o dono do token e quem recebe. E isso
 * que fecha o criterio "figurinha nao libera sem evento valido" (§44) — nao
 * ha como pedir a figurinha, so como ter o check-in aceito.
 */
create or replace function fly_private.desbloquear_por_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.qr_tokens;
  v_sticker uuid;
begin
  if new.result <> 'ok' or new.token_id is null then
    return null;
  end if;

  select * into v_token from public.qr_tokens q where q.id = new.token_id;
  if not found or v_token.kind <> 'activity_checkin' then
    return null;
  end if;
  if v_token.user_id is null or v_token.activity_id is null then
    return null;
  end if;

  for v_sticker in
    select s.id from public.stickers s
    where s.activity_id = v_token.activity_id
      and s.unlock_kind = 'activity_checkin'
      and s.is_published
  loop
    perform fly_private.desbloquear_figurinha(
      v_token.user_id, v_sticker, 'checkin', new.token_id::text
    );
  end loop;

  return null;
end;
$$;

create trigger qr_scans_desbloqueiam_figurinha
  after insert on public.qr_scans
  for each row execute function fly_private.desbloquear_por_checkin();

/**
 * Caminho 2: o **cliente** le um codigo (§13.1 e §14.1).
 *
 * Direcao oposta a do `ler_qr`: la e a equipe lendo o codigo do cliente; aqui
 * e o cliente lendo um codigo que a Fly colou no mundo — na pagina do album
 * fisico, num ponto da cidade. Por isso e outra funcao, e nao um parametro na
 * de la: quem pode ler, o que se valida e o que se registra sao diferentes.
 *
 * O que ela **nao** faz: dizer se um token existe. Codigo desconhecido e
 * codigo vencido devolvem a mesma coisa. Enumerar tokens validos a partir da
 * mensagem de erro seria facil demais — e o mesmo cuidado que o `ler_qr` ja
 * tomava.
 *
 * `max_uses` continua sendo do token: um codigo de ponto de cidade pode ser
 * lido por muita gente (limite nulo), e um codigo de premio unico nao.
 */
create or replace function public.resgatar_codigo(p_token text)
returns table (
  ok boolean,
  motivo text,
  figurinha uuid,
  figurinha_nome text,
  missao uuid,
  missao_titulo text,
  ja_tinha boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_token public.qr_tokens;
  v_id uuid;
  v_sticker public.stickers;
  v_missao public.quest_missions;
  v_novo boolean := false;
  v_linhas int;
  v_res public.qr_scan_result;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  select * into v_token from public.qr_tokens q where q.token = p_token;

  /**
   * O log interno diz **qual** foi a recusa; a mensagem ao cliente, nao.
   *
   * Uma sequencia de `already_used` e o sinal de que um print esta
   * circulando, e apagar essa distincao no log apagaria o sinal. Mas
   * devolver ao cliente "vencido" em vez de "desconhecido" deixaria
   * enumerar tokens validos pela mensagem — o mesmo cuidado do `ler_qr`.
   */
  if not found then
    v_res := 'unknown';
  elsif v_token.revoked_at is not null then
    v_res := 'revoked';
  elsif v_token.expires_at is not null and v_token.expires_at <= now() then
    v_res := 'expired';
  elsif v_token.kind not in ('album', 'city_point') then
    v_res := 'wrong_scope';
  end if;

  if v_res is not null then
    insert into public.qr_scans (token_id, scanned_by, result, note)
    values (v_token.id, v_user, v_res, 'resgate pelo cliente');
    return query select false, 'Este código não vale mais.'::text,
                        null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  v_id := v_token.id;

  /**
   * O alvo e resolvido **antes** de gastar um uso.
   *
   * Na ordem inversa, alguem de outra viagem tentando um codigo de uso unico
   * queimaria o uso de quem tem direito a ele — e o dono do codigo
   * descobriria isso na frente da figurinha que nao abre.
   */
  if v_token.scope like 'sticker:%' then
    select s.* into v_sticker
    from public.stickers s
    join public.album_chapters c on c.id = s.chapter_id
    where s.code = substring(v_token.scope from 9)
      and s.is_published
      and c.is_published
      -- Figurinha e do album de uma viagem: so quem esta nela recebe.
      and fly_private.is_trip_member(c.trip_id);

    if not found then
      insert into public.qr_scans (token_id, scanned_by, result, note)
      values (v_id, v_user, 'wrong_scope', 'resgate pelo cliente: album de outra viagem');
      return query select false, 'Este código não é do seu álbum.'::text,
                          null::uuid, null::text, null::uuid, null::text, false;
      return;
    end if;
  elsif v_token.scope like 'mission:%' then
    select m.* into v_missao
    from public.quest_missions m
    where m.code = substring(v_token.scope from 9)
      and m.is_published
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
      and (m.trip_id is null or fly_private.is_trip_member(m.trip_id));

    if not found then
      insert into public.qr_scans (token_id, scanned_by, result, note)
      values (v_id, v_user, 'wrong_scope', 'resgate pelo cliente: missao fora de janela');
      return query select false, 'Esta missão não está valendo agora.'::text,
                          null::uuid, null::text, null::uuid, null::text, false;
      return;
    end if;
  else
    insert into public.qr_scans (token_id, scanned_by, result, note)
    values (v_id, v_user, 'wrong_scope', 'resgate pelo cliente: escopo sem alvo');
    return query select false, 'Este código não entrega nada.'::text,
                        null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  -- Limite de uso conferido e incrementado no mesmo comando (§14.2).
  update public.qr_tokens q
  set uses = q.uses + 1
  where q.id = v_id
    and (q.max_uses is null or q.uses < q.max_uses);
  get diagnostics v_linhas = row_count;

  if v_linhas = 0 then
    insert into public.qr_scans (token_id, scanned_by, result, note)
    values (v_id, v_user, 'already_used', 'resgate pelo cliente');
    return query select false, 'Este código já atingiu o limite de usos.'::text,
                        null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  insert into public.qr_scans (token_id, scanned_by, result, note)
  values (v_id, v_user, 'ok', 'resgate pelo cliente');

  if v_sticker.id is not null then
    v_novo := fly_private.desbloquear_figurinha(v_user, v_sticker.id, 'qr', v_id::text);
    return query select true, null::text, v_sticker.id, v_sticker.name,
                        null::uuid, null::text, not v_novo;
    return;
  end if;

  insert into public.quest_completions (user_id, mission_id, reference)
  values (v_user, v_missao.id, v_id::text)
  on conflict (user_id, mission_id) do nothing;
  get diagnostics v_linhas = row_count;
  v_novo := v_linhas > 0;

  if v_novo then
    perform fly_private.creditar_pontos_de_encantamento(
      v_user, v_missao.points_reward, 'challenge', v_missao.code,
      'mission:' || v_missao.id::text || ':' || v_user::text
    );
    if v_missao.sticker_id is not null then
      perform fly_private.desbloquear_figurinha(
        v_user, v_missao.sticker_id, 'qr', v_id::text
      );
    end if;
  end if;

  return query select true, null::text, v_missao.sticker_id, null::text,
                      v_missao.id, v_missao.title, not v_novo;
end;
$$;

/**
 * Caminho 3: acao autorizada (§44, entrega 5).
 *
 * Quem opera a viagem libera a mao — a figurinha que o guia entregou fora do
 * fluxo de QR, o item que so existe no album fisico. Fica registrado com
 * quem liberou, porque desbloqueio a mao sem responsavel e presente anonimo.
 */
create or replace function public.liberar_figurinha(p_user uuid, p_sticker uuid)
returns table (ok boolean, novo boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip uuid;
  v_novo boolean;
begin
  select c.trip_id into v_trip
  from public.stickers s
  join public.album_chapters c on c.id = s.chapter_id
  where s.id = p_sticker;

  if v_trip is null then
    raise exception 'figurinha nao encontrada' using errcode = 'P0002';
  end if;

  if not fly_private.can_operate_trip(v_trip) then
    raise exception 'nao opera esta viagem' using errcode = '42501';
  end if;

  v_novo := fly_private.desbloquear_figurinha(
    p_user, p_sticker, 'ops', (select auth.uid())::text
  );
  return query select true, v_novo;
end;
$$;

-- =============================================================================
-- Bucket da arte das figurinhas.
--
-- **Privado**, ao contrario de `passeios`. A §44 exige que "o cliente veja
-- somente midia liberada", e uma figurinha secreta num bucket publico e uma
-- URL adivinhavel de distancia. A policy abaixo e o que faz esse criterio ser
-- regra de banco, e nao regra de tela: sem desbloqueio, o Storage recusa.
--
-- Caminho: `<sticker_id>/<arquivo>`.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'album',
  'album',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

create policy album_select on storage.objects for select to authenticated
  using (
    bucket_id = 'album'
    and (
      fly_private.is_staff()
      or exists (
        select 1 from public.sticker_unlocks u
        where u.user_id = (select auth.uid())
          and u.sticker_id::text = (storage.foldername(name))[1]
      )
    )
  );

create policy album_write_operador on storage.objects for insert to authenticated
  with check (bucket_id = 'album' and fly_private.is_global_operator());

create policy album_delete_operador on storage.objects for delete to authenticated
  using (bucket_id = 'album' and fly_private.is_global_operator());

-- =============================================================================
-- RLS e GRANT — controles diferentes, os dois configurados (D128).
-- =============================================================================
alter table public.album_chapters      enable row level security;
alter table public.stickers            enable row level security;
alter table public.sticker_unlocks     enable row level security;
alter table public.chapter_completions enable row level security;
alter table public.quest_missions      enable row level security;
alter table public.quest_completions   enable row level security;

-- Capitulo: quem esta na viagem ve o publicado; quem opera ve tudo.
create policy album_chapters_select on public.album_chapters for select to authenticated
  using (
    (is_published and fly_private.is_trip_member(trip_id))
    or fly_private.can_operate_trip(trip_id)
  );
create policy album_chapters_write on public.album_chapters for all to authenticated
  using (fly_private.can_operate_trip(trip_id))
  with check (fly_private.can_operate_trip(trip_id));

/**
 * Figurinha: publicada e do album de uma viagem que a pessoa faz.
 *
 * A **secreta aparece na leitura** — a tela e que a desenha coberta ate o
 * desbloqueio. Esconder no banco obrigaria a tela a nao saber quantas faltam,
 * e o contador do capitulo mentiria.
 */
create policy stickers_select on public.stickers for select to authenticated
  using (
    exists (
      select 1 from public.album_chapters c
      where c.id = stickers.chapter_id
        and (
          (stickers.is_published and c.is_published and fly_private.is_trip_member(c.trip_id))
          or fly_private.can_operate_trip(c.trip_id)
        )
    )
  );
create policy stickers_write on public.stickers for all to authenticated
  using (
    exists (
      select 1 from public.album_chapters c
      where c.id = stickers.chapter_id and fly_private.can_operate_trip(c.trip_id)
    )
  )
  with check (
    exists (
      select 1 from public.album_chapters c
      where c.id = stickers.chapter_id and fly_private.can_operate_trip(c.trip_id)
    )
  );

-- Desbloqueio e conclusao: leitura do proprio, mais a equipe. **Ninguem
-- escreve pelo cliente** — as duas tabelas so recebem linha por funcao.
create policy sticker_unlocks_select on public.sticker_unlocks for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

create policy chapter_completions_select on public.chapter_completions for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

-- Missao: publicada, dentro da janela, e da viagem certa (ou da cidade).
create policy quest_missions_select on public.quest_missions for select to authenticated
  using (
    (
      is_published
      and (trip_id is null or fly_private.is_trip_member(trip_id))
    )
    or fly_private.is_global_operator()
  );
create policy quest_missions_write on public.quest_missions for all to authenticated
  using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

create policy quest_completions_select on public.quest_completions for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

revoke all on public.album_chapters      from anon;
revoke all on public.stickers            from anon;
revoke all on public.sticker_unlocks     from anon;
revoke all on public.chapter_completions from anon;
revoke all on public.quest_missions      from anon;
revoke all on public.quest_completions   from anon;

grant select, insert, update, delete on public.album_chapters to authenticated;
grant select, insert, update, delete on public.stickers to authenticated;
grant select, insert, update, delete on public.quest_missions to authenticated;

/**
 * Desbloqueio e conclusao sao **so leitura** para todo mundo.
 *
 * Nao ha policy de insert nem GRANT de insert: quem grava sao as funcoes
 * `security definer`, que rodam como dono da tabela. E a diferenca que
 * importa — sem o GRANT, um cliente que descobrisse o id de uma figurinha
 * secreta ainda assim nao conseguiria se dar a figurinha.
 */
grant select on public.sticker_unlocks to authenticated;
grant select on public.chapter_completions to authenticated;

revoke all on function fly_private.creditar_pontos_de_encantamento(uuid, int, text, text, text)
  from public, anon, authenticated;
revoke all on function fly_private.desbloquear_figurinha(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function fly_private.fechar_dia_completo() from public, anon, authenticated;
revoke all on function fly_private.desbloquear_por_checkin() from public, anon, authenticated;

revoke all on function public.resgatar_codigo(text) from public, anon;
grant execute on function public.resgatar_codigo(text) to authenticated;

revoke all on function public.liberar_figurinha(uuid, uuid) from public, anon;
grant execute on function public.liberar_figurinha(uuid, uuid) to authenticated;

-- O album e o Fly Quest chegam em tempo real: uma figurinha que abre enquanto
-- a pessoa olha a tela e metade do encantamento.
alter publication supabase_realtime add table public.sticker_unlocks;
alter publication supabase_realtime add table public.chapter_completions;
