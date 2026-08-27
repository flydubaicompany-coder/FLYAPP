import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Pedidos e reembolso (§40.13).
 *
 * Duas regras que a tela precisa respeitar, e não só exibir:
 *
 * - **Reembolso não apaga histórico.** O pedido reembolsado continua na lista,
 *   com os itens e o valor original. O que se acrescenta é uma linha.
 * - **A política é a que valia na compra.** Ela é lida do próprio pedido, não
 *   do catálogo — quem for avaliar um reembolso precisa ver o que o cliente
 *   aceitou, e não o que a Fly pratica hoje.
 */

interface Reembolso {
  id: string;
  valorCentavos: number;
  moeda: string;
  motivo: string;
  em: string;
}

interface Pedido {
  id: string;
  referencia: string;
  status: string;
  cliente: string;
  totalCentavos: number;
  descontoCentavos: number;
  moeda: string;
  cupom: string | null;
  feitoEm: string;
  politicaTexto: string | null;
  politicaVersao: number | null;
  itens: { titulo: string; variante: string; pessoas: number; comeca: string | null }[];
  reembolsos: Reembolso[];
  reembolsadoCentavos: number;
}

const ROTULO_STATUS: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado em parte',
  failed: 'Pagamento não concluído',
};

function preco(centavos: number, moeda: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(
      centavos / 100,
    );
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

export function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const db = supabase();

    const { data, error } = await db
      .from('orders')
      .select(
        'id, reference, status, user_id, total_cents, discount_cents, currency, coupon_code, placed_at, cancellation_policy_text, cancellation_policy_version, order_items(tour_title, variant_label, people, starts_at), refunds(id, amount_cents, currency, reason, created_at)',
      )
      .order('placed_at', { ascending: false })
      .limit(100);

    if (error) return setErro(error.message);

    // `profiles` não vem por junção: a chave estrangeira de `orders` aponta
    // para `auth.users`, e o PostgREST não inventa o caminho.
    const ids = [...new Set((data ?? []).map((o) => o.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, display_name, preferred_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

    const nome = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? '—']),
    );

    setPedidos(
      (data ?? []).map((o) => {
        const reembolsos = (o.refunds ?? []).map((r) => ({
          id: r.id,
          valorCentavos: r.amount_cents,
          moeda: r.currency,
          motivo: r.reason,
          em: r.created_at,
        }));
        return {
          id: o.id,
          referencia: o.reference,
          status: o.status,
          cliente: nome.get(o.user_id) ?? '—',
          totalCentavos: o.total_cents,
          descontoCentavos: o.discount_cents,
          moeda: o.currency,
          cupom: o.coupon_code,
          feitoEm: o.placed_at,
          politicaTexto: o.cancellation_policy_text,
          politicaVersao: o.cancellation_policy_version,
          itens: (o.order_items ?? []).map((i) => ({
            titulo: i.tour_title,
            variante: i.variant_label,
            pessoas: i.people,
            comeca: i.starts_at,
          })),
          reembolsos,
          reembolsadoCentavos: reembolsos.reduce((s, r) => s + r.valorCentavos, 0),
        };
      }),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function reembolsar(p: Pedido) {
    const restante = p.totalCentavos - p.reembolsadoCentavos;

    const valorTexto = window.prompt(
      `Quanto reembolsar de ${p.referencia}?\n` +
        `Total do pedido: ${preco(p.totalCentavos, p.moeda)}\n` +
        `Já reembolsado: ${preco(p.reembolsadoCentavos, p.moeda)}\n` +
        `Máximo agora: ${preco(restante, p.moeda)}\n\n` +
        `Informe em reais, por exemplo 450,00`,
      (restante / 100).toFixed(2).replace('.', ','),
    );
    if (!valorTexto) return;

    // Aceita "450,00" e "450.00". Digitar vírgula é o normal em português, e
    // recusar por causa disso seria implicância.
    const centavos = Math.round(Number(valorTexto.replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) {
      setErro('Valor inválido.');
      return;
    }

    const motivo = window.prompt('Motivo do reembolso (fica no histórico do pedido):');
    if (!motivo || motivo.trim().length < 3) return;

    setOcupado(p.id);
    setErro(null);
    setRecado(null);

    const { data, error } = await supabase().rpc('reembolsar_pedido', {
      p_order: p.id,
      p_amount_cents: centavos,
      p_reason: motivo.trim(),
    });

    setOcupado(null);
    const linha = Array.isArray(data) ? data[0] : data;

    if (error) return setErro(error.message);
    if (!linha?.ok) return setErro(linha?.motivo ?? 'Não consegui reembolsar.');

    setRecado(`Reembolso de ${preco(centavos, p.moeda)} registrado em ${p.referencia}.`);
    await carregar();
  }

  if (erro && !pedidos)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!pedidos) return <p className="muted">Carregando…</p>;

  const aguardando = pedidos.filter((p) => p.status === 'pending_payment').length;
  const pedido = pedidos.find((p) => p.id === aberto) ?? null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Comercial</p>
          <h1>Pedidos</h1>
        </div>
        <p className="muted">
          {pedidos.length} pedidos · {aguardando} aguardando pagamento
        </p>
      </div>

      <p className="muted">
        Reembolso não apaga o pedido: acrescenta uma linha ao histórico. O pedido continua aqui com
        os itens e o valor originais, que é o que se apresenta numa contestação.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="muted">{recado}</p> : null}

      <div className="tabela-envolvente">
        <table className="tabela">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Situação</th>
              <th>Total</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong className="mono">{p.referencia}</strong>
                  <br />
                  <span className="muted">{new Date(p.feitoEm).toLocaleDateString('pt-BR')}</span>
                </td>
                <td>{p.cliente}</td>
                <td>
                  <span
                    className={
                      p.status === 'confirmed'
                        ? 'muted'
                        : p.status === 'pending_payment'
                          ? 'pendente'
                          : 'muted'
                    }
                  >
                    {ROTULO_STATUS[p.status] ?? p.status}
                  </span>
                </td>
                <td className="mono">
                  {preco(p.totalCentavos, p.moeda)}
                  {p.reembolsadoCentavos > 0 ? (
                    <>
                      <br />
                      <span className="pendente">− {preco(p.reembolsadoCentavos, p.moeda)}</span>
                    </>
                  ) : null}
                </td>
                <td>
                  <button
                    type="button"
                    className={aberto === p.id ? 'botao' : 'botao botao--fantasma'}
                    aria-pressed={aberto === p.id}
                    onClick={() => setAberto(aberto === p.id ? null : p.id)}
                  >
                    {aberto === p.id ? 'Fechar' : 'Abrir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pedidos.length === 0 ? <p className="muted">Nenhum pedido ainda.</p> : null}

      {pedido ? (
        <section className="secao">
          <div className="cabecalho">
            <div>
              <p className="kicker mono">{pedido.referencia}</p>
              <h2>{pedido.cliente}</h2>
            </div>
            <p className="muted">{ROTULO_STATUS[pedido.status] ?? pedido.status}</p>
          </div>

          <div className="bloco">
            <h3>Itens</h3>
            <div className="tabela-envolvente">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Passeio</th>
                    <th>Opção</th>
                    <th>Pessoas</th>
                    <th>Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.itens.map((i, n) => (
                    <tr key={`${i.titulo}-${n}`}>
                      <td>
                        <strong>{i.titulo}</strong>
                      </td>
                      <td>{i.variante}</td>
                      <td className="mono">{i.pessoas}</td>
                      <td className="mono">
                        {i.comeca ? new Date(i.comeca).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pedido.politicaTexto ? (
            <div className="bloco">
              <h3>Política de cancelamento no momento da compra</h3>
              <p className="muted">{pedido.politicaTexto}</p>
              <p className="muted">
                Versão {pedido.politicaVersao ?? '—'}. É esta que vale para este pedido, mesmo que a
                política tenha mudado depois.
              </p>
            </div>
          ) : null}

          {pedido.reembolsos.length > 0 ? (
            <div className="bloco">
              <h3>Reembolsos</h3>
              <div className="tabela-envolvente">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Valor</th>
                      <th>Motivo</th>
                      <th>Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.reembolsos.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{preco(r.valorCentavos, r.moeda)}</td>
                        <td>{r.motivo}</td>
                        <td className="mono">{new Date(r.em).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {['paid', 'confirmed', 'partially_refunded'].includes(pedido.status) ? (
            <div className="acoes">
              <button
                type="button"
                className="botao"
                disabled={ocupado === pedido.id}
                onClick={() => void reembolsar(pedido)}
              >
                Reembolsar
              </button>
              <span className="muted">
                Restam {preco(pedido.totalCentavos - pedido.reembolsadoCentavos, pedido.moeda)}
              </span>
            </div>
          ) : (
            <p className="muted">
              Só pedido pago aceita reembolso. Este está como{' '}
              {ROTULO_STATUS[pedido.status] ?? pedido.status}.
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
