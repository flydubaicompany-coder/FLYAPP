import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../auth/client';
import { minutosEntre } from '../dominio/tempo';

/**
 * Dashboard Hoje (§46, entrega 2).
 *
 * A tela que abre de manhã. Ela não é um resumo bonito do mês: é a lista do
 * que acontece hoje e do que está parado esperando alguém.
 *
 * A regra que a organiza é uma só — **nada aqui é informativo**. Cada bloco
 * ou é uma coisa que vai acontecer nas próximas horas, ou é uma coisa que
 * alguém precisa resolver agora. Contador de total acumulado, gráfico de
 * tendência e "clientes cadastrados" ficam no `/relatorios`, onde se olha
 * sentado.
 *
 * O que está parado vem primeiro, e não o roteiro: o roteiro acontece com ou
 * sem esta tela; o caso sem dono, não.
 */

interface Atividade {
  id: string;
  titulo: string;
  quando: string | null;
  local: string | null;
  situacao: string;
  viagem: string;
  esperados: number;
  presentes: number;
}

interface Refeicao {
  id: string;
  tipo: string;
  local: string | null;
  serveAs: string | null;
  fecha: string | null;
  situacao: string;
  viagem: string;
  escolhas: number;
  esperados: number;
}

interface Caso {
  id: string;
  nivel: 'sos' | 'urgent' | 'chat';
  assunto: string | null;
  situacao: string;
  abertoEm: string;
  temDono: boolean;
}

interface Passagem {
  id: string;
  resumo: string;
  quando: string;
  viagem: string | null;
}

interface Plantao {
  id: string;
  nome: string;
  papel: string;
  ate: string;
  viagem: string | null;
}

interface Estoque {
  id: string;
  nome: string;
  saldo: number;
  minimo: number;
}

interface Dados {
  atividades: Atividade[];
  refeicoes: Refeicao[];
  casos: Caso[];
  passagens: Passagem[];
  plantao: Plantao[];
  estoque: Estoque[];
  surpresas: number;
  viagens: number;
}

const ROTULO_NIVEL: Record<Caso['nivel'], string> = {
  sos: 'SOS',
  urgent: 'Urgente',
  chat: 'Conversa',
};

const ROTULO_REFEICAO: Record<string, string> = {
  breakfast: 'Café',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

function hora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function Hoje() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const db = supabase();
    const hojeIso = new Date().toISOString().slice(0, 10);

    const { data: viagens, error: erroViagens } = await db
      .from('trips')
      .select('id, name, status')
      .eq('status', 'ongoing');

    if (erroViagens) return setErro(erroViagens.message);

    const nomeDaViagem = new Map((viagens ?? []).map((t) => [t.id, t.name]));
    const idsViagem = [...nomeDaViagem.keys()];
    // O PostgREST recusa `in` com lista vazia; um id impossível mantém a
    // consulta válida e o resultado vazio, que é o que a tela deve mostrar.
    const escopo = idsViagem.length > 0 ? idsViagem : ['00000000-0000-0000-0000-000000000000'];

    const { data: dias } = await db
      .from('trip_days')
      .select('id, trip_id, day_date')
      .in('trip_id', escopo)
      .eq('day_date', hojeIso);

    const viagemDoDia = new Map((dias ?? []).map((d) => [d.id, d.trip_id]));
    const idsDia =
      (dias ?? []).length > 0
        ? (dias ?? []).map((d) => d.id)
        : ['00000000-0000-0000-0000-000000000000'];

    const [atvRes, refRes, casosRes, passRes, plantaoRes, estoqueRes, surpresaRes] =
      await Promise.all([
        db
          .from('activities')
          .select(
            'id, trip_day_id, title, starts_at, meeting_point, status, activity_participants(user_id), activity_checkins(user_id)',
          )
          .in('trip_day_id', idsDia)
          .order('starts_at', { ascending: true, nullsFirst: false }),
        db
          .from('meal_services')
          .select(
            'id, trip_day_id, kind, location, serves_at, choices_close_at, status, meal_choices(user_id)',
          )
          .in('trip_day_id', idsDia)
          .order('serves_at', { ascending: true, nullsFirst: false }),
        db
          .from('support_cases')
          .select('id, level, subject, status, opened_at, assigned_to')
          .in('status', ['open', 'accepted', 'in_progress', 'escalated'])
          .order('opened_at', { ascending: true })
          .limit(50),
        db
          .from('shift_handoffs')
          .select('id, summary, created_at, trip_id')
          .is('accepted_at', null)
          .order('created_at', { ascending: true })
          .limit(20),
        db
          .from('staff_shifts')
          .select('id, user_id, role, ends_at, trip_id')
          .lte('starts_at', new Date().toISOString())
          .gte('ends_at', new Date().toISOString())
          .limit(50),
        db
          .from('inventory_balance')
          .select('item_id, name, saldo, low_stock_at, is_active')
          .not('low_stock_at', 'is', null)
          .limit(100),
        db.from('surprise_tasks').select('id').eq('status', 'sugerida').limit(100),
      ]);

    // Quem está de plantão precisa de nome, e o nome mora em `profiles`.
    const idsPessoa = [...new Set((plantaoRes.data ?? []).map((p) => p.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', idsPessoa.length > 0 ? idsPessoa : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );

    const participantesPorDia = new Map<string, number>();

    setDados({
      viagens: idsViagem.length,
      atividades: (atvRes.data ?? []).map((a) => {
        const tripId = viagemDoDia.get(a.trip_day_id) ?? '';
        const esperados = (a.activity_participants ?? []).length;
        participantesPorDia.set(a.trip_day_id, esperados);
        return {
          id: a.id,
          titulo: a.title,
          quando: a.starts_at,
          local: a.meeting_point,
          situacao: a.status,
          viagem: nomeDaViagem.get(tripId) ?? '—',
          esperados,
          presentes: (a.activity_checkins ?? []).length,
        };
      }),
      refeicoes: (refRes.data ?? []).map((m) => ({
        id: m.id,
        tipo: ROTULO_REFEICAO[m.kind] ?? m.kind,
        local: m.location,
        serveAs: m.serves_at,
        fecha: m.choices_close_at,
        situacao: m.status,
        viagem: nomeDaViagem.get(viagemDoDia.get(m.trip_day_id) ?? '') ?? '—',
        escolhas: (m.meal_choices ?? []).length,
        esperados: participantesPorDia.get(m.trip_day_id) ?? 0,
      })),
      casos: (casosRes.data ?? []).map((c) => ({
        id: c.id,
        nivel: c.level as Caso['nivel'],
        assunto: c.subject,
        situacao: c.status,
        abertoEm: c.opened_at,
        temDono: c.assigned_to !== null,
      })),
      passagens: (passRes.data ?? []).map((h) => ({
        id: h.id,
        resumo: h.summary,
        quando: h.created_at,
        viagem: h.trip_id ? (nomeDaViagem.get(h.trip_id) ?? null) : null,
      })),
      plantao: (plantaoRes.data ?? []).map((p) => ({
        id: p.id,
        nome: nomeDe.get(p.user_id) ?? 'Sem nome',
        papel: p.role,
        ate: p.ends_at,
        viagem: p.trip_id ? (nomeDaViagem.get(p.trip_id) ?? null) : null,
      })),
      estoque: (estoqueRes.data ?? [])
        .filter(
          (i) =>
            i.is_active &&
            i.low_stock_at !== null &&
            (i.saldo ?? 0) <= i.low_stock_at &&
            i.item_id !== null,
        )
        .map((i) => ({
          id: i.item_id as string,
          nome: i.name ?? '—',
          saldo: i.saldo ?? 0,
          minimo: i.low_stock_at ?? 0,
        })),
      surpresas: (surpresaRes.data ?? []).length,
    });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!dados) return <p className="muted">Carregando…</p>;

  const semDono = dados.casos.filter((c) => !c.temDono);
  const sos = dados.casos.filter((c) => c.nivel === 'sos');

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Hoje</p>
          <h1>
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
          </h1>
          <p className="muted">
            {dados.viagens === 0
              ? 'Nenhuma viagem em andamento.'
              : `${dados.viagens} viagem${dados.viagens > 1 ? 'ns' : ''} em andamento.`}
          </p>
        </div>
        <button type="button" className="botao botao--fantasma" onClick={() => void carregar()}>
          Atualizar
        </button>
      </header>

      {/* O que está parado. Vem antes do roteiro de propósito. */}
      <section className="secao">
        <h2>Esperando alguém</h2>
        <div className="facts">
          <div>
            <strong>{sos.length}</strong>
            <span>SOS aberto{sos.length === 1 ? '' : 's'}</span>
          </div>
          <div>
            <strong>{semDono.length}</strong>
            <span>caso{semDono.length === 1 ? '' : 's'} sem dono</span>
          </div>
          <div>
            <strong>{dados.passagens.length}</strong>
            <span>passagem{dados.passagens.length === 1 ? '' : 's'} não assumida</span>
          </div>
          <div>
            <strong>{dados.surpresas}</strong>
            <span>surpresa{dados.surpresas === 1 ? '' : 's'} para aprovar</span>
          </div>
        </div>

        {semDono.length > 0 ? (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nível</th>
                  <th>Assunto</th>
                  <th>Aberto há</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {semDono.slice(0, 8).map((c) => (
                  <tr key={c.id}>
                    <td>{ROTULO_NIVEL[c.nivel]}</td>
                    <td>{c.assunto ?? '—'}</td>
                    <td className="mono">
                      {minutosEntre(c.abertoEm, new Date().toISOString())} min
                    </td>
                    <td>
                      <Link className="botao botao--fantasma" to="/atendimento">
                        Abrir fila
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhum caso sem dono.</p>
        )}

        {dados.passagens.length > 0 ? (
          <div className="bloco">
            <h3>Passagens de turno sem ninguém</h3>
            {dados.passagens.map((p) => (
              <p key={p.id} className="muted">
                <strong>{p.viagem ?? 'Plataforma'}</strong> · {hora(p.quando)} — {p.resumo}
              </p>
            ))}
            <Link className="botao botao--fantasma" to="/equipe">
              Ver escala
            </Link>
          </div>
        ) : null}

        {dados.estoque.length > 0 ? (
          <div className="bloco">
            <h3>Estoque no limite</h3>
            {dados.estoque.map((i) => (
              <p key={i.id} className="muted">
                {i.nome}: <strong>{i.saldo}</strong> (mínimo {i.minimo})
              </p>
            ))}
            <Link className="botao botao--fantasma" to="/inventario">
              Abrir inventário
            </Link>
          </div>
        ) : null}
      </section>

      <section className="secao">
        <h2>Quem está de plantão agora</h2>
        {dados.plantao.length === 0 ? (
          <p className="muted">
            Ninguém com turno aberto neste momento. Isso pode estar certo — ou a escala do dia não
            foi montada.
          </p>
        ) : (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Papel</th>
                  <th>Viagem</th>
                  <th>Até</th>
                </tr>
              </thead>
              <tbody>
                {dados.plantao.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.papel}</td>
                    <td>{p.viagem ?? 'Plataforma'}</td>
                    <td className="mono">{hora(p.ate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>Roteiro de hoje</h2>
        {dados.atividades.length === 0 ? (
          <p className="muted">Nenhuma atividade marcada para hoje.</p>
        ) : (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Atividade</th>
                  <th>Viagem</th>
                  <th>Ponto de encontro</th>
                  <th>Presença</th>
                </tr>
              </thead>
              <tbody>
                {dados.atividades.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{hora(a.quando)}</td>
                    <td>{a.titulo}</td>
                    <td className="muted">{a.viagem}</td>
                    <td className="muted">{a.local ?? '—'}</td>
                    <td className="mono">
                      {a.presentes}/{a.esperados}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>Refeições de hoje</h2>
        {dados.refeicoes.length === 0 ? (
          <p className="muted">Nenhuma refeição servida por nós hoje.</p>
        ) : (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Refeição</th>
                  <th>Local</th>
                  <th>Escolhas</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {dados.refeicoes.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{hora(m.serveAs)}</td>
                    <td>{m.tipo}</td>
                    <td className="muted">{m.local ?? '—'}</td>
                    <td className="mono">
                      {m.escolhas}
                      {m.esperados > 0 ? `/${m.esperados}` : ''}
                    </td>
                    <td className="mono">{hora(m.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
