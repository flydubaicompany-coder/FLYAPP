-- =============================================================================
-- Fase 9 — Galeria e autorizacao de imagem (§13.5 e §44, entregas 8, 9 e 10).
--
-- ## A revogacao corta o acesso ao arquivo, e nao so o botao
--
-- Criterio literal da §44: "revogacao de imagem afeta acesso/publicacao". A
-- forma fraca disso seria a tela deixar de listar a foto. A forma que este
-- arquivo implementa e outra: a policy do Storage confere a autorizacao antes
-- de assinar a URL. Revogou, o arquivo para de abrir — inclusive para uma URL
-- que alguem tenha guardado, assim que ela vencer.
--
-- ## Sem consentimento registrado = sem autorizacao
--
-- O `coalesce(..., false)` la embaixo e a decisao inteira: quem nunca
-- respondeu **nao** autorizou. Imagem de pessoa e opt-in; tratar silencio
-- como sim seria inverter o unico jeito honesto de perguntar.
--
-- Efeito colateral aceito: a galeria nasce mais vazia do que a operacao
-- espera. O Fly Ops mostra **por que** cada foto nao aparece, para isso virar
-- uma conversa com o cliente em vez de um bug fantasma.
--
-- ## Marcacao manual, como a §13.5 pede
--
-- "Marcacao manual no primeiro estagio." Nao ha reconhecimento facial aqui, e
-- nao ha por acidente: rosto e dado biometrico, e a §33 nao deixa inventar
-- tratamento de dado sensivel.
-- =============================================================================

create type public.media_kind as enum ('photo', 'video');

create table public.trip_media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Por dia e por experiencia (§13.5). Nulos = midia da viagem inteira.
  trip_day_id uuid references public.trip_days (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,

  kind public.media_kind not null default 'photo',
  -- Caminho dentro do bucket privado `galeria`: `<trip_id>/<arquivo>`.
  storage_path text not null unique,

  caption text,
  -- "creditos dos fotografos" (§13.5). Texto: pode ser da equipe ou de fora.
  credit text,

  /**
   * Liberada pela equipe (§44, "cliente ve somente midia liberada").
   *
   * Nasce falsa. Foto de viagem passa por curadoria antes de virar galeria —
   * e o que sai da camera nao e o que se entrega.
   */
  is_released boolean not null default false,
  released_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,

  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trip_media_caminho_preenchido check (length(btrim(storage_path)) > 0),
  constraint trip_media_liberacao_completa check (
    (released_at is null) = (is_released is false)
  )
);

create index trip_media_trip_idx on public.trip_media (trip_id, created_at desc);
create index trip_media_dia_idx on public.trip_media (trip_day_id);
create index trip_media_atividade_idx on public.trip_media (activity_id);
create index trip_media_liberada_idx on public.trip_media (trip_id, is_released);
create index trip_media_released_by_idx on public.trip_media (released_by);
create index trip_media_uploaded_by_idx on public.trip_media (uploaded_by);

/** Quem esta na foto. Marcacao **manual**, feita por quem opera a viagem. */
create table public.media_tags (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.trip_media (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tagged_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint media_tags_unico unique (media_id, user_id)
);

create index media_tags_user_idx on public.media_tags (user_id);
create index media_tags_tagged_by_idx on public.media_tags (tagged_by);

/**
 * Liberar carimba a hora e o responsavel, sem ninguem lembrar.
 *
 * A constraint acima exige o par completo. Deixar o par a cargo de quem
 * escreve a tela transforma um esquecimento em erro de banco na cara do
 * operador — e, pior, faz "quem liberou esta foto" depender de disciplina.
 */
create or replace function fly_private.carimbar_liberacao_de_midia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_released and not coalesce(old.is_released, false) then
    new.released_at := coalesce(new.released_at, now());
    new.released_by := coalesce(new.released_by, (select auth.uid()));
  elsif not new.is_released then
    -- Tirar da galeria apaga o carimbo: senao a linha diria que esta liberada
    -- por alguem, em outro dia, e nao esta.
    new.released_at := null;
    new.released_by := null;
  end if;
  return new;
end;
$$;

create trigger trip_media_carimba_liberacao
  before update on public.trip_media
  for each row execute function fly_private.carimbar_liberacao_de_midia();

create trigger trip_media_touch before update on public.trip_media
  for each row execute function fly_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- A finalidade de uso de imagem entra no consentimento que ja existe.
--
-- Nao ha tabela nova de "autorizacao de imagem": a §23.2 ja resolveu como se
-- pergunta, como se versiona e como se revoga, e uma segunda maquina de
-- consentimento significaria duas respostas possiveis para a mesma pergunta.
-- O texto juridico e do dono do produto (§33); aqui fica a estrutura.
-- -----------------------------------------------------------------------------
insert into public.consent_purposes (key, label, description, is_required, is_sensitive)
values (
  'image_use',
  'Uso de imagem',
  'Permite à Fly usar fotos e vídeos em que você aparece na galeria da sua viagem. Você pode retirar esta autorização quando quiser, e o material deixa de aparecer.',
  false,
  true
)
on conflict (key) do nothing;

/**
 * Alguem marcado nesta midia nao autoriza a propria imagem?
 *
 * `security definer` **por necessidade**: a policy precisa ler o
 * consentimento de outra pessoa, e o cliente nao pode ler isso diretamente.
 * A view `current_consents` nao serve aqui — ela e `security_invoker`, entao
 * dentro de uma policy ela devolveria vazio para o cliente e a conferencia
 * passaria sempre. E a mesma armadilha da D144.
 *
 * **Sem registro = sem autorizacao.** O `coalesce(..., false)`.
 */
create or replace function fly_private.midia_tem_revogacao(p_media uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_tags t
    where t.media_id = p_media
      and not coalesce(
        (
          select c.granted
          from public.consents c
          where c.user_id = t.user_id and c.purpose_key = 'image_use'
          order by c.recorded_at desc, c.id desc
          limit 1
        ),
        false
      )
  );
$$;

comment on function fly_private.midia_tem_revogacao(uuid) is
  'true quando alguem marcado na midia nao autoriza a propria imagem — inclusive quem nunca respondeu.';

-- -----------------------------------------------------------------------------
-- Bucket privado da galeria.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'galeria',
  'galeria',
  false,
  200 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

/**
 * A revogacao corta o arquivo, e nao a listagem.
 *
 * Esta policy e o criterio "revogacao de imagem afeta acesso/publicacao" (§44)
 * no unico lugar onde ele nao da para contornar: a assinatura da URL.
 */
create policy galeria_select on storage.objects for select to authenticated
  using (
    bucket_id = 'galeria'
    and (
      fly_private.is_staff()
      or exists (
        select 1
        from public.trip_media m
        where m.storage_path = storage.objects.name
          and m.is_released
          and fly_private.is_trip_member(m.trip_id)
          and not fly_private.midia_tem_revogacao(m.id)
      )
    )
  );

create policy galeria_insert_equipe on storage.objects for insert to authenticated
  with check (bucket_id = 'galeria' and fly_private.is_staff());

create policy galeria_delete_operador on storage.objects for delete to authenticated
  using (bucket_id = 'galeria' and fly_private.is_global_operator());

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.trip_media enable row level security;
alter table public.media_tags enable row level security;

create policy trip_media_select on public.trip_media for select to authenticated
  using (
    fly_private.can_operate_trip(trip_id)
    or (
      is_released
      and fly_private.is_trip_member(trip_id)
      and not fly_private.midia_tem_revogacao(id)
    )
  );

create policy trip_media_write on public.trip_media for all to authenticated
  using (fly_private.can_operate_trip(trip_id))
  with check (fly_private.can_operate_trip(trip_id));

/**
 * A marcacao e visivel para quem opera a viagem e para **a propria pessoa**.
 *
 * Saber em quais fotos voce aparece e o que torna a revogacao uma escolha
 * informada. Ver quem mais esta marcado, nao — por isso a policy e por linha,
 * e nao por midia.
 */
create policy media_tags_select on public.media_tags for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.trip_media m
      where m.id = media_tags.media_id and fly_private.can_operate_trip(m.trip_id)
    )
  );

create policy media_tags_write on public.media_tags for all to authenticated
  using (
    exists (
      select 1 from public.trip_media m
      where m.id = media_tags.media_id and fly_private.can_operate_trip(m.trip_id)
    )
  )
  with check (
    exists (
      select 1 from public.trip_media m
      where m.id = media_tags.media_id and fly_private.can_operate_trip(m.trip_id)
    )
  );

revoke all on public.trip_media from anon;
revoke all on public.media_tags from anon;

grant select, insert, update, delete on public.trip_media to authenticated;
grant select, insert, update, delete on public.media_tags to authenticated;

revoke all on function fly_private.carimbar_liberacao_de_midia() from public, anon, authenticated;
revoke all on function fly_private.midia_tem_revogacao(uuid) from public, anon;
grant execute on function fly_private.midia_tem_revogacao(uuid) to authenticated;
