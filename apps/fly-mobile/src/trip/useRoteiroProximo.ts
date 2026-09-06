import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { alertasDoRoteiro, proximoCompromisso, type Alerta, type AtividadeParaAlerta } from './alertas';

/**
 * O roteiro perto de agora: ontem, hoje e amanhã.
 *
 * Três dias, e não a viagem inteira, porque é disso que os alertas precisam —
 * "amanhã às 10:00" e "mudou faz duas horas" não alcançam mais do que isso.
 * Puxar sete dias para descartar cinco seria pagar rede por nada, e o cliente
 * abre esta tela num 4G de deserto.
 *
 * Ontem entra por causa da tolerância: um compromisso das 23h50 ainda é
 * "agora" às 00h10, e ele mora no dia anterior.
 *
 * `useHoje` não serve aqui e não foi alterado: ele traz só o dia corrente e
 * não devolve `departure_at` nem `what_to_bring`, que são exatamente os dois
 * campos de que o alerta vive.
 */

export type RoteiroProximo =
  | { kind: 'loading' }
  | { kind: 'ready'; alertas: Alerta[]; proximo: AtividadeParaAlerta | null; doDia: AtividadeParaAlerta[] }
  | { kind: 'error'; message: string };

interface AtividadeCrua {
  id: string;
  title: string;
  starts_at: string | null;
  departure_at: string | null;
  meeting_point: string | null;
  what_to_bring: string | null;
  instructions: string | null;
  changed_at: string | null;
  change_note: string | null;
  status: string;
}

function diaISO(deslocamento: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

export function useRoteiroProximo(tripId: string | null): RoteiroProximo {
  const [data, setData] = useState<RoteiroProximo>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId) return setData({ kind: 'ready', alertas: [], proximo: null, doDia: [] });

    const { data: dias, error } = await supabase()
      .from('trip_days')
      .select(
        'day_date, activities(id, title, status, starts_at, departure_at, meeting_point, what_to_bring, instructions, changed_at, change_note, sort_order)',
      )
      .eq('trip_id', tripId)
      .in('day_date', [diaISO(-1), diaISO(0), diaISO(1)]);

    if (error) return setData({ kind: 'error', message: error.message });

    const hoje = diaISO(0);
    const cruas: { dia: string; a: AtividadeCrua }[] = (dias ?? []).flatMap(
      (d: { day_date: string; activities?: AtividadeCrua[] | null }) =>
        (d.activities ?? []).map((a) => ({ dia: d.day_date, a })),
    );

    const paraAlerta = (a: AtividadeCrua): AtividadeParaAlerta => ({
      id: a.id,
      titulo: a.title,
      saidaEm: a.departure_at,
      comecaEm: a.starts_at,
      local: a.meeting_point,
      levar: a.what_to_bring,
      instrucoes: a.instructions,
      mudouEm: a.changed_at,
      notaDaMudanca: a.change_note,
    });

    // Atividade cancelada não vira alerta nem próximo compromisso: mandar
    // alguém para um passeio que não vai acontecer é pior do que não avisar.
    const ativas = cruas.filter((c) => c.a.status !== 'cancelled');
    const todas = ativas.map((c) => paraAlerta(c.a));

    setData({
      kind: 'ready',
      alertas: alertasDoRoteiro(todas),
      proximo: proximoCompromisso(todas),
      doDia: ativas
        .filter((c) => c.dia === hoje)
        .map((c) => paraAlerta(c.a))
        .sort((x, y) => (x.comecaEm ?? '').localeCompare(y.comecaEm ?? '')),
    });
  }, [tripId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return data;
}
