-- =============================================================================
-- Demonstracao: catalogo de beneficios.
--
-- **Estes beneficios sao inventados, e o titulo diz isso.** Premio esta na
-- lista da §33 do que nunca se inventa: o que a Fly de fato entrega, a que
-- custo em pontos, e decisao do dono. Sao aqui so para a tela ter o que
-- mostrar e para o resgate poder ser exercitado ponta a ponta.
--
-- Apagar este arquivo e limpar `benefits` devolve o catalogo vazio.
-- Pendencia registrada: **P45**.
--
-- Os custos foram postos na escala real (prime 25.000, elite 100.000) para o
-- resgate ser exercitavel: com 69.100 pontos da para resgatar varios, e um
-- deles fica fora de alcance de proposito.
-- =============================================================================

insert into public.benefits
  (key, title, description, points_cost, stock, min_level, is_active, sort_order)
values
  ('demo-upgrade-mesa',
   'Upgrade de mesa (demonstração)',
   'Mesa com vista no jantar já reservado, sujeito a disponibilidade da casa.',
   8000, null, null, true, 1),

  ('demo-late-checkout',
   'Late checkout garantido (demonstração)',
   'Saída até as 16h no último dia, confirmada pela Fly com o hotel.',
   12000, 20, null, true, 2),

  ('demo-transfer-extra',
   'Transfer privativo extra (demonstração)',
   'Um trajeto adicional com motorista, dentro de Dubai.',
   15000, 8, null, true, 3),

  ('demo-ensaio-deserto',
   'Ensaio fotográfico no deserto (demonstração)',
   'Sessão de uma hora no pôr do sol, com fotógrafo da Fly.',
   30000, 4, 'prime', true, 4),

  ('demo-jantar-burj',
   'Jantar no Burj Al Arab para dois (demonstração)',
   'Menu degustação completo. Exige nível elite.',
   90000, 2, 'elite', true, 5),

  ('demo-esgotado',
   'Passeio de balão ao amanhecer (demonstração)',
   'Esgotado nesta temporada — serve para mostrar o estado sem estoque.',
   20000, 0, null, true, 6)
on conflict (key) do nothing;
