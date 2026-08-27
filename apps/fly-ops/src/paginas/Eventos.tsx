import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@fly/domain-types';
import { supabase } from '../auth/client';

/** Campos que este painel pode alterar num evento. */
type CamposEvento = Database['public']['Tables']['events']['Update'];

/**
 * Eventos (§16.10 e §38.7).
 *
 * Publicar, ordenar na Home e retirar. O critério da §38 é literal: "evento
 * publicado aparece sem nova build" — e é isso que esta tela entrega. O app do
 * cliente lê `events` direto; publicar aqui muda a Home dele na próxima
 * abertura.
 *
 * `home_order` merece explicação: nulo significa "não aparece no destaque da
 * Home", e não "não existe". O evento continua na listagem completa. Tirar do
 * destaque é diferente de despublicar, e a operação precisa das duas ações.
 */

interface Evento {
  id: string;
  slug: string;
  titulo: string;
  categoria: string;
  status: string;
  publicado: boolean;
  ordemHome: number | null;
  cidade: string | null;
  comecaEm: string | null;
}

const ROTULO_STATUS: Record<string, string> = {
  announced: 'Anunciado',
  registration_open: 'Inscrições abertas',
  happening: 'Acontecendo',
  finished: 'Encerrado',
};

const STATUS_DISPONIVEIS = Object.keys(ROTULO_STATUS);

export function Eventos() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('events')
      .select('id, slug, title, category_key, status, is_published, home_order, city, starts_at')
      .order('home_order', { ascending: true, nullsFirst: false })
      .order('title');

    if (error) return setErro(error.message);
    setEventos(
      (data ?? []).map((e) => ({
        id: e.id,
        slug: e.slug,
        titulo: e.title,
        categoria: e.category_key,
        status: e.status,
        publicado: e.is_published,
        ordemHome: e.home_order,
        cidade: e.city,
        comecaEm: e.starts_at,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function atualizar(evento: Evento, campos: CamposEvento) {
    setSalvando(evento.id);
    setErro(null);
    const { error } = await supabase().from('events').update(campos).eq('id', evento.id);
    if (error) setErro(error.message);
    await carregar();
    setSalvando(null);
  }

  function alternarPublicacao(evento: Evento) {
    // `published_at` acompanha o estado: há constraint no banco exigindo data
    // quando publicado. Despublicar limpa, para o histórico não mentir.
    void atualizar(evento, {
      is_published: !evento.publicado,
      published_at: evento.publicado ? null : new Date().toISOString(),
    });
  }

  /**
   * Coloca no destaque, na primeira vaga livre.
   *
   * Sem isso, um evento sem posicao entrava com um numero arbitrario e dois
   * eventos acabavam empatados — e empate em ordenacao vira ordem aleatoria
   * na Home do cliente.
   */
  function destacar(evento: Evento) {
    const ocupadas = (eventos ?? []).map((e) => e.ordemHome).filter((n): n is number => n !== null);
    const proxima = ocupadas.length === 0 ? 1 : Math.max(...ocupadas) + 1;
    void atualizar(evento, { home_order: proxima });
  }

  /** Troca de lugar com o vizinho, em vez de somar um numero solto. */
  function mover(evento: Evento, direcao: -1 | 1) {
    if (evento.ordemHome === null || !eventos) return;

    const destacados = eventos
      .filter((e) => e.ordemHome !== null)
      .sort((a, b) => (a.ordemHome ?? 0) - (b.ordemHome ?? 0));

    const i = destacados.findIndex((e) => e.id === evento.id);
    const vizinho = destacados[i + direcao];
    if (!vizinho) return;

    // Trocar as duas posicoes mantem a sequencia sem buracos.
    void (async () => {
      await atualizar(evento, { home_order: vizinho.ordemHome });
      await atualizar(vizinho, { home_order: evento.ordemHome });
    })();
  }

  if (erro && !eventos)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!eventos) return <p className="muted">Carregando…</p>;

  const noDestaque = eventos.filter((e) => e.publicado && e.ordemHome !== null).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Eventos</p>
          <h1>Acontece na Fly</h1>
        </div>
        <p className="muted">{noDestaque} em destaque na Home · a Home mostra até 3</p>
      </div>

      <p className="muted">
        O que você publicar aqui aparece no app do cliente sem nova versão. Tirar do destaque não
        despublica: o evento sai da Home e continua na listagem.
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
              <th>Evento</th>
              <th>Categoria</th>
              <th>Situação</th>
              <th>Publicado</th>
              <th>Destaque</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.titulo}</strong>
                  <br />
                  <span className="mono muted">{e.slug}</span>
                </td>
                <td className="mono">{e.categoria}</td>
                <td>
                  <select
                    value={e.status}
                    disabled={salvando === e.id}
                    aria-label={`Situação de ${e.titulo}`}
                    onChange={(ev) =>
                      void atualizar(e, {
                        status: ev.target.value as Database['public']['Enums']['event_status'],
                      })
                    }
                  >
                    {STATUS_DISPONIVEIS.map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className={e.publicado ? 'botao' : 'botao botao--fantasma'}
                    disabled={salvando === e.id}
                    aria-pressed={e.publicado}
                    onClick={() => alternarPublicacao(e)}
                  >
                    {e.publicado ? 'Publicado' : 'Publicar'}
                  </button>
                </td>
                <td>
                  {!e.publicado ? (
                    <span className="muted">—</span>
                  ) : e.ordemHome === null ? (
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={salvando === e.id}
                      aria-label={`Destacar ${e.titulo} na Home`}
                      onClick={() => destacar(e)}
                    >
                      Destacar
                    </button>
                  ) : (
                    <div className="acoes">
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={salvando === e.id}
                        aria-label={`Subir ${e.titulo} na Home`}
                        onClick={() => mover(e, -1)}
                      >
                        ↑
                      </button>
                      <span className="mono">{e.ordemHome}</span>
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={salvando === e.id}
                        aria-label={`Descer ${e.titulo} na Home`}
                        onClick={() => mover(e, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={salvando === e.id}
                        aria-label={`Tirar ${e.titulo} do destaque`}
                        onClick={() => void atualizar(e, { home_order: null })}
                      >
                        Tirar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
