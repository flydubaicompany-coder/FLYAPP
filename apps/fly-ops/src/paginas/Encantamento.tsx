import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Tarefas de surpresa (§13.3 e §44, entrega 13).
 *
 * O ciclo que a §13.3 lista, inteiro: insight, sugestão, orçamento,
 * aprovação, responsável, prazo, compra, preparação, entrega e reação.
 *
 * **Aprovar é um ato de papel, e não um botão a mais.** Guia e mídia
 * registram insight e entregam a surpresa; nenhum dos dois autoriza dinheiro.
 * Quem recusar isso é a RPC `aprovar_surpresa`, no servidor — esta tela
 * apenas não mostra o botão para quem não pode, o que é conveniência e não
 * segurança.
 *
 * O **teto** de orçamento vive em `app_config` e nasce `PENDENTE`:
 * "orçamento de encantamento" está na lista da §33 do que nunca se inventa.
 * Enquanto for pendente, a aprovação não confere teto — e esta tela diz isso,
 * em vez de deixar a operação supor que existe um.
 */

type Situacao =
  'sugerida' | 'aprovada' | 'recusada' | 'comprando' | 'pronta' | 'entregue' | 'cancelada';

const NOME_SITUACAO: Record<Situacao, string> = {
  sugerida: 'Sugerida',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  comprando: 'Comprando',
  pronta: 'Pronta',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

type Categoria = 'preferencia' | 'desejo' | 'celebracao' | 'incomodo' | 'outro';

const NOME_CATEGORIA: Record<Categoria, string> = {
  preferencia: 'Preferência',
  desejo: 'Desejo',
  celebracao: 'Celebração',
  incomodo: 'Incômodo',
  outro: 'Outro',
};

interface Insight {
  id: string;
  clienteId: string;
  cliente: string;
  categoria: Categoria;
  urgencia: string;
  nota: string;
  quando: string;
  temTarefa: boolean;
}

interface Tarefa {
  id: string;
  clienteId: string;
  cliente: string;
  titulo: string;
  situacao: Situacao;
  orcamento: number | null;
  custo: number | null;
  moeda: string | null;
  patrocinador: string | null;
  reacao: string | null;
  aprovadaEm: string | null;
  entregueEm: string | null;
}

export function Encantamento() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [teto, setTeto] = useState<Record<string, number> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [orcamento, setOrcamento] = useState<Record<string, { valor: string; moeda: string }>>({});

  const carregar = useCallback(async () => {
    const db = supabase();

    const [insRes, tarRes, cfgRes] = await Promise.all([
      db
        .from('guest_insights')
        .select('id, user_id, category, urgency, note, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      db
        .from('surprise_tasks')
        .select(
          'id, user_id, insight_id, title, status, budget_cents, cost_cents, currency, sponsor, reaction, approved_at, delivered_at',
        )
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('app_config').select('key, value').eq('key', 'encantamento.budget_cap'),
    ]);

    if (insRes.error) return setErro(insRes.error.message);
    if (tarRes.error) return setErro(tarRes.error.message);

    const bruto = (cfgRes.data ?? [])[0]?.value;
    setTeto(
      bruto !== null && typeof bruto === 'object' && !Array.isArray(bruto)
        ? (bruto as Record<string, number>)
        : null,
    );

    const ids = [
      ...new Set([
        ...(insRes.data ?? []).map((i) => i.user_id),
        ...(tarRes.data ?? []).map((t) => t.user_id),
      ]),
    ];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Viajante']),
    );

    const comTarefa = new Set(
      (tarRes.data ?? []).map((t) => t.insight_id).filter((x): x is string => x !== null),
    );

    setInsights(
      (insRes.data ?? []).map((i) => ({
        id: i.id,
        clienteId: i.user_id,
        cliente: nomeDe.get(i.user_id) ?? 'Viajante',
        categoria: i.category as Categoria,
        urgencia: i.urgency,
        nota: i.note,
        quando: i.created_at,
        temTarefa: comTarefa.has(i.id),
      })),
    );

    setTarefas(
      (tarRes.data ?? []).map((t) => ({
        id: t.id,
        clienteId: t.user_id,
        cliente: nomeDe.get(t.user_id) ?? 'Viajante',
        titulo: t.title,
        situacao: t.status as Situacao,
        orcamento: t.budget_cents === null ? null : Number(t.budget_cents),
        custo: t.cost_cents === null ? null : Number(t.cost_cents),
        moeda: t.currency,
        patrocinador: t.sponsor,
        reacao: t.reaction,
        aprovadaEm: t.approved_at,
        entregueEm: t.delivered_at,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function virarTarefa(i: Insight) {
    const titulo = prompt(
      `Virar surpresa a partir de: "${i.nota}"\n\nO que a Fly vai fazer?`,
      i.nota,
    );
    if (titulo === null) return;
    if (!titulo.trim()) return setErro('A tarefa precisa dizer o que vai ser feito.');

    setOcupado(true);
    setErro(null);
    const { data: sessao } = await supabase().auth.getUser();
    const { error } = await supabase()
      .from('surprise_tasks')
      .insert({
        user_id: i.clienteId,
        insight_id: i.id,
        title: titulo.trim(),
        created_by: sessao.user?.id ?? null,
      });
    if (error) setErro(error.message);
    else setRecado('Sugerida. Falta orçamento e aprovação.');
    await carregar();
    setOcupado(false);
  }

  async function aprovar(t: Tarefa) {
    const o = orcamento[t.id] ?? { valor: '', moeda: 'AED' };
    const centavos = Math.round(Number(o.valor.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos < 0) {
      return setErro('Escreva o orçamento em dinheiro, por exemplo 120,00.');
    }

    setOcupado(true);
    setErro(null);
    const { data, error } = await supabase().rpc('aprovar_surpresa', {
      p_task: t.id,
      p_budget_cents: centavos,
      p_currency: o.moeda,
    });
    if (error) setErro(error.message);
    else {
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.ok) setRecado('Aprovada.');
      else setErro(r?.motivo ?? 'não foi possível aprovar');
    }
    await carregar();
    setOcupado(false);
  }

  async function mudar(t: Tarefa, situacao: Situacao) {
    setOcupado(true);
    setErro(null);
    const extra =
      situacao === 'entregue'
        ? {
            delivered_at: new Date().toISOString(),
            delivered_by: (await supabase().auth.getUser()).data.user?.id ?? null,
          }
        : {};
    const { error } = await supabase()
      .from('surprise_tasks')
      .update({ status: situacao, ...extra })
      .eq('id', t.id);
    if (error) setErro(error.message);
    else setRecado(`${NOME_SITUACAO[situacao]}.`);
    await carregar();
    setOcupado(false);
  }

  async function anotarReacao(t: Tarefa) {
    const reacao = prompt('Como a pessoa reagiu?', t.reacao ?? '');
    if (reacao === null) return;
    setOcupado(true);
    const { error } = await supabase()
      .from('surprise_tasks')
      .update({ reaction: reacao.trim() || null })
      .eq('id', t.id);
    if (error) setErro(error.message);
    await carregar();
    setOcupado(false);
  }

  function dinheiro(centavos: number | null, moeda: string | null): string {
    if (centavos === null) return '—';
    return `${(centavos / 100).toFixed(2).replace('.', ',')} ${moeda ?? ''}`.trim();
  }

  if (erro && !insights)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!insights) return <p className="muted">Carregando…</p>;

  const naFila = insights.filter((i) => !i.temTarefa);
  const abertas = tarefas.filter(
    (t) => t.situacao !== 'entregue' && t.situacao !== 'cancelada' && t.situacao !== 'recusada',
  );

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Encantamento</p>
          <h1>Surpresas</h1>
        </div>
        <p className="muted">
          {naFila.length} insights sem tarefa · {abertas.length} tarefas abertas
        </p>
      </div>

      {teto === null ? (
        <p className="aviso">
          Não há teto de orçamento declarado: <span className="mono">encantamento.budget_cap</span>{' '}
          está <span className="mono">PENDENTE</span>. A aprovação não confere limite nenhum
          enquanto for assim. &quot;Orçamento de encantamento&quot; está na lista da §33 do que
          nunca se inventa — o valor é decisão do dono.
        </p>
      ) : (
        <p className="muted">
          Teto por tarefa:{' '}
          {Object.entries(teto)
            .map(([moeda, centavos]) => `${dinheiro(Number(centavos), moeda)}`)
            .join(' · ')}
          .
        </p>
      )}

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <section className="bloco">
        <h3>Insights sem tarefa</h3>
        {naFila.length === 0 ? (
          <p className="muted">Nada esperando. O campo não anotou nada novo.</p>
        ) : (
          <ul className="checks">
            {naFila.map((i) => (
              <li key={i.id}>
                <span>
                  <strong>{i.cliente}</strong> · {NOME_CATEGORIA[i.categoria]}
                  {i.urgencia === 'alta' ? ' · hoje' : ''} — {i.nota}{' '}
                  <span className="muted mono">{new Date(i.quando).toLocaleString('pt-BR')}</span>
                </span>
                <button
                  type="button"
                  className="botao botao--fantasma"
                  disabled={ocupado}
                  onClick={() => void virarTarefa(i)}
                >
                  Virar surpresa
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tarefas.length === 0 ? (
        <p className="muted">Nenhuma tarefa de surpresa ainda.</p>
      ) : (
        tarefas.map((t) => {
          const o = orcamento[t.id] ?? { valor: '', moeda: 'AED' };
          return (
            <section key={t.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">{t.cliente}</p>
                  <h3>{t.titulo}</h3>
                </div>
                <span
                  className={
                    t.situacao === 'entregue'
                      ? 'selo selo--ok'
                      : t.situacao === 'sugerida'
                        ? 'selo selo--pendente'
                        : 'selo'
                  }
                >
                  {NOME_SITUACAO[t.situacao]}
                </span>
              </div>

              <dl className="facts">
                <div>
                  <dt>Orçamento</dt>
                  <dd className="mono">{dinheiro(t.orcamento, t.moeda)}</dd>
                </div>
                <div>
                  <dt>Custo</dt>
                  <dd className="mono">{dinheiro(t.custo, t.moeda)}</dd>
                </div>
                <div>
                  <dt>Patrocinador</dt>
                  <dd>{t.patrocinador ?? '—'}</dd>
                </div>
                <div>
                  <dt>Entregue em</dt>
                  <dd className="mono">
                    {t.entregueEm ? new Date(t.entregueEm).toLocaleString('pt-BR') : '—'}
                  </dd>
                </div>
              </dl>

              {t.reacao ? (
                <p className="muted">
                  <strong>Reação:</strong> {t.reacao}
                </p>
              ) : null}

              {t.situacao === 'sugerida' ? (
                <div className="form form--linha">
                  <label className="field">
                    <span className="muted">Orçamento</span>
                    <input
                      value={o.valor}
                      onChange={(e) =>
                        setOrcamento({ ...orcamento, [t.id]: { ...o, valor: e.target.value } })
                      }
                      placeholder="120,00"
                    />
                  </label>
                  <label className="field">
                    <span className="muted">Moeda</span>
                    <select
                      value={o.moeda}
                      onChange={(e) =>
                        setOrcamento({ ...orcamento, [t.id]: { ...o, moeda: e.target.value } })
                      }
                    >
                      <option value="AED">AED</option>
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <div className="acoes">
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void aprovar(t)}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado}
                      onClick={() => void mudar(t, 'recusada')}
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="acoes">
                {t.situacao === 'aprovada' ? (
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void mudar(t, 'comprando')}
                  >
                    Comprando
                  </button>
                ) : null}
                {t.situacao === 'comprando' ? (
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void mudar(t, 'pronta')}
                  >
                    Pronta
                  </button>
                ) : null}
                {t.situacao === 'pronta' ? (
                  <button
                    type="button"
                    className="botao"
                    disabled={ocupado}
                    onClick={() => void mudar(t, 'entregue')}
                  >
                    Entregue
                  </button>
                ) : null}
                {t.situacao === 'entregue' ? (
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void anotarReacao(t)}
                  >
                    Anotar reação
                  </button>
                ) : null}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
