import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Viajantes de uma viagem (P42).
 *
 * Esta e a ligacao que faltava: uma viagem sem membro nao aparece para
 * ninguem. O app do cliente le `trip_members` para saber qual e a viagem
 * dele, entao **e aqui que a viagem vira real** para quem comprou.
 *
 * Por isso a tela diz isso em voz alta. Adicionar alguem nao e um detalhe de
 * cadastro: e dar a uma pessoa acesso ao roteiro, aos documentos e ao QR
 * daquela viagem.
 */

interface Membro {
  userId: string;
  nome: string;
  flyId: string;
}

interface Candidato {
  id: string;
  nome: string;
  flyId: string;
}

export interface ViajantesProps {
  viagemId: string;
}

function nomeDe(preferido: string | null, exibicao: string | null): string {
  return preferido ?? exibicao ?? 'Sem nome';
}

export function Viajantes({ viagemId }: ViajantesProps) {
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [escolhido, setEscolhido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const db = supabase();

    /* Duas consultas, e nao um join: `trip_members.user_id` aponta para
       `auth.users`, nao para `profiles`. Nao existe chave estrangeira entre as
       duas tabelas, entao o PostgREST nao sabe relacionar — e o tipo gerado
       diz isso na cara. */
    const { data: linhas, error } = await db
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', viagemId);

    if (error) return setErro(error.message);

    const ids = (linhas ?? []).map((m) => m.user_id);

    const { data: todos, error: erroPerfis } = await db
      .from('profiles')
      .select('id, public_id, preferred_name, display_name')
      .order('created_at', { ascending: false })
      .limit(200);

    if (erroPerfis) return setErro(erroPerfis.message);

    const porId = new Map((todos ?? []).map((p) => [p.id, p]));

    const lista: Membro[] = ids.map((id) => {
      const p = porId.get(id);
      return {
        userId: id,
        nome: p ? nomeDe(p.preferred_name, p.display_name) : 'Cliente fora da lista',
        flyId: p?.public_id ?? '—',
      };
    });
    setMembros(lista);

    const jaDentro = new Set(ids);
    const livres = (todos ?? [])
      .filter((p) => !jaDentro.has(p.id))
      .map((p) => ({
        id: p.id,
        nome: nomeDe(p.preferred_name, p.display_name),
        flyId: p.public_id,
      }));
    setCandidatos(livres);
    setEscolhido(livres[0]?.id ?? '');
  }, [viagemId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function adicionar() {
    if (!escolhido) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase()
      .from('trip_members')
      .insert({ trip_id: viagemId, user_id: escolhido });
    if (error) setErro(error.message);
    await carregar();
    setSalvando(false);
  }

  async function remover(userId: string, nome: string) {
    if (!confirm(`Tirar ${nome} desta viagem? Ela some do app dessa pessoa.`)) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase()
      .from('trip_members')
      .delete()
      .eq('trip_id', viagemId)
      .eq('user_id', userId);
    if (error) setErro(error.message);
    await carregar();
    setSalvando(false);
  }

  if (!membros) return <p className="muted">Carregando viajantes…</p>;

  return (
    <div className="bloco">
      <div className="cabecalho">
        <h3>Viajantes</h3>
        <p className="muted">{membros.length} nesta viagem</p>
      </div>

      <p className="muted">
        É esta lista que faz a viagem aparecer no app. Quem está aqui vê o roteiro, os documentos e
        o QR desta viagem — quem não está, não vê nada.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      {membros.length === 0 ? (
        <p className="aviso">
          Nenhum viajante ainda. Enquanto esta lista estiver vazia, a viagem não existe para ninguém
          no app.
        </p>
      ) : (
        <ul className="checks">
          {membros.map((m) => (
            <li key={m.userId}>
              <span>
                <strong>{m.nome}</strong> <span className="mono muted">{m.flyId}</span>
              </span>
              <button
                type="button"
                className="botao botao--fantasma"
                onClick={() => void remover(m.userId, m.nome)}
                disabled={salvando}
              >
                Tirar
              </button>
            </li>
          ))}
        </ul>
      )}

      {candidatos.length > 0 ? (
        <div className="form form--linha">
          <label className="field">
            <span className="muted">Adicionar viajante</span>
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {c.flyId}
                </option>
              ))}
            </select>
          </label>
          <div className="acoes">
            <button
              type="button"
              className="botao"
              onClick={() => void adicionar()}
              disabled={salvando || !escolhido}
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Todos os clientes cadastrados já estão nesta viagem.</p>
      )}
    </div>
  );
}
