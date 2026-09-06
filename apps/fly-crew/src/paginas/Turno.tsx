import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Turno: escala, passagem e entrega de brinde (§46, entregas 7 e 8).
 *
 * A passagem de turno acontece **no campo**, e não numa mesa. Quem termina o
 * plantão está num lobby de hotel com o celular na mão, e é ali que precisa
 * escrever o que ficou aberto — no Fly Ops isso chegaria depois de alguém
 * transcrever, que é o mesmo que não chegar.
 *
 * A entrega de brinde está aqui pela mesma razão: quem entrega o press kit é
 * quem está com a caixa. Registrar depois, de memória, é o começo de um
 * estoque que não bate.
 *
 * **Assumir é um ato.** Uma passagem sem `accepted_at` é pendência, e a tela
 * mostra isso em primeiro lugar: o turno que ninguém pegou é a informação mais
 * urgente desta página.
 */

interface Passagem {
  id: string;
  de: string;
  resumo: string;
  pendencias: string | null;
  quando: string;
  viagem: string | null;
  aceitaEm: string | null;
  aceitaPor: string | null;
}

interface Turno {
  id: string;
  papel: string;
  inicio: string;
  fim: string;
  viagem: string | null;
  nota: string | null;
  meu: boolean;
  pessoa: string;
}

interface Item {
  id: string;
  nome: string;
  tipo: string;
  saldo: number;
}

interface Viajante {
  id: string;
  nome: string;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Turno() {
  const [euId, setEuId] = useState<string | null>(null);
  const [passagens, setPassagens] = useState<Passagem[] | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [viajantes, setViajantes] = useState<Viajante[]>([]);
  const [viagens, setViagens] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [nova, setNova] = useState({ viagem: '', resumo: '', pendencias: '' });
  const [entrega, setEntrega] = useState({ item: '', pessoa: '', quantidade: '1' });

  const carregar = useCallback(async () => {
    const db = supabase();

    const [{ data: sessao }, atribRes, passRes, turnoRes, itemRes] = await Promise.all([
      db.auth.getUser(),
      db.from('staff_assignments').select('trip_id').is('revoked_at', null),
      db
        .from('shift_handoffs')
        .select('id, from_user, summary, open_items, created_at, trip_id, accepted_at, accepted_by')
        .order('created_at', { ascending: false })
        .limit(30),
      db
        .from('staff_shifts')
        .select('id, user_id, role, starts_at, ends_at, trip_id, notes')
        .gte('ends_at', new Date(Date.now() - 3600000).toISOString())
        .order('starts_at')
        .limit(40),
      db.from('inventory_balance').select('item_id, name, kind, saldo, is_active').limit(100),
    ]);

    if (passRes.error) return setErro(passRes.error.message);

    const eu = sessao.user?.id ?? null;
    setEuId(eu);

    const minhasViagens = [...new Set((atribRes.data ?? []).map((a) => a.trip_id))];
    const { data: viagensData } = await db
      .from('trips')
      .select('id, name')
      .in(
        'id',
        minhasViagens.length > 0 ? minhasViagens : ['00000000-0000-0000-0000-000000000000'],
      );
    const nomeDaViagem = new Map((viagensData ?? []).map((t) => [t.id, t.name]));
    setViagens((viagensData ?? []).map((t) => ({ id: t.id, nome: t.name })));

    const idsPessoa = [
      ...new Set([
        ...(passRes.data ?? []).map((h) => h.from_user),
        ...(passRes.data ?? []).map((h) => h.accepted_by),
        ...(turnoRes.data ?? []).map((t) => t.user_id),
      ]),
    ].filter((v): v is string => v !== null);

    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', idsPessoa.length > 0 ? idsPessoa : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );

    // Quem pode receber brinde: quem está nas minhas viagens.
    const { data: membros } = await db
      .from('trip_members')
      .select('user_id')
      .in(
        'trip_id',
        minhasViagens.length > 0 ? minhasViagens : ['00000000-0000-0000-0000-000000000000'],
      );
    const idsViajante = [...new Set((membros ?? []).map((m) => m.user_id))];
    const { data: perfisViajantes } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', idsViajante.length > 0 ? idsViajante : ['00000000-0000-0000-0000-000000000000']);
    setViajantes(
      (perfisViajantes ?? []).map((p) => ({
        id: p.id,
        nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
      })),
    );

    setPassagens(
      (passRes.data ?? []).map((h) => ({
        id: h.id,
        de: nomeDe.get(h.from_user) ?? 'Sem nome',
        resumo: h.summary,
        pendencias: h.open_items,
        quando: h.created_at,
        viagem: h.trip_id ? (nomeDaViagem.get(h.trip_id) ?? null) : null,
        aceitaEm: h.accepted_at,
        aceitaPor: h.accepted_by ? (nomeDe.get(h.accepted_by) ?? null) : null,
      })),
    );
    setTurnos(
      (turnoRes.data ?? []).map((t) => ({
        id: t.id,
        papel: t.role,
        inicio: t.starts_at,
        fim: t.ends_at,
        viagem: t.trip_id ? (nomeDaViagem.get(t.trip_id) ?? null) : null,
        nota: t.notes,
        meu: t.user_id === eu,
        pessoa: nomeDe.get(t.user_id) ?? 'Sem nome',
      })),
    );
    setItens(
      (itemRes.data ?? [])
        .filter((i) => i.item_id !== null && i.is_active)
        .map((i) => ({
          id: i.item_id as string,
          nome: i.name ?? '—',
          tipo: i.kind ?? 'gift',
          saldo: i.saldo ?? 0,
        })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const passar = useCallback(async () => {
    if (!euId) return setErro('Sessão perdida.');
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('shift_handoffs')
      .insert({
        trip_id: nova.viagem || null,
        from_user: euId,
        summary: nova.resumo.trim(),
        open_items: nova.pendencias.trim() || null,
      });
    setOcupado(false);
    if (error) return setErro(error.message);
    setNova({ viagem: '', resumo: '', pendencias: '' });
    setRecado('Passagem registrada. Ela fica pendente até alguém assumir.');
    await carregar();
  }, [euId, nova, carregar]);

  const assumir = useCallback(
    async (id: string) => {
      setOcupado(true);
      setErro(null);
      setRecado(null);
      const { data, error } = await supabase().rpc('aceitar_passagem', { p_handoff: id });
      setOcupado(false);
      if (error) return setErro(error.message);
      const linha = data?.[0];
      if (!linha?.ok) return setErro(linha?.motivo ?? 'Não deu.');
      setRecado('Turno assumido.');
      await carregar();
    },
    [carregar],
  );

  const registrarEntrega = useCallback(async () => {
    const quantidade = Number(entrega.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1) return setErro('Quantidade inválida.');
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { data, error } = await supabase().rpc('movimentar_estoque', {
      p_item: entrega.item,
      p_delta: -quantidade,
      p_reason: 'entrega',
      ...(entrega.pessoa ? { p_recipient: entrega.pessoa } : {}),
    });
    setOcupado(false);
    if (error) return setErro(error.message);
    const linha = data?.[0];
    if (!linha?.ok) return setErro(linha?.motivo ?? 'Não deu.');
    setEntrega({ item: '', pessoa: '', quantidade: '1' });
    setRecado(`Entregue. Restam ${linha.saldo}.`);
    await carregar();
  }, [entrega, carregar]);

  if (erro && !passagens)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!passagens) return <p className="muted">Carregando…</p>;

  const pendentes = passagens.filter((p) => p.aceitaEm === null);
  const meuTurno = turnos.find(
    (t) => t.meu && new Date(t.inicio) <= new Date() && new Date(t.fim) >= new Date(),
  );

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Turno</p>
          <h1>
            {meuTurno ? `Você está de plantão até ${hora(meuTurno.fim)}` : 'Sem turno aberto'}
          </h1>
          {meuTurno?.nota ? <p className="muted">{meuTurno.nota}</p> : null}
        </div>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      {pendentes.length > 0 ? (
        <section className="secao">
          <h2>Ninguém assumiu</h2>
          {pendentes.map((p) => (
            <article key={p.id} className="bloco">
              <p className="kicker">
                {p.viagem ?? 'Plataforma'} · {hora(p.quando)} · {p.de}
              </p>
              <p>{p.resumo}</p>
              {p.pendencias ? (
                <p className="pendente">
                  <strong>Aberto:</strong> {p.pendencias}
                </p>
              ) : null}
              <button
                type="button"
                className="botao"
                disabled={ocupado}
                onClick={() => void assumir(p.id)}
              >
                Assumir
              </button>
            </article>
          ))}
        </section>
      ) : (
        <p className="muted">Nenhuma passagem esperando alguém.</p>
      )}

      <section className="secao">
        <h2>Passar o turno</h2>
        <div className="form">
          <label className="field">
            <span>Viagem</span>
            <select
              value={nova.viagem}
              onChange={(e) => setNova({ ...nova, viagem: e.target.value })}
            >
              <option value="">Sem viagem</option>
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
              value={nova.resumo}
              onChange={(e) => setNova({ ...nova, resumo: e.target.value })}
            />
          </label>
          <label className="field">
            <span>O que ficou aberto</span>
            <textarea
              rows={2}
              value={nova.pendencias}
              onChange={(e) => setNova({ ...nova, pendencias: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !nova.resumo.trim()}
            onClick={() => void passar()}
          >
            Passar
          </button>
        </div>
      </section>

      <section className="secao">
        <h2>Entregar brinde ou kit</h2>
        <p className="muted">
          Registre na hora. Anotar depois, de memória, é o começo de um estoque que não bate — e a
          conta só aparece na contagem física, depois da viagem.
        </p>
        <div className="form">
          <label className="field">
            <span>Item</span>
            <select
              value={entrega.item}
              onChange={(e) => setEntrega({ ...entrega, item: e.target.value })}
            >
              <option value="">Escolha</option>
              {itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} ({i.saldo})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Para quem</span>
            <select
              value={entrega.pessoa}
              onChange={(e) => setEntrega({ ...entrega, pessoa: e.target.value })}
            >
              <option value="">Sem destinatário</option>
              {viajantes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quantidade</span>
            <input
              type="number"
              min={1}
              value={entrega.quantidade}
              onChange={(e) => setEntrega({ ...entrega, quantidade: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !entrega.item}
            onClick={() => void registrarEntrega()}
          >
            Registrar entrega
          </button>
        </div>
        {itens.length === 0 ? (
          <p className="muted">Nenhum item de estoque cadastrado ainda.</p>
        ) : null}
      </section>

      <section className="secao">
        <h2>Escala</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Papel</th>
                <th>De</th>
                <th>Até</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.pessoa}
                    {t.meu ? <span className="selo selo--ok">você</span> : null}
                  </td>
                  <td>{t.papel}</td>
                  <td className="mono">{hora(t.inicio)}</td>
                  <td className="mono">{hora(t.fim)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {turnos.length === 0 ? <p className="muted">Nenhum turno montado.</p> : null}
      </section>
    </>
  );
}
