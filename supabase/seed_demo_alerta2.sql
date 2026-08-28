-- Ajuste do texto do alerta de demonstracao: o design usa duas linhas curtas.
-- Arquivo novo porque o seed anterior ja foi aplicado.
update public.activities
set change_note = 'Novo horario e ponto de encontro'
where change_note = 'Novo horario e ponto de encontro. Confirme que voce viu.';
