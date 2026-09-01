import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Fila do concierge (§11.2 e §11.3).
 *
 * Dois tipos de pedido, mesma mecânica: alguém pediu, alguém precisa
 * responder. A tela abre nos **pendentes** porque é o que tem prazo — um
 * pedido de mesa para hoje à noite não pode esperar alguém rolar a página.
 *
 * **Recusar exige motivo**, por constraint. O cliente precisa saber se tenta
 * outro dia, outro horário, ou desiste.
 */

type SitReserva =
  'requested' | 'confirmed' | 'waitlist' | 'declined' | 'cancelled' | 'seated' | 'no_show';
type SitServico = 'requested' | 'in_progress' | 'done' | 'declined' | 'cancelled';

const R_ROTULO: Record<SitReserva, string> = {
  requested: 'Pedido',
  confirmed: 'Confirmada',
  waitlist: 'Na espera',
  declined: 'Recusada',
  cancelled: 'Cancelada',
  seated: 'Compareceu',
  no_show: 'Não foi',
};
const S_ROTULO: Record<SitServico, string> = {
  requested: 'Pedido',
  in_progress: 'Resolvendo',
  done: 'Resolvido',
  declined: 'Recusado',
  cancelled: 'Cancelado',
};

interface Reserva {
  id: string;
  cliente: string;
  restaurante: string;
  pessoas: number;
  quando: string;
  ocasiao: string | null;
  notas: string | null;
  situacao: SitReserva;
}
interface Pedido {
  id: string;
  cliente: string;
  servico: string;
  detalhes: string;
  entregarEm: string | null;
  situacao: SitServico;
}

export function Concierge() {
  const [reservas, setReservas] = useState<Reserva[] | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<Record<string, string>>({});
  const [soPendentes, setSoPendentes] = useState(true);

  const carregar = useCallback(async () => {
    const db = supabase();

    const [res, ped] = await Promise.all([
      db
        .from('restaurant_reservations')
        .select('id, user_id, party_size, desired_at, occasion, notes, status, restaurants(name)')
        .order('desired_at'),
      db
        .from('service_requests')
        .select('id, user_id, details, deliver_to, status, lifestyle_services(name)')
        .order('created_at', { ascending: false }),
    ]);

    if (res.error) return setErro(res.error.message);

    const ids = [
      ...new Set([
        ...(res.data ?? []).map((r) => r.user_id),
        ...(ped.data ?? []).map((p) => p.user_id),
      ]),
    ];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, public_id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nome = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? p.public_id]),
    );

    setReservas(
      (res.data ?? []).map((r) => ({
        id: r.id,
        cliente: nome.get(r.user_id) ?? 'Cliente',
        restaurante: (r.restaurants as { name: string } | null)?.name ?? 'Restaurante',
        pessoas: r.party_size,
        quando: r.desired_at,
        ocasiao: r.occasion,
        notas: r.notes,
        situacao: r.status as SitReserva,
      })),
    );

    setPedidos(
      (ped.data ?? []).map((p) => ({
        id: p.id,
        cliente: nome.get(p.user_id) ?? 'Cliente',
        servico: (p.lifestyle_services as { name: string } | null)?.name ?? 'Serviço',
        detalhes: p.details,
        entregarEm: p.deliver_to,
        situacao: p.status as SitServico,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidirReserva(r: Reserva, situacao: SitReserva) {
    const motivo = (nota[r.id] ?? '').trim();
    if (situacao === 'declined' && !motivo) {
      return setErro('Recusar exige motivo — o cliente precisa saber se tenta outro dia.');
    }
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('restaurant_reservations')
      .update({ status: situacao, decline_reason: situacao === 'declined' ? motivo : null })
      .eq('id', r.id);
    if (error) setErro(error.message);
    else setRecado(`${r.restaurante} · ${r.cliente}: ${R_ROTULO[situacao].toLowerCase()}.`);
    await carregar();
    setOcupado(false);
  }

  async function decidirPedido(p: Pedido, situacao: SitServico) {
    const motivo = (nota[p.id] ?? '').trim();
    if (situacao === 'declined' && !motivo) {
      return setErro('Recusar exige motivo.');
    }
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('service_requests')
      .update({ status: situacao, response_note: motivo || null })
      .eq('id', p.id);
    if (error) setErro(error.message);
    else setRecado(`${p.servico} · ${p.cliente}: ${S_ROTULO[situacao].toLowerCase()}.`);
    await carregar();
    setOcupado(false);
  }

  if (erro && !reservas)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!reservas) return <p className="muted">Carregando…</p>;

  const rPend = reservas.filter((r) => r.situacao === 'requested' || r.situacao === 'waitlist');
  const pPend = pedidos.filter((p) => p.situacao === 'requested' || p.situacao === 'in_progress');
  const rVis = soPendentes ? rPend : reservas;
  const pVis = soPendentes ? pPend : pedidos;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Concierge</p>
          <h1>Reservas e serviços</h1>
        </div>
        <p className="muted">
          {rPend.length} mesas · {pPend.length} serviços
        </p>
      </div>

      <p className="muted">
        O cliente <strong>pede</strong>; quem confirma é você. Enquanto ninguém responde, ele vê
        “pedido enviado” — e não “confirmada”.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <div className="acoes">
        <button
          type="button"
          className={soPendentes ? 'botao' : 'botao botao--fantasma'}
          aria-pressed={soPendentes}
          onClick={() => setSoPendentes(!soPendentes)}
        >
          {soPendentes ? 'Mostrando só pendentes' : 'Mostrando tudo'}
        </button>
      </div>

      <section className="secao">
        <div className="cabecalho">
          <h2>Mesas</h2>
        </div>
        {rVis.length === 0 ? (
          <p className="muted">Nada pendente.</p>
        ) : (
          rVis.map((r) => (
            <div key={r.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">{r.cliente}</p>
                  <h3>{r.restaurante}</h3>
                </div>
                <span className={r.situacao === 'requested' ? 'selo selo--pendente' : 'selo'}>
                  {R_ROTULO[r.situacao]}
                </span>
              </div>
              <dl className="facts">
                <div>
                  <dt>Quando</dt>
                  <dd className="mono">{new Date(r.quando).toLocaleString('pt-BR')}</dd>
                </div>
                <div>
                  <dt>Pessoas</dt>
                  <dd>{r.pessoas}</dd>
                </div>
                <div>
                  <dt>Ocasião</dt>
                  <dd>{r.ocasiao ?? '—'}</dd>
                </div>
              </dl>
              {r.notas ? <p className="muted">Pedido especial: {r.notas}</p> : null}

              {r.situacao === 'requested' || r.situacao === 'waitlist' ? (
                <>
                  <div className="form form--linha">
                    <label className="field">
                      <span className="muted">Motivo (obrigatório para recusar)</span>
                      <input
                        value={nota[r.id] ?? ''}
                        onChange={(e) => setNota({ ...nota, [r.id]: e.target.value })}
                        placeholder="Casa lotada nesse horário; há mesa às 22h"
                      />
                    </label>
                  </div>
                  <div className="acoes">
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void decidirReserva(r, 'confirmed')}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado}
                      onClick={() => void decidirReserva(r, 'waitlist')}
                    >
                      Deixar na espera
                    </button>
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado}
                      onClick={() => void decidirReserva(r, 'declined')}
                    >
                      Não foi possível
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="secao">
        <div className="cabecalho">
          <h2>Serviços</h2>
        </div>
        {pVis.length === 0 ? (
          <p className="muted">Nada pendente.</p>
        ) : (
          pVis.map((p) => (
            <div key={p.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">{p.cliente}</p>
                  <h3>{p.servico}</h3>
                </div>
                <span className={p.situacao === 'requested' ? 'selo selo--pendente' : 'selo'}>
                  {S_ROTULO[p.situacao]}
                </span>
              </div>
              <p className="muted">{p.detalhes}</p>
              {p.entregarEm ? <p className="muted">Entregar em: {p.entregarEm}</p> : null}

              {p.situacao === 'requested' || p.situacao === 'in_progress' ? (
                <>
                  <div className="form form--linha">
                    <label className="field">
                      <span className="muted">Resposta ao cliente</span>
                      <input
                        value={nota[p.id] ?? ''}
                        onChange={(e) => setNota({ ...nota, [p.id]: e.target.value })}
                        placeholder="Retirado às 9h, volta amanhã até as 18h"
                      />
                    </label>
                  </div>
                  <div className="acoes">
                    {p.situacao === 'requested' ? (
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado}
                        onClick={() => void decidirPedido(p, 'in_progress')}
                      >
                        Estou resolvendo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void decidirPedido(p, 'done')}
                    >
                      Resolvido
                    </button>
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado}
                      onClick={() => void decidirPedido(p, 'declined')}
                    >
                      Não foi possível
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ))
        )}
      </section>
    </>
  );
}
