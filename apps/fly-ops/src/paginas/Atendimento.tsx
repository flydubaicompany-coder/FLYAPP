import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../auth/client';
import { espera, lerAlvos, media, minutosEntre, type AlvosDeSla } from '../dominio/tempo';

/**
 * A fila do Fly Assist (§12.3, §12.4 e §43, entrega 10).
 *
 * A tela abre na **fila**, ordenada como o índice `support_cases_fila_idx`
 * ordena: SOS primeiro, depois ajuda urgente, depois conversa — e, dentro de
 * cada nível, quem espera há mais tempo. Uma fila que a operação lê numa
 * ordem e o banco entrega em outra atende gente fora de ordem.
 *
 * ## Sobre o SLA
 *
 * O que esta tela mostra é **tempo decorrido**, que é fato medido pelos
 * carimbos dos gatilhos. O **alvo** — quantos minutos a Fly promete para
 * aceitar um SOS — vive em `app_config['support.sla_minutes']` e nasce
 * `PENDENTE`: prazo de atendimento é promessa de nível de serviço, e a §33
 * proíbe inventar. Enquanto estiver pendente, a tela mede e não acusa atraso.
 */

type Nivel = 'chat' | 'urgent' | 'sos';
type Situacao = 'open' | 'accepted' | 'in_progress' | 'escalated' | 'resolved' | 'closed';

const NOME_NIVEL: Record<Nivel, string> = {
  chat: 'Conversa',
  urgent: 'Ajuda urgente',
  sos: 'SOS',
};

const NOME_SITUACAO: Record<Situacao, string> = {
  open: 'Na fila',
  accepted: 'Aceito',
  in_progress: 'Em atendimento',
  escalated: 'Escalado',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

/** SOS na frente, conversa atrás. Mesma ordem do índice da fila. */
const PESO: Record<Nivel, number> = { sos: 3, urgent: 2, chat: 1 };

const EM_ABERTO: Situacao[] = ['open', 'accepted', 'in_progress', 'escalated'];

interface Mensagem {
  id: string;
  autorId: string | null;
  corpo: string;
  doSistema: boolean;
  quando: string;
}

interface Ponto {
  latitude: number;
  longitude: number;
  precisao: number | null;
  quando: string;
}

interface Caso {
  id: string;
  clienteId: string;
  cliente: string;
  flyId: string;
  nivel: Nivel;
  assunto: string | null;
  situacao: Situacao;
  abertoEm: string;
  aceitoEm: string | null;
  primeiraRespostaEm: string | null;
  resolvidoEm: string | null;
  escaladoEm: string | null;
  motivoEscala: string | null;
  atribuidoA: string | null;
  atribuidoEm: string | null;
  mensagens: Mensagem[];
  pontos: Ponto[];
}

interface Pessoa {
  id: string;
  nome: string;
  papeis: string[];
}

/** O que uma ação muda num caso. Estreito de propósito: a tela não edita
 *  carimbo de tempo — quem carimba é o gatilho. */
interface Mudanca {
  status?: Situacao;
  escalation_reason?: string;
  assigned_to?: string | null;
}

export function Atendimento() {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [equipe, setEquipe] = useState<Pessoa[]>([]);
  const [alvos, setAlvos] = useState<AlvosDeSla | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [soFila, setSoFila] = useState(true);
  const [resposta, setResposta] = useState<Record<string, string>>({});
  const [euId, setEuId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const db = supabase();

    const [{ data: sessao }, casosRes, cfgRes] = await Promise.all([
      db.auth.getUser(),
      db
        .from('support_cases')
        .select(
          'id, user_id, level, subject, status, opened_at, accepted_at, first_response_at, resolved_at, escalated_at, escalation_reason, assigned_to, assigned_at, support_messages(id, author_id, body, is_system, created_at), case_locations(latitude, longitude, accuracy_m, captured_at)',
        )
        .order('opened_at', { ascending: false })
        .limit(200),
      db.from('app_config').select('key, value').eq('key', 'support.sla_minutes'),
    ]);

    if (casosRes.error) return setErro(casosRes.error.message);
    setEuId(sessao.user?.id ?? null);

    const linhas = casosRes.data ?? [];
    const ids = [...new Set(linhas.map((c) => c.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, public_id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

    // A lista da equipe é o que torna a atribuição possível. Se o papel não
    // puder listar, a tela segue funcionando — só sem o seletor.
    const { data: gente } = await db.rpc('equipe_de_atendimento');
    setEquipe((gente ?? []).map((g) => ({ id: g.user_id, nome: g.nome, papeis: g.papeis ?? [] })));

    setAlvos(lerAlvos((cfgRes.data ?? [])[0]?.value ?? null));

    setCasos(
      linhas.map((c) => {
        const p = porId.get(c.user_id);
        return {
          id: c.id,
          clienteId: c.user_id,
          cliente: p?.preferred_name ?? p?.display_name ?? 'Cliente',
          flyId: p?.public_id ?? '—',
          nivel: c.level as Nivel,
          assunto: c.subject,
          situacao: c.status as Situacao,
          abertoEm: c.opened_at,
          aceitoEm: c.accepted_at,
          primeiraRespostaEm: c.first_response_at,
          resolvidoEm: c.resolved_at,
          escaladoEm: c.escalated_at,
          motivoEscala: c.escalation_reason,
          atribuidoA: c.assigned_to,
          atribuidoEm: c.assigned_at,
          mensagens: [...(c.support_messages ?? [])]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => ({
              id: m.id,
              autorId: m.author_id,
              corpo: m.body,
              doSistema: m.is_system,
              quando: m.created_at,
            })),
          pontos: [...(c.case_locations ?? [])]
            .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
            .map((l) => ({
              latitude: l.latitude,
              longitude: l.longitude,
              precisao: l.accuracy_m,
              quando: l.captured_at,
            })),
        };
      }),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * A fila se atualiza sozinha (§43, entrega 11).
   *
   * Um SOS que chega enquanto alguém olha esta tela não pode depender de
   * lembrar de recarregar. O canal é privado: o Postgres Changes aplica a RLS
   * de cada tabela por assinante, e quem não é equipe não recebe fila
   * nenhuma.
   */
  useEffect(() => {
    const db = supabase();
    const canal = db
      .channel('ops:atendimento')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_cases' }, () => {
        void carregar();
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        () => {
          void carregar();
        },
      )
      .subscribe();

    return () => {
      void db.removeChannel(canal);
    };
  }, [carregar]);

  async function mudar(c: Caso, campos: Mudanca, feito: string) {
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase().from('support_cases').update(campos).eq('id', c.id);
    if (error) setErro(error.message);
    else setRecado(feito);
    await carregar();
    setOcupado(false);
  }

  async function responder(c: Caso) {
    const corpo = (resposta[c.id] ?? '').trim();
    if (!corpo) return setErro('Escreva a resposta antes de enviar.');
    if (!euId) return setErro('Sessão sem usuário — entre de novo.');
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('support_messages')
      .insert({ case_id: c.id, author_id: euId, body: corpo });
    if (error) setErro(error.message);
    else {
      setRecado('Resposta enviada.');
      setResposta({ ...resposta, [c.id]: '' });
    }
    await carregar();
    setOcupado(false);
  }

  async function escalar(c: Caso) {
    // Motivo é constraint no banco. Pedir aqui evita o erro cru na tela e,
    // principalmente, faz a pergunta certa: o próximo precisa saber o que já
    // foi tentado.
    const motivo = prompt(
      `Escalar «${c.assunto ?? NOME_NIVEL[c.nivel]}» de ${c.cliente}.\n\n` +
        'Por quê? O próximo a pegar precisa saber o que já foi tentado.',
    );
    if (motivo === null) return;
    if (!motivo.trim()) return setErro('Escalar sem motivo é recusado pelo banco — e com razão.');
    await mudar(c, { status: 'escalated', escalation_reason: motivo.trim() }, 'Caso escalado.');
  }

  const fila = useMemo(() => {
    const lista = (casos ?? []).filter((c) => !soFila || EM_ABERTO.includes(c.situacao));
    return [...lista].sort(
      (a, b) => PESO[b.nivel] - PESO[a.nivel] || a.abertoEm.localeCompare(b.abertoEm),
    );
  }, [casos, soFila]);

  const numeros = useMemo(() => {
    const todos = casos ?? [];
    const abertos = todos.filter((c) => EM_ABERTO.includes(c.situacao));
    const aceites = todos
      .filter((c) => c.aceitoEm !== null)
      .map((c) => minutosEntre(c.abertoEm, c.aceitoEm));
    const respostas = todos
      .filter((c) => c.primeiraRespostaEm !== null)
      .map((c) => minutosEntre(c.abertoEm, c.primeiraRespostaEm));
    return {
      abertos: abertos.length,
      sos: abertos.filter((c) => c.nivel === 'sos').length,
      urgentes: abertos.filter((c) => c.nivel === 'urgent').length,
      semDono: abertos.filter((c) => c.atribuidoA === null).length,
      escalados: todos.filter((c) => c.escaladoEm !== null).length,
      aceite: media(aceites),
      resposta: media(respostas),
    };
  }, [casos]);

  if (erro && !casos)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!casos) return <p className="muted">Carregando…</p>;

  const nomeDe = (id: string | null) =>
    id === null ? null : (equipe.find((p) => p.id === id)?.nome ?? 'Alguém da equipe');

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Atendimento</h1>
        </div>
        <p className="muted">
          {numeros.abertos} na fila · {numeros.sos} SOS · {numeros.urgentes} urgentes
        </p>
      </div>

      {/* Relatório (§43, entrega 10). Tudo aqui é medido pelos carimbos dos
          gatilhos — nenhuma linha é alvo, porque alvo ainda não existe. */}
      <section className="bloco">
        <h3>Como está indo</h3>
        <dl className="facts">
          <div>
            <dt>Na fila</dt>
            <dd>{numeros.abertos}</dd>
          </div>
          <div>
            <dt>Sem dono</dt>
            <dd>{numeros.semDono}</dd>
          </div>
          <div>
            <dt>Escalados</dt>
            <dd>{numeros.escalados}</dd>
          </div>
          <div>
            <dt>Média até aceitar</dt>
            <dd className="mono">{numeros.aceite === null ? '—' : espera(numeros.aceite)}</dd>
          </div>
          <div>
            <dt>Média até responder</dt>
            <dd className="mono">{numeros.resposta === null ? '—' : espera(numeros.resposta)}</dd>
          </div>
        </dl>
        {alvos ? null : (
          <p className="muted">
            Os números acima são <strong>tempo medido</strong>. Não há prazo declarado para
            comparar: <span className="mono">support.sla_minutes</span> está{' '}
            <span className="mono">PENDENTE</span>. Prazo de atendimento é promessa de nível de
            serviço, e a §33 não deixa inventar uma. Preenchida a configuração, esta tela passa a
            marcar o que estourou — sem release.
          </p>
        )}
      </section>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <div className="acoes">
        <button
          type="button"
          className={soFila ? 'botao' : 'botao botao--fantasma'}
          onClick={() => setSoFila(true)}
        >
          Só a fila
        </button>
        <button
          type="button"
          className={soFila ? 'botao botao--fantasma' : 'botao'}
          onClick={() => setSoFila(false)}
        >
          Tudo
        </button>
      </div>

      {fila.length === 0 ? (
        <p className="muted">
          {soFila ? 'Ninguém esperando. A fila está vazia.' : 'Nenhum caso registrado ainda.'}
        </p>
      ) : (
        fila.map((c) => {
          const alvo = alvos?.[c.nivel];
          const minAceite = minutosEntre(c.abertoEm, c.aceitoEm);
          const minResposta = minutosEntre(c.abertoEm, c.primeiraRespostaEm);
          const alvoAceite = alvo?.aceite ?? null;
          const alvoResposta = alvo?.primeiraResposta ?? null;
          // Só acusa atraso do que ainda não aconteceu: um caso já aceito em
          // 40 min não está "atrasado agora" — é um número no histórico.
          const atrasoAceite = alvoAceite !== null && c.aceitoEm === null && minAceite > alvoAceite;
          const atrasoResposta =
            alvoResposta !== null && c.primeiraRespostaEm === null && minResposta > alvoResposta;
          const ultimo = c.pontos[0];

          return (
            <section key={c.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">
                    {c.cliente} · <span className="mono">{c.flyId}</span>
                  </p>
                  <h3>{c.assunto ?? NOME_NIVEL[c.nivel]}</h3>
                </div>
                <span
                  className={
                    c.nivel === 'sos'
                      ? 'selo selo--pendente'
                      : c.nivel === 'urgent'
                        ? 'selo selo--ok'
                        : 'selo'
                  }
                >
                  {NOME_NIVEL[c.nivel]} · {NOME_SITUACAO[c.situacao]}
                </span>
              </div>

              <dl className="facts">
                <div>
                  <dt>Esperando</dt>
                  <dd className="mono">{espera(minutosEntre(c.abertoEm, c.resolvidoEm))}</dd>
                </div>
                <div>
                  <dt>Até aceitar</dt>
                  <dd className="mono">{c.aceitoEm ? espera(minAceite) : '—'}</dd>
                </div>
                <div>
                  <dt>Até a 1ª resposta</dt>
                  <dd className="mono">{c.primeiraRespostaEm ? espera(minResposta) : '—'}</dd>
                </div>
                <div>
                  <dt>De quem é</dt>
                  <dd>{nomeDe(c.atribuidoA) ?? 'ninguém ainda'}</dd>
                </div>
              </dl>

              {atrasoAceite || atrasoResposta ? (
                <p className="aviso">
                  Fora do prazo declarado em <span className="mono">support.sla_minutes</span>.
                </p>
              ) : null}

              {c.motivoEscala ? (
                <p className="aviso">
                  <strong>Escalado:</strong> {c.motivoEscala}
                </p>
              ) : null}

              {/* A localização é do CLIENTE, e só existe porque ele mandou.
                  Não há — e não haverá — localização de funcionário (D179). */}
              {ultimo ? (
                <p className="muted">
                  Localização enviada pelo cliente {new Date(ultimo.quando).toLocaleString('pt-BR')}
                  {ultimo.precisao === null ? '' : ` · ±${Math.round(ultimo.precisao)} m`} ·{' '}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${ultimo.latitude},${ultimo.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    abrir no mapa
                  </a>
                </p>
              ) : null}

              <ul className="checks">
                {c.mensagens.length === 0 ? (
                  <li>
                    <span className="muted">Sem mensagens.</span>
                  </li>
                ) : (
                  c.mensagens.map((m) => (
                    <li key={m.id}>
                      <span>
                        <strong>
                          {m.doSistema
                            ? 'Fly'
                            : m.autorId === c.clienteId
                              ? c.cliente
                              : (nomeDe(m.autorId) ?? 'Equipe')}
                        </strong>{' '}
                        {m.corpo}{' '}
                        <span className="muted mono">
                          {new Date(m.quando).toLocaleString('pt-BR')}
                        </span>
                      </span>
                    </li>
                  ))
                )}
              </ul>

              {c.situacao === 'resolved' || c.situacao === 'closed' ? null : (
                <>
                  <div className="form form--linha">
                    <label className="field">
                      <span className="muted">Responder</span>
                      <input
                        value={resposta[c.id] ?? ''}
                        onChange={(e) => setResposta({ ...resposta, [c.id]: e.target.value })}
                        placeholder="Estou indo até você. Fique onde está."
                      />
                    </label>
                    <div className="acoes">
                      <button
                        type="button"
                        className="botao"
                        disabled={ocupado}
                        onClick={() => void responder(c)}
                      >
                        Enviar
                      </button>
                    </div>
                  </div>

                  <div className="form form--linha">
                    <label className="field">
                      <span className="muted">De quem é</span>
                      <select
                        value={c.atribuidoA ?? ''}
                        disabled={ocupado || equipe.length === 0}
                        onChange={(e) =>
                          void mudar(
                            c,
                            { assigned_to: e.target.value === '' ? null : e.target.value },
                            e.target.value === '' ? 'Devolvido para a fila.' : 'Atribuído.',
                          )
                        }
                      >
                        <option value="">— na fila, sem dono —</option>
                        {equipe.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} ({p.papeis.join(', ')})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="acoes">
                    {c.situacao === 'open' ? (
                      <button
                        type="button"
                        className="botao"
                        disabled={ocupado}
                        onClick={() => void mudar(c, { status: 'accepted' }, 'Caso aceito.')}
                      >
                        Aceitar
                      </button>
                    ) : null}
                    {c.situacao === 'accepted' ? (
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado}
                        onClick={() => void mudar(c, { status: 'in_progress' }, 'Em atendimento.')}
                      >
                        Em atendimento
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado || c.situacao === 'escalated'}
                      onClick={() => void escalar(c)}
                    >
                      Escalar
                    </button>
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado}
                      onClick={() => void mudar(c, { status: 'resolved' }, 'Resolvido.')}
                    >
                      Resolver
                    </button>
                  </div>
                </>
              )}

              {c.situacao === 'resolved' ? (
                <div className="acoes">
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void mudar(c, { status: 'closed' }, 'Encerrado.')}
                  >
                    Encerrar
                  </button>
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </>
  );
}
