-- =============================================================================
-- Fase 5 — o passeio comprado dentro da viagem (§40.11 e §6.1)
--
-- `orders.trip_id` existe desde 20260826010000, e `criar_pedido()` já aceita
-- `p_trip`. Falta ligar um pedido que nasceu solto — e desligar, que é o mesmo
-- botão no outro sentido.
--
-- **Por que uma função, se é só um update de uma coluna.** Porque o cliente
-- não tem `update` em `orders`, e não vai ter: ali moram valor, política de
-- cancelamento e status. Abrir a tabela para o cliente mexer numa coluna é
-- abrir a tabela.
--
-- **O que este arquivo deliberadamente NÃO faz: criar `activities`.** A
-- tentação é transformar a compra numa linha do roteiro. Duas razões contra:
--
--   • `activities` é território da operação — a RLS só deixa
--     `can_operate_trip` escrever. Um cliente inserindo lá contorna a
--     curadoria do roteiro, que é o que faz o roteiro valer.
--   • Seria cópia. Se o pedido for cancelado ou reembolsado, a cópia fica no
--     roteiro dizendo que o passeio acontece.
--
-- Então o roteiro **lê** os pedidos ligados à viagem e mostra ao lado das
-- atividades, com rótulo próprio. É honesto: não é atividade organizada pela
-- Fly, é a compra da pessoa.
-- =============================================================================

create or replace function public.incluir_pedido_na_viagem(
  p_order uuid,
  -- Com default, **omitir o parâmetro desliga o pedido da viagem** — e é assim
  -- que o app chama, porque o gerador de tipos transforma parâmetro com
  -- default em opcional e não sabe que este aceita `null`.
  p_trip uuid default null
)
returns table (ok boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order;

  if not found then
    return query select false, 'pedido nao encontrado';
    return;
  end if;

  if v_order.user_id <> v_user and not fly_private.is_global_operator() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  -- Pedido encerrado não entra em roteiro. O que ele conta é história, e o
  -- roteiro fala do que vai acontecer.
  if v_order.status in ('cancelled', 'refunded') then
    return query select false, 'pedido encerrado';
    return;
  end if;

  -- Ausente ou `null` desliga: é o mesmo botão no outro sentido.
  if p_trip is not null then
    -- A viagem precisa ser de quem pede. Sem esta checagem, alguém anexaria o
    -- próprio pedido ao roteiro de outra pessoa — e o passeio apareceria lá.
    if not exists (
      select 1 from public.trip_members tm
      where tm.trip_id = p_trip and tm.user_id = v_user
    ) and not fly_private.is_global_operator() then
      return query select false, 'voce nao esta nesta viagem';
      return;
    end if;
  end if;

  update public.orders o set trip_id = p_trip where o.id = p_order;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user,
          case when p_trip is null then 'order.trip_unlinked' else 'order.trip_linked' end,
          'orders', p_order::text,
          jsonb_build_object('trip_id', p_trip));

  return query select true, null::text;
end;
$$;

revoke all on function public.incluir_pedido_na_viagem(uuid, uuid) from public, anon;
grant execute on function public.incluir_pedido_na_viagem(uuid, uuid) to authenticated;

comment on function public.incluir_pedido_na_viagem(uuid, uuid) is
  'Liga ou desliga (p_trip null) um pedido de uma viagem. O cliente nao tem '
  'update em orders, e nao vai ter: ali moram valor e politica (§40.11).';
