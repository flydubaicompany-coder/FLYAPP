import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Painel de Ready Check e presença (§7.9 e §39).
 *
 * Esta é a tela que fica aberta no celular do guia enquanto o grupo se reúne.
 * Ela responde uma pergunta: **quem ainda falta?**
 *
 * Por isso "sem resposta" aparece com o mesmo peso de "atrasado" — quem não
 * respondeu é exatamente o caso que precisa de um telefonema, e uma lista que
 * só mostra quem respondeu esconde o problema.
 */

interface Atividade {
  id: string;
  titulo: string;
  comeca: string | null;
  viagem: string;
}

interface Pessoa {
  userId: string;
  nome: string;
  estado: string | null;
  nota: string | null;
  presente: boolean;
  metodo: string | null;
}

const ROTULO_ESTADO: Record<string, string> = {
  ready: 'Pronto',
  late: 'Atrasado',
  lost: 'Não encontrou o grupo',
  needs_help: 'Precisa de ajuda',
};

export function Presenca() {
  const [atividades, setAtividades] = useState<Atividade[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [readyCheckId, setReadyCheckId] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregarAtividades = useCallback(async () => {
    const { data, error } = await supabase()
      .from('activities')
      .select('id, title, starts_at, trip_days(trips(name))')
      .neq('status', 'cancelled')
      .order('starts_at', { nullsFirst: false })
      .limit(50);

    if (error) return setErro(error.message);
    setAtividades(
      (data ?? []).map((a) => ({
        id: a.id,
        titulo: a.title,
        comeca: a.starts_at,
        viagem: a.trip_days?.trips?.name ?? '—',
      })),
    );
  }, []);

  const carregarPainel = useCallback(async (activityId: string) => {
    const db = supabase();

    const { data: rc } = await db
      .from('ready_checks')
      .select('id')
      .eq('activity_id', activityId)
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setReadyCheckId(rc?.id ?? null);

    // Quem deveria estar: participantes da atividade, ou o grupo inteiro
    // quando não há lista específica.
    //
    // `profiles` não vem por junção: a chave estrangeira de
    // `activity_participants` aponta para `auth.users`, e não para
    // `public.profiles`. O PostgREST não inventa o caminho, e nem deveria —
    // os nomes vêm numa segunda consulta.
    const { data: listados } = await db
      .from('activity_participants')
      .select('user_id')
      .eq('activity_id', activityId);

    let ids = (listados ?? []).map((p) => p.user_id);

    if (ids.length === 0) {
      const { data: atividade } = await db
        .from('activities')
        .select('trip_days(trip_id)')
        .eq('id', activityId)
        .maybeSingle();

      const tripId = atividade?.trip_days?.trip_id;
      if (tripId) {
        const { data: doGrupo } = await db
          .from('trip_members')
          .select('user_id')
          .eq('trip_id', tripId);
        ids = (doGrupo ?? []).map((m) => m.user_id);
      }
    }

    const { data: perfis } = await db
      .from('profiles')
      .select('id, display_name, preferred_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

    const nomePorId = new Map(
      (perfis ?? []).map((x) => [x.id, x.preferred_name ?? x.display_name ?? '—']),
    );

    const membros = ids.map((id) => ({ userId: id, nome: nomePorId.get(id) ?? '—' }));

    const [respostas, presencas] = await Promise.all([
      rc
        ? db
            .from('ready_check_responses')
            .select('user_id, state, note')
            .eq('ready_check_id', rc.id)
        : Promise.resolve({
            data: [] as { user_id: string; state: string; note: string | null }[],
          }),
      db.from('activity_checkins').select('user_id, method').eq('activity_id', activityId),
    ]);

    const porUsuario = new Map((respostas.data ?? []).map((r) => [r.user_id, r]));
    const presente = new Map((presencas.data ?? []).map((c) => [c.user_id, c.method]));

    setPessoas(
      membros.map((m) => ({
        userId: m.userId,
        nome: m.nome,
        estado: porUsuario.get(m.userId)?.state ?? null,
        nota: porUsuario.get(m.userId)?.note ?? null,
        presente: presente.has(m.userId),
        metodo: presente.get(m.userId) ?? null,
      })),
    );
  }, []);

  useEffect(() => {
    void carregarAtividades();
  }, [carregarAtividades]);

  useEffect(() => {
    if (aberta) void carregarPainel(aberta);
  }, [aberta, carregarPainel]);

  async function abrirReadyCheck(activityId: string) {
    const { error } = await supabase().from('ready_checks').insert({ activity_id: activityId });
    if (error) setErro(error.message);
    await carregarPainel(activityId);
  }

  async function fecharReadyCheck() {
    if (!readyCheckId || !aberta) return;
    const { error } = await supabase()
      .from('ready_checks')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', readyCheckId);
    if (error) setErro(error.message);
    await carregarPainel(aberta);
  }

  /**
   * Check-in manual (§39).
   *
   * A justificativa é obrigatória no banco, não só aqui. Check-in manual sem
   * motivo é o caminho por onde a lista de presença deixa de valer.
   */
  async function checkinManual(userId: string) {
    if (!aberta) return;
    const justificativa = window.prompt(
      'Por que este check-in é manual? (celular sem bateria, QR ilegível, etc.)',
    );
    if (!justificativa || justificativa.trim().length < 3) return;

    setSalvando(userId);
    const { error } = await supabase().from('activity_checkins').insert({
      activity_id: aberta,
      user_id: userId,
      method: 'manual',
      justification: justificativa.trim(),
    });
    if (error) setErro(error.message);
    await carregarPainel(aberta);
    setSalvando(null);
  }

  if (erro && !atividades)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!atividades) return <p className="muted">Carregando…</p>;

  const semResposta = pessoas.filter((p) => !p.estado);
  const prontos = pessoas.filter((p) => p.estado === 'ready');
  const problemas = pessoas.filter((p) => p.estado && p.estado !== 'ready');

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Ready Check e presença</h1>
        </div>
        {aberta ? (
          <p className="muted">
            {prontos.length} prontos · {problemas.length} com pendência · {semResposta.length} sem
            resposta
          </p>
        ) : null}
      </div>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      <label className="field">
        <span>Atividade</span>
        <select
          value={aberta ?? ''}
          onChange={(e) => setAberta(e.target.value || null)}
          aria-label="Escolher atividade"
        >
          <option value="">Escolha uma atividade</option>
          {atividades.map((a) => (
            <option key={a.id} value={a.id}>
              {a.viagem} — {a.titulo}
              {a.comeca ? ` (${new Date(a.comeca).toLocaleString('pt-BR')})` : ''}
            </option>
          ))}
        </select>
      </label>

      {aberta ? (
        <>
          <div className="acoes">
            {readyCheckId ? (
              <button
                type="button"
                className="botao botao--fantasma"
                onClick={() => void fecharReadyCheck()}
              >
                Fechar Ready Check
              </button>
            ) : (
              <button type="button" className="botao" onClick={() => void abrirReadyCheck(aberta)}>
                Abrir Ready Check
              </button>
            )}
          </div>

          {!readyCheckId ? (
            <p className="muted">
              Sem Ready Check aberto, os botões «Estou pronto» não aparecem no app do cliente.
            </p>
          ) : null}

          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Ready Check</th>
                  <th>Observação</th>
                  <th>Presença</th>
                </tr>
              </thead>
              <tbody>
                {/* Sem resposta primeiro: é quem precisa de um telefonema. */}
                {[...semResposta, ...problemas, ...prontos].map((p) => (
                  <tr key={p.userId}>
                    <td>
                      <strong>{p.nome}</strong>
                    </td>
                    <td>
                      <span className={p.estado === 'ready' ? 'muted' : 'pendente'}>
                        {p.estado ? (ROTULO_ESTADO[p.estado] ?? p.estado) : 'Sem resposta'}
                      </span>
                    </td>
                    <td className="muted">{p.nota ?? '—'}</td>
                    <td>
                      {p.presente ? (
                        <span className="muted">
                          Presente {p.metodo === 'manual' ? '(manual)' : '(QR)'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="botao botao--fantasma"
                          disabled={salvando === p.userId}
                          onClick={() => void checkinManual(p.userId)}
                        >
                          Check-in manual
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
