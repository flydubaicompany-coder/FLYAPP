import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Press kits, brindes e recompensas (§46, entrega 7).
 *
 * Os três nomes são os da §46, e não há um quarto. "Material" genérico viraria
 * depósito de tudo, e o relatório de entrega perderia o sentido.
 *
 * **O saldo não é uma coluna.** É a soma de um ledger append-only, como o de
 * pontos e o da carteira. Uma coluna `quantidade` que alguém edita seria dois
 * números para a mesma verdade, e no dia em que discordassem ninguém saberia
 * qual vale.
 *
 * Entregar mais do que existe é recusado no servidor. O `ajuste` é a exceção
 * deliberada: contagem física que achou menos tem que poder registrar o que
 * achou — senão a operação corrige por fora, e o sistema para de valer.
 */

type Tipo = 'press_kit' | 'gift' | 'reward';
type Motivo = 'entrada' | 'entrega' | 'perda' | 'devolucao' | 'ajuste';

const ROTULO_TIPO: Record<Tipo, string> = {
  press_kit: 'Press kit',
  gift: 'Brinde',
  reward: 'Recompensa',
};

const ROTULO_MOTIVO: Record<Motivo, string> = {
  entrada: 'Entrada',
  entrega: 'Entrega',
  perda: 'Perda',
  devolucao: 'Devolução',
  ajuste: 'Ajuste de contagem',
};

interface Item {
  id: string;
  tipo: Tipo;
  nome: string;
  viagem: string | null;
  saldo: number;
  entregues: number;
  minimo: number | null;
  ativo: boolean;
  ultimo: string | null;
}

interface Movimento {
  id: string;
  item: string;
  delta: number;
  motivo: Motivo;
  paraQuem: string | null;
  nota: string | null;
  quando: string;
}

interface Viagem {
  id: string;
  nome: string;
}

export function Inventario() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [novo, setNovo] = useState({
    tipo: 'press_kit' as Tipo,
    nome: '',
    viagem: '',
    minimo: '',
  });
  const [mover, setMover] = useState({
    item: '',
    quantidade: '',
    motivo: 'entrada' as Motivo,
    pessoa: '',
    nota: '',
  });

  const carregar = useCallback(async () => {
    const db = supabase();
    const [saldoRes, movRes, viagemRes, itemRes] = await Promise.all([
      db
        .from('inventory_balance')
        .select(
          'item_id, kind, name, trip_id, low_stock_at, is_active, saldo, entregues, ultimo_movimento',
        )
        .limit(200),
      db
        .from('inventory_movements')
        .select('id, item_id, delta, reason, recipient_id, note, occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(100),
      db.from('trips').select('id, name').order('starts_on', { ascending: false }).limit(100),
      db.from('inventory_items').select('id, name').limit(200),
    ]);

    if (saldoRes.error) return setErro(saldoRes.error.message);

    const nomeDaViagem = new Map((viagemRes.data ?? []).map((t) => [t.id, t.name]));
    const nomeDoItem = new Map((itemRes.data ?? []).map((i) => [i.id, i.name]));

    const idsPessoa = [
      ...new Set((movRes.data ?? []).map((m) => m.recipient_id).filter((v): v is string => !!v)),
    ];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', idsPessoa.length > 0 ? idsPessoa : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );

    // Para o campo "para quem": a lista de quem participa de alguma viagem.
    const { data: todos } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .limit(300);
    setPessoas(
      (todos ?? []).map((p) => ({
        id: p.id,
        nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
      })),
    );

    setViagens((viagemRes.data ?? []).map((t) => ({ id: t.id, nome: t.name })));
    setItens(
      (saldoRes.data ?? [])
        .filter((i) => i.item_id !== null)
        .map((i) => ({
          id: i.item_id as string,
          tipo: (i.kind ?? 'gift') as Tipo,
          nome: i.name ?? '—',
          viagem: i.trip_id ? (nomeDaViagem.get(i.trip_id) ?? null) : null,
          saldo: i.saldo ?? 0,
          entregues: i.entregues ?? 0,
          minimo: i.low_stock_at,
          ativo: i.is_active ?? true,
          ultimo: i.ultimo_movimento,
        }))
        .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome)),
    );
    setMovimentos(
      (movRes.data ?? []).map((m) => ({
        id: m.id,
        item: nomeDoItem.get(m.item_id) ?? '—',
        delta: m.delta,
        motivo: m.reason as Motivo,
        paraQuem: m.recipient_id ? (nomeDe.get(m.recipient_id) ?? 'Conta removida') : null,
        nota: m.note,
        quando: m.occurred_at,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = useCallback(async () => {
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('inventory_items')
      .insert({
        kind: novo.tipo,
        name: novo.nome.trim(),
        trip_id: novo.viagem || null,
        low_stock_at: novo.minimo === '' ? null : Number(novo.minimo),
      });
    setOcupado(false);
    if (error) return setErro(error.message);
    setNovo({ tipo: 'press_kit', nome: '', viagem: '', minimo: '' });
    setRecado('Item criado. O saldo começa em zero até alguém registrar a entrada.');
    await carregar();
  }, [novo, carregar]);

  const registrar = useCallback(async () => {
    setOcupado(true);
    setErro(null);
    setRecado(null);

    const quantidade = Number(mover.quantidade);
    if (!Number.isInteger(quantidade) || quantidade === 0) {
      setOcupado(false);
      return setErro('Quantidade precisa ser um número inteiro diferente de zero.');
    }

    // O sinal vem do motivo, e não da pessoa. Entrega é saída, sempre — deixar
    // o sinal à mão faria uma entrega positiva virar reposição silenciosa.
    const sai = mover.motivo === 'entrega' || mover.motivo === 'perda';
    const delta =
      mover.motivo === 'ajuste' ? quantidade : sai ? -Math.abs(quantidade) : Math.abs(quantidade);

    const { data, error } = await supabase().rpc('movimentar_estoque', {
      p_item: mover.item,
      p_delta: delta,
      p_reason: mover.motivo,
      ...(mover.pessoa ? { p_recipient: mover.pessoa } : {}),
      ...(mover.nota.trim() ? { p_note: mover.nota.trim() } : {}),
    });
    setOcupado(false);
    if (error) return setErro(error.message);

    const linha = data?.[0];
    if (!linha?.ok) return setErro(linha?.motivo ?? 'Não deu.');
    setMover({ item: '', quantidade: '', motivo: 'entrada', pessoa: '', nota: '' });
    setRecado(`Registrado. Saldo agora: ${linha.saldo}.`);
    await carregar();
  }, [mover, carregar]);

  if (erro && !itens)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!itens) return <p className="muted">Carregando…</p>;

  const noLimite = itens.filter((i) => i.ativo && i.minimo !== null && i.saldo <= i.minimo);

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Inventário</p>
          <h1>Press kits, brindes e recompensas</h1>
          <p className="muted">
            O saldo é a soma dos movimentos, e os movimentos não se editam. Errou? Lance um ajuste
            com o sinal contrário — a correção fica visível, que é o ponto.
          </p>
        </div>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      {noLimite.length > 0 ? (
        <p className="pendente">
          No limite:{' '}
          {noLimite.map((i) => `${i.nome} (${i.saldo}, mínimo ${i.minimo ?? 0})`).join(' · ')}
        </p>
      ) : null}

      <section className="secao">
        <h2>O que existe</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Item</th>
                <th>Viagem</th>
                <th>Saldo</th>
                <th>Entregues</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id}>
                  <td>{ROTULO_TIPO[i.tipo]}</td>
                  <td>
                    {i.nome}
                    {i.ativo ? null : <span className="muted"> · inativo</span>}
                  </td>
                  <td className="muted">{i.viagem ?? 'Todas'}</td>
                  <td
                    className={i.minimo !== null && i.saldo <= i.minimo ? 'mono pendente' : 'mono'}
                  >
                    {i.saldo}
                  </td>
                  <td className="mono">{i.entregues}</td>
                  <td className="mono muted">{i.minimo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {itens.length === 0 ? <p className="muted">Nenhum item cadastrado.</p> : null}

        <div className="form form--linha">
          <label className="field">
            <span>Tipo</span>
            <select
              value={novo.tipo}
              onChange={(e) => setNovo({ ...novo, tipo: e.target.value as Tipo })}
            >
              {(Object.keys(ROTULO_TIPO) as Tipo[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nome</span>
            <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          </label>
          <label className="field">
            <span>Viagem</span>
            <select
              value={novo.viagem}
              onChange={(e) => setNovo({ ...novo, viagem: e.target.value })}
            >
              <option value="">Todas</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Avisar abaixo de</span>
            <input
              type="number"
              min={0}
              value={novo.minimo}
              onChange={(e) => setNovo({ ...novo, minimo: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !novo.nome.trim()}
            onClick={() => void criar()}
          >
            Criar item
          </button>
        </div>
      </section>

      <section className="secao">
        <h2>Registrar movimento</h2>
        <div className="form form--linha">
          <label className="field">
            <span>Item</span>
            <select
              value={mover.item}
              onChange={(e) => setMover({ ...mover, item: e.target.value })}
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
            <span>Motivo</span>
            <select
              value={mover.motivo}
              onChange={(e) => setMover({ ...mover, motivo: e.target.value as Motivo })}
            >
              {(Object.keys(ROTULO_MOTIVO) as Motivo[]).map((m) => (
                <option key={m} value={m}>
                  {ROTULO_MOTIVO[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              {mover.motivo === 'ajuste' ? 'Diferença (pode ser negativa)' : 'Quantidade'}
            </span>
            <input
              type="number"
              value={mover.quantidade}
              onChange={(e) => setMover({ ...mover, quantidade: e.target.value })}
            />
          </label>
          {mover.motivo === 'entrega' || mover.motivo === 'devolucao' ? (
            <label className="field">
              <span>Para quem</span>
              <select
                value={mover.pessoa}
                onChange={(e) => setMover({ ...mover, pessoa: e.target.value })}
              >
                <option value="">Sem destinatário</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Observação</span>
            <input
              value={mover.nota}
              onChange={(e) => setMover({ ...mover, nota: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !mover.item || !mover.quantidade}
            onClick={() => void registrar()}
          >
            Registrar
          </button>
        </div>
      </section>

      <section className="secao">
        <h2>Movimentos</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Item</th>
                <th>Motivo</th>
                <th>Quantidade</th>
                <th>Para quem</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{new Date(m.quando).toLocaleString('pt-BR')}</td>
                  <td>{m.item}</td>
                  <td>{ROTULO_MOTIVO[m.motivo]}</td>
                  <td className="mono">{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="muted">{m.paraQuem ?? '—'}</td>
                  <td className="muted">{m.nota ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {movimentos.length === 0 ? <p className="muted">Nenhum movimento ainda.</p> : null}
      </section>
    </>
  );
}
