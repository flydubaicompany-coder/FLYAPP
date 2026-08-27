-- =============================================================================
-- Fase 5 — mídia do passeio e fornecedor (§40.13)
--
-- Duas coisas diferentes num arquivo só porque as duas são "o que falta no
-- painel de catálogo", e nenhuma delas é grande.
--
-- -----------------------------------------------------------------------------
-- 1. O bucket das imagens de passeio
-- -----------------------------------------------------------------------------
-- **Público, ao contrário de `documentos`.** A diferença não é descuido: foto
-- de passeio é material de vitrine, feito para ser visto por quem ainda nem
-- comprou. Passaporte é o oposto, e por isso aquele bucket é privado, com URL
-- assinada de sessenta segundos a cada abertura.
--
-- Assinar URL de imagem de catálogo custaria uma ida ao servidor por card, numa
-- tela que mostra dez — para esconder uma foto que a Fly quer que circule.
--
-- Escrever continua restrito a operador global. Público é a leitura.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'passeios',
  'passeios',
  true,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Leitura aberta: é o que "bucket público" quer dizer, e a política precisa
-- existir mesmo assim — `public = true` sozinho não concede select.
create policy passeios_midia_select on storage.objects for select
  using (bucket_id = 'passeios');

create policy passeios_midia_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'passeios' and fly_private.is_global_operator());

create policy passeios_midia_update on storage.objects for update to authenticated
  using (bucket_id = 'passeios' and fly_private.is_global_operator())
  with check (bucket_id = 'passeios' and fly_private.is_global_operator());

create policy passeios_midia_delete on storage.objects for delete to authenticated
  using (bucket_id = 'passeios' and fly_private.is_global_operator());

-- -----------------------------------------------------------------------------
-- 2. Fornecedor
--
-- **O que esta tabela tem: identificação e contato.** Quem opera o passeio, e
-- para quem ligar quando o ônibus não chega.
--
-- **O que ela deliberadamente NÃO tem: comissão, prazo de pagamento, vigência
-- de contrato ou SLA.** Isso é regra comercial, e a §33 proíbe inventar taxa
-- financeira e termo de contrato. Modelar campo vazio para esses valores
-- convida alguém a preencher com um palpite e tratar como acordado. Quando
-- houver contrato de verdade, entra em migration com a regra junto.
-- -----------------------------------------------------------------------------

create table public.tour_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  contact_name text,
  contact_email text,
  contact_phone text,
  -- O que a operação precisa lembrar: onde encontra o guia, qual o portão,
  -- que o motorista não fala português. Texto livre de propósito.
  notes text,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tour_suppliers_name_not_blank check (length(trim(name)) >= 2),
  constraint tour_suppliers_email_shape
    check (contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create index tour_suppliers_ativos_idx on public.tour_suppliers (name) where is_active;

create trigger tour_suppliers_touch before update on public.tour_suppliers
  for each row execute function fly_private.touch_updated_at();

-- `set null`: perder o fornecedor não pode apagar o passeio do catálogo.
alter table public.tours
  add column supplier_id uuid references public.tour_suppliers (id) on delete set null;

create index tours_supplier_idx on public.tours (supplier_id);

comment on table public.tour_suppliers is
  'Quem opera o passeio e para quem ligar. Sem comissao, prazo ou vigencia: '
  'isso e regra comercial e §33 proibe inventar (§40.13).';

-- -----------------------------------------------------------------------------
-- RLS
--
-- Fornecedor é dado de operação, não de vitrine. O cliente **não** lê: o nome
-- e o telefone de quem opera não são informação de quem compra, e expor a
-- cadeia de fornecedores é entregar a lista de contatos da Fly.
-- -----------------------------------------------------------------------------
alter table public.tour_suppliers enable row level security;

create policy tour_suppliers_select_operador on public.tour_suppliers for select to authenticated
  using (fly_private.is_global_operator());

create policy tour_suppliers_write_operador on public.tour_suppliers for all to authenticated
  using (fly_private.is_global_operator())
  with check (fly_private.is_global_operator());

grant select, insert, update, delete on public.tour_suppliers to authenticated;
revoke all on public.tour_suppliers from anon;
