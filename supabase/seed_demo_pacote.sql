-- Demonstracao: o pacote do Rafael. Dado falso, isolado.
-- Black para o selo aparecer branco no Perfil e na Carteira (D120).
do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'cliente@fly.com' limit 1;
  if v_user is null then return; end if;
  insert into public.customer_packages (user_id, package, note)
  values (v_user, 'black', 'Demonstração — pacote de exemplo')
  on conflict (user_id) do update set package = excluded.package;
end $$;
