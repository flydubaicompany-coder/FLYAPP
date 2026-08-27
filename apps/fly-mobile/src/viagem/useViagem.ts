import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Estado de Minha Viagem, vindo do servidor (§7.1).
 *
 * Mesma razão de `useHome`: quem decide o que é "agora" e o que é "próximo" é
 * o banco, em `viagem_atual()`. A conta depende do fuso do destino, e um
 * celular ainda no horário de Brasília mostraria o compromisso errado no
 * primeiro dia de viagem — que é exatamente quando ninguém pode errar.
 */

export interface Agora {
  id: string;
  titulo: string;
  comeca: string;
}

export interface Proximo {
  id: string;
  titulo: string;
  comeca: string;
  saida: string | null;
  ponto: string | null;
}

export interface Viagem {
  id: string;
  nome: string;
  destino: string;
  timezone: string;
  comecaEm: string;
  terminaEm: string;
  diaAtual: number | null;
  totalDias: number;
  agora: Agora | null;
  proximo: Proximo | null;
  alteracoesPendentes: number;
}

export type DadosViagem =
  | { kind: 'loading' }
  | { kind: 'semViagem' }
  | { kind: 'ready'; viagem: Viagem }
  | { kind: 'error'; message: string };

export function useViagem(): { data: DadosViagem; reload: () => Promise<void> } {
  const { state: sessao } = useSession();
  const [data, setData] = useState<DadosViagem>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (sessao.kind !== 'signedIn') return setData({ kind: 'semViagem' });

    const { data: linhas, error } = await supabase().rpc('viagem_atual');
    if (error) return setData({ kind: 'error', message: error.message });

    const v = Array.isArray(linhas) ? linhas[0] : linhas;
    // Sem viagem não é erro. É o estado de quem ainda não embarcou, e a tela
    // tem conteúdo próprio para ele.
    if (!v?.trip_id) return setData({ kind: 'semViagem' });

    setData({
      kind: 'ready',
      viagem: {
        id: v.trip_id,
        nome: v.trip_name,
        destino: v.destination_name,
        timezone: v.timezone,
        comecaEm: v.starts_on,
        terminaEm: v.ends_on,
        diaAtual: v.day_number,
        totalDias: v.total_days,
        agora: v.agora_id
          ? { id: v.agora_id, titulo: v.agora_titulo, comeca: v.agora_comeca }
          : null,
        proximo: v.proximo_id
          ? {
              id: v.proximo_id,
              titulo: v.proximo_titulo,
              comeca: v.proximo_comeca,
              saida: v.proximo_saida,
              ponto: v.proximo_ponto,
            }
          : null,
        alteracoesPendentes: v.alteracoes_sem_confirmacao ?? 0,
      },
    });
  }, [sessao.kind]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { data, reload: carregar };
}
