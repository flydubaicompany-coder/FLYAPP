import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Avisos ao cliente — lacuna 2 da auditoria de paridade.
 *
 * O app tem uma caixa de avisos desde a Fase 3 e ninguém nunca conseguiu
 * enchê-la: `notifications` só tinha GRANT de `select` e de `update (read_at)`.
 * Mudança de horário de roteiro não virava aviso; virava telefonema.
 *
 * Três coisas que esta tela faz de propósito:
 *
 *   • **O aviso é por viagem.** Não existe botão de mandar para todo mundo. Um
 *     broadcast global é a ação de mais alcance do produto inteiro, e nenhum
 *     fluxo do cliente precisa dele. Quando precisar, entra com aprovação de
 *     duas pessoas — não como campo em branco.
 *
 *   • **A preferência do cliente vale**, menos em categoria crítica. A §26 é
 *     literal sobre isso, e o outro lado da mesma frase é que o resto pode ser
 *     silenciado. Por isso a tela mostra quantos **não** receberam: sem esse
 *     número o operador acha que avisou todo mundo.
 *
 *   • **O texto é escrito por quem envia.** Nada aqui monta frase sozinho.
 */

interface Categoria {
  chave: string;
  rotulo: string;
  descricao: string;
  critica: boolean;
}

interface Viagem {
  id: string;
  nome: string;
  status: string;
}

interface Participante {
  id: string;
  nome: string;
}

interface Enviado {
  id: string;
  titulo: string;
  corpo: string | null;
  categoria: string;
  quando: string;
  lido: boolean;
  paraQuem: string;
}

export function Avisos() {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [recentes, setRecentes] = useState<Enviado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [form, setForm] = useState({
    viagem: '',
    categoria: '',
    titulo: '',
    corpo: '',
    link: '',
    so: [] as string[],
  });

  const carregar = useCallback(async () => {
    const db = supabase();
    const [catRes, viagemRes, notifRes] = await Promise.all([
      db
        .from('notification_categories')
        .select('key, label, description, is_critical')
        .order('sort_order'),
      db
        .from('trips')
        .select('id, name, status')
        .order('starts_on', { ascending: false })
        .limit(50),
      db
        .from('notifications')
        .select('id, title, body, category_key, created_at, read_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (catRes.error) return setErro(catRes.error.message);

    const ids = [...new Set((notifRes.data ?? []).map((n) => n.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );

    setCategorias(
      (catRes.data ?? []).map((c) => ({
        chave: c.key,
        rotulo: c.label,
        descricao: c.description,
        critica: c.is_critical,
      })),
    );
    setViagens((viagemRes.data ?? []).map((t) => ({ id: t.id, nome: t.name, status: t.status })));
    setRecentes(
      (notifRes.data ?? []).map((n) => ({
        id: n.id,
        titulo: n.title,
        corpo: n.body,
        categoria: n.category_key,
        quando: n.created_at,
        lido: n.read_at !== null,
        paraQuem: nomeDe.get(n.user_id) ?? 'Conta removida',
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // A lista de quem vai receber é a de participantes da viagem escolhida.
  // Ela não é decorativa: é o que a pessoa confere antes de apertar o botão.
  useEffect(() => {
    if (!form.viagem) return setParticipantes([]);
    void (async () => {
      const db = supabase();
      const { data: membros } = await db
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', form.viagem);
      const ids = (membros ?? []).map((m) => m.user_id);
      const { data: perfis } = await db
        .from('profiles')
        .select('id, preferred_name, display_name')
        .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
      setParticipantes(
        (perfis ?? []).map((p) => ({
          id: p.id,
          nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
        })),
      );
    })();
  }, [form.viagem]);

  const enviar = useCallback(async () => {
    setOcupado(true);
    setErro(null);
    setRecado(null);

    const { data, error } = await supabase().rpc('enviar_aviso', {
      p_trip: form.viagem,
      p_category: form.categoria,
      p_title: form.titulo.trim(),
      ...(form.corpo.trim() ? { p_body: form.corpo.trim() } : {}),
      ...(form.link.trim() ? { p_deep_link: form.link.trim() } : {}),
      ...(form.so.length > 0 ? { p_users: form.so } : {}),
    });
    setOcupado(false);

    if (error) return setErro(error.message);
    const linha = data?.[0];
    if (!linha?.ok) return setErro(linha?.motivo ?? 'Não deu.');

    setRecado(
      linha.silenciados > 0
        ? `${linha.enviados} receberam. ${linha.silenciados} não: silenciaram esta categoria, e a §26 só proíbe silenciar alerta crítico.`
        : `${linha.enviados} receberam.`,
    );
    setForm({ ...form, titulo: '', corpo: '', link: '', so: [] });
    await carregar();
  }, [form, carregar]);

  if (erro && !categorias)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!categorias) return <p className="muted">Carregando…</p>;

  const escolhida = categorias.find((c) => c.chave === form.categoria);
  const alcance = form.so.length > 0 ? form.so.length : participantes.length;

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Avisos</p>
          <h1>Falar com quem está viajando</h1>
          <p className="muted">
            O aviso vai para os participantes de uma viagem. Não há envio para todo mundo, e a falta
            é deliberada.
          </p>
        </div>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      <section className="secao">
        <h2>Novo aviso</h2>
        <div className="form">
          <label className="field">
            <span>Viagem</span>
            <select
              value={form.viagem}
              onChange={(e) => setForm({ ...form, viagem: e.target.value, so: [] })}
            >
              <option value="">Escolha</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} · {t.status}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Categoria</span>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="">Escolha</option>
              {categorias.map((c) => (
                <option key={c.chave} value={c.chave}>
                  {c.rotulo}
                  {c.critica ? ' (crítica)' : ''}
                </option>
              ))}
            </select>
          </label>
          {escolhida ? (
            <p className="muted">
              {escolhida.descricao}{' '}
              {escolhida.critica
                ? 'Categoria crítica: chega a todos, mesmo a quem silenciou.'
                : 'Quem silenciou esta categoria não recebe.'}
            </p>
          ) : null}

          <label className="field">
            <span>Título</span>
            <input
              maxLength={160}
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Texto</span>
            <textarea
              rows={3}
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Levar para (rota do app, opcional)</span>
            <input
              className="mono"
              placeholder="/viagem/roteiro"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
            />
          </label>

          {participantes.length > 0 ? (
            <fieldset className="checks">
              <legend>
                Para quem ({alcance} de {participantes.length})
              </legend>
              <p className="muted">
                Sem marcar ninguém, vai para todos os participantes. Marcar só restringe — não há
                como acrescentar quem não está na viagem.
              </p>
              {participantes.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={form.so.includes(p.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        so: e.target.checked
                          ? [...form.so, p.id]
                          : form.so.filter((i) => i !== p.id),
                      })
                    }
                  />
                  {p.nome}
                </label>
              ))}
            </fieldset>
          ) : null}

          <button
            type="button"
            className="botao"
            disabled={ocupado || !form.viagem || !form.categoria || !form.titulo.trim()}
            onClick={() => void enviar()}
          >
            Enviar para {alcance} pessoa{alcance === 1 ? '' : 's'}
          </button>
        </div>
      </section>

      <section className="secao">
        <h2>Últimos avisos</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Para</th>
                <th>Categoria</th>
                <th>Título</th>
                <th>Lido</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((n) => (
                <tr key={n.id}>
                  <td className="mono">{new Date(n.quando).toLocaleString('pt-BR')}</td>
                  <td>{n.paraQuem}</td>
                  <td className="muted">{n.categoria}</td>
                  <td>{n.titulo}</td>
                  <td>{n.lido ? 'Sim' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentes.length === 0 ? <p className="muted">Nenhum aviso enviado ainda.</p> : null}
      </section>
    </>
  );
}
