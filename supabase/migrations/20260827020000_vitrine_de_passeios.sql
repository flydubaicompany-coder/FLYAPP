-- =============================================================================
-- Fase 5 — as seções da vitrine (§40.1 e §6.1)
--
-- A §6.1 lista seis prateleiras: Trend, recomendados, Fly Exclusives, perto de
-- você, ofertas e combos, parceiros e eventos locais.
--
-- **O que este arquivo deliberadamente NÃO faz: inventar um algoritmo de
-- recomendação.** O app não tem sinal para isso. As preferências que o cliente
-- preenche no onboarding são texto livre — "snacks", "música", "hobbies" — e
-- não existe nada que ligue "gosta de rock" a um passeio. Espremer uma
-- recomendação disso seria adivinhar e chamar de personalização; a §33 proíbe
-- inventar critério de ranking.
--
-- Então a curadoria é da Fly, feita no painel, e a tela diz isso: a seção se
-- chama "A Fly recomenda", não "recomendados para você". A diferença não é
-- semântica — é a diferença entre uma promessa que o sistema cumpre e uma que
-- ele não cumpre.
--
-- Três fontes cobrem as seis prateleiras sem inventar nada:
--
--   selo               → `tours.badge`, que a operação já define. Trend e
--                        Fly Exclusives saem daqui de graça.
--   curada             → lista explícita e ordenada, escolhida no painel. É
--                        como "A Fly recomenda", "ofertas e combos" e
--                        "parceiros" se enchem, porque não há sinal honesto.
--   destino_da_viagem  → o slot "perto de você" da §6.1, resolvido pelo
--                        **destino da viagem ativa**, e não por GPS.
--                        Localização é dado sensível (§23.1), pedir permissão
--                        de GPS para montar vitrine é desproporcional, e o
--                        provedor de mapa é P16. Por isso o rótulo semeado é
--                        "No seu destino": o app sabe para onde você vai, não
--                        onde você está, e a prateleira não promete mais do
--                        que sabe.
--
-- Seção vazia não aparece. Uma prateleira "A Fly recomenda" sem nada dentro é
-- pior do que prateleira nenhuma.
-- =============================================================================

create type public.tour_section_source as enum ('selo', 'curada', 'destino_da_viagem');

create table public.tour_sections (
  key text primary key,
  label text not null,
  subtitle text,
  source public.tour_section_source not null,

  -- Só faz sentido quando a fonte é `selo`.
  badge public.tour_badge,

  -- Prateleira é vitrine, não catálogo: quem quer a lista inteira usa a busca.
  max_items int not null default 8,

  sort_order int not null default 0,
  is_published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tour_sections_key_format check (key ~ '^[a-z][a-z0-9_]{2,39}$'),
  constraint tour_sections_max_sane check (max_items between 1 and 24),
  -- Fonte `selo` sem selo renderiza uma prateleira vazia para sempre, e
  -- ninguém descobre por quê.
  constraint tour_sections_selo_tem_badge check (source <> 'selo' or badge is not null),
  constraint tour_sections_badge_so_em_selo check (source = 'selo' or badge is null)
);

create index tour_sections_publicadas_idx on public.tour_sections (sort_order)
  where is_published;

/**
 * A lista escolhida a dedo, para as seções `curada`.
 *
 * `sort_order` é da seção, não do passeio: o mesmo passeio pode ser o primeiro
 * de "A Fly recomenda" e o quarto de "Ofertas".
 */
create table public.tour_section_items (
  section_key text not null references public.tour_sections (key) on delete cascade,
  tour_id uuid not null references public.tours (id) on delete cascade,
  sort_order int not null default 0,

  primary key (section_key, tour_id)
);

create index tour_section_items_ordem_idx on public.tour_section_items (section_key, sort_order);

create trigger tour_sections_touch before update on public.tour_sections
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
--
-- O cliente lê a vitrine publicada; só quem publica catálogo a edita.
-- -----------------------------------------------------------------------------
alter table public.tour_sections enable row level security;
alter table public.tour_section_items enable row level security;

create policy tour_sections_select_publicadas on public.tour_sections for select to authenticated
  using (is_published or fly_private.is_global_operator());

create policy tour_sections_write_operador on public.tour_sections for all to authenticated
  using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

create policy tour_section_items_select on public.tour_section_items for select to authenticated
  using (
    exists (
      select 1 from public.tour_sections s
      where s.key = public.tour_section_items.section_key
        and (s.is_published or fly_private.is_global_operator())
    )
  );

create policy tour_section_items_write_operador on public.tour_section_items for all to authenticated
  using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

grant select on public.tour_sections to authenticated;
grant select on public.tour_section_items to authenticated;
grant insert, update, delete on public.tour_sections to authenticated;
grant insert, update, delete on public.tour_section_items to authenticated;

revoke all on public.tour_sections from anon;
revoke all on public.tour_section_items from anon;

/**
 * A vitrine, resolvida no servidor (§6.1).
 *
 * Devolve linhas planas — seção repetida por passeio — e o app agrupa. Não é
 * elegante e é a coisa certa: a alternativa é o app pedir as seções, depois
 * um `select` por seção, e decidir sozinho o que "perto de você" quer dizer.
 * Uma viagem por vitrine, e o servidor decide o que entra.
 *
 * "No seu destino" resolve pelo `destination_id` da viagem ativa — o mesmo
 * campo dos dois lados, em vez de comparar nome de cidade por texto. Sem
 * viagem ativa, a seção some, em vez de mostrar o catálogo inteiro sob um
 * rótulo que promete proximidade.
 *
 * `security definer` porque precisa ler `trips` e `trip_members` para achar o
 * destino, e a RLS daquelas tabelas é sobre a viagem, não sobre a vitrine. O
 * que a função devolve continua sendo só catálogo publicado.
 */
create or replace function public.vitrine_de_passeios()
returns table (
  section_key text,
  section_label text,
  section_subtitle text,
  section_sort int,
  tour_id uuid,
  tour_sort int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_destino uuid;
begin
  -- O destino da viagem que está acontecendo ou por vir. `published` é a
  -- viagem confirmada e `ongoing` a que já começou; rascunho e encerrada não
  -- montam vitrine.
  select t.destination_id into v_destino
  from public.trip_members tm
  join public.trips t on t.id = tm.trip_id
  where tm.user_id = v_user
    and t.status in ('published', 'ongoing')
  order by t.starts_on
  limit 1;

  return query
  with publicadas as (
    select * from public.tour_sections s where s.is_published
  ),
  resolvidas as (
    -- Por selo: Trend e Fly Exclusives.
    select s.key, s.label, s.subtitle, s.sort_order as ssort, s.max_items,
           t.id as tid, t.sort_order as tsort
    from publicadas s
    join public.tours t
      on s.source = 'selo' and t.badge = s.badge and t.status = 'published'

    union all

    -- Curada: a ordem é a que a operação escolheu.
    select s.key, s.label, s.subtitle, s.sort_order, s.max_items,
           t.id, i.sort_order
    from publicadas s
    join public.tour_section_items i on i.section_key = s.key
    join public.tours t on t.id = i.tour_id and t.status = 'published'
    where s.source = 'curada'

    union all

    -- No destino: só existe se houver viagem ativa com destino definido.
    select s.key, s.label, s.subtitle, s.sort_order, s.max_items,
           t.id, t.sort_order
    from publicadas s
    join public.tours t
      on s.source = 'destino_da_viagem'
     and t.status = 'published'
     and v_destino is not null
     and t.destination_id = v_destino
  ),
  numeradas as (
    select r.*,
           row_number() over (partition by r.key order by r.tsort, r.tid) as posicao
    from resolvidas r
  )
  select n.key, n.label, n.subtitle, n.ssort, n.tid, n.posicao::int
  from numeradas n
  where n.posicao <= n.max_items
  order by n.ssort, n.posicao;
end;
$$;

revoke all on function public.vitrine_de_passeios() from public, anon;
grant execute on function public.vitrine_de_passeios() to authenticated;

comment on function public.vitrine_de_passeios() is
  'Seções da tela Passeios, ja resolvidas e cortadas por max_items (§6.1).';

-- -----------------------------------------------------------------------------
-- As seis prateleiras da §6.1.
--
-- Nascem **despublicadas**, e as curadas nascem vazias. A ordem e os rotulos
-- vem da spec; o conteudo vem do painel. Publicar uma prateleira vazia seria
-- entregar uma tela com buraco.
-- -----------------------------------------------------------------------------
insert into public.tour_sections (key, label, subtitle, source, badge, sort_order, is_published) values
  ('trend', 'Trend Passeios', 'O que mais saiu esta semana', 'selo', 'trending', 10, false),
  ('fly_recomenda', 'A Fly recomenda', null, 'curada', null, 20, false),
  ('exclusives', 'Fly Exclusives', 'Só quem viaja com a Fly entra', 'selo', 'exclusive', 30, false),
  ('perto', 'No seu destino', 'O slot "perto de voce" da §6.1, sem pedir GPS', 'destino_da_viagem', null, 40, false),
  ('ofertas', 'Ofertas e combos', null, 'curada', null, 50, false),
  ('parceiros', 'Parceiros e eventos locais', null, 'curada', null, 60, false)
on conflict (key) do nothing;

comment on table public.tour_sections is
  'Prateleiras da tela Passeios. "A Fly recomenda" e curadoria da Fly, e nao '
  'personalizacao: o app nao tem sinal de gosto estruturado, e §33 proibe '
  'inventar criterio de ranking.';
