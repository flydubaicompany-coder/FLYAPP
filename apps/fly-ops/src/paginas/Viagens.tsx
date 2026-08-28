import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@fly/domain-types';
import { supabase } from '../auth/client';
import { NovaViagem } from '../componentes/NovaViagem';
import { Viajantes } from '../componentes/Viajantes';

/** Campos que este painel pode alterar numa atividade. */
type CamposAtividade = Database['public']['Tables']['activities']['Update'];

/**
 * Viagens e roteiro (§16 e §39).
 *
 * O critério da §39 é "mudança no painel aparece no app". Esta é a tela onde
 * a mudança acontece — e a que precisa deixar claro que ela **é** publicação.
 *
 * O aviso de alteração não é decorativo: mexer em horário ou ponto de
 * encontro de uma atividade dispara o carimbo de alteração no banco, e o
 * cliente vê o destaque. Quem edita precisa saber disso antes de clicar.
 */

interface Viagem {
  id: string;
  nome: string;
  destino: string;
  status: string;
  comeca: string;
  termina: string;
  dias: number;
  atividades: number;
}

interface Dia {
  id: string;
  numero: number;
  data: string;
  titulo: string | null;
}

interface Atividade {
  id: string;
  diaId: string;
  titulo: string;
  status: string;
  comeca: string | null;
  saida: string | null;
  ponto: string | null;
  exigeConfirmacao: boolean;
  alteradoEm: string | null;
}

interface Template {
  id: string;
  nome: string;
  atividades: number;
}

const ROTULO_STATUS: Record<string, string> = {
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  in_progress: 'Acontecendo',
  done: 'Concluído',
  changed: 'Alterado',
  cancelled: 'Cancelado',
};

/** Converte `timestamptz` para o valor de um `<input type="datetime-local">`. */
function paraCampo(iso: string | null, timezone: string): string {
  if (!iso) return '';
  // `sv-SE` produz "2026-09-12 20:00", que é o formato ISO curto de que o
  // campo precisa depois de trocar o espaço por "T". É o truque mais direto
  // para formatar num fuso arbitrário sem biblioteca.
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
  return partes.replace(' ', 'T');
}

/**
 * E de volta.
 *
 * O operador digita a hora **local do destino**. Sem esta conversão, "20h" em
 * Dubai viraria 20h no fuso do navegador de quem edita — e o roteiro sairia
 * errado para todo mundo, sem ninguém perceber até o dia.
 */
function doCampo(valor: string, timezone: string): string | null {
  if (!valor) return null;

  // Descobre o deslocamento do fuso naquele instante, tratando o valor
  // digitado primeiro como UTC e medindo a diferença.
  const comoUtc = new Date(`${valor}:00Z`);
  const formatado = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(comoUtc);
  const deslocamento = new Date(`${formatado.replace(' ', 'T')}Z`).getTime() - comoUtc.getTime();

  return new Date(comoUtc.getTime() - deslocamento).toISOString();
}

export function Viagens() {
  const [viagens, setViagens] = useState<Viagem[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [dias, setDias] = useState<Dia[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const carregarViagens = useCallback(async () => {
    const { data, error } = await supabase()
      .from('trips')
      .select('id, name, status, starts_on, ends_on, destinations(name, timezone), trip_days(id)')
      .order('starts_on', { ascending: false });

    if (error) return setErro(error.message);

    setViagens(
      (data ?? []).map((t) => ({
        id: t.id,
        nome: t.name,
        destino: t.destinations?.name ?? '—',
        status: t.status,
        comeca: t.starts_on,
        termina: t.ends_on,
        dias: t.trip_days?.length ?? 0,
        atividades: 0,
      })),
    );
  }, []);

  const carregarRoteiro = useCallback(async (tripId: string) => {
    const db = supabase();

    const { data: viagem } = await db
      .from('trips')
      .select('destinations(timezone)')
      .eq('id', tripId)
      .maybeSingle();
    setTimezone(viagem?.destinations?.timezone ?? 'UTC');

    const { data, error } = await db
      .from('trip_days')
      .select(
        'id, day_number, day_date, title, activities(id, title, status, starts_at, departure_at, meeting_point, requires_ack, changed_at, sort_order)',
      )
      .eq('trip_id', tripId)
      .order('day_number');

    if (error) return setErro(error.message);

    setDias(
      (data ?? []).map((d) => ({
        id: d.id,
        numero: d.day_number,
        data: d.day_date,
        titulo: d.title,
      })),
    );
    setAtividades(
      (data ?? []).flatMap((d) =>
        (d.activities ?? []).map((a) => ({
          id: a.id,
          diaId: d.id,
          titulo: a.title,
          status: a.status,
          comeca: a.starts_at,
          saida: a.departure_at,
          ponto: a.meeting_point,
          exigeConfirmacao: a.requires_ack,
          alteradoEm: a.changed_at,
        })),
      ),
    );
  }, []);

  const carregarTemplates = useCallback(async () => {
    const { data } = await supabase()
      .from('itinerary_templates')
      .select('id, name, template_activities(id)')
      .order('name');
    setTemplates(
      (data ?? []).map((t) => ({
        id: t.id,
        nome: t.name,
        atividades: t.template_activities?.length ?? 0,
      })),
    );
  }, []);

  useEffect(() => {
    void carregarViagens();
    void carregarTemplates();
  }, [carregarViagens, carregarTemplates]);

  useEffect(() => {
    if (aberta) void carregarRoteiro(aberta);
  }, [aberta, carregarRoteiro]);

  async function atualizarAtividade(id: string, campos: CamposAtividade) {
    setSalvando(id);
    setErro(null);
    const { error } = await supabase().from('activities').update(campos).eq('id', id);
    if (error) setErro(error.message);
    if (aberta) await carregarRoteiro(aberta);
    setSalvando(null);
  }

  async function criarDia(tripId: string) {
    const proximo = dias.length === 0 ? 1 : Math.max(...dias.map((d) => d.numero)) + 1;
    const viagem = viagens?.find((v) => v.id === tripId);
    if (!viagem) return;

    const data = new Date(viagem.comeca);
    data.setUTCDate(data.getUTCDate() + proximo - 1);

    const { error } = await supabase()
      .from('trip_days')
      .insert({
        trip_id: tripId,
        day_number: proximo,
        day_date: data.toISOString().slice(0, 10),
      });
    if (error) setErro(error.message);
    await carregarRoteiro(tripId);
  }

  async function criarAtividade(diaId: string) {
    const irmas = atividades.filter((a) => a.diaId === diaId);
    const { error } = await supabase().from('activities').insert({
      trip_day_id: diaId,
      title: 'Nova atividade',
      sort_order: irmas.length,
    });
    if (error) setErro(error.message);
    if (aberta) await carregarRoteiro(aberta);
  }

  async function aplicarTemplate(templateId: string, tripId: string) {
    setRecado(null);
    const { data, error } = await supabase().rpc('aplicar_template', {
      p_template: templateId,
      p_trip: tripId,
    });
    if (error) return setErro(error.message);
    setRecado(`${data ?? 0} atividade(s) criadas. O que já existia foi mantido.`);
    await carregarRoteiro(tripId);
  }

  if (erro && !viagens)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!viagens) return <p className="muted">Carregando…</p>;

  const viagem = viagens.find((v) => v.id === aberta) ?? null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Viagens e roteiro</h1>
        </div>
        <p className="muted">{viagens.length} viagens</p>
      </div>

      <p className="muted">
        O que você salva aqui aparece no app do cliente sem nova versão. Mexer em horário, saída,
        ponto de encontro ou título marca a atividade como <strong>alterada</strong> e destaca no
        app — use isso quando for de fato uma mudança, para o destaque continuar valendo.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="muted">{recado}</p> : null}

      <NovaViagem
        aoCriar={(id) => {
          void carregarViagens();
          setAberta(id);
        }}
      />

      <div className="tabela-envolvente">
        <table className="tabela">
          <thead>
            <tr>
              <th>Viagem</th>
              <th>Destino</th>
              <th>Datas</th>
              <th>Situação</th>
              <th>Roteiro</th>
            </tr>
          </thead>
          <tbody>
            {viagens.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong>{v.nome}</strong>
                </td>
                <td>{v.destino}</td>
                <td className="mono">
                  {v.comeca} → {v.termina}
                </td>
                <td>{v.status}</td>
                <td>
                  <button
                    type="button"
                    className={aberta === v.id ? 'botao' : 'botao botao--fantasma'}
                    aria-pressed={aberta === v.id}
                    onClick={() => setAberta(aberta === v.id ? null : v.id)}
                  >
                    {aberta === v.id ? 'Fechando' : `Abrir (${v.dias} dias)`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viagem ? (
        <section className="secao">
          <div className="cabecalho">
            <div>
              <p className="kicker">{viagem.destino}</p>
              <h2>{viagem.nome}</h2>
            </div>
            <p className="muted">
              Horários no fuso <span className="mono">{timezone}</span>
            </p>
          </div>

          <Viajantes viagemId={viagem.id} />

          <div className="acoes">
            <button
              type="button"
              className="botao botao--fantasma"
              onClick={() => void criarDia(viagem.id)}
            >
              Adicionar dia
            </button>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className="botao botao--fantasma"
                onClick={() => void aplicarTemplate(t.id, viagem.id)}
              >
                Aplicar «{t.nome}» ({t.atividades})
              </button>
            ))}
          </div>

          {dias.length === 0 ? (
            <p className="muted">Nenhum dia ainda. Adicione um dia ou aplique um template.</p>
          ) : (
            dias.map((d) => (
              <div key={d.id} className="bloco">
                <div className="cabecalho">
                  <h3>
                    Dia {d.numero} <span className="mono muted">{d.data}</span>
                  </h3>
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    onClick={() => void criarAtividade(d.id)}
                  >
                    Adicionar atividade
                  </button>
                </div>

                <div className="tabela-envolvente">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Atividade</th>
                        <th>Começa (local)</th>
                        <th>Sair às (local)</th>
                        <th>Ponto de encontro</th>
                        <th>Situação</th>
                        <th>Exige leitura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atividades
                        .filter((a) => a.diaId === d.id)
                        .map((a) => (
                          <tr key={a.id}>
                            <td>
                              <input
                                type="text"
                                defaultValue={a.titulo}
                                aria-label={`Título de ${a.titulo}`}
                                disabled={salvando === a.id}
                                onBlur={(e) =>
                                  e.target.value !== a.titulo &&
                                  void atualizarAtividade(a.id, { title: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="datetime-local"
                                defaultValue={paraCampo(a.comeca, timezone)}
                                aria-label={`Início de ${a.titulo}`}
                                disabled={salvando === a.id}
                                onBlur={(e) =>
                                  void atualizarAtividade(a.id, {
                                    starts_at: doCampo(e.target.value, timezone),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="datetime-local"
                                defaultValue={paraCampo(a.saida, timezone)}
                                aria-label={`Saída de ${a.titulo}`}
                                disabled={salvando === a.id}
                                onBlur={(e) =>
                                  void atualizarAtividade(a.id, {
                                    departure_at: doCampo(e.target.value, timezone),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                defaultValue={a.ponto ?? ''}
                                aria-label={`Ponto de encontro de ${a.titulo}`}
                                disabled={salvando === a.id}
                                onBlur={(e) =>
                                  void atualizarAtividade(a.id, {
                                    meeting_point: e.target.value || null,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <span className={a.status === 'changed' ? 'pendente' : 'muted'}>
                                {ROTULO_STATUS[a.status] ?? a.status}
                              </span>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={a.exigeConfirmacao}
                                aria-label={`Exigir confirmação de leitura em ${a.titulo}`}
                                disabled={salvando === a.id}
                                onChange={(e) =>
                                  void atualizarAtividade(a.id, { requires_ack: e.target.checked })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </>
  );
}
