import { useCallback, useEffect, useState } from 'react';
import type { FlyRole } from '@fly/domain-types';
import { supabase } from '../auth/client';

/**
 * Convites (§16.2 e §37.9).
 *
 * O token aparece **uma única vez**, logo depois de criar. Não há como
 * recuperá-lo depois: o banco guarda só o hash. Se o operador perder o link,
 * gera outro convite — um token recuperável é um token que vaza.
 */

interface Convite {
  id: string;
  email: string | null;
  papel: FlyRole;
  criadoEm: string;
  expiraEm: string;
  aceitoEm: string | null;
  revogadoEm: string | null;
}

type Situacao = 'pendente' | 'aceito' | 'revogado' | 'expirado';

function situacaoDe(c: Convite): Situacao {
  if (c.aceitoEm) return 'aceito';
  if (c.revogadoEm) return 'revogado';
  if (new Date(c.expiraEm) < new Date()) return 'expirado';
  return 'pendente';
}

const ROTULO: Record<Situacao, string> = {
  pendente: 'Pendente',
  aceito: 'Aceito',
  revogado: 'Revogado',
  expirado: 'Expirado',
};

const PAPEIS: FlyRole[] = ['customer', 'creator', 'guide', 'base', 'support', 'trip_manager'];

export function Convites() {
  const [convites, setConvites] = useState<Convite[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<FlyRole>('customer');
  const [criando, setCriando] = useState(false);
  const [linkNovo, setLinkNovo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('invitations')
      .select('id, email, role, created_at, expires_at, accepted_at, revoked_at')
      .order('created_at', { ascending: false });

    if (error) return setErro(error.message);
    setConvites(
      (data ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        papel: i.role,
        criadoEm: i.created_at,
        expiraEm: i.expires_at,
        aceitoEm: i.accepted_at,
        revogadoEm: i.revoked_at,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    setErro(null);
    setLinkNovo(null);

    const { data, error } = await supabase().rpc('create_invitation', {
      p_email: email.trim().toLowerCase(),
      p_role: papel,
      p_valid_days: 7,
    });

    if (error) {
      setErro(error.message);
    } else {
      const linha = Array.isArray(data) ? data[0] : data;
      if (linha?.token) setLinkNovo(`fly://convite?token=${linha.token}`);
      setEmail('');
      await carregar();
    }
    setCriando(false);
  }

  async function revogar(id: string) {
    const { error } = await supabase().rpc('revoke_invitation', { p_id: id });
    if (error) setErro(error.message);
    else await carregar();
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Convites</p>
          <h1>Quem entra na Fly</h1>
        </div>
      </div>

      <form onSubmit={(e) => void criar(e)} className="form form--linha">
        <label className="field">
          <span className="muted">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@exemplo.com"
            required
          />
        </label>

        <label className="field">
          <span className="muted">Papel</span>
          <select value={papel} onChange={(e) => setPapel(e.target.value as FlyRole)}>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={criando} className="botao">
          {criando ? 'Criando…' : 'Convidar'}
        </button>
      </form>

      {linkNovo ? (
        <div className="destaque" role="status">
          <p className="kicker">Link do convite</p>
          <p className="muted">
            Copie agora. Ele não aparece de novo — o banco guarda apenas o hash.
          </p>
          <code className="link-convite">{linkNovo}</code>
          <button
            type="button"
            className="botao botao--fantasma"
            onClick={() => void navigator.clipboard?.writeText(linkNovo)}
          >
            Copiar
          </button>
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      {!convites ? (
        <p className="muted">Carregando…</p>
      ) : convites.length === 0 ? (
        <p className="muted">Nenhum convite ainda.</p>
      ) : (
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Situação</th>
                <th>Expira</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {convites.map((c) => {
                const s = situacaoDe(c);
                return (
                  <tr key={c.id}>
                    <td>{c.email}</td>
                    <td className="mono">{c.papel}</td>
                    <td>
                      <span className={`selo selo--${s}`}>{ROTULO[s]}</span>
                    </td>
                    <td className="muted">{new Date(c.expiraEm).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {s === 'pendente' ? (
                        <button
                          type="button"
                          className="botao botao--fantasma"
                          onClick={() => void revogar(c.id)}
                        >
                          Revogar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
