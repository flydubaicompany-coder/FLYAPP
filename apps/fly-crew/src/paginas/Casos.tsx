import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SITUACOES_EM_ABERTO,
  ordenarFila,
  type NivelDeAtendimento,
  type SituacaoDeAtendimento,
} from '@fly/domain-types';
import { supabase } from '../auth/client';

/**
 * Casos de atendimento no campo (§12.3, §12.4 e §43, entrega 9).
 *
 * Esta tela é usada **na rua, com uma mão**, por quem vai até a pessoa. Por
 * isso ela mostra três coisas e nada mais: quem chamou, o que disse, e onde
 * está — quando a pessoa mandou a localização.
 *
 * O que o escritório faz — relatório, média de aceite, encerrar — não está
 * aqui. Isso é Fly Ops.
 *
 * **Não existe localização de funcionário** (D179). O que aparece abaixo é a
 * localização que o **cliente** enviou, e só porque ele tocou no botão.
 */

// Mesma fonte de verdade do Fly Ops e do app: a ordem da fila é uma só, e o
// campo não pode ver uma ordem enquanto o escritório vê outra.
type Nivel = NivelDeAtendimento;
type Situacao = SituacaoDeAtendimento;

const NOME_NIVEL: Record<Nivel, string> = {
  chat: 'Conversa',
  urgent: 'Urgente',
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

interface Mensagem {
  id: string;
  autorId: string | null;
  corpo: string;
  doSistema: boolean;
  quando: string;
}

interface Caso {
  id: string;
  clienteId: string;
  cliente: string;
  flyId: string;
  telefone: string | null;
  nivel: Nivel;
  assunto: string | null;
  situacao: Situacao;
  abertoEm: string;
  atribuidoA: string | null;
  mensagens: Mensagem[];
  local: { latitude: number; longitude: number; quando: string } | null;
}

/** "12 min", "2 h", "3 dias". A conta que importa em pé é "há quanto tempo". */
function esperando(desde: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(desde).getTime()) / 60000));
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export function Casos() {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [euId, setEuId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<'meus' | 'fila'>('meus');
  const [resposta, setResposta] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const db = supabase();

    const [{ data: sessao }, casosRes] = await Promise.all([
      db.auth.getUser(),
      db
        .from('support_cases')
        .select(
          'id, user_id, level, subject, status, opened_at, assigned_to, support_messages(id, author_id, body, is_system, created_at), case_locations(latitude, longitude, captured_at)',
        )
        .in('status', SITUACOES_EM_ABERTO)
        .order('opened_at', { ascending: true })
        .limit(100),
    ]);

    if (casosRes.error) return setErro(casosRes.error.message);
    setEuId(sessao.user?.id ?? null);

    const linhas = casosRes.data ?? [];
    const ids = [...new Set(linhas.map((c) => c.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, public_id, preferred_name, display_name, phone')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

    setCasos(
      linhas.map((c) => {
        const p = porId.get(c.user_id);
        const pontos = [...(c.case_locations ?? [])].sort((a, b) =>
          b.captured_at.localeCompare(a.captured_at),
        );
        const ultimo = pontos[0];
        return {
          id: c.id,
          clienteId: c.user_id,
          cliente: p?.preferred_name ?? p?.display_name ?? 'Cliente',
          flyId: p?.public_id ?? '—',
          telefone: p?.phone ?? null,
          nivel: c.level as Nivel,
          assunto: c.subject,
          situacao: c.status as Situacao,
          abertoEm: c.opened_at,
          atribuidoA: c.assigned_to,
          mensagens: [...(c.support_messages ?? [])]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => ({
              id: m.id,
              autorId: m.author_id,
              corpo: m.body,
              doSistema: m.is_system,
              quando: m.created_at,
            })),
          local: ultimo
            ? {
                latitude: ultimo.latitude,
                longitude: ultimo.longitude,
                quando: ultimo.captured_at,
              }
            : null,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Caso novo aparece sem recarregar (§43, entrega 11).
   *
   * Quem está na rua não fica puxando a tela para ver se chegou alguma coisa.
   * O canal é privado: a RLS de cada tabela vale para o Realtime também.
   */
  useEffect(() => {
    const db = supabase();
    const canal = db
      .channel('crew:casos')
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

  async function assumir(c: Caso) {
    if (!euId) return setErro('Sessão sem usuário — entre de novo.');
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('support_cases')
      .update({
        assigned_to: euId,
        ...(c.situacao === 'open' ? { status: 'accepted' as const } : {}),
      })
      .eq('id', c.id);
    if (error) setErro(error.message);
    else setRecado('É seu. O cliente já vê que alguém assumiu.');
    await carregar();
    setOcupado(false);
  }

  async function responder(c: Caso) {
    const corpo = (resposta[c.id] ?? '').trim();
    if (!corpo) return setErro('Escreva antes de enviar.');
    if (!euId) return setErro('Sessão sem usuário — entre de novo.');
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('support_messages')
      .insert({ case_id: c.id, author_id: euId, body: corpo });
    if (error) setErro(error.message);
    else {
      setRecado('Enviado.');
      setResposta({ ...resposta, [c.id]: '' });
    }
    await carregar();
    setOcupado(false);
  }

  async function resolver(c: Caso) {
    if (!confirm(`Marcar «${c.assunto ?? NOME_NIVEL[c.nivel]}» como resolvido?`)) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('support_cases')
      .update({ status: 'resolved' })
      .eq('id', c.id);
    if (error) setErro(error.message);
    else setRecado('Resolvido.');
    await carregar();
    setOcupado(false);
  }

  async function escalar(c: Caso) {
    // Motivo é constraint no banco, e é a pergunta certa: quem pegar depois
    // precisa saber o que já foi tentado.
    const motivo = prompt('Escalar. O que você já tentou, e por que precisa de mais gente?');
    if (motivo === null) return;
    if (!motivo.trim()) return setErro('Escalar sem motivo é recusado — e com razão.');
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('support_cases')
      .update({ status: 'escalated', escalation_reason: motivo.trim() })
      .eq('id', c.id);
    if (error) setErro(error.message);
    else setRecado('Escalado. A operação vê na fila do Fly Ops.');
    await carregar();
    setOcupado(false);
  }

  const lista = useMemo(() => {
    const todos = casos ?? [];
    const filtrado =
      aba === 'meus'
        ? todos.filter((c) => c.atribuidoA !== null && c.atribuidoA === euId)
        : todos.filter((c) => c.atribuidoA === null);
    return ordenarFila(filtrado);
  }, [casos, aba, euId]);

  if (erro && !casos)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!casos) return <p className="muted">Carregando…</p>;

  const meus = casos.filter((c) => c.atribuidoA !== null && c.atribuidoA === euId).length;
  const naFila = casos.filter((c) => c.atribuidoA === null).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Campo</p>
          <h1>Casos</h1>
        </div>
        <p className="muted">
          {meus} seus · {naFila} na fila
        </p>
      </div>

      <div className="acoes">
        <button
          type="button"
          className={aba === 'meus' ? 'botao' : 'botao botao--fantasma'}
          onClick={() => setAba('meus')}
        >
          Meus ({meus})
        </button>
        <button
          type="button"
          className={aba === 'fila' ? 'botao' : 'botao botao--fantasma'}
          onClick={() => setAba('fila')}
        >
          Na fila ({naFila})
        </button>
      </div>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      {lista.length === 0 ? (
        <p className="muted">
          {aba === 'meus' ? 'Nenhum caso com você agora.' : 'Ninguém esperando. A fila está vazia.'}
        </p>
      ) : (
        lista.map((c) => (
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

            <p className="muted">
              Esperando há <strong>{esperando(c.abertoEm)}</strong>
            </p>

            {/* Ligar e chegar. As duas coisas que resolvem quando o chat não
                resolve — e a §43 pede que a ligação funcione sem chat. */}
            <div className="acoes">
              {c.telefone ? (
                <a className="botao botao--fantasma" href={`tel:${c.telefone}`}>
                  Ligar para {c.cliente}
                </a>
              ) : null}
              {c.local ? (
                <a
                  className="botao botao--fantasma"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${c.local.latitude},${c.local.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Rota até onde ele estava
                </a>
              ) : null}
            </div>

            {c.local ? (
              <p className="muted">
                Localização enviada pelo cliente {new Date(c.local.quando).toLocaleString('pt-BR')}.
                É o ponto que ele mandou, e não onde ele está agora.
              </p>
            ) : null}

            <ul className="checks">
              {c.mensagens.slice(-6).map((m) => (
                <li key={m.id}>
                  <span>
                    <strong>
                      {m.doSistema
                        ? 'Fly'
                        : m.autorId === c.clienteId
                          ? c.cliente
                          : m.autorId === euId
                            ? 'Você'
                            : 'Equipe'}
                    </strong>{' '}
                    {m.corpo}
                  </span>
                </li>
              ))}
            </ul>

            <div className="form form--linha">
              <label className="field">
                <span className="muted">Responder</span>
                <input
                  value={resposta[c.id] ?? ''}
                  onChange={(e) => setResposta({ ...resposta, [c.id]: e.target.value })}
                  placeholder="Estou a caminho. Fique onde está."
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

            <div className="acoes">
              {c.atribuidoA === euId ? null : (
                <button
                  type="button"
                  className="botao"
                  disabled={ocupado}
                  onClick={() => void assumir(c)}
                >
                  Assumir
                </button>
              )}
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
                onClick={() => void resolver(c)}
              >
                Resolvido
              </button>
            </div>
          </section>
        ))
      )}
    </>
  );
}
