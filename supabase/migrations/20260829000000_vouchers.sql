-- =============================================================================
-- Fase 6 — vouchers do cliente (§8.2 e §41, entrega 5).
--
-- Os `coupons` da Fase 5 sao **codigos globais**: qualquer um que saiba o texto
-- digita no checkout. Isso resolve campanha, e nao resolve Carteira. O que
-- falta e o voucher **nominal**: um cupom entregue a uma pessoa, que aparece
-- na Carteira dela.
--
-- **Nao ha copia dos termos.** O desconto continua morando em `coupons`, e a
-- policy abaixo deixa o cliente ler **apenas o cupom que ele possui**. Congelar
-- rotulo e valor na linha do voucher criaria duas fontes de verdade que
-- divergem no dia em que alguem corrigir o cupom.
-- =============================================================================

create table public.customer_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  coupon_code text not null references public.coupons (code) on delete restrict,

  -- Por que esta pessoa recebeu. Aparece so para a equipe.
  note text,

  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,

  -- Preenchidos quando o voucher e usado. Nulo = ainda vale.
  used_at timestamptz,
  used_order_id uuid references public.orders (id) on delete set null,

  -- A mesma pessoa nao recebe o mesmo cupom duas vezes.
  constraint customer_vouchers_unicos unique (user_id, coupon_code),
  -- Usado sem pedido, ou pedido sem data de uso, e meia informacao.
  constraint customer_vouchers_uso_coerente check (
    (used_at is null and used_order_id is null)
    or (used_at is not null)
  )
);

create index customer_vouchers_user_idx on public.customer_vouchers (user_id, granted_at desc);

comment on table public.customer_vouchers is
  'Cupom entregue a uma pessoa. Os termos ficam em `coupons` — aqui nao ha copia.';

-- -----------------------------------------------------------------------------
-- Marcar como usado quando o pedido que o consumiu e confirmado.
--
-- Gatilho, e nao chamada: o pedido vira `confirmed` por tres caminhos
-- (webhook, sandbox, painel), e o voucher tem de sair da Carteira nos tres.
-- -----------------------------------------------------------------------------
create or replace function fly_private.marcar_voucher_usado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.coupon_code is null then
    return null;
  end if;

  update public.customer_vouchers v
  set used_at = now(), used_order_id = new.id
  where v.user_id = new.user_id
    and v.coupon_code = new.coupon_code
    and v.used_at is null;

  return null;
end;
$$;

create trigger orders_marcam_voucher
  after update of status on public.orders
  for each row
  when (new.status = 'confirmed' and old.status is distinct from 'confirmed')
  execute function fly_private.marcar_voucher_usado();

-- -----------------------------------------------------------------------------
-- RLS e GRANT.
-- -----------------------------------------------------------------------------
alter table public.customer_vouchers enable row level security;

create policy customer_vouchers_select on public.customer_vouchers for select to authenticated
  using ((select auth.uid()) = user_id or fly_private.is_staff());
create policy customer_vouchers_write_operator on public.customer_vouchers for all to authenticated
  using (fly_private.is_global_operator()) with check (fly_private.is_global_operator());

/**
 * O cliente le **so o cupom que ele possui**.
 *
 * Sem isto a Carteira mostraria um codigo sem valor nem validade. Com um
 * `select` amplo em `coupons`, qualquer cliente listaria todas as campanhas
 * ativas da Fly — inclusive as que nao sao para ele.
 */
create policy coupons_select_own_voucher on public.coupons for select to authenticated
  using (
    exists (
      select 1 from public.customer_vouchers v
      where v.coupon_code = coupons.code
        and v.user_id = (select auth.uid())
    )
  );

revoke all on public.customer_vouchers from anon;
grant select on public.customer_vouchers to authenticated;
grant insert, update, delete on public.customer_vouchers to authenticated;
