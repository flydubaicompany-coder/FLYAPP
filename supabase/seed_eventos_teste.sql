-- =============================================================================
-- Eventos de DEMONSTRACAO para o banner da Home
--
-- Arquivo separado de proposito: o `supabase db push --include-seed` **nao
-- reexecuta** um seed ja aplicado quando o conteudo muda — ele so atualiza o
-- hash. Conteudo novo precisa de arquivo novo.
--
-- Data, cidade e capa aqui sao demonstracao. O calendario real vem do Fly Ops.
-- =============================================================================

-- --- Eventos em destaque, para o banner da Home ------------------------------
-- Tres dos eventos ja semeados ganham data, cidade e capa, so para o carrossel
-- ter o que mostrar. Datas relativas a `current_date`, nunca cravadas.
--
-- As fotos ficam no bucket `passeios`, sob `eventos/`: e o bucket publico de
-- midia da vitrine, com a RLS certa (leitura livre, escrita so de operador).
-- Criar um bucket so para eventos custaria migration sem ganho.
update public.events e
set is_published = true,
    published_at = coalesce(e.published_at, now()),
    home_order = v.ordem,
    city = v.cidade,
    starts_at = current_date + v.dias
from (values
  ('fly-cup-futevolei', 10, 'Jumeirah Beach',        15),
  ('fly-cup-basquete',  20, 'Dubai Sports City',     37),
  ('fly-cup-kart',      30, 'Dubai Autodrome',       61)
) as v(slug, ordem, cidade, dias)
where e.slug = v.slug;

insert into public.event_media (event_id, storage_path, kind, sort_order)
select e.id, m.arquivo, 'image', 0
from (values
  ('fly-cup-futevolei', 'eventos/marina-yacht.jpg'),
  ('fly-cup-basquete',  'eventos/dubai-frame.jpg'),
  ('fly-cup-kart',      'eventos/burj-khalifa.jpg')
) as m(slug, arquivo)
join public.events e on e.slug = m.slug
where not exists (select 1 from public.event_media x where x.event_id = e.id);
