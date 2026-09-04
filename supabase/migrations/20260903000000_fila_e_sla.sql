-- =============================================================================
-- Fase 8 — fila, atribuicao e SLA (§43, entregas 7, 9 e 10).
--
-- O que faltava do caso de atendimento: **atribuir**. Aceitar, responder,
-- escalar e resolver ja existiam desde `20260902000000`; atribuir nao — e sem
-- ela o Fly Crew nao tem como saber qual caso e dele.
--
-- ## Atribuir e aceitar sao dois atos, e nao um
--
-- `accepted_by` responde "quem pegou"; `assigned_to` responde "de quem e".
-- Confundir os dois quebra a fila do campo: um caso atribuido a um guia que
-- ainda nao abriu o app continua sem `accepted_by`, e some da lista dele se a
-- coluna for a mesma.
--
-- ## O SLA nasce PENDENTE, e isso e proposital
--
-- Quantos minutos a Fly promete para aceitar um SOS e **promessa de nivel de
-- servico** — a mesma coisa que a D117 recusou copiar do canvas ("24h" do Fly
-- Assist). A §33 poe isso na lista do que nunca se inventa. Entao a
-- configuracao existe, nasce `PENDENTE`, e enquanto for:
--
--   - o Fly Ops mostra o **tempo decorrido**, que e fato medido;
--   - e nao afirma atraso, porque nao existe prazo contra o que comparar.
--
-- Preenchida a configuracao, a mesma tela passa a marcar o que estourou. Sem
-- release: e `app_config`.
-- =============================================================================

alter table public.support_cases
  add column assigned_to uuid references auth.users (id) on delete set null,
  add column assigned_at timestamptz;

/**
 * Atribuir sem hora nao serve para medir; hora sem dono nao diz de quem e.
 *
 * O gatilho abaixo carimba a hora **no update**, que e como a atribuicao
 * acontece hoje (a fila do Fly Ops e a do Fly Crew). Um `insert` futuro que ja
 * traga `assigned_to` sem `assigned_at` bate aqui, com `23514` — de proposito:
 * falhar alto e melhor do que gravar um caso cuja hora de atribuicao ninguem
 * sabe. Quem precisar disso acrescenta o ramo de insert ao gatilho.
 */
alter table public.support_cases
  add constraint support_cases_atribuicao_completa check (
    (assigned_at is null) = (assigned_to is null)
  );

comment on column public.support_cases.assigned_to is
  'De quem e o caso. Diferente de accepted_by, que e quem ja pegou.';

/**
 * A fila do campo.
 *
 * Mesma ordem da fila da operacao (`support_cases_fila_idx`), filtrada por
 * dono. O Fly Crew le por aqui, e a ordem da tela e a ordem do indice — uma
 * fila lida numa ordem e entregue em outra atende gente fora de ordem.
 */
create index support_cases_atribuidos_idx
  on public.support_cases (assigned_to, level desc, opened_at)
  where status in ('open', 'accepted', 'in_progress', 'escalated');

-- -----------------------------------------------------------------------------
-- O carimbo da atribuicao entra no gatilho que ja carimba o resto.
-- -----------------------------------------------------------------------------
create or replace function fly_private.carimbar_atendimento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status = 'open' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.accepted_by := coalesce(new.accepted_by, (select auth.uid()));
  end if;

  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;

  if new.status = 'escalated' and old.status <> 'escalated' then
    new.escalated_at := coalesce(new.escalated_at, now());
  end if;

  -- Trocar de dono recarimba a hora: o que a operacao mede e ha quanto tempo
  -- o caso esta com **esta** pessoa, e nao com a primeira que o recebeu.
  -- Devolver para a fila (dono nulo) apaga a hora e mantem a constraint.
  if new.assigned_to is distinct from old.assigned_to then
    new.assigned_at := case when new.assigned_to is null then null else now() end;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- O alvo de SLA, marcado como pendente (§33).
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public) values
  (
    'support.sla_minutes',
    '"PENDENTE"'::jsonb,
    'Minutos-alvo por nivel, para aceite e para primeira resposta. Formato quando decidido: '
    || '{"sos":{"accept":5,"first_response":10},"urgent":{...},"chat":{...}}. '
    || 'Nasce PENDENTE porque prazo de atendimento e promessa de nivel de servico, e a §33 '
    || 'proibe inventar. Enquanto for PENDENTE, o Fly Ops mostra o tempo decorrido e nao '
    || 'afirma atraso. NAO e publico: um alvo interno lido pelo app viraria promessa ao cliente.',
    false
  )
on conflict (key) do nothing;

-- Nada de GRANT novo: `assigned_to` e coluna de tabela que ja tem privilegio
-- de update para `authenticated`, e a policy `support_cases_update_staff`
-- continua sendo quem decide que so a equipe escreve.

-- -----------------------------------------------------------------------------
-- Quem existe para receber um caso.
--
-- `user_roles` so e legivel pelo dono da linha e por admin, e `staff_assignments`
-- so por operacao global — entao um operador de suporte nao consegue listar a
-- equipe para atribuir. Alargar a RLS daquelas tabelas resolveria o sintoma e
-- abriria o cadastro de papeis inteiro; esta funcao devolve **so** o que a
-- atribuicao precisa: quem e, como se chama, e o que faz.
--
-- Nao ha localizacao aqui, nem telefone, nem e-mail. A D179 vale: a posicao de
-- funcionario nao existe em lugar nenhum deste banco.
-- -----------------------------------------------------------------------------
create or replace function public.equipe_de_atendimento()
returns table (user_id uuid, nome text, papeis text[])
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not fly_private.is_staff() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  return query
    select
      ur.user_id,
      coalesce(
        nullif(btrim(p.preferred_name), ''),
        nullif(btrim(p.display_name), ''),
        'Equipe Fly'
      ),
      array_agg(ur.role::text order by ur.role::text)
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    where ur.role in (
      'guide', 'base', 'media', 'experience',
      'support', 'finance', 'trip_manager', 'admin'
    )
    group by ur.user_id, p.preferred_name, p.display_name
    order by 2;
end;
$$;

revoke all on function public.equipe_de_atendimento() from public, anon;
grant execute on function public.equipe_de_atendimento() to authenticated;
