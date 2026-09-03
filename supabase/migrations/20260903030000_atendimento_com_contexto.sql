-- =============================================================================
-- Fase 8 — conversa a partir de uma atividade ou de um pedido (§43, entrega 4).
--
-- "Chat por viagem, atividade e pedido." A viagem ja entrava; as outras duas
-- colunas existiam em `support_cases` desde `20260902000000` e **nada as
-- preenchia**. Sem elas, quem fala "o transfer nao chegou" obriga a equipe a
-- perguntar qual transfer — e a informacao estava na tela de onde a pessoa
-- veio.
--
-- ## O contexto e conferido, e nao aceito
--
-- O `activity_id` e o `order_id` chegam do cliente. Se a funcao os gravasse
-- sem conferir, alguem etiquetaria o proprio caso com o pedido de outra
-- pessoa — e a equipe abriria a tela errada no momento errado. A conferencia
-- reusa as funcoes que ja decidem isso no resto do sistema:
-- `fly_private.can_see_trip` para a atividade, e o dono do pedido para o
-- pedido.
--
-- Contexto invalido **nao lanca**: o caso nasce sem ele. Recusar um SOS
-- porque o id da atividade envelheceu seria trocar uma etiqueta por um
-- atendimento.
-- =============================================================================

-- `create or replace` nao troca a lista de parametros — criaria uma sobrecarga,
-- e o PostgREST nao saberia qual chamar.
drop function public.abrir_atendimento(public.support_level, text, uuid);

create or replace function public.abrir_atendimento(
  p_level public.support_level,
  p_subject text default null,
  p_trip uuid default null,
  p_activity uuid default null,
  p_order uuid default null
)
returns table (ok boolean, caso uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_activity uuid := null;
  v_order uuid := null;
  v_trip uuid := null;
  v_trip_da_atividade uuid;
begin
  if v_user is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;

  -- Viagem: so vale a que a pessoa enxerga. Id que nao existe voltaria como
  -- violacao de chave estrangeira, e um SOS nao pode morrer por causa disso.
  if p_trip is not null and fly_private.can_see_trip(p_trip) then
    v_trip := p_trip;
  end if;

  /**
   * Atividade: precisa **existir** e estar numa viagem que a pessoa enxerga.
   *
   * As duas condicoes, e nao so a segunda: `trip_of_activity` de um id que
   * nao existe devolve null, e `can_see_trip(null)` e falso para o cliente —
   * mas verdadeiro para a operacao global, que enxerga tudo. Sem o teste de
   * existencia, um operador que colasse um id errado derrubaria o `insert`
   * numa violacao de chave estrangeira.
   */
  if p_activity is not null then
    v_trip_da_atividade := fly_private.trip_of_activity(p_activity);
    if v_trip_da_atividade is not null and fly_private.can_see_trip(v_trip_da_atividade) then
      v_activity := p_activity;
      v_trip := coalesce(v_trip, v_trip_da_atividade);
    end if;
  end if;

  -- Pedido: so vale se for da propria pessoa. O `exists` ja garante que existe.
  if p_order is not null then
    if exists (select 1 from public.orders o where o.id = p_order and o.user_id = v_user) then
      v_order := p_order;
    end if;
  end if;

  insert into public.support_cases (user_id, trip_id, level, subject, activity_id, order_id)
  values (
    v_user,
    v_trip,
    p_level,
    nullif(btrim(coalesce(p_subject, '')), ''),
    v_activity,
    v_order
  )
  returning id into v_id;

  if p_level = 'sos' then
    insert into public.support_messages (case_id, body, is_system)
    values (
      v_id,
      'A Fly recebeu seu SOS e já está acionando a equipe. '
      || 'Se houver risco de vida, ligue também para o número de emergência local.',
      true
    );
  elsif p_level = 'urgent' then
    insert into public.support_messages (case_id, body, is_system)
    values (v_id, 'A Fly recebeu seu pedido e ele entrou na fila prioritária.', true);
  end if;

  return query select true, v_id;
end;
$$;

revoke all on function public.abrir_atendimento(
  public.support_level, text, uuid, uuid, uuid
) from public, anon;
grant execute on function public.abrir_atendimento(
  public.support_level, text, uuid, uuid, uuid
) to authenticated;
