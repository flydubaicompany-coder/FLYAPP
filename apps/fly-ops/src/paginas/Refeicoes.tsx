import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Cardápio, pendências e consolidação (§11.1 e §42, entrega 11).
 *
 * A tela responde três perguntas, e nessa ordem — que é a ordem em que a
 * operação precisa delas:
 *
 *   1. **quanto de cada prato pedir** (o total por opção);
 *   2. **quem ainda não escolheu** (a pendência, antes do prazo fechar);
 *   3. o que montar para os próximos dias (o cardápio).
 *
 * O total vem primeiro porque é o que vira ligação para a cozinha. Uma tela
 * que começa pelo cadastro obriga a rolar até o fim para achar o número que
 * importa.
 */

type Situacao = 'draft' | 'open' | 'locked' | 'sent' | 'delivered' | 'cancelled';
type Tipo = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const NOME_TIPO: Record<Tipo, string> = {
  breakfast: 'Café',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

const NOME_SITUACAO: Record<Situacao, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  locked: 'Fechada',
  sent: 'Enviada ao fornecedor',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

interface Opcao {
  id: string;
  rotulo: string;
  ativa: boolean;
  escolhas: number;
}

interface Servico {
  id: string;
  viagem: string;
  diaNumero: number;
  data: string;
  tipo: Tipo;
  fornecedor: string | null;
  serveEm: string | null;
  fechaEm: string | null;
  situacao: Situacao;
  opcoes: Opcao[];
  /** Quantos viajantes há na viagem, e quantos já escolheram. */
  membros: number;
  escolheram: number;
  excecoes: number;
}

export function Refeicoes() {
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novaOpcao, setNovaOpcao] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const db = supabase();

    const { data: linhas, error } = await db
      .from('meal_services')
      .select(
        'id, kind, supplier_name, serves_at, choices_close_at, status, trip_day_id, meal_options(id, label, is_active), meal_choices(id, option_id, exception_reason)',
      )
      .order('serves_at');

    if (error) return setErro(error.message);

    const diasIds = [...new Set((linhas ?? []).map((s) => s.trip_day_id))];
    const { data: dias } = await db
      .from('trip_days')
      .select('id, day_number, day_date, trip_id, trips(name)')
      .in('id', diasIds.length > 0 ? diasIds : ['00000000-0000-0000-0000-000000000000']);

    const porDia = new Map((dias ?? []).map((d) => [d.id, d]));

    const tripIds = [...new Set((dias ?? []).map((d) => d.trip_id))];
    const { data: membros } = await db
      .from('trip_members')
      .select('trip_id')
      .in('trip_id', tripIds.length > 0 ? tripIds : ['00000000-0000-0000-0000-000000000000']);

    const porViagem = new Map<string, number>();
    for (const m of membros ?? []) {
      porViagem.set(m.trip_id, (porViagem.get(m.trip_id) ?? 0) + 1);
    }

    setServicos(
      (linhas ?? []).map((s) => {
        const d = porDia.get(s.trip_day_id);
        const escolhas = (s.meal_choices ?? []) as Array<{
          option_id: string;
          exception_reason: string | null;
        }>;
        const porOpcao = new Map<string, number>();
        for (const e of escolhas) porOpcao.set(e.option_id, (porOpcao.get(e.option_id) ?? 0) + 1);

        return {
          id: s.id,
          viagem: (d?.trips as { name: string } | null)?.name ?? 'Viagem',
          diaNumero: d?.day_number ?? 0,
          data: d?.day_date ?? '',
          tipo: s.kind as Tipo,
          fornecedor: s.supplier_name,
          serveEm: s.serves_at,
          fechaEm: s.choices_close_at,
          situacao: s.status as Situacao,
          opcoes: (
            (s.meal_options ?? []) as Array<{ id: string; label: string; is_active: boolean }>
          ).map((o) => ({
            id: o.id,
            rotulo: o.label,
            ativa: o.is_active,
            escolhas: porOpcao.get(o.id) ?? 0,
          })),
          membros: d ? (porViagem.get(d.trip_id) ?? 0) : 0,
          escolheram: escolhas.length,
          excecoes: escolhas.filter((e) => e.exception_reason !== null).length,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function somarOpcao(servicoId: string) {
    const rotulo = (novaOpcao[servicoId] ?? '').trim();
    if (!rotulo) return setErro('A opção precisa de um nome — é o que o cliente vai ler.');
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('meal_options')
      .insert({ service_id: servicoId, label: rotulo });
    if (error) setErro(error.message);
    else {
      setRecado('Opção adicionada.');
      setNovaOpcao({ ...novaOpcao, [servicoId]: '' });
    }
    await carregar();
    setOcupado(false);
  }

  async function abrir(s: Servico) {
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { data, error } = await supabase().rpc('abrir_refeicao', { p_service: s.id });
    if (error) setErro(error.message);
    else {
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.ok) {
        setRecado(
          r.fecha_em
            ? `Aberta. A escolha fecha em ${new Date(r.fecha_em).toLocaleString('pt-BR')}.`
            : 'Aberta. Sem horário de servir, não há prazo — defina o horário.',
        );
      } else setErro(r?.motivo ?? 'não foi possível abrir');
    }
    await carregar();
    setOcupado(false);
  }

  async function mudarSituacao(s: Servico, situacao: Situacao) {
    if (
      situacao === 'sent' &&
      !confirm(
        `Marcar «${NOME_TIPO[s.tipo]} do dia ${s.diaNumero}» como enviada ao fornecedor?\n\n` +
          `${s.escolheram} de ${s.membros} escolheram. ` +
          `Quem não escolheu não entra no pedido.`,
      )
    ) {
      return;
    }
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('meal_services')
      .update({ status: situacao })
      .eq('id', s.id);
    if (error) setErro(error.message);
    else setRecado(`${NOME_SITUACAO[situacao]}.`);
    await carregar();
    setOcupado(false);
  }

  if (erro && !servicos)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!servicos) return <p className="muted">Carregando…</p>;

  const abertas = servicos.filter((s) => s.situacao === 'open');
  const pendentes = abertas.reduce((n, s) => n + (s.membros - s.escolheram), 0);

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Refeições</h1>
        </div>
        <p className="muted">
          {abertas.length} abertas · {pendentes} sem escolher
        </p>
      </div>

      <p className="muted">
        O prazo de cada refeição sai de <span className="mono">meals.deadline_hours</span> e é
        gravado quando você abre. Depois dele, só a equipe muda — e a mudança fica marcada como
        exceção.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      {servicos.length === 0 ? (
        <p className="muted">
          Nenhuma refeição criada. Crie uma na página Viagens, dentro do dia do roteiro.
        </p>
      ) : (
        servicos.map((s) => {
          const faltam = s.membros - s.escolheram;
          return (
            <section key={s.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">
                    {s.viagem} · dia {s.diaNumero} · {s.data}
                  </p>
                  <h3>
                    {NOME_TIPO[s.tipo]}
                    {s.fornecedor ? ` · ${s.fornecedor}` : ''}
                  </h3>
                </div>
                <span
                  className={
                    s.situacao === 'open'
                      ? 'selo selo--ok'
                      : s.situacao === 'draft'
                        ? 'selo selo--pendente'
                        : 'selo'
                  }
                >
                  {NOME_SITUACAO[s.situacao]}
                </span>
              </div>

              {/* O total vem primeiro: e o que vira ligacao para a cozinha. */}
              {s.opcoes.length > 0 ? (
                <ul className="checks">
                  {s.opcoes.map((o) => (
                    <li key={o.id}>
                      <span>
                        <strong>{o.escolhas}</strong> × {o.rotulo}
                        {o.ativa ? '' : ' (inativa)'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="aviso">
                  Sem opção nenhuma. Não dá para abrir um cardápio vazio — o cliente abriria a tela
                  e não teria o que escolher.
                </p>
              )}

              <dl className="facts">
                <div>
                  <dt>Escolheram</dt>
                  <dd>
                    {s.escolheram} de {s.membros}
                    {faltam > 0 && s.situacao === 'open' ? ` · faltam ${faltam}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Fecha em</dt>
                  <dd className="mono">
                    {s.fechaEm ? new Date(s.fechaEm).toLocaleString('pt-BR') : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Exceções</dt>
                  <dd>{s.excecoes}</dd>
                </div>
              </dl>

              <div className="form form--linha">
                <label className="field">
                  <span className="muted">Nova opção</span>
                  <input
                    value={novaOpcao[s.id] ?? ''}
                    onChange={(e) => setNovaOpcao({ ...novaOpcao, [s.id]: e.target.value })}
                    placeholder="Robalo grelhado com legumes"
                  />
                </label>
                <div className="acoes">
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void somarOpcao(s.id)}
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="acoes">
                {s.situacao === 'draft' ? (
                  <button
                    type="button"
                    className="botao"
                    disabled={ocupado || s.opcoes.filter((o) => o.ativa).length === 0}
                    onClick={() => void abrir(s)}
                  >
                    Abrir para escolha
                  </button>
                ) : null}
                {s.situacao === 'open' || s.situacao === 'locked' ? (
                  <button
                    type="button"
                    className="botao"
                    disabled={ocupado}
                    onClick={() => void mudarSituacao(s, 'sent')}
                  >
                    Enviar ao fornecedor
                  </button>
                ) : null}
                {s.situacao === 'sent' ? (
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void mudarSituacao(s, 'delivered')}
                  >
                    Marcar entregue
                  </button>
                ) : null}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
