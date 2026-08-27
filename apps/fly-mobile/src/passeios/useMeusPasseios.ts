import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

/**
 * Resumo dos passeios comprados, para a barra da §6.1.
 *
 * Devolve só o que a barra mostra: quantas experiências, as capas das
 * próximas e quando é a próxima. A tela cheia carrega o resto.
 *
 * **Conta experiências, não pedidos.** Um pedido com três passeios é três
 * coisas para fazer na viagem, e é assim que a pessoa conta. "1" ali, com três
 * capas empilhadas ao lado, seria a barra se contradizendo.
 *
 * Encerrado não entra: o que foi cancelado ou reembolsado não é um passeio
 * que a pessoa tem pela frente.
 */

export interface ResumoMeusPasseios {
  quantidade: number;
  /** `storage_path` das capas, na ordem em que os passeios acontecem. */
  capas: string[];
  /** "próximo em 2 dias", ou `null` quando nada tem data futura. */
  proximo: string | null;
}

const VAZIO: ResumoMeusPasseios = { quantidade: 0, capas: [], proximo: null };

function comoFalta(iso: string, agora: Date): string | null {
  const dias = Math.round((new Date(iso).getTime() - agora.getTime()) / 86_400_000);
  if (dias < 0) return null;
  if (dias === 0) return 'é hoje';
  if (dias === 1) return 'é amanhã';
  return `próximo em ${dias} dias`;
}

export function useMeusPasseios(): ResumoMeusPasseios & { recarregar: () => Promise<void> } {
  const [resumo, setResumo] = useState<ResumoMeusPasseios>(VAZIO);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('orders')
      .select('id, status, order_items(id, starts_at, tours(tour_media(storage_path, sort_order)))')
      .not('status', 'in', '(cancelled,refunded,failed)');

    // Falha aqui esconde a barra, e não mostra uma barra mentindo "0".
    if (error || !data) return setResumo(VAZIO);

    const agora = new Date();
    const itens = data
      .flatMap((o) => o.order_items ?? [])
      .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));

    if (itens.length === 0) return setResumo(VAZIO);

    const futuros = itens.filter((i) => i.starts_at && new Date(i.starts_at) >= agora);
    const primeiro = futuros[0]?.starts_at;

    setResumo({
      quantidade: itens.length,
      capas: (futuros.length > 0 ? futuros : itens)
        .map((i) => {
          const midias = [...(i.tours?.tour_media ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          return midias[0]?.storage_path ?? null;
        })
        .filter((c): c is string => c !== null)
        .slice(0, 3),
      proximo: primeiro ? comoFalta(primeiro, agora) : null,
    });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { ...resumo, recarregar: carregar };
}
