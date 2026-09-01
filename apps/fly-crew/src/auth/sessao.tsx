import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { FlyRole } from '@fly/domain-types';
import { supabase } from './client';

/**
 * Sessao do operador.
 *
 * Os papeis vem de `user_roles`, tabela protegida. O painel usa isso apenas
 * para decidir o que mostrar — cada consulta ainda passa pela RLS, que decide
 * de novo. Esconder um botao nao e controle de acesso.
 */
export type EstadoSessao =
  | { tipo: 'carregando' }
  | { tipo: 'deslogado' }
  | { tipo: 'logado'; sessao: Session; papeis: FlyRole[]; nome: string | null }
  | { tipo: 'semPermissao'; papeis: FlyRole[] }
  | { tipo: 'erro'; mensagem: string };

interface Contexto {
  estado: EstadoSessao;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
}

const SessaoContext = createContext<Contexto | null>(null);

export function useSessao(): Contexto {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return ctx;
}

/** Papeis que operam o painel. Guia e midia usam o Fly Crew, nao o Fly Crew. */
/**
 * O Crew e app de **campo**, e nao de escritorio.
 *
 * Guia, base, midia e experiencia estao na rua com o cliente; `admin` e
 * `trip_manager` entram porque precisam conferir o que o campo ve. Financeiro
 * e suporte nao — o trabalho deles e no Fly Ops, e dar acesso "por via das
 * duvidas" e como se alarga um acesso ate ele nao significar nada.
 */
const PAPEIS_DE_CAMPO: FlyRole[] = [
  'guide',
  'base',
  'media',
  'experience',
  'trip_manager',
  'admin',
];

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>({ tipo: 'carregando' });

  const aplicar = useCallback(async (sessao: Session | null) => {
    if (!sessao) return setEstado({ tipo: 'deslogado' });

    const [papeisRes, perfilRes] = await Promise.all([
      supabase().from('user_roles').select('role').eq('user_id', sessao.user.id),
      supabase()
        .from('profiles')
        .select('preferred_name, display_name')
        .eq('id', sessao.user.id)
        .maybeSingle(),
    ]);

    if (papeisRes.error) return setEstado({ tipo: 'erro', mensagem: papeisRes.error.message });

    const papeis = (papeisRes.data ?? []).map((p) => p.role);
    if (!papeis.some((p) => PAPEIS_DE_CAMPO.includes(p))) {
      return setEstado({ tipo: 'semPermissao', papeis });
    }

    setEstado({
      tipo: 'logado',
      sessao,
      papeis,
      nome: perfilRes.data?.preferred_name ?? perfilRes.data?.display_name ?? null,
    });
  }, []);

  useEffect(() => {
    let ativo = true;
    void supabase()
      .auth.getSession()
      .then(({ data }) => ativo && void aplicar(data.session));
    const { data: sub } = supabase().auth.onAuthStateChange((_e, s) => ativo && void aplicar(s));
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [aplicar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase().auth.signInWithPassword({ email, password: senha });
    // Mesma resposta para conta inexistente e senha errada, para nao permitir
    // descobrir quem tem acesso ao painel.
    return error ? 'E-mail ou senha não conferem.' : null;
  }, []);

  const sair = useCallback(async () => {
    await supabase().auth.signOut({ scope: 'global' });
    setEstado({ tipo: 'deslogado' });
  }, []);

  const valor = useMemo(() => ({ estado, entrar, sair }), [estado, entrar, sair]);
  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}
