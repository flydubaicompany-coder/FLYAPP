import { useCallback, useEffect, useState } from 'react';
import type { FlyRole } from '@fly/domain-types';
import { supabase } from '../auth/client';
import { useSessao } from '../auth/sessao';

/**
 * Equipe: papéis, atribuições, escala e passagem de turno (§46, entregas 5 e 8).
 *
 * Até esta fase, dar acesso a alguém da equipe era um `insert` no banco. A
 * auditoria de paridade registrou isso como lacuna de prioridade A: o critério
 * da §46 é "nenhuma mudança comum exige editar código", e nenhuma mudança é
 * mais comum do que a chegada de um guia novo.
 *
 * As três coisas desta tela são diferentes, e a tela as separa de propósito:
 *
 *   • **papel** diz o que a pessoa pode fazer;
 *   • **atribuição** diz em que viagem;
 *   • **turno** diz em que horas.
 *
 * Quem confunde as duas primeiras acaba com um guia que enxerga todas as
 * viagens. Foi o bug corrigido na auditoria das Fases 0-3, e ele custou uma
 * política de RLS escrita ao contrário.
 *
 * Toda escrita aqui passa por RPC, e cada RPC grava a trilha. O painel não
 * escreve em `user_roles` nem em `app_config` direto — não tem permissão para
 * isso, e é assim de propósito.
 */

const PAPEIS_DE_EQUIPE: FlyRole[] = [
  'guide',
  'base',
  'media',
  'experience',
  'support',
  'finance',
  'trip_manager',
  'creator',
  'admin',
];

const ROTULO_PAPEL: Record<string, string> = {
  customer: 'Cliente',
  family_lead: 'Responsável de família',
  creator: 'Criador',
  guide: 'Guia',
  base: 'Base Fly',
  media: 'Mídia',
  experience: 'Experiência',
  support: 'Suporte',
  finance: 'Financeiro',
  trip_manager: 'Gerente de viagem',
  admin: 'Administração',
};

interface Pessoa {
  id: string;
  nome: string;
  publicId: string | null;
  papeis: FlyRole[];
}

interface Atribuicao {
  id: string;
  userId: string;
  pessoa: string;
  tripId: string;
  viagem: string;
  papel: string;
  revogadaEm: string | null;
}

interface Turno {
  id: string;
  pessoa: string;
  papel: string;
  viagem: string | null;
  inicio: string;
  fim: string;
  nota: string | null;
}

interface Passagem {
  id: string;
  de: string;
  para: string | null;
  viagem: string | null;
  resumo: string;
  pendencias: string | null;
  criadaEm: string;
  aceitaEm: string | null;
  aceitaPor: string | null;
}

interface Viagem {
  id: string;
  nome: string;
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `datetime-local` devolve hora local sem fuso; o banco quer ISO. */
function paraIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function Equipe() {
  const { estado } = useSessao();
  const ehAdmin = estado.tipo === 'logado' && estado.papeis.includes('admin');

  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [passagens, setPassagens] = useState<Passagem[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [novoPapel, setNovoPapel] = useState<{ pessoa: string; papel: FlyRole }>({
    pessoa: '',
    papel: 'guide',
  });
  const [novaAtribuicao, setNovaAtribuicao] = useState({ pessoa: '', viagem: '', papel: 'guide' });
  const [novoTurno, setNovoTurno] = useState({
    pessoa: '',
    viagem: '',
    papel: 'guide',
    inicio: '',
    fim: '',
    nota: '',
  });
  const [novaPassagem, setNovaPassagem] = useState({ viagem: '', resumo: '', pendencias: '' });

  const carregar = useCallback(async () => {
    const db = supabase();

    const [perfisRes, papeisRes, atribRes, turnosRes, passRes, viagensRes] = await Promise.all([
      db.from('profiles').select('id, public_id, preferred_name, display_name').limit(500),
      db.from('user_roles').select('user_id, role'),
      db
        .from('staff_assignments')
        .select('id, user_id, trip_id, role, revoked_at')
        .order('assigned_at', { ascending: false })
        .limit(200),
      db
        .from('staff_shifts')
        .select('id, user_id, trip_id, role, starts_at, ends_at, notes')
        .gte('ends_at', new Date(Date.now() - 86400000).toISOString())
        .order('starts_at')
        .limit(100),
      db
        .from('shift_handoffs')
        .select(
          'id, trip_id, from_user, to_user, summary, open_items, created_at, accepted_at, accepted_by',
        )
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('trips').select('id, name').order('starts_on', { ascending: false }).limit(100),
    ]);

    if (perfisRes.error) return setErro(perfisRes.error.message);
    if (papeisRes.error) return setErro(papeisRes.error.message);

    const nomeDe = new Map(
      (perfisRes.data ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );
    const nomeDaViagem = new Map((viagensRes.data ?? []).map((t) => [t.id, t.name]));

    const porPessoa = new Map<string, FlyRole[]>();
    for (const linha of papeisRes.data ?? []) {
      porPessoa.set(linha.user_id, [...(porPessoa.get(linha.user_id) ?? []), linha.role]);
    }

    setViagens((viagensRes.data ?? []).map((t) => ({ id: t.id, nome: t.name })));
    setPessoas(
      (perfisRes.data ?? [])
        .map((p) => ({
          id: p.id,
          nome: nomeDe.get(p.id) ?? 'Sem nome',
          publicId: p.public_id,
          papeis: porPessoa.get(p.id) ?? [],
        }))
        // Quem tem papel de equipe primeiro: é quem esta tela administra.
        .sort((a, b) => {
          const ea = a.papeis.some((r) => PAPEIS_DE_EQUIPE.includes(r)) ? 0 : 1;
          const eb = b.papeis.some((r) => PAPEIS_DE_EQUIPE.includes(r)) ? 0 : 1;
          return ea - eb || a.nome.localeCompare(b.nome);
        }),
    );
    setAtribuicoes(
      (atribRes.data ?? []).map((a) => ({
        id: a.id,
        userId: a.user_id,
        pessoa: nomeDe.get(a.user_id) ?? 'Sem nome',
        tripId: a.trip_id,
        viagem: nomeDaViagem.get(a.trip_id) ?? 'Viagem removida',
        papel: a.role,
        revogadaEm: a.revoked_at,
      })),
    );
    setTurnos(
      (turnosRes.data ?? []).map((t) => ({
        id: t.id,
        pessoa: nomeDe.get(t.user_id) ?? 'Sem nome',
        papel: t.role,
        viagem: t.trip_id ? (nomeDaViagem.get(t.trip_id) ?? null) : null,
        inicio: t.starts_at,
        fim: t.ends_at,
        nota: t.notes,
      })),
    );
    setPassagens(
      (passRes.data ?? []).map((h) => ({
        id: h.id,
        de: nomeDe.get(h.from_user) ?? 'Sem nome',
        para: h.to_user ? (nomeDe.get(h.to_user) ?? null) : null,
        viagem: h.trip_id ? (nomeDaViagem.get(h.trip_id) ?? null) : null,
        resumo: h.summary,
        pendencias: h.open_items,
        criadaEm: h.created_at,
        aceitaEm: h.accepted_at,
        aceitaPor: h.accepted_by ? (nomeDe.get(h.accepted_by) ?? null) : null,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Toda RPC desta tela devolve `ok` e `motivo`. Um caminho só para as três. */
  const chamar = useCallback(
    async (executar: () => Promise<{ ok: boolean; motivo: string | null } | string>) => {
      setOcupado(true);
      setRecado(null);
      setErro(null);
      const r = await executar();
      setOcupado(false);
      if (typeof r === 'string') return setErro(r);
      setRecado(r.ok ? (r.motivo ?? 'Feito.') : (r.motivo ?? 'Não deu.'));
      if (r.ok) await carregar();
    },
    [carregar],
  );

  const conceder = () =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('conceder_papel', {
        p_user: novoPapel.pessoa,
        p_role: novoPapel.papel,
      });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const revogar = (pessoa: string, papel: FlyRole) =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('revogar_papel', {
        p_user: pessoa,
        p_role: papel,
      });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const atribuir = () =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('atribuir_a_viagem', {
        p_user: novaAtribuicao.pessoa,
        p_trip: novaAtribuicao.viagem,
        p_role: novaAtribuicao.papel as FlyRole,
      });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const revogarAtribuicao = (id: string) =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('revogar_atribuicao', { p_assignment: id });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const criarTurno = () =>
    void chamar(async () => {
      const inicio = paraIso(novoTurno.inicio);
      const fim = paraIso(novoTurno.fim);
      if (!inicio || !fim) return 'Turno precisa de início e fim.';
      const { error } = await supabase()
        .from('staff_shifts')
        .insert({
          user_id: novoTurno.pessoa,
          trip_id: novoTurno.viagem || null,
          role: novoTurno.papel as FlyRole,
          starts_at: inicio,
          ends_at: fim,
          notes: novoTurno.nota.trim() || null,
        });
      if (error) return error.message;
      return { ok: true, motivo: 'Turno na escala.' };
    });

  const passarTurno = () =>
    void chamar(async () => {
      if (estado.tipo !== 'logado') return 'Sessão perdida.';
      if (!novaPassagem.resumo.trim()) return 'Escreva o que aconteceu no turno.';
      const { error } = await supabase()
        .from('shift_handoffs')
        .insert({
          trip_id: novaPassagem.viagem || null,
          from_user: estado.sessao.user.id,
          summary: novaPassagem.resumo.trim(),
          open_items: novaPassagem.pendencias.trim() || null,
        });
      if (error) return error.message;
      setNovaPassagem({ viagem: '', resumo: '', pendencias: '' });
      return { ok: true, motivo: 'Passagem registrada.' };
    });

  const assumir = (id: string) =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('aceitar_passagem', { p_handoff: id });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  if (erro && !pessoas)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!pessoas) return <p className="muted">Carregando…</p>;

  const daEquipe = pessoas.filter((p) => p.papeis.some((r) => PAPEIS_DE_EQUIPE.includes(r)));

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Equipe</p>
          <h1>Papéis, viagens e escala</h1>
          <p className="muted">
            Papel diz o que a pessoa faz. Atribuição diz em que viagem. Turno diz em que horas. São
            três coisas, e trocar uma pela outra abre viagem alheia para quem não deveria vê-la.
          </p>
        </div>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      {/* --------------------------------------------------------------- */}
      <section className="secao">
        <h2>Papéis</h2>
        {!ehAdmin ? (
          <p className="muted">
            Conceder e revogar papel é da administração. Você está vendo a lista, e o servidor
            recusaria a mudança de qualquer forma.
          </p>
        ) : (
          <div className="form form--linha">
            <label className="field">
              <span>Pessoa</span>
              <select
                value={novoPapel.pessoa}
                onChange={(e) => setNovoPapel({ ...novoPapel, pessoa: e.target.value })}
              >
                <option value="">Escolha</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                    {p.publicId ? ` · ${p.publicId}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Papel</span>
              <select
                value={novoPapel.papel}
                onChange={(e) => setNovoPapel({ ...novoPapel, papel: e.target.value as FlyRole })}
              >
                {PAPEIS_DE_EQUIPE.map((r) => (
                  <option key={r} value={r}>
                    {ROTULO_PAPEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novoPapel.pessoa}
              onClick={conceder}
            >
              Conceder
            </button>
          </div>
        )}

        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Fly ID</th>
                <th>Papéis</th>
                {ehAdmin ? <th>Revogar</th> : null}
              </tr>
            </thead>
            <tbody>
              {daEquipe.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td className="mono muted">{p.publicId ?? '—'}</td>
                  <td>{p.papeis.map((r) => ROTULO_PAPEL[r] ?? r).join(', ')}</td>
                  {ehAdmin ? (
                    <td className="acoes">
                      {p.papeis
                        .filter((r) => PAPEIS_DE_EQUIPE.includes(r))
                        .map((r) => (
                          <button
                            key={r}
                            type="button"
                            className="botao botao--fantasma"
                            disabled={ocupado}
                            onClick={() => revogar(p.id, r)}
                          >
                            {ROTULO_PAPEL[r]}
                          </button>
                        ))}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {daEquipe.length === 0 ? <p className="muted">Ninguém com papel de equipe ainda.</p> : null}
      </section>

      {/* --------------------------------------------------------------- */}
      <section className="secao">
        <h2>Atribuições</h2>
        <p className="muted">
          Atribuir não concede papel: são controles diferentes. Alguém dentro da viagem sem papel
          nenhum não conseguiria fazer nada, e o servidor recusa antes de criar esse estado.
        </p>
        <div className="form form--linha">
          <label className="field">
            <span>Pessoa</span>
            <select
              value={novaAtribuicao.pessoa}
              onChange={(e) => setNovaAtribuicao({ ...novaAtribuicao, pessoa: e.target.value })}
            >
              <option value="">Escolha</option>
              {daEquipe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Viagem</span>
            <select
              value={novaAtribuicao.viagem}
              onChange={(e) => setNovaAtribuicao({ ...novaAtribuicao, viagem: e.target.value })}
            >
              <option value="">Escolha</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Papel</span>
            <select
              value={novaAtribuicao.papel}
              onChange={(e) => setNovaAtribuicao({ ...novaAtribuicao, papel: e.target.value })}
            >
              {PAPEIS_DE_EQUIPE.map((r) => (
                <option key={r} value={r}>
                  {ROTULO_PAPEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !novaAtribuicao.pessoa || !novaAtribuicao.viagem}
            onClick={atribuir}
          >
            Atribuir
          </button>
        </div>

        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Viagem</th>
                <th>Papel</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {atribuicoes.map((a) => (
                <tr key={a.id}>
                  <td>{a.pessoa}</td>
                  <td>{a.viagem}</td>
                  <td>{ROTULO_PAPEL[a.papel] ?? a.papel}</td>
                  <td>
                    {a.revogadaEm ? (
                      <span className="selo selo--revogado">Revogada</span>
                    ) : (
                      <span className="selo selo--ok">Ativa</span>
                    )}
                  </td>
                  <td>
                    {a.revogadaEm ? null : (
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado}
                        onClick={() => revogarAtribuicao(a.id)}
                      >
                        Revogar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------------- */}
      <section className="secao">
        <h2>Escala</h2>
        <div className="form form--linha">
          <label className="field">
            <span>Pessoa</span>
            <select
              value={novoTurno.pessoa}
              onChange={(e) => setNovoTurno({ ...novoTurno, pessoa: e.target.value })}
            >
              <option value="">Escolha</option>
              {daEquipe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Viagem</span>
            <select
              value={novoTurno.viagem}
              onChange={(e) => setNovoTurno({ ...novoTurno, viagem: e.target.value })}
            >
              <option value="">Plataforma (sem viagem)</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Papel</span>
            <select
              value={novoTurno.papel}
              onChange={(e) => setNovoTurno({ ...novoTurno, papel: e.target.value })}
            >
              {PAPEIS_DE_EQUIPE.map((r) => (
                <option key={r} value={r}>
                  {ROTULO_PAPEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Início</span>
            <input
              type="datetime-local"
              value={novoTurno.inicio}
              onChange={(e) => setNovoTurno({ ...novoTurno, inicio: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Fim</span>
            <input
              type="datetime-local"
              value={novoTurno.fim}
              onChange={(e) => setNovoTurno({ ...novoTurno, fim: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !novoTurno.pessoa}
            onClick={criarTurno}
          >
            Escalar
          </button>
        </div>

        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Papel</th>
                <th>Viagem</th>
                <th>De</th>
                <th>Até</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td>{t.pessoa}</td>
                  <td>{ROTULO_PAPEL[t.papel] ?? t.papel}</td>
                  <td className="muted">{t.viagem ?? 'Plataforma'}</td>
                  <td className="mono">{quando(t.inicio)}</td>
                  <td className="mono">{quando(t.fim)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {turnos.length === 0 ? <p className="muted">Nenhum turno nas próximas horas.</p> : null}
      </section>

      {/* --------------------------------------------------------------- */}
      <section className="secao">
        <h2>Passagem de turno</h2>
        <p className="muted">
          Assumir é um ato, e não uma suposição: a passagem fica pendente até alguém dizer que leu.
          Quem assumir de fato é quem fica registrado, mesmo que outra pessoa tenha sido nomeada.
        </p>
        <div className="form">
          <label className="field">
            <span>Viagem</span>
            <select
              value={novaPassagem.viagem}
              onChange={(e) => setNovaPassagem({ ...novaPassagem, viagem: e.target.value })}
            >
              <option value="">Plataforma (sem viagem)</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>O que aconteceu</span>
            <textarea
              rows={3}
              value={novaPassagem.resumo}
              onChange={(e) => setNovaPassagem({ ...novaPassagem, resumo: e.target.value })}
            />
          </label>
          <label className="field">
            <span>O que ficou aberto</span>
            <textarea
              rows={2}
              value={novaPassagem.pendencias}
              onChange={(e) => setNovaPassagem({ ...novaPassagem, pendencias: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !novaPassagem.resumo.trim()}
            onClick={passarTurno}
          >
            Passar o turno
          </button>
        </div>

        {passagens.map((h) => (
          <article key={h.id} className="bloco">
            <p className="kicker">
              {h.viagem ?? 'Plataforma'} · {quando(h.criadaEm)}
            </p>
            <p>
              <strong>{h.de}</strong>
              {h.para ? ` → ${h.para}` : ' → quem assumir'}
            </p>
            <p>{h.resumo}</p>
            {h.pendencias ? (
              <p className="pendente">
                <strong>Aberto:</strong> {h.pendencias}
              </p>
            ) : null}
            {h.aceitaEm ? (
              <p className="muted">
                Assumida por {h.aceitaPor ?? 'alguém'} em {quando(h.aceitaEm)}.
              </p>
            ) : (
              <button
                type="button"
                className="botao"
                disabled={ocupado}
                onClick={() => assumir(h.id)}
              >
                Assumir
              </button>
            )}
          </article>
        ))}
        {passagens.length === 0 ? <p className="muted">Nenhuma passagem registrada.</p> : null}
      </section>
    </>
  );
}
