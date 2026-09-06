import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Álbum e Fly Quest (§13.1, §13.2, §14.1 e §44).
 *
 * Esta tela existe pela mesma razão que a do Mapa: **conteúdo crítico não
 * fica no código**. Capítulo, figurinha e missão são conteúdo editorial da
 * Fly, e sem esta página o álbum de toda viagem nasceria vazio e continuaria
 * vazio até alguém escrever SQL.
 *
 * **Quanto vale cada figurinha em pontos é digitado aqui, e nasce zero.**
 * Fórmula de pontos está na lista da §33 do que nunca se inventa: o sistema
 * não escolhe o número, a operação escolhe. E enquanto `points.earning_rule`
 * tiver versão nula, nada é creditado de qualquer forma (D136).
 *
 * O que esta tela **não** faz é desbloquear figurinha em massa. Liberar é um
 * ato por pessoa, com responsável registrado — está na página do cliente.
 */

type Raridade = 'common' | 'rare' | 'secret' | 'holographic';
type Desbloqueio = 'activity_checkin' | 'qr' | 'manual';

const NOME_RARIDADE: Record<Raridade, string> = {
  common: 'Comum',
  rare: 'Rara',
  secret: 'Secreta',
  holographic: 'Holográfica',
};

const NOME_DESBLOQUEIO: Record<Desbloqueio, string> = {
  activity_checkin: 'Check-in da atividade',
  qr: 'Código',
  manual: 'Liberação a mão',
};

const RARIDADES: Raridade[] = ['common', 'rare', 'secret', 'holographic'];
const DESBLOQUEIOS: Desbloqueio[] = ['activity_checkin', 'qr', 'manual'];

interface Figurinha {
  id: string;
  codigo: string;
  nome: string;
  raridade: Raridade;
  obrigatoria: boolean;
  desbloqueio: Desbloqueio;
  atividadeId: string | null;
  pontos: number;
  publicada: boolean;
  conquistas: number;
}

interface Capitulo {
  id: string;
  titulo: string;
  teaser: string | null;
  recompensa: string | null;
  pontos: number;
  liberaEm: string | null;
  publicado: boolean;
  diaNumero: number;
  figurinhas: Figurinha[];
  completos: number;
}

interface Viagem {
  id: string;
  nome: string;
}

interface Dia {
  id: string;
  numero: number;
  temCapitulo: boolean;
}

interface Atividade {
  id: string;
  titulo: string;
  diaId: string;
}

const FIG_VAZIA = {
  codigo: '',
  nome: '',
  raridade: 'common' as Raridade,
  obrigatoria: false,
  desbloqueio: 'activity_checkin' as Desbloqueio,
  atividadeId: '',
  pontos: '0',
};

export function Album() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagemId, setViagemId] = useState('');
  const [capitulos, setCapitulos] = useState<Capitulo[] | null>(null);
  const [dias, setDias] = useState<Dia[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novoCap, setNovoCap] = useState({
    diaId: '',
    titulo: '',
    teaser: '',
    recompensa: '',
    pontos: '0',
  });
  const [novaFig, setNovaFig] = useState<Record<string, typeof FIG_VAZIA>>({});
  /**
   * Fly Quest entrou na Fase 11.
   *
   * A auditoria de paridade (lacuna 10) achou que o Álbum operava capítulo e
   * figurinha, e a **missão** — que é o outro lado da §14 — não tinha tela
   * nenhuma. O cliente via a aba de Quest e a operação não conseguia criar uma
   * missão sem abrir o banco.
   */
  const [missoes, setMissoes] = useState<
    {
      id: string;
      codigo: string;
      titulo: string;
      pontos: number;
      publicada: boolean;
      concluidas: number;
    }[]
  >([]);
  const [novaMissao, setNovaMissao] = useState({
    codigo: '',
    titulo: '',
    briefing: '',
    pontos: '10',
  });

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
    if (!viagemId) return setCapitulos([]);
    const db = supabase();

    const [capsRes, diasRes, ativRes, missoesRes] = await Promise.all([
      db
        .from('album_chapters')
        .select(
          'id, title, teaser, reward_note, reward_points, release_at, is_published, trip_day_id, stickers(id, code, name, rarity, is_required, unlock_kind, activity_id, points_reward, is_published, sort_order)',
        )
        .eq('trip_id', viagemId)
        .order('sort_order'),
      db.from('trip_days').select('id, day_number').eq('trip_id', viagemId).order('day_number'),
      db
        .from('trip_days')
        .select('id, activities(id, title)')
        .eq('trip_id', viagemId)
        .order('day_number'),
      db
        .from('quest_missions')
        .select('id, code, title, points_reward, is_published, quest_completions(id)')
        .eq('trip_id', viagemId)
        .order('sort_order'),
    ]);

    if (capsRes.error) return setErro(capsRes.error.message);

    const caps = capsRes.data ?? [];
    const usados = new Set(caps.map((c) => c.trip_day_id));
    setDias(
      (diasRes.data ?? []).map((d) => ({
        id: d.id,
        numero: d.day_number,
        temCapitulo: usados.has(d.id),
      })),
    );

    setAtividades(
      (ativRes.data ?? []).flatMap((d) =>
        ((d.activities ?? []) as Array<{ id: string; title: string }>).map((a) => ({
          id: a.id,
          titulo: a.title,
          diaId: d.id,
        })),
      ),
    );

    // Quantas pessoas fecharam cada capítulo — o número que diz se a
    // configuração do dia está alcançável na prática.
    const { data: completos } = await db
      .from('chapter_completions')
      .select('chapter_id')
      .in(
        'chapter_id',
        caps.length > 0 ? caps.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000'],
      );
    const porCapitulo = new Map<string, number>();
    for (const c of completos ?? []) {
      porCapitulo.set(c.chapter_id, (porCapitulo.get(c.chapter_id) ?? 0) + 1);
    }

    const figIds = caps.flatMap((c) =>
      ((c.stickers ?? []) as Array<{ id: string }>).map((s) => s.id),
    );
    const { data: unlocks } = await db
      .from('sticker_unlocks')
      .select('sticker_id')
      .in('sticker_id', figIds.length > 0 ? figIds : ['00000000-0000-0000-0000-000000000000']);
    const porFigurinha = new Map<string, number>();
    for (const u of unlocks ?? []) {
      porFigurinha.set(u.sticker_id, (porFigurinha.get(u.sticker_id) ?? 0) + 1);
    }

    setMissoes(
      (missoesRes.data ?? []).map((m) => ({
        id: m.id,
        codigo: m.code,
        titulo: m.title,
        pontos: m.points_reward,
        publicada: m.is_published,
        concluidas: (m.quest_completions ?? []).length,
      })),
    );

    const numeroDoDia = new Map((diasRes.data ?? []).map((d) => [d.id, d.day_number]));

    setCapitulos(
      caps.map((c) => ({
        id: c.id,
        titulo: c.title,
        teaser: c.teaser,
        recompensa: c.reward_note,
        pontos: c.reward_points,
        liberaEm: c.release_at,
        publicado: c.is_published,
        diaNumero: numeroDoDia.get(c.trip_day_id) ?? 0,
        completos: porCapitulo.get(c.id) ?? 0,
        figurinhas: (
          (c.stickers ?? []) as Array<{
            id: string;
            code: string;
            name: string;
            rarity: string;
            is_required: boolean;
            unlock_kind: string;
            activity_id: string | null;
            points_reward: number;
            is_published: boolean;
            sort_order: number;
          }>
        )
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            id: s.id,
            codigo: s.code,
            nome: s.name,
            raridade: s.rarity as Raridade,
            obrigatoria: s.is_required,
            desbloqueio: s.unlock_kind as Desbloqueio,
            atividadeId: s.activity_id,
            pontos: s.points_reward,
            publicada: s.is_published,
            conquistas: porFigurinha.get(s.id) ?? 0,
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

  function inteiro(texto: string): number {
    const n = Number(texto.trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  async function criarCapitulo() {
    if (!novoCap.diaId) return setErro('Escolha o dia. Um capítulo é um dia da viagem.');
    if (!novoCap.titulo.trim()) return setErro('O capítulo precisa de um título.');

    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('album_chapters')
      .insert({
        trip_id: viagemId,
        trip_day_id: novoCap.diaId,
        title: novoCap.titulo.trim(),
        teaser: novoCap.teaser.trim() || null,
        reward_note: novoCap.recompensa.trim() || null,
        reward_points: inteiro(novoCap.pontos),
      });
    if (error) setErro(error.message);
    else {
      setRecado('Capítulo criado. Ele só aparece para o cliente quando você publicar.');
      setNovoCap({ diaId: '', titulo: '', teaser: '', recompensa: '', pontos: '0' });
    }
    await carregar();
    setOcupado(false);
  }

  async function criarFigurinha(cap: Capitulo) {
    const f = novaFig[cap.id] ?? FIG_VAZIA;
    if (!f.codigo.trim() || !f.nome.trim()) {
      return setErro(
        'A figurinha precisa de código e nome. O código entra no QR e no álbum físico.',
      );
    }
    if (f.desbloqueio === 'activity_checkin' && !f.atividadeId) {
      return setErro(
        'Desbloqueio por check-in precisa de uma atividade — é o check-in dela que libera.',
      );
    }

    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('stickers')
      .insert({
        chapter_id: cap.id,
        code: f.codigo.trim().toLowerCase(),
        name: f.nome.trim(),
        rarity: f.raridade,
        is_required: f.obrigatoria,
        unlock_kind: f.desbloqueio,
        activity_id: f.desbloqueio === 'activity_checkin' ? f.atividadeId : null,
        points_reward: inteiro(f.pontos),
      });
    if (error) setErro(error.message);
    else {
      setRecado('Figurinha criada.');
      setNovaFig({ ...novaFig, [cap.id]: FIG_VAZIA });
    }
    await carregar();
    setOcupado(false);
  }

  async function publicarCapitulo(c: Capitulo, publicado: boolean) {
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('album_chapters')
      .update({ is_published: publicado })
      .eq('id', c.id);
    if (error) setErro(error.message);
    else setRecado(publicado ? 'Capítulo publicado.' : 'Capítulo escondido.');
    await carregar();
    setOcupado(false);
  }

  async function publicarFigurinha(f: Figurinha, publicada: boolean) {
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('stickers')
      .update({ is_published: publicada })
      .eq('id', f.id);
    if (error) setErro(error.message);
    else setRecado(publicada ? 'Figurinha publicada.' : 'Figurinha escondida.');
    await carregar();
    setOcupado(false);
  }

  async function publicarMissao(id: string, publicada: boolean) {
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('quest_missions')
      .update({ is_published: publicada })
      .eq('id', id);
    if (error) setErro(error.message);
    else setRecado(publicada ? 'Missão publicada.' : 'Missão escondida.');
    await carregar();
    setOcupado(false);
  }

  async function criarMissao() {
    setOcupado(true);
    setErro(null);
    const pontos = Number(novaMissao.pontos);
    // A constraint do banco recusa missão que não entrega nada. Dizer isso
    // aqui é melhor do que devolver o erro do Postgres para a tela.
    if (!Number.isInteger(pontos) || pontos < 1) {
      setOcupado(false);
      return setErro('Missão sem ponto e sem figurinha não é missão, é texto.');
    }
    const { error } = await supabase()
      .from('quest_missions')
      .insert({
        trip_id: viagemId,
        code: novaMissao.codigo.trim(),
        title: novaMissao.titulo.trim(),
        briefing: novaMissao.briefing.trim() || null,
        points_reward: pontos,
      });
    if (error) setErro(error.message);
    else {
      setNovaMissao({ codigo: '', titulo: '', briefing: '', pontos: '10' });
      setRecado('Missão criada, e escondida até você publicar.');
    }
    await carregar();
    setOcupado(false);
  }

  if (erro && !capitulos)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!capitulos) return <p className="muted">Carregando…</p>;

  const semCapitulo = dias.filter((d) => !d.temCapitulo);

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Encantamento</p>
          <h1>Álbum</h1>
        </div>
        <p className="muted">
          {capitulos.filter((c) => c.publicado).length} capítulos publicados de {capitulos.length}
        </p>
      </div>

      <p className="muted">
        Um capítulo por dia da viagem. O <strong>Dia Completo</strong> fecha sozinho, no servidor,
        quando a pessoa conquista todas as figurinhas <strong>obrigatórias e publicadas</strong> do
        capítulo — o app não decide isso. Capítulo sem nenhuma obrigatória não fecha nunca.
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
        <h3>Novo capítulo</h3>
        {semCapitulo.length === 0 ? (
          <p className="muted">
            Todos os dias desta viagem já têm capítulo. Crie um dia no roteiro para abrir outro.
          </p>
        ) : (
          <>
            <div className="form">
              <label className="field">
                <span className="muted">Dia</span>
                <select
                  value={novoCap.diaId}
                  onChange={(e) => setNovoCap({ ...novoCap, diaId: e.target.value })}
                >
                  <option value="">— escolha —</option>
                  {semCapitulo.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dia {d.numero}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="muted">Título</span>
                <input
                  value={novoCap.titulo}
                  onChange={(e) => setNovoCap({ ...novoCap, titulo: e.target.value })}
                  placeholder="O deserto"
                />
              </label>
              <label className="field">
                <span className="muted">Teaser do próximo capítulo</span>
                <input
                  value={novoCap.teaser}
                  onChange={(e) => setNovoCap({ ...novoCap, teaser: e.target.value })}
                  placeholder="Amanhã o mar."
                />
              </label>
              <label className="field">
                <span className="muted">Recompensa (texto)</span>
                <input
                  value={novoCap.recompensa}
                  onChange={(e) => setNovoCap({ ...novoCap, recompensa: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="muted">Pontos do capítulo</span>
                <input
                  value={novoCap.pontos}
                  onChange={(e) => setNovoCap({ ...novoCap, pontos: e.target.value })}
                />
              </label>
            </div>
            <div className="acoes">
              <button
                type="button"
                className="botao"
                disabled={ocupado}
                onClick={() => void criarCapitulo()}
              >
                Criar capítulo
              </button>
            </div>
          </>
        )}
      </section>

      {capitulos.length === 0 ? (
        <p className="muted">Esta viagem ainda não tem capítulo nenhum.</p>
      ) : (
        capitulos.map((c) => {
          const f = novaFig[c.id] ?? FIG_VAZIA;
          const obrigatorias = c.figurinhas.filter((x) => x.obrigatoria && x.publicada).length;
          return (
            <section key={c.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">Dia {c.diaNumero}</p>
                  <h3>{c.titulo}</h3>
                </div>
                <span className={c.publicado ? 'selo selo--ok' : 'selo selo--pendente'}>
                  {c.publicado ? 'Publicado' : 'Rascunho'}
                </span>
              </div>

              <dl className="facts">
                <div>
                  <dt>Figurinhas</dt>
                  <dd>{c.figurinhas.length}</dd>
                </div>
                <div>
                  <dt>Obrigatórias publicadas</dt>
                  <dd>{obrigatorias}</dd>
                </div>
                <div>
                  <dt>Dia Completo</dt>
                  <dd>{c.completos} pessoas</dd>
                </div>
                <div>
                  <dt>Pontos do capítulo</dt>
                  <dd className="mono">{c.pontos}</dd>
                </div>
              </dl>

              {obrigatorias === 0 ? (
                <p className="aviso">
                  Sem nenhuma figurinha obrigatória publicada, este capítulo <strong>nunca</strong>{' '}
                  fecha o Dia Completo. É o comportamento correto — um capítulo assim ainda está
                  sendo montado —, mas se você já publicou, marque pelo menos uma como obrigatória.
                </p>
              ) : null}

              {c.figurinhas.length > 0 ? (
                <ul className="checks">
                  {c.figurinhas.map((x) => (
                    <li key={x.id}>
                      <span>
                        <strong>{x.nome}</strong> <span className="mono">{x.codigo}</span> ·{' '}
                        {NOME_RARIDADE[x.raridade]}
                        {x.obrigatoria ? ' · obrigatória' : ''} · {NOME_DESBLOQUEIO[x.desbloqueio]}
                        {x.pontos > 0 ? ` · ${x.pontos} pts` : ''} · {x.conquistas} conquistas
                        {x.publicada ? '' : ' · rascunho'}
                      </span>
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado}
                        onClick={() => void publicarFigurinha(x, !x.publicada)}
                      >
                        {x.publicada ? 'Esconder' : 'Publicar'}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nenhuma figurinha neste capítulo.</p>
              )}

              <div className="form">
                <label className="field">
                  <span className="muted">Código</span>
                  <input
                    value={f.codigo}
                    onChange={(e) =>
                      setNovaFig({ ...novaFig, [c.id]: { ...f, codigo: e.target.value } })
                    }
                    placeholder="deserto-por-do-sol"
                  />
                </label>
                <label className="field">
                  <span className="muted">Nome</span>
                  <input
                    value={f.nome}
                    onChange={(e) =>
                      setNovaFig({ ...novaFig, [c.id]: { ...f, nome: e.target.value } })
                    }
                    placeholder="Pôr do sol no deserto"
                  />
                </label>
                <label className="field">
                  <span className="muted">Raridade</span>
                  <select
                    value={f.raridade}
                    onChange={(e) =>
                      setNovaFig({
                        ...novaFig,
                        [c.id]: { ...f, raridade: e.target.value as Raridade },
                      })
                    }
                  >
                    {RARIDADES.map((r) => (
                      <option key={r} value={r}>
                        {NOME_RARIDADE[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="muted">Como desbloqueia</span>
                  <select
                    value={f.desbloqueio}
                    onChange={(e) =>
                      setNovaFig({
                        ...novaFig,
                        [c.id]: { ...f, desbloqueio: e.target.value as Desbloqueio },
                      })
                    }
                  >
                    {DESBLOQUEIOS.map((d) => (
                      <option key={d} value={d}>
                        {NOME_DESBLOQUEIO[d]}
                      </option>
                    ))}
                  </select>
                </label>
                {f.desbloqueio === 'activity_checkin' ? (
                  <label className="field">
                    <span className="muted">Atividade que libera</span>
                    <select
                      value={f.atividadeId}
                      onChange={(e) =>
                        setNovaFig({ ...novaFig, [c.id]: { ...f, atividadeId: e.target.value } })
                      }
                    >
                      <option value="">— escolha —</option>
                      {atividades.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.titulo}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="field">
                  <span className="muted">Pontos</span>
                  <input
                    value={f.pontos}
                    onChange={(e) =>
                      setNovaFig({ ...novaFig, [c.id]: { ...f, pontos: e.target.value } })
                    }
                  />
                </label>
                <label className="field">
                  <span className="muted">Obrigatória para o Dia Completo</span>
                  <select
                    value={f.obrigatoria ? 'sim' : 'nao'}
                    onChange={(e) =>
                      setNovaFig({
                        ...novaFig,
                        [c.id]: { ...f, obrigatoria: e.target.value === 'sim' },
                      })
                    }
                  >
                    <option value="nao">Opcional</option>
                    <option value="sim">Obrigatória</option>
                  </select>
                </label>
              </div>

              <div className="acoes">
                <button
                  type="button"
                  className="botao botao--fantasma"
                  disabled={ocupado}
                  onClick={() => void criarFigurinha(c)}
                >
                  Adicionar figurinha
                </button>
                <button
                  type="button"
                  className={c.publicado ? 'botao botao--fantasma' : 'botao'}
                  disabled={ocupado}
                  onClick={() => void publicarCapitulo(c, !c.publicado)}
                >
                  {c.publicado ? 'Esconder capítulo' : 'Publicar capítulo'}
                </button>
              </div>
            </section>
          );
        })
      )}

      <section className="secao">
        <h2>Fly Quest</h2>
        <p className="muted">
          Missão nasce escondida e só aparece quando alguém publica. O código é a prova aceita hoje
          — geofence é a §14.1 futura, e não há provedor de mapa homologado (P16).
        </p>

        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Código</th>
                <th>Missão</th>
                <th>Pontos</th>
                <th>Concluíram</th>
                <th>Publicada</th>
              </tr>
            </thead>
            <tbody>
              {missoes.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.codigo}</td>
                  <td>{m.titulo}</td>
                  <td className="mono">{m.pontos}</td>
                  <td className="mono">{m.concluidas}</td>
                  <td>
                    <button
                      type="button"
                      className={m.publicada ? 'botao botao--fantasma' : 'botao'}
                      disabled={ocupado}
                      onClick={() => void publicarMissao(m.id, !m.publicada)}
                    >
                      {m.publicada ? 'Esconder' : 'Publicar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {missoes.length === 0 ? <p className="muted">Nenhuma missão nesta viagem.</p> : null}

        <div className="form form--linha">
          <label className="field">
            <span>Código</span>
            <input
              className="mono"
              placeholder="marina-ao-por-do-sol"
              value={novaMissao.codigo}
              onChange={(e) => setNovaMissao({ ...novaMissao, codigo: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Missão</span>
            <input
              value={novaMissao.titulo}
              onChange={(e) => setNovaMissao({ ...novaMissao, titulo: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Briefing</span>
            <input
              value={novaMissao.briefing}
              onChange={(e) => setNovaMissao({ ...novaMissao, briefing: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Pontos</span>
            <input
              type="number"
              min={1}
              value={novaMissao.pontos}
              onChange={(e) => setNovaMissao({ ...novaMissao, pontos: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !novaMissao.codigo.trim() || !novaMissao.titulo.trim()}
            onClick={() => void criarMissao()}
          >
            Criar missão
          </button>
        </div>
      </section>
    </>
  );
}
