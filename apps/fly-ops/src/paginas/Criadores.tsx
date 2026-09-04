import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Modo Criador (§13.6 e §44, entrega 15).
 *
 * **Habilitar é por pessoa e por viagem**, como a §13.6 pede — não é um papel
 * do Fly ID. Um criador convidado para a viagem de setembro não vira criador
 * da Fly para sempre, e a viagem seguinte precisa de um convite novo.
 *
 * O que esta tela **não** tem: valor, status de pagamento e contrapartida.
 * Isso é taxa e parceiro financeiro, os dois na lista da §33, e o PSP
 * continua sendo a P09/P38. O que há é o campo do combinado, em texto, para
 * quando houver contrato.
 *
 * As métricas dos entregáveis são **declaradas pelo criador**. Aparecem
 * marcadas como declaradas — somá-las num relatório como se fossem medidas
 * seria transformar um número informado em número apurado.
 */

type Situacao = 'pendente' | 'enviado' | 'aprovado' | 'recusado' | 'publicado';

const NOME_SITUACAO: Record<Situacao, string> = {
  pendente: 'A fazer',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Precisa de ajuste',
  publicado: 'Publicado',
};

interface Entregavel {
  id: string;
  titulo: string;
  situacao: Situacao;
  url: string | null;
  observacao: string | null;
  alcance: number | null;
  engajamento: number | null;
  declaradoEm: string | null;
}

interface Criador {
  id: string;
  userId: string;
  nome: string;
  ativo: boolean;
  briefing: string | null;
  direitos: string | null;
  combinado: string | null;
  arroba: string | null;
  habilitadoEm: string | null;
  entregaveis: Entregavel[];
}

interface Viagem {
  id: string;
  nome: string;
}

interface Viajante {
  id: string;
  nome: string;
  jaECriador: boolean;
}

export function Criadores() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagemId, setViagemId] = useState('');
  const [criadores, setCriadores] = useState<Criador[] | null>(null);
  const [viajantes, setViajantes] = useState<Viajante[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState({ userId: '', briefing: '', arroba: '' });
  const [novoEnt, setNovoEnt] = useState<Record<string, string>>({});

  const carregarViagens = useCallback(async () => {
    const { data, error } = await supabase()
      .from('trips')
      .select('id, name')
      .order('starts_on', { ascending: false });
    if (error) return setErro(error.message);
    const lista = (data ?? []).map((t) => ({ id: t.id, nome: t.name }));
    setViagens(lista);
    setViagemId((atual) => atual || (lista[0]?.id ?? ''));
  }, []);

  const carregar = useCallback(async () => {
    if (!viagemId) return setCriadores([]);
    const db = supabase();

    const { data: perfis, error } = await db
      .from('influencer_profiles')
      .select(
        'id, user_id, is_active, briefing, usage_rights, collab_note, handle, enabled_at, influencer_deliverables(id, title, status, submitted_url, review_note, reach_declared, engagement_declared, metrics_declared_at, created_at)',
      )
      .eq('trip_id', viagemId);

    if (error) return setErro(error.message);

    const { data: membros } = await db
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', viagemId);
    const ids = [
      ...new Set([
        ...(membros ?? []).map((m) => m.user_id),
        ...(perfis ?? []).map((p) => p.user_id),
      ]),
    ];
    const { data: pf } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (pf ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Viajante']),
    );

    const comPerfil = new Set((perfis ?? []).map((p) => p.user_id));
    setViajantes(
      (membros ?? []).map((m) => ({
        id: m.user_id,
        nome: nomeDe.get(m.user_id) ?? 'Viajante',
        jaECriador: comPerfil.has(m.user_id),
      })),
    );

    setCriadores(
      (perfis ?? []).map((p) => ({
        id: p.id,
        userId: p.user_id,
        nome: nomeDe.get(p.user_id) ?? 'Viajante',
        ativo: p.is_active,
        briefing: p.briefing,
        direitos: p.usage_rights,
        combinado: p.collab_note,
        arroba: p.handle,
        habilitadoEm: p.enabled_at,
        entregaveis: (
          (p.influencer_deliverables ?? []) as Array<{
            id: string;
            title: string;
            status: string;
            submitted_url: string | null;
            review_note: string | null;
            reach_declared: number | null;
            engagement_declared: number | null;
            metrics_declared_at: string | null;
            created_at: string;
          }>
        )
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((d) => ({
            id: d.id,
            titulo: d.title,
            situacao: d.status as Situacao,
            url: d.submitted_url,
            observacao: d.review_note,
            alcance: d.reach_declared === null ? null : Number(d.reach_declared),
            engajamento: d.engagement_declared === null ? null : Number(d.engagement_declared),
            declaradoEm: d.metrics_declared_at,
          })),
      })),
    );
  }, [viagemId]);

  useEffect(() => {
    void carregarViagens();
  }, [carregarViagens]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!novo.userId) return setErro('Escolha quem vai produzir conteúdo nesta viagem.');
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('influencer_profiles')
      .insert({
        user_id: novo.userId,
        trip_id: viagemId,
        briefing: novo.briefing.trim() || null,
        handle: novo.arroba.trim() || null,
      });
    if (error) setErro(error.message);
    else {
      setRecado('Criado. Ele nasce desligado — habilitar é o próximo passo.');
      setNovo({ userId: '', briefing: '', arroba: '' });
    }
    await carregar();
    setOcupado(false);
  }

  async function habilitar(c: Criador, ativo: boolean) {
    setOcupado(true);
    setErro(null);
    // `enabled_at` e `enabled_by` são carimbados por gatilho.
    const { error } = await supabase()
      .from('influencer_profiles')
      .update({ is_active: ativo })
      .eq('id', c.id);
    if (error) setErro(error.message);
    else setRecado(ativo ? 'Habilitado. O modo aparece no app dele.' : 'Desligado.');
    await carregar();
    setOcupado(false);
  }

  async function somarEntregavel(c: Criador) {
    const titulo = (novoEnt[c.id] ?? '').trim();
    if (!titulo) return setErro('O entregável precisa de um título.');
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('influencer_deliverables')
      .insert({ profile_id: c.id, title: titulo });
    if (error) setErro(error.message);
    else {
      setRecado('Entregável criado.');
      setNovoEnt({ ...novoEnt, [c.id]: '' });
    }
    await carregar();
    setOcupado(false);
  }

  async function revisar(e: Entregavel, situacao: Situacao) {
    let nota: string | null = e.observacao;
    if (situacao === 'recusado') {
      // Constraint no banco. Perguntar aqui evita o erro cru e faz a pergunta
      // certa: o criador precisa saber o que refazer.
      const motivo = prompt('O que precisa mudar? O criador vai ler isto.');
      if (motivo === null) return;
      if (!motivo.trim()) return setErro('Recusar sem motivo é recusado pelo banco — e com razão.');
      nota = motivo.trim();
    }

    setOcupado(true);
    setErro(null);
    const { data: sessao } = await supabase().auth.getUser();
    const { error } = await supabase()
      .from('influencer_deliverables')
      .update({
        status: situacao,
        review_note: nota,
        reviewed_by: sessao.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', e.id);
    if (error) setErro(error.message);
    else setRecado(`${NOME_SITUACAO[situacao]}.`);
    await carregar();
    setOcupado(false);
  }

  if (erro && !criadores)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!criadores) return <p className="muted">Carregando…</p>;

  const ativos = criadores.filter((c) => c.ativo).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Encantamento</p>
          <h1>Criadores</h1>
        </div>
        <p className="muted">
          {ativos} habilitados de {criadores.length}
        </p>
      </div>

      <p className="muted">
        Habilitar é <strong>por pessoa e por viagem</strong>. Não há valor nem status de pagamento
        aqui: contrapartida é taxa financeira, e a §33 não deixa inventar. O campo do combinado
        existe para quando houver contrato.
      </p>

      <div className="form form--linha">
        <label className="field">
          <span className="muted">Viagem</span>
          <select value={viagemId} onChange={(e) => setViagemId(e.target.value)}>
            {viagens.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <section className="bloco">
        <h3>Novo criador nesta viagem</h3>
        <div className="form">
          <label className="field">
            <span className="muted">Quem</span>
            <select
              value={novo.userId}
              onChange={(e) => setNovo({ ...novo, userId: e.target.value })}
            >
              <option value="">— escolha —</option>
              {viajantes
                .filter((v) => !v.jaECriador)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">Perfil profissional</span>
            <input
              value={novo.arroba}
              onChange={(e) => setNovo({ ...novo, arroba: e.target.value })}
              placeholder="@criador"
            />
          </label>
          <label className="field">
            <span className="muted">Briefing</span>
            <input
              value={novo.briefing}
              onChange={(e) => setNovo({ ...novo, briefing: e.target.value })}
              placeholder="Três stories por dia, marcando a Fly."
            />
          </label>
        </div>
        <div className="acoes">
          <button type="button" className="botao" disabled={ocupado} onClick={() => void criar()}>
            Criar
          </button>
        </div>
      </section>

      {criadores.length === 0 ? (
        <p className="muted">Nenhum criador nesta viagem.</p>
      ) : (
        criadores.map((c) => (
          <section key={c.id} className="bloco">
            <div className="cabecalho">
              <div>
                <p className="kicker">{c.arroba ?? 'sem perfil informado'}</p>
                <h3>{c.nome}</h3>
              </div>
              <span className={c.ativo ? 'selo selo--ok' : 'selo selo--pendente'}>
                {c.ativo ? 'Habilitado' : 'Desligado'}
              </span>
            </div>

            <dl className="facts">
              <div>
                <dt>Habilitado em</dt>
                <dd className="mono">
                  {c.habilitadoEm ? new Date(c.habilitadoEm).toLocaleString('pt-BR') : '—'}
                </dd>
              </div>
              <div>
                <dt>Entregáveis</dt>
                <dd>{c.entregaveis.length}</dd>
              </div>
            </dl>

            {c.briefing ? <p className="muted">{c.briefing}</p> : null}

            {c.entregaveis.length > 0 ? (
              <ul className="checks">
                {c.entregaveis.map((e) => (
                  <li key={e.id}>
                    <span>
                      <strong>{e.titulo}</strong> · {NOME_SITUACAO[e.situacao]}
                      {e.url ? ` · ${e.url}` : ''}
                      {e.declaradoEm
                        ? ` · declarado pelo criador: ${e.alcance ?? '—'} de alcance, ${e.engajamento ?? '—'} de engajamento`
                        : ''}
                    </span>
                    {e.situacao === 'enviado' ? (
                      <>
                        <button
                          type="button"
                          className="botao botao--fantasma"
                          disabled={ocupado}
                          onClick={() => void revisar(e, 'aprovado')}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="botao botao--fantasma"
                          disabled={ocupado}
                          onClick={() => void revisar(e, 'recusado')}
                        >
                          Pedir ajuste
                        </button>
                      </>
                    ) : null}
                    {e.situacao === 'aprovado' ? (
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado}
                        onClick={() => void revisar(e, 'publicado')}
                      >
                        Publicado
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhum entregável combinado ainda.</p>
            )}

            <div className="form form--linha">
              <label className="field">
                <span className="muted">Novo entregável</span>
                <input
                  value={novoEnt[c.id] ?? ''}
                  onChange={(e) => setNovoEnt({ ...novoEnt, [c.id]: e.target.value })}
                  placeholder="Reels do jantar no deserto"
                />
              </label>
              <div className="acoes">
                <button
                  type="button"
                  className="botao botao--fantasma"
                  disabled={ocupado}
                  onClick={() => void somarEntregavel(c)}
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="acoes">
              <button
                type="button"
                className={c.ativo ? 'botao botao--fantasma' : 'botao'}
                disabled={ocupado}
                onClick={() => void habilitar(c, !c.ativo)}
              >
                {c.ativo ? 'Desligar' : 'Habilitar'}
              </button>
            </div>
          </section>
        ))
      )}
    </>
  );
}
