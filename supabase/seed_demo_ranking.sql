-- =============================================================================
-- Demonstracao: um periodo de ranking.
--
-- **A dimensao e o criterio sao invenção minha para a tela ter o que mostrar.**
-- "Criterios de ranking" esta na lista da §33 do que nunca se inventa — o que
-- vale de verdade e decisao do dono. Por isso o criterio abaixo descreve
-- exatamente o que a maquina faz, e nada alem: soma dos pontos ganhos na
-- janela, normalizada. Sem promessa de premio, que seria a outra invencao.
--
-- Pendencia registrada: **P46**.
-- =============================================================================

insert into public.ranking_periods
  (key, label, dimension, starts_on, ends_on, basis, criteria_note, is_published)
values (
  'demo-agosto-2026',
  'Agosto na Fly (demonstração)',
  'clientes da semana',
  date_trunc('month', now())::date,
  (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  'points_earned',
  'Soma dos Fly Points ganhos no mês, normalizada de 0 a 1000 contra quem ganhou mais. Valor gasto não entra e não é publicado.',
  true
)
on conflict (key) do nothing;

-- O Rafael precisa ter optado por participar para aparecer.
update public.customer_preferences cp
set ranking_opt_in = true
from auth.users u
where u.email = 'cliente@fly.com' and cp.user_id = u.id;

insert into public.customer_preferences (user_id, ranking_opt_in)
select u.id, true from auth.users u
where u.email = 'cliente@fly.com'
on conflict (user_id) do update set ranking_opt_in = true;
