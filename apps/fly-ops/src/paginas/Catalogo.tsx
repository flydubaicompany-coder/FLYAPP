import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@fly/domain-types';
import { supabase } from '../auth/client';
import { MidiaEFornecedor } from '../componentes/MidiaEFornecedor';
import { NovoPasseio } from '../componentes/NovoPasseio';

/**
 * Catálogo de passeios (§6 e §40.13).
 *
 * Publicar aqui coloca o passeio na vitrine do cliente sem nova versão do app
 * — e é por isso que a tela avisa antes, e não depois.
 *
 * **Preço não se edita em linha.** Mudar um preço muda o que o próximo cliente
 * paga, e um clique acidental numa tabela de trinta linhas é diferente de um
 * clique num campo que você abriu de propósito. Preço fica no bloco da
 * variante, aberto item a item.
 */

type CamposPasseio = Database['public']['Tables']['tours']['Update'];
type SituacaoPasseio = Database['public']['Enums']['tour_status'];

interface Passeio {
  id: string;
  slug: string;
  fornecedorId: string | null;
  titulo: string;
  categoria: string;
  cidade: string | null;
  status: SituacaoPasseio;
  selo: string | null;
  temPolitica: boolean;
  variantes: number;
  horarios: number;
}

interface Variante {
  id: string;
  rotulo: string;
  precoCentavos: number;
  moeda: string;
  ativa: boolean;
  cobrePessoas: number;
}

interface Horario {
  id: string;
  varianteId: string;
  comeca: string;
  capacidade: number;
  vendidos: number;
  ativo: boolean;
}

const ROTULO_STATUS: Record<SituacaoPasseio, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  paused: 'Pausado',
  archived: 'Arquivado',
};

function formatarPreco(centavos: number, moeda: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(
      centavos / 100,
    );
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

export function Catalogo() {
  const [passeios, setPasseios] = useState<Passeio[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('tours')
      .select(
        'id, slug, title, category_key, city, status, badge, supplier_id, cancellation_policy_id, tour_variants(id), tour_slots:tour_variants(tour_slots(id))',
      )
      .order('sort_order');

    if (error) return setErro(error.message);

    setPasseios(
      (data ?? []).map((t) => ({
        id: t.id,
        slug: t.slug,
        fornecedorId: t.supplier_id,
        titulo: t.title,
        categoria: t.category_key,
        cidade: t.city,
        status: t.status,
        selo: t.badge,
        temPolitica: t.cancellation_policy_id !== null,
        variantes: t.tour_variants?.length ?? 0,
        horarios: (t.tour_slots ?? []).reduce((n, v) => n + (v.tour_slots?.length ?? 0), 0),
      })),
    );
  }, []);

  const carregarDetalhe = useCallback(async (tourId: string) => {
    const db = supabase();

    const { data: vars } = await db
      .from('tour_variants')
      .select('id, label, price_cents, currency, is_active, covers_people')
      .eq('tour_id', tourId)
      .order('sort_order');

    const lista: Variante[] = (vars ?? []).map((v) => ({
      id: v.id,
      rotulo: v.label,
      precoCentavos: v.price_cents,
      moeda: v.currency,
      ativa: v.is_active,
      cobrePessoas: v.covers_people,
    }));
    setVariantes(lista);

    if (lista.length === 0) return setHorarios([]);

    const { data: slots } = await db
      .from('tour_slots')
      .select('id, variant_id, starts_at, capacity, sold, is_active')
      .in(
        'variant_id',
        lista.map((v) => v.id),
      )
      .order('starts_at');

    setHorarios(
      (slots ?? []).map((s) => ({
        id: s.id,
        varianteId: s.variant_id,
        comeca: s.starts_at,
        capacidade: s.capacity,
        vendidos: s.sold,
        ativo: s.is_active,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (aberto) void carregarDetalhe(aberto);
  }, [aberto, carregarDetalhe]);

  async function atualizar(id: string, campos: CamposPasseio) {
    setSalvando(id);
    setErro(null);
    const { error } = await supabase().from('tours').update(campos).eq('id', id);
    if (error) setErro(error.message);
    await carregar();
    setSalvando(null);
  }

  async function publicar(p: Passeio) {
    // O banco recusa publicar sem política; a tela explica antes de o cliente
    // ver um erro de constraint.
    if (!p.temPolitica && p.status !== 'published') {
      setErro(
        `«${p.titulo}» não tem política de cancelamento. Publicar sem ela é vender sem dizer a regra — defina a política primeiro.`,
      );
      return;
    }
    await atualizar(p.id, { status: p.status === 'published' ? 'paused' : 'published' });
  }

  if (erro && !passeios)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!passeios) return <p className="muted">Carregando…</p>;

  const publicados = passeios.filter((p) => p.status === 'published').length;
  const passeio = passeios.find((p) => p.id === aberto) ?? null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Comercial</p>
          <h1>Catálogo de passeios</h1>
        </div>
        <p className="muted">
          {publicados} publicados de {passeios.length}
        </p>
      </div>

      <p className="muted">
        O que você publicar aqui entra na vitrine do cliente sem nova versão do app. Passeio sem
        política de cancelamento não pode ser publicado — o banco recusa, e é de propósito.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      <NovoPasseio
        aoCriar={(id) => {
          void carregar();
          setAberto(id);
        }}
      />

      <div className="tabela-envolvente">
        <table className="tabela">
          <thead>
            <tr>
              <th>Passeio</th>
              <th>Cidade</th>
              <th>Situação</th>
              <th>Política</th>
              <th>Opções</th>
              <th>Publicar</th>
            </tr>
          </thead>
          <tbody>
            {passeios.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.titulo}</strong>
                  <br />
                  <span className="mono muted">{p.slug}</span>
                </td>
                <td>{p.cidade ?? '—'}</td>
                <td>
                  <span className={p.status === 'published' ? 'muted' : 'pendente'}>
                    {ROTULO_STATUS[p.status]}
                  </span>
                </td>
                <td>
                  {p.temPolitica ? (
                    <span className="muted">Definida</span>
                  ) : (
                    <span className="pendente">Falta</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={aberto === p.id ? 'botao' : 'botao botao--fantasma'}
                    aria-pressed={aberto === p.id}
                    onClick={() => setAberto(aberto === p.id ? null : p.id)}
                  >
                    {p.variantes} opções · {p.horarios} horários
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={p.status === 'published' ? 'botao' : 'botao botao--fantasma'}
                    disabled={salvando === p.id}
                    aria-pressed={p.status === 'published'}
                    onClick={() => void publicar(p)}
                  >
                    {p.status === 'published' ? 'Publicado' : 'Publicar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {passeios.length === 0 ? <p className="muted">Nenhum passeio cadastrado ainda.</p> : null}

      {passeio ? (
        <section className="secao">
          <div className="cabecalho">
            <div>
              <p className="kicker">{passeio.cidade ?? 'Catálogo'}</p>
              <h2>{passeio.titulo}</h2>
            </div>
            <button type="button" className="botao botao--fantasma" onClick={() => setAberto(null)}>
              Fechar
            </button>
          </div>

          <div className="bloco">
            <h3>Opções e preço</h3>
            {variantes.length === 0 ? (
              <p className="muted">
                Nenhuma opção cadastrada. Um passeio sem opção não tem preço, e sem preço não vende.
              </p>
            ) : (
              <div className="tabela-envolvente">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Opção</th>
                      <th>Preço</th>
                      <th>Cobre</th>
                      <th>Ativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantes.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <strong>{v.rotulo}</strong>
                        </td>
                        <td className="mono">{formatarPreco(v.precoCentavos, v.moeda)}</td>
                        <td className="muted">
                          {v.cobrePessoas > 1 ? `até ${v.cobrePessoas} pessoas` : 'por pessoa'}
                        </td>
                        <td>{v.ativa ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bloco">
            <h3>Horários e vagas</h3>
            {horarios.length === 0 ? (
              <p className="muted">Nenhum horário aberto.</p>
            ) : (
              <div className="tabela-envolvente">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Capacidade</th>
                      <th>Vendidos</th>
                      <th>Restam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horarios.map((h) => {
                      const restam = h.capacidade - h.vendidos;
                      return (
                        <tr key={h.id}>
                          <td className="mono">{new Date(h.comeca).toLocaleString('pt-BR')}</td>
                          <td className="mono">{h.capacidade}</td>
                          <td className="mono">{h.vendidos}</td>
                          <td>
                            <span className={restam === 0 ? 'pendente' : 'muted'}>
                              {restam === 0 ? 'Esgotado' : restam}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted">
              «Restam» desconta o que já foi vendido. Reservas de carrinho não aparecem aqui: elas
              expiram sozinhas, e mostrá-las como ocupadas assustaria à toa.
            </p>

            <MidiaEFornecedor
              passeioId={passeio.id}
              fornecedorAtual={passeio.fornecedorId}
              aoMudarFornecedor={() => void carregar()}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
