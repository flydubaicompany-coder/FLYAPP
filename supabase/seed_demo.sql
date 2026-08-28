-- =============================================================================
-- MODO DEMONSTRACAO — dados ficticios, para ver o app cheio
--
-- Pedido do dono em 28/08/2026: "cria uma versao demo do app, com infos fakes,
-- preenchendo tudo, so pra eu ver as funcionalidades". Sem viagem, metade das
-- telas mostra estado vazio e nao da para julgar o redesenho.
--
-- **Nada aqui e regra de produto.** Nome, voo, hotel e horario sao ficticios,
-- no mesmo espirito do prototipo do Claude Design (que usa "Rafael Mendes").
-- Apagar este arquivo e o `seed_fase4_demo.sql` devolve o app ao estado limpo.
--
-- O que continua fora, porque a §33 proibe inventar e nenhum numero aqui
-- resolveria: saldo, pontos, formula de pontuacao, politica de cancelamento
-- real e contato de emergencia.
--
-- Datas relativas a `current_date`: a viagem esta sempre no dia 3 de 7, para o
-- estado "durante a viagem" ser o que o app mostra.
-- =============================================================================

-- --- Quem e o viajante da demo -----------------------------------------------
update public.profiles p
set display_name = 'Rafael Mendes',
    preferred_name = 'Rafael'
from auth.users u
where u.id = p.id
  and u.email = 'cliente@fly.com';

-- --- A viagem ----------------------------------------------------------------
insert into public.trips (destination_id, name, status, starts_on, ends_on)
select d.id, 'Dubai — Fly Black', 'ongoing', current_date - 2, current_date + 4
from public.destinations d
where d.slug = 'dubai'
  and not exists (select 1 from public.trips t where t.name = 'Dubai — Fly Black');

insert into public.trip_members (trip_id, user_id)
select t.id, u.id
from public.trips t
cross join auth.users u
where t.name = 'Dubai — Fly Black'
  and u.email = 'cliente@fly.com'
on conflict (trip_id, user_id) do nothing;

-- --- Voo de volta, para o bloco "proxima acao" e o Modo Aeroporto ------------
-- Numero de voo ficticio, como no prototipo.
insert into public.flights (
  trip_id, airline, flight_number, origin_iata, destination_iata,
  departs_at, arrives_at, origin_timezone, destination_timezone,
  terminal, gate, baggage_allowance, leave_by_at, status
)
select
  t.id, 'Emirates', 'EK262', 'DXB', 'GRU',
  (current_date + 4) + time '02:45', (current_date + 4) + time '12:20',
  'Asia/Dubai', 'America/Sao_Paulo',
  'Terminal 3', 'A12', '2 volumes de 23 kg',
  (current_date + 3) + time '23:00', 'scheduled'
from public.trips t
where t.name = 'Dubai — Fly Black'
  and not exists (select 1 from public.flights f where f.trip_id = t.id);

insert into public.flight_passengers (flight_id, user_id, seat)
select f.id, u.id, '4A'
from public.flights f
join public.trips t on t.id = f.trip_id
cross join auth.users u
where t.name = 'Dubai — Fly Black'
  and u.email = 'cliente@fly.com'
  and not exists (
    select 1 from public.flight_passengers x where x.flight_id = f.id and x.user_id = u.id
  );

-- --- Notificacoes, para o ponto dourado do sino ------------------------------
insert into public.notifications (user_id, category_key, title, body, deep_link)
select u.id, c.key, v.titulo, v.corpo, v.link
from auth.users u
cross join (values
  ('Seu traslado sai em 40 minutos', 'O motorista aguarda na portaria do hotel.', '/viagem'),
  ('Topo do Burj Khalifa confirmado', 'Ingresso disponivel em Minha Viagem.', '/viagem/qr')
) as v(titulo, corpo, link)
join public.notification_categories c on c.key = 'itinerary'
where u.email = 'cliente@fly.com'
  and not exists (
    select 1 from public.notifications n where n.user_id = u.id and n.title = v.titulo
  );
