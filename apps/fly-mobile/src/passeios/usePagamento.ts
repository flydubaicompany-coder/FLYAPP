import { useCallback, useEffect, useState } from 'react';
import { escolherProvedor, TOKENS_SANDBOX, type Autorizacao } from '@fly/payments';
import { isMoeda } from '@fly/domain-types';
import { supabase } from '@/auth/client';
import { loadEnv } from '@/env';

/**
 * Pagamento do pedido (§6.5, passo 6, e §40.9).
 *
 * A tela não sabe qual provedor está atendendo, e não deve saber. Ela pergunta
 * a este hook se dá para pagar; o hook lê o interruptor e o nome do adapter no
 * banco e monta o provedor. Trocar o sandbox por um PSP real não encosta em
 * tela nenhuma.
 *
 * **O retorno de `pagar()` não é o desfecho do pagamento.** Quem confirma é o
 * webhook, no servidor. `pendente` quer dizer "o provedor aceitou a intenção";
 * o pedido só muda de status quando o evento assinado chega. Por isso a tela
 * recarrega o pedido depois, em vez de acreditar na resposta.
 */

export interface EstadoPagamento {
  /** `null` enquanto carrega. */
  readonly disponivel: boolean | null;
  /** `false` no sandbox. A tela precisa avisar que não é cobrança real. */
  readonly ehProducao: boolean;
  readonly nome: string;
}

const INICIAL: EstadoPagamento = { disponivel: null, ehProducao: false, nome: 'desligado' };

export function usePagamento() {
  const [estado, setEstado] = useState<EstadoPagamento>(INICIAL);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    let vivo = true;

    void (async () => {
      const cliente = supabase();

      // Duas leituras porque são duas tabelas. Ambas são select simples e
      // ficam em cache do PostgREST; não vale inventar uma view para isso.
      const [flag, config] = await Promise.all([
        cliente
          .from('feature_flags')
          .select('is_enabled')
          .eq('key', 'payments.checkout')
          .maybeSingle(),
        cliente.from('app_config').select('value').eq('key', 'payments.provider').maybeSingle(),
      ]);

      if (!vivo) return;

      const ligado = flag.data?.is_enabled ?? false;
      const nome = typeof config.data?.value === 'string' ? config.data.value : null;

      // Token vazio de proposito: aqui so se pergunta *qual* provedor
      // atende, e a resposta nao depende de sessao. `autorizar()` nunca e
      // chamado nesta instancia — `pagar()` monta outra, com o token.
      const provedor = escolherProvedor({
        checkoutLigado: ligado,
        provedor: nome,
        sandbox: opcoesDoSandbox(''),
      });

      setEstado({
        disponivel: provedor.nome !== 'desligado',
        ehProducao: provedor.ehProducao,
        nome: provedor.nome,
      });
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const pagar = useCallback(
    async (pedidoId: string, totalCentavos: number, moeda: string): Promise<Autorizacao> => {
      setPagando(true);
      try {
        const cliente = supabase();
        const { data } = await cliente.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          return { status: 'indisponivel', motivo: 'sua sessao expirou' };
        }

        const [flag, config] = await Promise.all([
          cliente
            .from('feature_flags')
            .select('is_enabled')
            .eq('key', 'payments.checkout')
            .maybeSingle(),
          cliente.from('app_config').select('value').eq('key', 'payments.provider').maybeSingle(),
        ]);

        // A flag é relida no momento de pagar, e não só na montagem da tela.
        // Uma tela aberta há vinte minutos não pode cobrar com um provedor
        // que a operação desligou há dez.
        const provedor = escolherProvedor({
          checkoutLigado: flag.data?.is_enabled ?? false,
          provedor: typeof config.data?.value === 'string' ? config.data.value : null,
          sandbox: opcoesDoSandbox(token),
        });

        // Moeda que o app nao conhece nao vira `as Moeda`: um cast aqui
        // mandaria para o provedor um codigo que o banco ja recusaria, e o
        // erro apareceria como falha de pagamento em vez de dado invalido.
        if (!isMoeda(moeda)) {
          return { status: 'indisponivel', motivo: 'moeda nao reconhecida' };
        }

        return await provedor.autorizar({
          pedidoId,
          totalCentavos,
          moeda,
          // O sandbox não coleta cartão — não existe tela de cartão, porque
          // não existe PSP para tokenizar. Este é o token de teste que aprova.
          // Com PSP real, aqui entra o token que o SDK dele devolve.
          instrumento: TOKENS_SANDBOX.aprovar,
        });
      } finally {
        setPagando(false);
      }
    },
    [],
  );

  return { estado, pagando, pagar };
}

function opcoesDoSandbox(token: string) {
  const env = loadEnv();
  return {
    endpoint: `${env.supabaseUrl}/functions/v1/pagamento-sandbox`,
    token,
    // Chave publicável. `loadEnv` recusa subir se parecer segredo de servidor.
    apiKey: env.supabaseKey,
  };
}
