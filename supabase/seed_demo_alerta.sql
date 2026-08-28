-- =============================================================================
-- MODO DEMONSTRACAO — uma alteracao de roteiro, para o alerta ambar aparecer
--
-- Arquivo separado porque `db push --include-seed` nao reexecuta seed ja
-- aplicado; conteudo novo precisa de nome novo.
--
-- Marca uma atividade de hoje como alterada. E o unico alerta que o schema
-- sabe produzir, e o bloco ambar da Home le exatamente isso — sem alteracao
-- pendente, ele some.
-- =============================================================================

update public.activities a
set changed_at = now(),
    change_note = 'Novo horario e ponto de encontro'
from public.trip_days d
join public.trips t on t.id = d.trip_id
where a.trip_day_id = d.id
  and t.name = 'Dubai — Fly Black'
  and d.day_date = current_date
  and a.changed_at is null
  and a.id = (
    select x.id from public.activities x
    where x.trip_day_id = d.id
    order by x.starts_at desc nulls last
    limit 1
  );
