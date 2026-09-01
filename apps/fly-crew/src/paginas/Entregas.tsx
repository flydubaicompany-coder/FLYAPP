import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Entregas de refeição (§11.1 e §42, entrega 12).
 *
 * Esta tela é usada **em pé, com uma mão, do lado de uma cozinha**. Por isso:
 *
 *   - só as refeições de hoje e amanhã, e não o histórico;
 *   - o total por prato em destaque, que é o que se confere na hora;
 *   - **um botão**, grande, para marcar entregue.
 *
 * O que a equipe do escritório faz — abrir cardápio, criar opção, mudar
 * escolha por exceção — não está aqui. Campo confere e entrega.
 */

type Situacao = 'draft' | 'open' | 'locked' | 'sent' | 'delivered' | 'cancelled';
type Tipo = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const NOME_TIPO: Record<Tipo, string> = {
  breakfast: 'Café',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

interface Linha {
  opcao: string;
  quantidade: number;
  observacoes: string[];
}

interface Entrega {
  id: string;
  viagem: string;
  diaNumero: number;
  tipo: Tipo;
  fornecedor: string | null;
  local: string | null;
  serveEm: string | null;
  situacao: Situacao;
  linhas: Linha[];
  total: number;
}

export function Entregas() {
  const [entregas, setEntregas] = useState<Entrega[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const db = supabase();

    // Hoje e amanha. Quem esta em campo nao precisa do que ja passou.
    const de = new Date();
    de.setHours(0, 0, 0, 0);
    const ate = new Date(de);
    ate.setDate(ate.getDate() + 2);

    const { data, error } = await db
      .from('meal_services')
      .select(
        'id, kind, supplier_name, location, serves_at, status, trip_day_id, meal_options(id, label), meal_choices(option_id, customization)',
      )
      .gte('serves_at', de.toISOString())
      .lt('serves_at', ate.toISOString())
      .order('serves_at');

    if (error) return setErro(error.message);

    const diasIds = [...new Set((data ?? []).map((s) => s.trip_day_id))];
    const { data: dias } = await db
      .from('trip_days')
      .select('id, day_number, trips(name)')
      .in('id', diasIds.length > 0 ? diasIds : ['00000000-0000-0000-0000-000000000000']);
    const porDia = new Map((dias ?? []).map((d) => [d.id, d]));

    setEntregas(
      (data ?? []).map((s) => {
        const d = porDia.get(s.trip_day_id);
        const opcoes = new Map(
          ((s.meal_options ?? []) as Array<{ id: string; label: string }>).map((o) => [
            o.id,
            o.label,
          ]),
        );
        const escolhas = (s.meal_choices ?? []) as Array<{
          option_id: string;
          customization: string | null;
        }>;

        const agrupado = new Map<string, Linha>();
        for (const e of escolhas) {
          const nome = opcoes.get(e.option_id) ?? 'Opção removida';
          const atual = agrupado.get(nome) ?? { opcao: nome, quantidade: 0, observacoes: [] };
          atual.quantidade += 1;
          if (e.customization) atual.observacoes.push(e.customization);
          agrupado.set(nome, atual);
        }

        return {
          id: s.id,
          viagem: (d?.trips as { name: string } | null)?.name ?? 'Viagem',
          diaNumero: d?.day_number ?? 0,
          tipo: s.kind as Tipo,
          fornecedor: s.supplier_name,
          local: s.location,
          serveEm: s.serves_at,
          situacao: s.status as Situacao,
          linhas: [...agrupado.values()].sort((a, b) => b.quantidade - a.quantidade),
          total: escolhas.length,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function marcarEntregue(e: Entrega) {
    if (
      !confirm(
        `Marcar ${NOME_TIPO[e.tipo]} do dia ${e.diaNumero} como entregue?\n\n` +
          `${e.total} refeição(ões). Isto avisa o escritório.`,
      )
    ) {
      return;
    }
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('meal_services')
      .update({ status: 'delivered' })
      .eq('id', e.id);
    if (error) setErro(error.message);
    else setRecado(`${NOME_TIPO[e.tipo]} do dia ${e.diaNumero}: entregue.`);
    await carregar();
    setOcupado(false);
  }

  if (erro && !entregas)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!entregas) return <p className="muted">Carregando…</p>;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Campo</p>
          <h1>Entregas de hoje</h1>
        </div>
        <p className="muted">{entregas.length} refeições</p>
      </div>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      {entregas.length === 0 ? (
        <p className="muted">
          Nada para hoje nem amanhã. Refeições aparecem aqui quando o escritório abrir o cardápio.
        </p>
      ) : (
        entregas.map((e) => (
          <section key={e.id} className="bloco">
            <div className="cabecalho">
              <div>
                <p className="kicker">
                  {e.viagem} · dia {e.diaNumero}
                  {e.local ? ` · ${e.local}` : ''}
                </p>
                <h2>
                  {NOME_TIPO[e.tipo]}
                  {e.serveEm
                    ? ` · ${new Date(e.serveEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </h2>
              </div>
              <span
                className={e.situacao === 'delivered' ? 'selo selo--ok' : 'selo selo--pendente'}
              >
                {e.situacao === 'delivered' ? 'Entregue' : `${e.total} refeições`}
              </span>
            </div>

            {e.linhas.length === 0 ? (
              <p className="aviso">Ninguém escolheu esta refeição.</p>
            ) : (
              <ul className="checks">
                {e.linhas.map((l) => (
                  <li key={l.opcao}>
                    <span>
                      <strong>{l.quantidade}</strong> × {l.opcao}
                    </span>
                    {l.observacoes.length > 0 ? (
                      <span className="muted">{l.observacoes.join(' · ')}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {e.situacao !== 'delivered' && e.situacao !== 'cancelled' ? (
              <div className="acoes">
                <button
                  type="button"
                  className="botao"
                  disabled={ocupado}
                  onClick={() => void marcarEntregue(e)}
                >
                  Marcar entregue
                </button>
              </div>
            ) : null}
          </section>
        ))
      )}
    </>
  );
}
