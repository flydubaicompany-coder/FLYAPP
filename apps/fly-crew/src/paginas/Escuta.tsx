import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Escuta ativa de encantamento (§13.4 e §44, entrega 12).
 *
 * "É fã do Travis Scott." "Falou que queria uma camisa específica." "Está
 * comemorando uma conquista." São quatro palavras anotadas no corredor, e é
 * disso que sai a surpresa que a pessoa lembra dez anos depois.
 *
 * Por isso o formulário é curto: quem registra está **em pé, do lado do
 * cliente**, e um formulário longo vira um formulário não preenchido.
 *
 * **O cliente nunca lê isto** (§13.4). A garantia não é esta tela: é a RLS,
 * que não tem `auth.uid() = user_id` na policy de leitura — a única tabela de
 * cliente do projeto que quebra esse molde, e de propósito.
 *
 * A anotação **não se edita nem se apaga**. Errou? Escreva outra. O registro
 * do que se ouviu, e de quando, é o valor.
 */

type Categoria = 'preferencia' | 'desejo' | 'celebracao' | 'incomodo' | 'outro';
type Urgencia = 'baixa' | 'normal' | 'alta';

const NOME_CATEGORIA: Record<Categoria, string> = {
  preferencia: 'Preferência',
  desejo: 'Desejo',
  celebracao: 'Celebração',
  incomodo: 'Incômodo',
  outro: 'Outro',
};

const NOME_URGENCIA: Record<Urgencia, string> = {
  baixa: 'Pode esperar',
  normal: 'Normal',
  alta: 'Hoje',
};

const CATEGORIAS: Categoria[] = ['preferencia', 'desejo', 'celebracao', 'incomodo', 'outro'];
const URGENCIAS: Urgencia[] = ['alta', 'normal', 'baixa'];

interface Insight {
  id: string;
  clienteId: string;
  cliente: string;
  categoria: Categoria;
  urgencia: Urgencia;
  nota: string;
  quando: string;
  meu: boolean;
}

interface Viajante {
  id: string;
  nome: string;
  viagem: string;
}

export function Escuta() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [viajantes, setViajantes] = useState<Viajante[]>([]);
  const [euId, setEuId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState({
    clienteId: '',
    categoria: 'preferencia' as Categoria,
    urgencia: 'normal' as Urgencia,
    nota: '',
  });

  const carregar = useCallback(async () => {
    const db = supabase();

    const [{ data: sessao }, insightsRes, atribRes] = await Promise.all([
      db.auth.getUser(),
      db
        .from('guest_insights')
        .select('id, user_id, category, urgency, note, created_at, created_by')
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('staff_assignments').select('trip_id').is('revoked_at', null),
    ]);

    if (insightsRes.error) return setErro(insightsRes.error.message);
    const eu = sessao.user?.id ?? null;
    setEuId(eu);

    // As viagens que esta pessoa opera — são as únicas em que ela vai anotar.
    const tripIds = [...new Set((atribRes.data ?? []).map((a) => a.trip_id))];
    const { data: membros } = await db
      .from('trip_members')
      .select('user_id, trip_id')
      .in('trip_id', tripIds.length > 0 ? tripIds : ['00000000-0000-0000-0000-000000000000']);

    const { data: viagens } = await db
      .from('trips')
      .select('id, name')
      .in('id', tripIds.length > 0 ? tripIds : ['00000000-0000-0000-0000-000000000000']);
    const nomeViagem = new Map((viagens ?? []).map((t) => [t.id, t.name]));

    const clienteIds = [
      ...new Set([
        ...(membros ?? []).map((m) => m.user_id),
        ...(insightsRes.data ?? []).map((i) => i.user_id),
      ]),
    ];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', clienteIds.length > 0 ? clienteIds : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Viajante']),
    );

    setViajantes(
      (membros ?? []).map((m) => ({
        id: m.user_id,
        nome: nomeDe.get(m.user_id) ?? 'Viajante',
        viagem: nomeViagem.get(m.trip_id) ?? 'Viagem',
      })),
    );

    setInsights(
      (insightsRes.data ?? []).map((i) => ({
        id: i.id,
        clienteId: i.user_id,
        cliente: nomeDe.get(i.user_id) ?? 'Viajante',
        categoria: i.category as Categoria,
        urgencia: i.urgency as Urgencia,
        nota: i.note,
        quando: i.created_at,
        meu: i.created_by === eu,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function registrar() {
    if (!novo.clienteId) return setErro('Escolha de quem é a anotação.');
    if (!novo.nota.trim()) return setErro('Escreva o que você ouviu.');
    if (!euId) return setErro('Sessão sem usuário — entre de novo.');

    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase().from('guest_insights').insert({
      user_id: novo.clienteId,
      category: novo.categoria,
      urgency: novo.urgencia,
      note: novo.nota.trim(),
      created_by: euId,
    });
    if (error) setErro(error.message);
    else {
      setRecado('Anotado. A Gerência da Experiência vê na fila.');
      setNovo({ ...novo, nota: '' });
    }
    await carregar();
    setOcupado(false);
  }

  if (erro && !insights)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!insights) return <p className="muted">Carregando…</p>;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Campo</p>
          <h1>Escuta</h1>
        </div>
        <p className="muted">{insights.length} anotações recentes</p>
      </div>

      <p className="muted">
        Quatro palavras bastam. O cliente <strong>nunca</strong> lê isto — é anotação interna, e é
        dela que sai a surpresa.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <section className="bloco">
        <h3>Ouvi agora</h3>
        <div className="form">
          <label className="field">
            <span className="muted">De quem</span>
            <select
              value={novo.clienteId}
              onChange={(e) => setNovo({ ...novo, clienteId: e.target.value })}
            >
              <option value="">— escolha —</option>
              {viajantes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} · {v.viagem}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">O quê</span>
            <select
              value={novo.categoria}
              onChange={(e) => setNovo({ ...novo, categoria: e.target.value as Categoria })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {NOME_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">Urgência</span>
            <select
              value={novo.urgencia}
              onChange={(e) => setNovo({ ...novo, urgencia: e.target.value as Urgencia })}
            >
              {URGENCIAS.map((u) => (
                <option key={u} value={u}>
                  {NOME_URGENCIA[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">O que você ouviu</span>
            <input
              value={novo.nota}
              onChange={(e) => setNovo({ ...novo, nota: e.target.value })}
              placeholder="Falou que queria uma camisa do time."
              maxLength={500}
            />
          </label>
        </div>
        <div className="acoes">
          <button
            type="button"
            className="botao"
            disabled={ocupado}
            onClick={() => void registrar()}
          >
            Anotar
          </button>
        </div>
      </section>

      {insights.length === 0 ? (
        <p className="muted">Nada anotado ainda.</p>
      ) : (
        <ul className="checks">
          {insights.map((i) => (
            <li key={i.id}>
              <span>
                <strong>{i.cliente}</strong> · {NOME_CATEGORIA[i.categoria]}
                {i.urgencia === 'alta' ? ' · hoje' : ''} — {i.nota}{' '}
                <span className="muted mono">{new Date(i.quando).toLocaleString('pt-BR')}</span>
                {i.meu ? ' · sua' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
