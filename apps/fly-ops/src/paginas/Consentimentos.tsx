import { useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Consentimentos (§16.2 e §37.9).
 *
 * O painel mostra o estado atual **e** o histórico. O histórico e o que
 * responde "o cliente tinha autorizado em tal data?" — pergunta que aparece
 * em auditoria e em disputa, e que um booleano nao responde.
 *
 * O operador le, nunca escreve: consentimento e do cliente. Alterar por aqui
 * seria consentir no lugar dele.
 */
interface Evento {
  id: number;
  userId: string;
  nome: string | null;
  finalidade: string;
  concedido: boolean;
  quando: string;
  origem: string;
}

export function Consentimentos() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [consentimentos, perfis] = await Promise.all([
        supabase()
          .from('consents')
          .select('id, user_id, purpose_key, granted, recorded_at, source')
          .order('recorded_at', { ascending: false })
          .limit(100),
        supabase().from('profiles').select('id, preferred_name, display_name'),
      ]);

      if (consentimentos.error) return setErro(consentimentos.error.message);

      const nomes = new Map(
        (perfis.data ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name]),
      );

      setEventos(
        (consentimentos.data ?? []).map((c) => ({
          id: c.id,
          userId: c.user_id,
          nome: nomes.get(c.user_id) ?? null,
          finalidade: c.purpose_key,
          concedido: c.granted,
          quando: c.recorded_at,
          origem: c.source,
        })),
      );
    })();
  }, []);

  if (erro)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!eventos) return <p className="muted">Carregando…</p>;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Consentimentos</p>
          <h1>Histórico</h1>
        </div>
      </div>

      <p className="muted">
        Somente leitura. Consentimento é do cliente — alterar por aqui seria consentir no lugar
        dele.
      </p>

      {eventos.length === 0 ? (
        <p className="muted">Nenhum registro ainda.</p>
      ) : (
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Finalidade</th>
                <th>Decisão</th>
                <th>Quando</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td>{e.nome ?? <span className="muted">sem nome</span>}</td>
                  <td className="mono">{e.finalidade}</td>
                  <td>
                    <span className={e.concedido ? 'selo selo--ok' : 'selo selo--revogado'}>
                      {e.concedido ? 'Concedido' : 'Revogado'}
                    </span>
                  </td>
                  <td className="muted">{new Date(e.quando).toLocaleString('pt-BR')}</td>
                  <td className="mono muted">{e.origem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
