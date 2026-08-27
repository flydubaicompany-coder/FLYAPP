-- =============================================================================
-- Seed da Fase 3: catálogos e os eventos que a §38 lista
--
-- Categorias e canais são estrutura. Os eventos são os que a especificação
-- nomeia — datas, cidades e horários ficam **nulos** de propósito: a §33
-- proíbe inventar horário, e o calendário real é publicado pelo Fly Ops.
-- =============================================================================

insert into public.event_categories (key, label, sort_order) values
  ('fly-cup',    'Fly Cup', 10),
  ('legends',    'Legends', 20),
  ('summit',     'Fly Summit', 30),
  ('festa',      'Festas e ativações', 40),
  ('viagem',     'Viagens Fly', 50)
on conflict (key) do nothing;

insert into public.notification_categories (key, label, description, is_critical, sort_order) values
  ('operational', 'Alertas da viagem',
   'Mudança de roteiro, ponto de encontro, voo e horário. Sempre chegam.', true, 10),
  ('itinerary',   'Roteiro',
   'Lembretes do que vem a seguir no seu dia.', false, 20),
  ('meal',        'Refeições',
   'Escolha do almoço e do jantar, e o prazo para confirmar.', false, 30),
  ('document',    'Documentos',
   'Passaporte, vouchers e o que a equipe precisa de você.', false, 40),
  ('purchase',    'Compras e pagamentos',
   'Pedidos, confirmações e recibos.', false, 50),
  ('benefit',     'Benefícios e pontos',
   'Fly Points, status e benefícios disponíveis.', false, 60),
  ('album',       'Álbum',
   'Figurinhas liberadas, fotos e o filme da viagem.', false, 70),
  ('event',       'Eventos Fly',
   'O que está acontecendo no ecossistema.', false, 80),
  ('marketing',   'Novidades e ofertas',
   'Novas viagens e experiências. Desligar isto nunca silencia alerta da viagem.', false, 90),
  ('support',     'Suporte e SOS',
   'Respostas da equipe e acompanhamento de pedidos de ajuda.', true, 100)
on conflict (key) do nothing;

insert into public.destinations (slug, name, country, timezone) values
  ('dubai', 'Dubai', 'Emirados Árabes Unidos', 'Asia/Dubai'),
  ('rio-de-janeiro', 'Rio de Janeiro', 'Brasil', 'America/Sao_Paulo')
on conflict (slug) do nothing;

-- Eventos nomeados pela §38. Sem data, sem cidade e sem horário: a §33 proíbe
-- inventar, e o calendário real vem do painel.
insert into public.events (slug, category_key, title, summary, status, is_published) values
  ('fly-cup-futevolei',  'fly-cup', 'Fly Cup Futevôlei',  'Areia, dupla e disputa.', 'announced', false),
  ('fly-cup-fut-7',      'fly-cup', 'Fly Cup Fut 7',      'Society com time montado.', 'announced', false),
  ('fly-cup-kart',       'fly-cup', 'Fly Cup Kart',       'Corrida com grid Fly.', 'announced', false),
  ('fly-cup-surf',       'fly-cup', 'Fly Cup Surf',       'Bateria no mar.', 'announced', false),
  ('fly-cup-basquete',   'fly-cup', 'Fly Cup Basquete',   'Quadra e três pontos.', 'announced', false),
  ('fly-cup-skate',      'fly-cup', 'Fly Cup Skate',      'Manobra e pista.', 'announced', false),
  ('fly-cup-tenis',      'fly-cup', 'Fly Cup Tênis',      'Saque e devolução.', 'announced', false),
  ('fly-cup-paintball',  'fly-cup', 'Fly Cup Paintball',  'Equipe e estratégia.', 'announced', false),
  ('fly-cup-airsoft',    'fly-cup', 'Fly Cup Airsoft',    'Missão em campo.', 'announced', false),
  ('legends-dubai-cup',  'legends', 'Legends Dubai Cup',  'Showbol com nomes que você cresceu vendo.', 'announced', false),
  ('fly-summit',         'summit',  'Fly Summit',         'Encontro de quem move o ecossistema.', 'announced', false)
on conflict (slug) do nothing;

-- Regras de exibição da Home. São janelas de apresentação, ajustáveis no
-- painel — não valores de negócio.
insert into public.app_config (key, value, description, is_public) values
  ('home.post_trip_days', '14'::jsonb,
   'Por quantos dias a Home continua em modo pos-viagem.', false),
  ('home.finished_event_days', '7'::jsonb,
   'Por quantos dias um evento encerrado continua no destaque da Home.', false)
on conflict (key) do nothing;
