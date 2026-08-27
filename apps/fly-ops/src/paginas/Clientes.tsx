import { useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Clientes (§16.2).
 *
 * A lista mostra onde cada pessoa parou no onboarding — que e a pergunta que a
 * operacao realmente faz antes de uma viagem: quem ainda nao completou?
 *
 * Nao ha busca por documento nem exibicao de dado sensivel: a §16.2 pede
 * "acesso por papel", e o que aparece aqui e o minimo para operar.
 */
interface Cliente {
  id: string;
  publicId: string;
  nome: string | null;
  passo: string;
  concluido: boolean;
  criadoEm: string;
}

const ROTULO_PASSO: Record<string, string> = {
  invited: 'Convidado',
  account: 'Criando acesso',
  identity: 'Identificação',
  preferences: 'Preferências',
  consents: 'Privacidade',
  done: 'Completo',
};

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void supabase()
      .from('profiles')
      .select(
        'id, public_id, preferred_name, display_name, onboarding_step, onboarding_completed_at, created_at',
      )
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return setErro(error.message);
        setClientes(
          (data ?? []).map((p) => ({
            id: p.id,
            publicId: p.public_id,
            nome: p.preferred_name ?? p.display_name,
            passo: p.onboarding_step,
            concluido: p.onboarding_completed_at !== null,
            criadoEm: p.created_at,
          })),
        );
      });
  }, []);

  if (erro)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!clientes) return <p className="muted">Carregando…</p>;

  const pendentes = clientes.filter((c) => !c.concluido);

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Clientes</p>
          <h1>{clientes.length} no total</h1>
        </div>
        {pendentes.length > 0 ? (
          <p className="aviso">{pendentes.length} com onboarding pendente</p>
        ) : null}
      </div>

      {clientes.length === 0 ? (
        <p className="muted">Ninguém ainda. Convide pela aba Convites.</p>
      ) : (
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Fly ID</th>
                <th>Onboarding</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome ?? <span className="muted">sem nome ainda</span>}</td>
                  <td className="mono">{c.publicId}</td>
                  <td>
                    <span className={c.concluido ? 'selo selo--ok' : 'selo selo--pendente'}>
                      {ROTULO_PASSO[c.passo] ?? c.passo}
                    </span>
                  </td>
                  <td className="muted">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
