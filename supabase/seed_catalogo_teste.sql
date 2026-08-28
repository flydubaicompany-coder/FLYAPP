-- =============================================================================
-- Catalogo de DEMONSTRACAO — nao e catalogo de producao
--
-- Existe por um motivo so: sem passeio publicado com foto, a tela Passeios
-- fica vazia e o redesenho nao tem o que comparar com o Claude Design. Foi a
-- falta de foto que fez o card cair no formato compacto que o dono reprovou.
--
-- O QUE VEIO DO DONO, em 28/08/2026, e portanto NAO e invencao:
--   - preco: 199 no Burj Khalifa, 250 nos outros quatro.
--
-- O QUE E PLACEHOLDER MARCADO (§33), e precisa de decisao antes de producao:
--   - moeda AED — escolhida por ser a do destino; o dono deu o numero, nao a moeda
--   - politica de cancelamento — a §33 proibe inventar, entao a que esta aqui
--     se identifica como teste no proprio texto que o cliente le
--   - duracao, horarios, capacidade e ponto de encontro
--   - pontos por compra ficam NULOS: a formula e a P12, e chutar seria pior
--     do que o espaco vazio que o card ja sabe mostrar
--
-- As fotos sao as cinco de `docs/design/fotos/`, no bucket publico `passeios`.
--
-- Idempotente: roda quantas vezes precisar.
-- =============================================================================

-- --- Categorias --------------------------------------------------------------
-- Rotulo de prateleira, nao regra de negocio.
insert into public.tour_categories (key, label, sort_order) values
  ('vistas',       'Vistas e miradouros', 10),
  ('mar',          'Mar e marina',        20),
  ('ar',           'Voos panoramicos',    30),
  ('gastronomia',  'Gastronomia',         40),
  ('cultura',      'Cultura e cidade',    50)
on conflict (key) do nothing;

-- --- Politica de cancelamento — PLACEHOLDER ----------------------------------
-- A §33 lista "politica de cancelamento" entre o que nunca se inventa. Esta
-- existe porque a constraint `tours_published_has_policy` recusa publicar sem
-- uma, e ela se identifica como teste no proprio texto que o cliente le — para
-- que ninguem a confunda com a regra real no dia em que houver cliente.
insert into public.cancellation_policies (key, version, label, description, rules) values
  (
    'teste-demonstracao',
    1,
    'POLITICA DE TESTE — nao vale para compra real',
    'Este catalogo e uma demonstracao visual. Nenhuma compra aqui gera '
      'obrigacao, e esta politica nao foi definida pela Fly. A regra real entra '
      'quando o dono do produto decidir (§33).',
    '[]'::jsonb
  )
on conflict (key, version) do nothing;

-- --- Passeios ----------------------------------------------------------------
insert into public.tours (
  slug, category_key, destination_id, title, summary, fly_note,
  city, meeting_point, duration_minutes, badge, audiences,
  status, cancellation_policy_id, sort_order
)
select
  v.slug, v.categoria, d.id, v.titulo, v.resumo, v.nota,
  'Dubai', 'PENDENTE — ponto de encontro nao definido', v.minutos,
  v.selo::public.tour_badge, v.publicos::public.tour_audience[],
  'published'::public.tour_status, p.id, v.ordem
from (values
  ('topo-do-burj-khalifa', 'vistas', 'Topo do Burj Khalifa',
   'O andar mais alto aberto ao publico, no fim da tarde.',
   'A Fly reserva o horario em que a cidade acende.',
   90,  'trending', array['couple','luxury'],       10),
  ('barco-pela-marina', 'mar', 'Barco pela Marina',
   'Uma volta pela marina, entre as torres e a agua.',
   'O trajeto que mostra Dubai de baixo para cima.',
   120, 'trending', array['family','couple'],       20),
  ('voo-de-helicoptero', 'ar', 'Voo de helicoptero',
   'A cidade inteira em poucos minutos de ar.',
   'Curto de proposito: e o tempo em que ninguem desgruda da janela.',
   30,  'exclusive', array['luxury','adventure'],   30),
  ('jantar-com-vista-do-burj-al-arab', 'gastronomia', 'Jantar com vista do Burj Al Arab',
   'Mesa voltada para a vela, no fim do dia.',
   'A vista que todo mundo fotografa, do lado de dentro.',
   150, 'exclusive', array['couple','luxury'],      40),
  ('dubai-frame', 'cultura', 'Dubai Frame',
   'A moldura entre a cidade velha e a nova.',
   'Os dois Dubais, um de cada lado do vidro.',
   60,  null,        array['family','business'],    50)
) as v(slug, categoria, titulo, resumo, nota, minutos, selo, publicos, ordem)
cross join (select id from public.destinations where slug = 'dubai') d
cross join (select id from public.cancellation_policies where key = 'teste-demonstracao' and version = 1) p
on conflict (slug) do nothing;

-- --- Uma opcao por passeio, com o preco que o dono definiu -------------------
insert into public.tour_variants (tour_id, label, description, price_cents, currency, covers_people, min_people, max_people)
select
  t.id,
  'Por pessoa',
  'Valor de demonstracao definido pelo dono do produto em 28/08/2026.',
  case when t.slug = 'topo-do-burj-khalifa' then 19900 else 25000 end,
  'AED'::public.currency_code,
  1, 1, 8
from public.tours t
where t.slug in (
  'topo-do-burj-khalifa','barco-pela-marina','voo-de-helicoptero',
  'jantar-com-vista-do-burj-al-arab','dubai-frame'
)
  and not exists (select 1 from public.tour_variants x where x.tour_id = t.id);

-- --- Horarios: proximos 14 dias ---------------------------------------------
-- Datas relativas a `current_date`, nunca fixas: um seed com data cravada
-- envelhece e passa a produzir passeio no passado.
insert into public.tour_slots (variant_id, starts_at, ends_at, timezone, capacity)
select
  v.id,
  dia + hora,
  dia + hora + make_interval(mins => t.duration_minutes),
  'Asia/Dubai',
  10
from public.tour_variants v
join public.tours t on t.id = v.tour_id
cross join generate_series(
  date_trunc('day', now() at time zone 'Asia/Dubai') + interval '1 day',
  date_trunc('day', now() at time zone 'Asia/Dubai') + interval '14 days',
  interval '1 day'
) as dia
cross join (values (interval '10 hours'), (interval '17 hours')) as h(hora)
where t.slug in (
  'topo-do-burj-khalifa','barco-pela-marina','voo-de-helicoptero',
  'jantar-com-vista-do-burj-al-arab','dubai-frame'
)
on conflict (variant_id, starts_at) do nothing;

-- --- Fotos -------------------------------------------------------------------
insert into public.tour_media (tour_id, kind, storage_path, alt_text, sort_order)
select t.id, 'image', m.arquivo, m.alt, 0
from (values
  ('topo-do-burj-khalifa',             'burj-khalifa.jpg', 'O Burj Khalifa visto de baixo, ao entardecer'),
  ('barco-pela-marina',                'marina-yacht.jpg', 'Barco na marina de Dubai entre as torres'),
  ('voo-de-helicoptero',               'helicoptero.jpg',  'Helicoptero sobrevoando a costa de Dubai'),
  ('jantar-com-vista-do-burj-al-arab', 'burj-al-arab.jpg', 'O Burj Al Arab visto da praia'),
  ('dubai-frame',                      'dubai-frame.jpg',  'A moldura dourada do Dubai Frame')
) as m(slug, arquivo, alt)
join public.tours t on t.slug = m.slug
where not exists (select 1 from public.tour_media x where x.tour_id = t.id);

-- --- Vitrine -----------------------------------------------------------------
-- `trend` e `exclusives` enchem sozinhas pelo selo. `fly_recomenda` e curadoria
-- a dedo — e continua sendo curadoria, nao algoritmo (D84).
insert into public.tour_section_items (section_key, tour_id, sort_order)
select 'fly_recomenda', t.id, t.sort_order
from public.tours t
where t.slug in ('topo-do-burj-khalifa', 'jantar-com-vista-do-burj-al-arab', 'dubai-frame')
on conflict (section_key, tour_id) do nothing;

update public.tour_sections
set is_published = true
where key in ('trend', 'fly_recomenda', 'exclusives');
