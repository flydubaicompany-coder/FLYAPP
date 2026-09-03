-- =============================================================================
-- Fase 8 — o mapa (§12.1 e §43, entrega 1).
--
-- ## Nao ha mapa embutido, e isso e decisao
--
-- A §12.1 lista "mapa embutido avancado", "navegacao contextual" e "3D" como
-- **futuro**, e fecha com uma regra: "nao depender de Google Earth ou
-- Citymapper para o nucleo funcionar". O nucleo, entao, e o que esta aqui:
-- os pontos com endereco, distancia quando a pessoa quiser, e **rota que abre
-- no app de mapas instalado**. Provedor de mapa continua sendo a P16.
--
-- ## Ponto ativo tem coordenada, por constraint
--
-- Um pino de clinica que nao leva a lugar nenhum e pior do que nenhum pino —
-- e a hora de descobrir isso nao e a hora em que alguem precisa de uma
-- clinica. Publicar exige saber onde fica.
--
-- ## O que este arquivo NAO tem
--
-- **Nenhum lugar de verdade.** Endereco de hospital, de farmacia e de parceiro
-- e conteudo operacional: a §33 nao deixa inventar dado medico nem parceiro, e
-- o CLAUDE.md exige que conteudo critico nao fique hardcoded. A tabela nasce
-- vazia e quem preenche e o Fly Ops.
--
-- **Fly Quest.** A §43 cita os pontos de Quest como camada do mapa, mas o Fly
-- Quest inteiro e a Fase 9 (§44, entrega 11). A camada entra junto da funcao —
-- um `kind` que nada produz seria promessa sem dono.
-- =============================================================================

create type public.place_kind as enum (
  'attraction', -- ponto turistico
  'partner',    -- parceiro da Fly
  'clinic',
  'hospital',
  'pharmacy'
);

create table public.map_places (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references public.destinations (id) on delete set null,

  kind public.place_kind not null,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,

  -- Texto, e nao duas colunas de hora: "24h", "9h as 21h", "plantao aos
  -- domingos". A realidade de uma farmacia nao cabe em `open`/`close`.
  hours_note text,
  notes text,

  is_active boolean not null default false,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint map_places_nome_preenchido check (length(btrim(name)) > 0),
  constraint map_places_lat_valida check (latitude is null or latitude between -90 and 90),
  constraint map_places_lng_valida check (longitude is null or longitude between -180 and 180),
  -- Meia coordenada nao e lugar nenhum.
  constraint map_places_ponto_completo check ((latitude is null) = (longitude is null)),
  -- Publicar exige saber onde fica.
  constraint map_places_ativo_tem_ponto check (
    not is_active or (latitude is not null and longitude is not null)
  )
);

create index map_places_ativos_idx on public.map_places (is_active, kind, sort_order);

comment on table public.map_places is
  'Pontos do mapa (§12.1): atracoes, parceiros, clinicas, hospitais e farmacias. Nasce vazia — endereco de servico de saude e conteudo operacional, nunca inventado (§33).';

create trigger map_places_touch before update on public.map_places
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS e GRANT — controles diferentes, os dois configurados.
-- -----------------------------------------------------------------------------
alter table public.map_places enable row level security;

create policy map_places_select on public.map_places for select to authenticated
  using (is_active or fly_private.is_staff());

create policy map_places_write_operator on public.map_places for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

revoke all on public.map_places from anon;
grant select, insert, update, delete on public.map_places to authenticated;
