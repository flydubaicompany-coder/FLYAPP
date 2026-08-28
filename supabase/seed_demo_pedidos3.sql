-- =============================================================================
-- Pedidos de DEMONSTRACAO
--
-- Tres passeios comprados, para a folha e a pagina "Meus Passeios" terem o que
-- mostrar. Sem eles a lista fica com uma linha generica.
--
-- **Nada aqui e venda real.** Preco vem do catalogo de demonstracao, cuja
-- politica de cancelamento se declara teste no proprio texto. Apagar este
-- arquivo e limpar `orders` devolve o app ao estado sem compras.
--
-- Arquivo novo porque `db push --include-seed` nao reexecuta seed ja aplicado.
-- =============================================================================

insert into public.orders (
  user_id, trip_id, reference, status, currency,
  subtotal_cents, total_cents, confirmed_at,
  cancellation_policy_id, cancellation_policy_version,
  cancellation_policy_label, cancellation_policy_text
)
select
  u.id, t.id, v.ref, v.situacao::public.order_status, 'AED'::public.currency_code,
  v.total, v.total, now(),
  p.id, p.version, p.label, p.description
from auth.users u
cross join (select id from public.trips where name = 'Dubai — Fly Black') t
cross join (select id, version, label, description from public.cancellation_policies
            where key = 'teste-demonstracao' and version = 1) p
cross join (values
  ('FLY-DEMO-1', 'confirmed', 39800),
  ('FLY-DEMO-2', 'confirmed', 50000),
  ('FLY-DEMO-3', 'confirmed', 50000)
) as v(ref, situacao, total)
where u.email = 'cliente@fly.com'
  and not exists (select 1 from public.orders o where o.reference = v.ref);

-- Um item por pedido, com nome, horario e preco do catalogo.
insert into public.order_items (
  order_id, tour_id, variant_id, tour_title, variant_label,
  starts_at, timezone, people, unit_price_cents, currency, line_total_cents
)
select
  o.id, t.id, var.id, t.title, var.label,
  (current_date + m.dias) + m.hora, 'Asia/Dubai',
  2, var.price_cents, var.currency, var.price_cents * 2
from (values
  ('FLY-DEMO-1', 'topo-do-burj-khalifa',             1, interval '18 hours 30 minutes'),
  ('FLY-DEMO-2', 'jantar-com-vista-do-burj-al-arab', 3, interval '20 hours'),
  ('FLY-DEMO-3', 'dubai-frame',                     -1, interval '9 hours')
) as m(ref, slug, dias, hora)
join public.orders o on o.reference = m.ref
join public.tours t on t.slug = m.slug
join public.tour_variants var on var.tour_id = t.id
where not exists (select 1 from public.order_items i where i.order_id = o.id);
