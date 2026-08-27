-- =============================================================================
-- Fase 5 — quem vai no passeio (§40.5 e §6.5, passo 5)
--
-- A tabela `order_participants` e sua RLS já existem desde 20260826010000. O
-- que falta é a regra: **quantos** nomes cabem num item.
--
-- Hoje nada impede o cliente de gravar cinquenta participantes num item de
-- duas pessoas. Não é dinheiro, mas é a lista de embarque — e uma lista maior
-- que a vaga vendida é uma discussão no portão do passeio, com o guia no meio.
--
-- Por que uma função e não um gatilho na tabela:
--
--   • **Atomicidade.** Trocar a lista é apagar e reinserir. Pelo cliente são
--     dois comandos sem transação: se o segundo falhar, a pessoa fica sem
--     nenhum nome gravado, e descobre no dia.
--   • **A contagem é sobre o conjunto final, não sobre a linha.** Um gatilho
--     `for each row` conta o estado no meio da escrita, e a ordem das linhas
--     muda o resultado.
--   • O cliente não decide o limite. `order_items.people` é o que ele comprou,
--     e vem do servidor.
-- =============================================================================

create or replace function public.definir_participantes(
  p_order_item uuid,
  p_nomes text[]
)
returns table (ok boolean, motivo text, gravados integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.order_items;
  v_order public.orders;
  v_limpos text[];
  v_n integer;
begin
  select * into v_item from public.order_items where id = p_order_item;
  if not found then
    return query select false, 'item nao encontrado', 0;
    return;
  end if;

  select * into v_order from public.orders where id = v_item.order_id;

  if v_order.user_id <> v_user and not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  -- Pedido encerrado não muda mais de lista. Depois de cancelado ou
  -- reembolsado, a lista é histórico do que foi vendido.
  if v_order.status in ('cancelled', 'refunded') then
    return query select false, 'pedido encerrado', 0;
    return;
  end if;

  -- Espaço em branco e nome vazio somem antes da contagem. Sem isto, três
  -- campos com um espaço cada contariam como três participantes.
  select coalesce(array_agg(nome), '{}')
  into v_limpos
  from (
    select trim(n) as nome
    from unnest(coalesce(p_nomes, '{}')) as n
    where length(trim(n)) >= 2
  ) limpos;

  v_n := coalesce(array_length(v_limpos, 1), 0);

  if v_n > v_item.people then
    return query select false,
      format('o item foi comprado para %s pessoa(s)', v_item.people), 0;
    return;
  end if;

  -- Apagar e reinserir dentro da mesma função: ou a lista nova inteira fica,
  -- ou a antiga continua. Nunca um meio-termo.
  delete from public.order_participants where order_item_id = p_order_item;

  if v_n > 0 then
    insert into public.order_participants (order_item_id, full_name)
    select p_order_item, nome from unnest(v_limpos) as nome;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'order.participants_set', 'order_items', p_order_item::text,
          jsonb_build_object('quantidade', v_n, 'vagas', v_item.people));

  return query select true, null::text, v_n;
end;
$$;

revoke all on function public.definir_participantes(uuid, text[]) from public, anon;
grant execute on function public.definir_participantes(uuid, text[]) to authenticated;

comment on function public.definir_participantes(uuid, text[]) is
  'Substitui a lista de participantes de um item, recusando mais nomes que vagas. '
  'Apagar e reinserir acontece aqui para ser atomico (§6.5 passo 5).';
