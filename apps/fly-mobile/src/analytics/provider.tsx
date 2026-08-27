import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Analytics, DestinoLog, DestinoNulo, type Destino } from '@fly/analytics';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Analytics ligado à sessão e ao consentimento (§38.11).
 *
 * A porta de consentimento vive no `@fly/analytics`; aqui só se descobre em
 * que estado ela está. A ordem importa: o cliente nasce em `desconhecido`,
 * segura o que for registrado, e só decide quando a leitura do servidor volta.
 *
 * Sem sessão, o estado é `negado` — não porque a pessoa recusou, mas porque
 * não há consentimento a consultar, e a ausência de permissão é tratada como
 * ausência de permissão.
 */

const ANALYTICS = createContext<Analytics | null>(null);

/**
 * Não há fornecedor contratado (§33). Em desenvolvimento os eventos vão para
 * o log estruturado, onde dá para conferir taxonomia e propriedades; em
 * produção não vão a lugar nenhum, e trocar isso é uma linha.
 */
function destinoPadrao(): Destino {
  return __DEV__ ? new DestinoLog() : new DestinoNulo();
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const [pronto, setPronto] = useState(false);

  const cliente = useMemo(
    () =>
      new Analytics({
        destino: destinoPadrao(),
        aoRedigir: (nome, motivos) => {
          // Em desenvolvimento isso é bug de instrumentação, não ocorrência
          // normal: alguém passou dado pessoal para um evento.
          if (__DEV__)
            console.warn(`[analytics] ${nome} teve valor redigido: ${motivos.join(', ')}`);
        },
      }),
    [],
  );

  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const carregado = state.kind !== 'loading';

  // Guardado em ref para o efeito não recriar o cliente ao mudar de sessão.
  const clienteRef = useRef(cliente);
  clienteRef.current = cliente;

  useEffect(() => {
    if (!carregado) return;

    if (!userId) {
      clienteRef.current.definirConsentimento('negado');
      setPronto(true);
      return;
    }

    let vivo = true;
    void (async () => {
      const { data, error } = await supabase()
        .from('current_consents')
        .select('granted')
        .eq('user_id', userId)
        .eq('purpose_key', 'product_analytics')
        .maybeSingle();

      if (!vivo) return;

      // Erro de rede não vira consentimento. Fica desconhecido, a fila segura,
      // e a próxima tentativa decide — enviar por causa de uma falha de leitura
      // seria coletar sem permissão.
      if (error) return;

      clienteRef.current.definirConsentimento(data?.granted ? 'concedido' : 'negado');
      setPronto(true);
    })();

    return () => {
      vivo = false;
    };
  }, [userId, carregado]);

  void pronto;

  return <ANALYTICS.Provider value={cliente}>{children}</ANALYTICS.Provider>;
}

/**
 * O cliente de analytics.
 *
 * Devolve um cliente inerte fora do provider, em vez de lançar. Uma tela
 * renderizada num teste sem provider não deve quebrar por causa de métrica.
 */
export function useAnalytics(): Analytics {
  const ctx = useContext(ANALYTICS);
  const inerte = useMemo(() => {
    const a = new Analytics({ destino: new DestinoNulo() });
    a.definirConsentimento('negado');
    return a;
  }, []);
  return ctx ?? inerte;
}
