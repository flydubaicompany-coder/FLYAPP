import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * Refeicoes da viagem (§11.1).
 *
 * O prazo vem **do servidor**, na coluna `choices_close_at`. O app so compara
 * com o relogio local para decidir o que mostrar — quem decide se aceita a
 * mudanca e o gatilho no banco. Relogio de celular atrasado nao pode virar
 * escolha aceita fora do prazo.
 */

export type TipoDeRefeicao = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type SituacaoDaRefeicao = 'draft' | 'open' | 'locked' | 'sent' | 'delivered' | 'cancelled';

export const NOME_DA_REFEICAO: Record<TipoDeRefeicao, string> = {
  breakfast: 'Café da manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

export interface OpcaoDeRefeicao {
  id: string;
  titulo: string;
  descricao: string | null;
  /** O que da para pedir diferente, em portugues. `null` = nada. */
  personalizacao: string | null;
}

export interface Refeicao {
  id: string;
  diaNumero: number;
  data: string;
  tipo: TipoDeRefeicao;
  fornecedor: string | null;
  local: string | null;
  serveEm: string | null;
  fechaEm: string | null;
  situacao: SituacaoDaRefeicao;
  opcoes: OpcaoDeRefeicao[];
  /** A escolha desta pessoa. `null` = ainda nao escolheu. */
  minhaEscolha: { opcaoId: string; personalizacao: string | null } | null;
}

export type RefeicoesData =
  | { kind: 'loading' }
  | { kind: 'ready'; refeicoes: Refeicao[] }
  | { kind: 'error'; message: string };

/** Ainda da para escolher? A palavra final e do banco; isto e so a tela. */
export function aindaDaParaEscolher(r: Refeicao): boolean {
  if (r.situacao !== 'open') return false;
  if (!r.fechaEm) return true;
  return new Date(r.fechaEm).getTime() > Date.now();
}

export function useRefeicoes(tripId: string | null, userId: string | null) {
  const [data, setData] = useState<RefeicoesData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!tripId || !userId) return setData({ kind: 'ready', refeicoes: [] });
    const db = supabase();

    const { data: dias, error } = await db
      .from('trip_days')
      .select(
        'id, day_number, day_date, meal_services(id, kind, supplier_name, location, serves_at, choices_close_at, status, meal_options(id, label, description, customization_note, is_active, sort_order))',
      )
      .eq('trip_id', tripId)
      .order('day_number');

    if (error) return setData({ kind: 'error', message: error.message });

    const servicos = (dias ?? []).flatMap(
      (d: {
        day_number: number;
        day_date: string;
        meal_services?: Array<Record<string, unknown>> | null;
      }) => (d.meal_services ?? []).map((s) => ({ dia: d.day_number, data: d.day_date, s })),
    );

    const ids = servicos.map((x) => String(x.s['id']));
    const { data: minhas } = await db
      .from('meal_choices')
      .select('service_id, option_id, customization')
      .eq('user_id', userId)
      .in('service_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

    const porServico = new Map((minhas ?? []).map((m) => [m.service_id, m]));

    setData({
      kind: 'ready',
      refeicoes: servicos
        .map(({ dia, data: dataDia, s }) => {
          const escolha = porServico.get(String(s['id']));
          const opcoes = ((s['meal_options'] as Array<Record<string, unknown>>) ?? [])
            .filter((o) => o['is_active'])
            .sort((a, b) => Number(a['sort_order']) - Number(b['sort_order']))
            .map((o) => ({
              id: String(o['id']),
              titulo: String(o['label']),
              descricao: (o['description'] as string) ?? null,
              personalizacao: (o['customization_note'] as string) ?? null,
            }));

          return {
            id: String(s['id']),
            diaNumero: dia,
            data: dataDia,
            tipo: s['kind'] as TipoDeRefeicao,
            fornecedor: (s['supplier_name'] as string) ?? null,
            local: (s['location'] as string) ?? null,
            serveEm: (s['serves_at'] as string) ?? null,
            fechaEm: (s['choices_close_at'] as string) ?? null,
            situacao: s['status'] as SituacaoDaRefeicao,
            opcoes,
            minhaEscolha: escolha
              ? { opcaoId: escolha.option_id, personalizacao: escolha.customization }
              : null,
          };
        })
        // Por horario de servir: o cliente pensa em "o que vem agora", e nao
        // em qual dia da viagem a refeicao pertence.
        .sort((a, b) => (a.serveEm ?? '').localeCompare(b.serveEm ?? '')),
    });
  }, [tripId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Escolhe ou troca.
   *
   * `upsert` porque a tabela tem uma escolha por pessoa por refeicao: trocar
   * de ideia e reescrever a mesma linha, e nao acumular.
   */
  const escolher = useCallback(
    async (
      servicoId: string,
      opcaoId: string,
      personalizacao: string,
    ): Promise<{ ok: boolean; motivo?: string }> => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };

      const { error } = await supabase()
        .from('meal_choices')
        .upsert(
          {
            service_id: servicoId,
            user_id: userId,
            option_id: opcaoId,
            customization: personalizacao.trim() || null,
          },
          { onConflict: 'service_id,user_id' },
        );

      if (error) return { ok: false, motivo: error.message };
      await carregar();
      return { ok: true };
    },
    [userId, carregar],
  );

  return { data, escolher, recarregar: carregar };
}
