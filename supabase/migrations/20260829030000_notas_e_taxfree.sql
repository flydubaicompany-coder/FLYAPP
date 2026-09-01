-- =============================================================================
-- Fase 6 — notas fiscais e tax-free (§41, entregas 11 e 12).
--
-- **Sem scanner e sem OCR**, por decisao do dono em 29/08: a pessoa manda a
-- foto, a Fly revisa. Scanner de verdade fica para depois. Isso e mais honesto
-- do que um OCR de mentira: um numero extraido errado e pior que numero
-- nenhum, porque parece conferido.
--
-- O que o sistema faz sozinho e o que ele faz bem: **sinalizar duplicada**.
-- Mesma pessoa, mesmo estabelecimento, mesmo valor, mesma data ja enviados =
-- a nova nasce marcada, e a revisao decide.
--
-- ## Tax-free
--
-- A §41 diz "tax-free nao promete 5% integral" e a §33 poe **regra de
-- tax-free** na lista do que nunca se inventa. Entao a estimativa nao e
-- calculada aqui: a regra mora em `app_config` e nasce **nula**. Enquanto for
-- nula, a tela mostra a nota e o status, e **nao** mostra valor a receber.
-- =============================================================================

create type public.receipt_status as enum (
  'received',   -- chegou, ninguem olhou
  'in_review',  -- alguem esta conferindo
  'approved',   -- confere
  'rejected',   -- nao serve (ilegivel, fora da regra, sem valor)
  'duplicate'   -- ja existe uma igual
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,

  -- Caminho no bucket privado `notas`. Nunca URL: URL pronta envelhece e vaza.
  storage_path text not null,
  mime_type text,
  size_bytes bigint,

  /**
   * O que o cliente digitou.
   *
   * Sao **declarados**, nao extraidos. Ate a revisao confirmar, valem como
   * "o que a pessoa disse que era" — e a tela diz isso.
   */
  merchant text,
  amount_cents bigint,
  currency public.currency_code,
  issued_on date,

  status public.receipt_status not null default 'received',
  -- Quando marcada como duplicada, aponta para a original.
  duplicate_of uuid references public.receipts (id) on delete set null,

  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint receipts_amount_positive check (amount_cents is null or amount_cents > 0),
  -- Valor sem moeda nao da para conferir nem somar.
  constraint receipts_valor_tem_moeda check (
    (amount_cents is null) = (currency is null)
  ),
  -- Data futura e erro de digitacao, sempre.
  constraint receipts_data_nao_futura check (issued_on is null or issued_on <= current_date + 1),
  -- Duplicada aponta para a original; o resto nao aponta para nada.
  constraint receipts_duplicada_aponta check (
    (status = 'duplicate') or duplicate_of is null
  ),
  -- Recusar sem dizer por que deixa o cliente sem saber o que corrigir.
  constraint receipts_recusa_tem_motivo check (
    status <> 'rejected' or (review_note is not null and length(btrim(review_note)) > 0)
  )
);

create index receipts_user_idx on public.receipts (user_id, created_at desc);
create index receipts_fila_idx on public.receipts (status, created_at)
  where status in ('received', 'in_review');

-- -----------------------------------------------------------------------------
-- Duplicidade.
--
-- A comparacao normaliza o estabelecimento: caixa, acento e espaco a mais nao
-- podem esconder que e a mesma nota. Sem os quatro campos preenchidos nao da
-- para afirmar nada, e a nota segue para revisao humana.
-- -----------------------------------------------------------------------------
-- `unaccent` e extensao; para nao depender dela, a troca e explicita. Precisa
-- vir ANTES de quem a chama, e a chamada precisa do schema: com
-- `search_path = ''` o Postgres nao acha funcao por nome curto.
create or replace function public.unaccent_imutavel(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

create or replace function fly_private.normalizar_estabelecimento(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(regexp_replace(lower(public.unaccent_imutavel(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g')),
    ''
  );
$$;

create or replace function fly_private.marcar_nota_duplicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original uuid;
begin
  -- Sem os quatro campos nao se afirma duplicidade: vai para revisao humana.
  if new.merchant is null or new.amount_cents is null or new.issued_on is null then
    return new;
  end if;

  select r.id into v_original
  from public.receipts r
  where r.user_id = new.user_id
    and r.id <> new.id
    and r.status <> 'duplicate'
    and r.amount_cents = new.amount_cents
    and r.currency = new.currency
    and r.issued_on = new.issued_on
    and fly_private.normalizar_estabelecimento(r.merchant)
        = fly_private.normalizar_estabelecimento(new.merchant)
  order by r.created_at
  limit 1;

  if v_original is not null then
    new.status := 'duplicate';
    new.duplicate_of := v_original;
  end if;

  return new;
end;
$$;

create trigger receipts_marcam_duplicada
  before insert on public.receipts
  for each row execute function fly_private.marcar_nota_duplicada();

create trigger receipts_touch
  before update on public.receipts
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Bucket privado das notas.
--
-- Separado de `documentos`: o ciclo de vida e outro, quem revisa e outro, e
-- misturar obrigaria a alargar a policy do passaporte para alcancar nota.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notas',
  'notas',
  false,
  15 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy notas_select on storage.objects for select to authenticated
  using (
    bucket_id = 'notas'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      -- Quem revisa precisa abrir. Sem isso a fila e uma lista de nomes.
      or fly_private.is_staff()
    )
  );

create policy notas_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'notas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy notas_delete_proprio on storage.objects for delete to authenticated
  using (
    bucket_id = 'notas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- Configuracao do tax-free — DELIBERADAMENTE NULA.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'taxfree.rule',
    'null'::jsonb,
    'Regra de tax-free: percentual, minimo por nota, prazo e o que e elegivel. NULO = nao decidido. A §33 poe regra de tax-free na lista do que nunca se inventa, e a §41 proibe prometer 5% integral. Enquanto for nulo, o app mostra a nota e o status e NAO mostra valor a receber.',
    true
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.receipts enable row level security;

create policy receipts_select on public.receipts for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());

-- O cliente envia a propria nota.
create policy receipts_insert_proprio on public.receipts for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Quem revisa e a equipe. O cliente nao muda o proprio status — seria decidir
-- sozinho se a nota vale.
create policy receipts_update_staff on public.receipts for update to authenticated
  using (fly_private.is_staff()) with check (fly_private.is_staff());

-- Enquanto ninguem olhou, o cliente pode desistir e apagar.
create policy receipts_delete_proprio on public.receipts for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'received');

revoke all on public.receipts from anon;
grant select, insert, update, delete on public.receipts to authenticated;

revoke all on function public.unaccent_imutavel(text) from public, anon;
grant execute on function public.unaccent_imutavel(text) to authenticated;
revoke all on function fly_private.normalizar_estabelecimento(text) from public, anon, authenticated;
