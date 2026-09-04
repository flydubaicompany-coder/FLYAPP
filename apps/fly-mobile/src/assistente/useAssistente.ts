import { useCallback, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';

/**
 * Assistente Fly (§15.1 e §45).
 *
 * O app **não fala com modelo nenhum**. Ele fala com a Edge Function
 * `assistente`, e a chave do provedor vive lá — a regra do projeto não tem
 * exceção: no cliente, só a chave publicável.
 *
 * A função devolve `disponivel: false` quando a flag está desligada, quando o
 * provedor é `PENDENTE` ou quando não há credencial. Hoje é sempre esse o
 * caso, e a tela diz isso em vez de fingir que o assistente está pensando.
 */

export interface Resposta {
  disponivel: boolean;
  runId: string | null;
  texto: string | null;
  motivo: string | null;
}

export interface Troca {
  id: string;
  pergunta: string;
  resposta: Resposta;
  /** `null` = ainda não opinou. */
  util: boolean | null;
}

export function useAssistente() {
  const [conversa, setConversa] = useState<Troca[]>([]);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const perguntar = useCallback(async (pergunta: string) => {
    const limpa = pergunta.trim();
    if (limpa === '') return;

    setPensando(true);
    setErro(null);
    try {
      const { data, error } = await supabase().functions.invoke('assistente', {
        body: { pergunta: limpa },
      });

      if (error) {
        setErro(
          ehFalhaDeRede(error)
            ? 'Sem conexão. Sua pergunta não chegou à Fly.'
            : 'Não consegui perguntar agora.',
        );
        return;
      }

      const r = data as {
        disponivel?: boolean;
        run_id?: string | null;
        resposta?: string | null;
        motivo?: string | null;
      };

      setConversa((atual) => [
        ...atual,
        {
          id: r.run_id ?? `local-${atual.length}`,
          pergunta: limpa,
          resposta: {
            disponivel: r.disponivel === true,
            runId: r.run_id ?? null,
            texto: r.resposta ?? null,
            motivo: r.motivo ?? null,
          },
          util: null,
        },
      ]);
    } finally {
      setPensando(false);
    }
  }, []);

  /**
   * "Recomendação pode ser recusada" (§45, entrega 4).
   *
   * Sem isto, a entrega seria só recomendação com motivo. O polegar para
   * baixo com texto é o único jeito de a operação descobrir que o assistente
   * está respondendo bonito e errado.
   */
  const opinar = useCallback(async (troca: Troca, util: boolean, motivo?: string) => {
    if (troca.resposta.runId === null) return;

    const { data: sessao } = await supabase().auth.getUser();
    const userId = sessao.user?.id;
    if (!userId) return;

    const { error } = await supabase()
      .from('assistant_feedback')
      .insert({
        run_id: troca.resposta.runId,
        user_id: userId,
        util,
        ...(motivo === undefined || motivo.trim() === '' ? {} : { motivo: motivo.trim() }),
      });

    if (!error) {
      setConversa((atual) => atual.map((t) => (t.id === troca.id ? { ...t, util } : t)));
    }
  }, []);

  return { conversa, pensando, erro, perguntar, opinar };
}
