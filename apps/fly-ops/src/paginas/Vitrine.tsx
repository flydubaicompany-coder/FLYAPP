import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@fly/domain-types';
import { supabase } from '../auth/client';

/**
 * Vitrine da tela Passeios (§6.1 e §40.1).
 *
 * Página separada do catálogo porque é outro trabalho. Catálogo é o que
 * existe e está à venda; vitrine é o que a Fly escolhe mostrar primeiro. A
 * mesma pessoa faz os dois, mas não na mesma sessão nem com a mesma cabeça.
 *
 * **"A Fly recomenda" é curadoria, e a tela do cliente diz isso.** Não existe
 * algoritmo de recomendação por trás: o app não tem sinal de gosto
 * estruturado, e a §33 proíbe inventar critério de ranking. O que entra aqui é
 * o que alguém escolheu a dedo.
 *
 * Seção vazia não aparece para o cliente — nem publicada. Por isso a tabela
 * mostra a contagem: publicar uma prateleira sem nada dentro não quebra a
 * tela, mas também não faz nada, e sem o número ninguém entende por quê.
 */

type Fonte = Database['public']['Enums']['tour_section_source'];

interface Secao {
  chave: string;
  rotulo: string;
  subtitulo: string | null;
  fonte: Fonte;
  selo: string | null;
  maximo: number;
  ordem: number;
  publicada: boolean;
  /** Só as curadas têm itens escolhidos a dedo. */
  curados: number;
}

interface PasseioPublicado {
  id: string;
  titulo: string;
  cidade: string | null;
}

const ROTULO_FONTE: Record<Fonte, string> = {
  selo: 'Automática, por selo',
  curada: 'Escolhida a dedo',
  destino_da_viagem: 'Destino da viagem do cliente',
};

const EXPLICACAO_FONTE: Record<Fonte, string> = {
  selo: 'Entra sozinho todo passeio publicado com o selo. Para mudar o conteúdo, mude o selo no catálogo.',
  curada: 'Só entra o que você escolher abaixo, na ordem que escolher.',
  destino_da_viagem:
    'Mostra os passeios do destino da viagem ativa do cliente. Quem não está em viagem não vê esta seção. Não usa GPS.',
};

export default function Vitrine() {
  const [secoes, setSecoes] = useState<Secao[] | null>(null);
  const [catalogo, setCatalogo] = useState<PasseioPublicado[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [itens, setItens] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const db = supabase();
    const [s, t] = await Promise.all([
      db
        .from('tour_sections')
        .select('key, label, subtitle, source, badge, max_items, sort_order, is_published')
        .order('sort_order'),
      db.from('tours').select('id, title, city').eq('status', 'published').order('title'),
    ]);

    if (s.error) return setErro(s.error.message);

    const chaves = (s.data ?? []).map((x) => x.key);
    const { data: contagens } = await db
      .from('tour_section_items')
      .select('section_key')
      .in('section_key', chaves);

    const porSecao = new Map<string, number>();
    for (const c of contagens ?? []) {
      porSecao.set(c.section_key, (porSecao.get(c.section_key) ?? 0) + 1);
    }

    setSecoes(
      (s.data ?? []).map((x) => ({
        chave: x.key,
        rotulo: x.label,
        subtitulo: x.subtitle,
        fonte: x.source,
        selo: x.badge,
        maximo: x.max_items,
        ordem: x.sort_order,
        publicada: x.is_published,
        curados: porSecao.get(x.key) ?? 0,
      })),
    );
    setCatalogo((t.data ?? []).map((x) => ({ id: x.id, titulo: x.title, cidade: x.city })));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarItens = useCallback(async (chave: string) => {
    const { data } = await supabase()
      .from('tour_section_items')
      .select('tour_id, sort_order')
      .eq('section_key', chave)
      .order('sort_order');
    setItens((data ?? []).map((i) => i.tour_id));
  }, []);

  useEffect(() => {
    if (aberta) void carregarItens(aberta);
    else setItens([]);
  }, [aberta, carregarItens]);

  async function publicar(s: Secao) {
    setSalvando(s.chave);
    setErro(null);
    const { error } = await supabase()
      .from('tour_sections')
      .update({ is_published: !s.publicada })
      .eq('key', s.chave);
    if (error) setErro(error.message);
    await carregar();
    setSalvando(null);
  }

  /**
   * A lista inteira é reescrita, e não incrementada.
   *
   * O que a pessoa vê na tela é a ordem final; salvar precisa produzir
   * exatamente aquilo. Um `upsert` item a item deixaria para trás o que ela
   * tirou, e o painel passaria a mentir sobre o que o cliente vê.
   */
  async function salvarItens(chave: string, novos: string[]) {
    setSalvando(chave);
    setErro(null);
    const db = supabase();

    const { error: apagou } = await db.from('tour_section_items').delete().eq('section_key', chave);

    if (apagou) {
      setErro(apagou.message);
      setSalvando(null);
      return;
    }

    if (novos.length > 0) {
      const { error } = await db
        .from('tour_section_items')
        .insert(novos.map((id, n) => ({ section_key: chave, tour_id: id, sort_order: n + 1 })));
      if (error) setErro(error.message);
    }

    setItens(novos);
    await carregar();
    setSalvando(null);
  }

  if (erro && !secoes)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!secoes) return <p className="muted">Carregando…</p>;

  const publicadas = secoes.filter((s) => s.publicada).length;
  const secao = secoes.find((s) => s.chave === aberta) ?? null;
  const disponiveis = catalogo.filter((p) => !itens.includes(p.id));

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Comercial</p>
          <h1>Vitrine de Passeios</h1>
        </div>
        <p className="muted">
          {publicadas} publicadas de {secoes.length}
        </p>
      </div>

      <p className="muted">
        As prateleiras da tela Passeios, na ordem em que o cliente as vê. Uma seção sem passeio não
        aparece para ele — nem publicada. «A Fly recomenda» é escolha de gente, não algoritmo: o app
        não tem sinal de gosto para recomendar sozinho, e a tela do cliente não promete que tem.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      <div className="tabela-envolvente">
        <table className="tabela">
          <thead>
            <tr>
              <th>Seção</th>
              <th>Como enche</th>
              <th>Dentro</th>
              <th>Máximo</th>
              <th>No app</th>
              <th>Curar</th>
            </tr>
          </thead>
          <tbody>
            {secoes.map((s) => (
              <tr key={s.chave}>
                <td>
                  <strong>{s.rotulo}</strong>
                  <br />
                  <span className="mono muted">{s.chave}</span>
                </td>
                <td>
                  {ROTULO_FONTE[s.fonte]}
                  {s.selo ? <span className="mono muted"> · {s.selo}</span> : null}
                </td>
                <td>
                  {s.fonte === 'curada' ? (
                    <span className={s.curados === 0 ? 'pendente' : 'muted'}>
                      {s.curados === 0 ? 'nada escolhido' : `${s.curados} escolhidos`}
                    </span>
                  ) : (
                    <span className="muted">automático</span>
                  )}
                </td>
                <td>{s.maximo}</td>
                <td>
                  <span className={s.publicada ? 'muted' : 'pendente'}>
                    {s.publicada ? 'visível' : 'oculta'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => void publicar(s)}
                    disabled={salvando === s.chave}
                  >
                    {s.publicada ? 'Ocultar' : 'Publicar'}
                  </button>{' '}
                  {s.fonte === 'curada' ? (
                    <button
                      type="button"
                      onClick={() => setAberta(aberta === s.chave ? null : s.chave)}
                    >
                      {aberta === s.chave ? 'Fechar' : 'Escolher'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {secao && secao.fonte === 'curada' ? (
        <section className="bloco">
          <h2>{secao.rotulo}</h2>
          <p className="muted">{EXPLICACAO_FONTE[secao.fonte]}</p>

          {itens.length > secao.maximo ? (
            <p role="alert" className="pendente">
              Você escolheu {itens.length}, e a seção mostra {secao.maximo}. Os últimos não aparecem
              para o cliente.
            </p>
          ) : null}

          <ol>
            {itens.map((id, n) => {
              const p = catalogo.find((x) => x.id === id);
              return (
                <li key={id}>
                  {p?.titulo ?? <span className="pendente">passeio despublicado</span>}
                  {p?.cidade ? <span className="muted"> · {p.cidade}</span> : null}{' '}
                  <button
                    type="button"
                    onClick={() =>
                      void salvarItens(
                        secao.chave,
                        itens.filter((x) => x !== id),
                      )
                    }
                    disabled={salvando === secao.chave}
                  >
                    Tirar
                  </button>{' '}
                  {n > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const novos = [...itens];
                        const anterior = novos[n - 1];
                        const atual = novos[n];
                        if (anterior === undefined || atual === undefined) return;
                        novos[n - 1] = atual;
                        novos[n] = anterior;
                        void salvarItens(secao.chave, novos);
                      }}
                      disabled={salvando === secao.chave}
                    >
                      Subir
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {itens.length === 0 ? (
            <p className="pendente">
              Nada escolhido. Enquanto estiver assim, esta seção não aparece para o cliente.
            </p>
          ) : null}

          <label>
            Acrescentar passeio
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                void salvarItens(secao.chave, [...itens, e.target.value]);
              }}
              disabled={salvando === secao.chave || disponiveis.length === 0}
            >
              <option value="">
                {disponiveis.length === 0 ? 'todos já estão na seção' : 'escolher…'}
              </option>
              {disponiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                  {p.cidade ? ` — ${p.cidade}` : ''}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
    </>
  );
}
