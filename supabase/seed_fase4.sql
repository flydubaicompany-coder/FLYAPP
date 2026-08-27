-- =============================================================================
-- Seed da Fase 4: um roteiro de verdade
--
-- Datas relativas a `current_date`, e não fixas: um seed com "10 de setembro"
-- cravado envelhece, e três meses depois todo `db reset` produz uma viagem no
-- passado — que é justamente o estado que menos se quer exercitar.
--
-- O que a §33 proíbe inventar continua fora: preço, política de cancelamento,
-- contato de emergência, número de reserva real. O que está aqui é estrutura
-- de roteiro, que é o objeto da fase.
-- =============================================================================

do $$
declare
  v_trip uuid;
  v_tz text;
  v_inicio date;
  v_d1 uuid; v_d2 uuid; v_d3 uuid;
begin
  select t.id, d.timezone into v_trip, v_tz
  from public.trips t
  join public.destinations d on d.id = t.destination_id
  order by t.starts_on
  limit 1;

  if v_trip is null then
    raise notice 'Sem viagem para semear. Rode o seed da Fase 3 antes.';
    return;
  end if;

  select starts_on into v_inicio from public.trips where id = v_trip;

  -- --- Dias -----------------------------------------------------------------
  insert into public.trip_days (trip_id, day_number, day_date, title, summary) values
    (v_trip, 1, v_inicio,     'Chegada', 'Transfer, check-in e primeiro jantar juntos.'),
    (v_trip, 2, v_inicio + 1, 'Deserto', 'O dia mais longo da viagem. Saída cedo.'),
    (v_trip, 3, v_inicio + 2, 'Cidade',  'Marina, observatório e noite livre.')
  on conflict (trip_id, day_number) do nothing;

  select id into v_d1 from public.trip_days where trip_id = v_trip and day_number = 1;
  select id into v_d2 from public.trip_days where trip_id = v_trip and day_number = 2;
  select id into v_d3 from public.trip_days where trip_id = v_trip and day_number = 3;

  -- --- Atividades -----------------------------------------------------------
  --
  -- `at time zone v_tz` em cada horário: o operador pensa "10h", e 10h é no
  -- destino. Sem isso, tudo entraria em UTC e sairia quatro horas errado.
  insert into public.activities
    (trip_day_id, title, description, status, starts_at, ends_at, departure_at,
     meeting_point, responsible_name, what_to_bring, dress_code, sort_order)
  values
    (v_d1, 'Transfer do aeroporto',
     'A equipe Fly espera na saída do desembarque, com placa.',
     'confirmed',
     (v_inicio + time '14:00') at time zone v_tz,
     (v_inicio + time '15:30') at time zone v_tz,
     null,
     'Portão de desembarque, Terminal 3', 'Equipe Fly', 'Passaporte em mãos', null, 0),

    (v_d1, 'Check-in no hotel', null, 'confirmed',
     (v_inicio + time '16:00') at time zone v_tz,
     (v_inicio + time '17:00') at time zone v_tz,
     null, 'Lobby', null, null, null, 1),

    (v_d1, 'Jantar de boas-vindas',
     'Primeiro jantar do grupo. Mesa reservada em nome da Fly.',
     'confirmed',
     (v_inicio + time '20:00') at time zone v_tz,
     (v_inicio + time '22:30') at time zone v_tz,
     (v_inicio + time '19:30') at time zone v_tz,
     'Lobby do hotel', 'Equipe Fly', null, 'Smart casual', 2),

    (v_d2, 'Safári no deserto',
     'Dunas, pôr do sol e jantar sob as estrelas. Estrada de 45 minutos.',
     'confirmed',
     (v_inicio + 1 + time '15:00') at time zone v_tz,
     (v_inicio + 1 + time '22:00') at time zone v_tz,
     (v_inicio + 1 + time '14:15') at time zone v_tz,
     'Portaria do hotel', 'Equipe Fly',
     'Protetor solar, óculos de sol e um agasalho leve para a noite',
     'Roupa confortável e tênis fechado', 0),

    (v_d3, 'Marina e observatório',
     null, 'scheduled',
     (v_inicio + 2 + time '10:00') at time zone v_tz,
     (v_inicio + 2 + time '14:00') at time zone v_tz,
     (v_inicio + 2 + time '09:30') at time zone v_tz,
     'Lobby', 'Equipe Fly', 'Documento com foto', null, 0),

    (v_d3, 'Noite livre',
     'Sem compromisso de grupo. A equipe continua disponível pelo app.',
     'scheduled',
     (v_inicio + 2 + time '19:00') at time zone v_tz,
     null, null, null, null, null, null, 1)
  on conflict do nothing;

  -- --- Tudo que está incluso -------------------------------------------------
  insert into public.trip_inclusions (trip_id, category, title, details, rules, status, is_optional, sort_order)
  values
    (v_trip, 'air', 'Aéreo internacional, ida e volta',
     'Classe econômica, bagagem despachada incluída.', null, 'included', false, 0),
    (v_trip, 'lodging', 'Hospedagem, 7 noites',
     'Quarto duplo, café da manhã incluso.', null, 'included', false, 1),
    (v_trip, 'transport', 'Todos os transfers',
     'Aeroporto, passeios e retorno.', null, 'included', false, 2),
    (v_trip, 'food', 'Jantar de boas-vindas e jantar no deserto',
     null, null, 'included', false, 3),
    (v_trip, 'tours', 'Safári no deserto', null, null, 'included', false, 4),
    (v_trip, 'tours', 'Passeio de barco na Marina',
     'Duas horas, com bebidas a bordo.', null, 'optional', true, 5),
    (v_trip, 'special', 'Jantar privativo no Burj',
     'Mesa para dois, vista para a cidade.', null, 'optional', true, 6),
    (v_trip, 'insurance', 'Seguro viagem internacional',
     'Cobertura médica e de bagagem.', null, 'included', false, 7),
    (v_trip, 'benefits', 'Kit de chegada Fly',
     null, null, 'included', false, 8)
  on conflict do nothing;

  -- --- Hospedagem ------------------------------------------------------------
  insert into public.accommodations (trip_id, name, address, phone, checkin_at, checkout_at, policy, timezone)
  values (
    v_trip, 'Hotel da viagem', 'Dubai Marina, Dubai', null,
    (v_inicio + time '16:00') at time zone v_tz,
    (v_inicio + 7 + time '12:00') at time zone v_tz,
    'Check-in a partir das 16h. Check-out até as 12h.',
    v_tz
  )
  on conflict do nothing;

  -- --- Transfers -------------------------------------------------------------
  insert into public.transfers (trip_id, title, pickup_point, pickup_at, dropoff_point, status)
  values
    (v_trip, 'Chegada — aeroporto ao hotel', 'Terminal 3, desembarque',
     (v_inicio + time '14:00') at time zone v_tz, 'Hotel', 'scheduled'),
    (v_trip, 'Safári no deserto', 'Portaria do hotel',
     (v_inicio + 1 + time '14:15') at time zone v_tz, 'Acampamento no deserto', 'scheduled')
  on conflict do nothing;
end $$;
