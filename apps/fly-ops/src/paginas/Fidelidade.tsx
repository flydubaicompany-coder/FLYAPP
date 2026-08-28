import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Fidelidade (§41, entrega 13): regra, pacote, ajuste e benefícios.
 *
 * Sem esta tela o dono não opera a Carteira: não concede pacote, não corrige
 * um lançamento errado e não muda um limiar. Tudo isso era SQL escrito à mão.
 *
 * **O ajuste é o item delicado.** O banco já exige papel de operador (RLS) e
 * motivo (constraint). Aqui a tela reforça a terceira coisa que nenhuma das
 * duas garante: que quem ajusta entenda que está mexendo no saldo de alguém.
 * Por isso o ajuste pede confirmação e mostra o saldo resultante antes.
 *
 * **Ajuste não edita o passado.** Lança um novo movimento, e o ledger continua
 * append-only — corrigir é somar o oposto, nunca apagar.
 */

interface ClienteFidelidade {
  id: string;
  nome: string;
  flyId: string;
  pacote: string | null;
  saldo: number;
}

interface BeneficioOps {
  id: string;
  chave: string;
  titulo: string;
  custo: number;
  estoque: number | null;
  nivelMinimo: string | null;
  ativo: boolean;
}

interface Regra {
  limiarPrime: number | null;
  limiarElite: number | null;
  validadeMeses: number | null;
  porUnidade: number | null;
  versao: string | null;
}

const PACOTES = ['standard', 'black', 'billionaire'] as const;

function formatar(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

function nivelDe(saldo: number, r: Regra): string {
  if (r.limiarElite !== null && saldo >= r.limiarElite) return 'elite';
  if (r.limiarPrime !== null && saldo >= r.limiarPrime) return 'prime';
  return 'basic';
}

export function Fidelidade() {
  const [clientes, setClientes] = useState<ClienteFidelidade[] | null>(null);
  const [beneficios, setBeneficios] = useState<BeneficioOps[]>([]);
  const [regra, setRegra] = useState<Regra | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Ajuste em aberto: qual cliente, quantos pontos, por quê.
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [pontos, setPontos] = useState('');
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    const db = supabase();

    const [perfis, pacotes, saldos, bens, config] = await Promise.all([
      db.from('profiles').select('id, public_id, preferred_name, display_name').limit(200),
      db.from('customer_packages').select('user_id, package'),
      db.from('points_balance').select('user_id, balance'),
      db
        .from('benefits')
        .select('id, key, title, points_cost, stock, min_level, is_active')
        .order('sort_order'),
      db
        .from('app_config')
        .select('key, value')
        .in('key', ['points.level_thresholds', 'points.validity_months', 'points.earning_rule']),
    ]);

    if (perfis.error) return setErro(perfis.error.message);

    const porPacote = new Map((pacotes.data ?? []).map((p) => [p.user_id, p.package]));
    const porSaldo = new Map((saldos.data ?? []).map((s) => [s.user_id, s.balance ?? 0]));

    setClientes(
      (perfis.data ?? []).map((p) => ({
        id: p.id,
        nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
        flyId: p.public_id,
        pacote: porPacote.get(p.id) ?? null,
        saldo: porSaldo.get(p.id) ?? 0,
      })),
    );

    setBeneficios(
      (bens.data ?? []).map((b) => ({
        id: b.id,
        chave: b.key,
        titulo: b.title,
        custo: b.points_cost,
        estoque: b.stock,
        nivelMinimo: b.min_level,
        ativo: b.is_active,
      })),
    );

    const c = new Map((config.data ?? []).map((x) => [x.key, x.value]));
    const lim = c.get('points.level_thresholds') as Record<string, number | null> | undefined;
    const reg = c.get('points.earning_rule') as Record<string, unknown> | undefined;
    const val = c.get('points.validity_months');

    setRegra({
      limiarPrime: lim?.['prime'] ?? null,
      limiarElite: lim?.['elite'] ?? null,
      validadeMeses: typeof val === 'number' ? val : null,
      porUnidade:
        typeof reg?.['spend_points_per_unit'] === 'number'
          ? (reg['spend_points_per_unit'] as number)
          : null,
      versao: typeof reg?.['version'] === 'string' ? (reg['version'] as string) : null,
    });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function definirPacote(userId: string, pacote: string) {
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('customer_packages')
      .upsert({ user_id: userId, package: pacote as 'standard' }, { onConflict: 'user_id' });
    if (error) setErro(error.message);
    else setRecado(`Pacote definido como ${pacote}.`);
    await carregar();
    setOcupado(false);
  }

  async function lancarAjuste(c: ClienteFidelidade) {
    const n = Number(pontos);
    if (!Number.isInteger(n) || n === 0) {
      return setErro('O ajuste é um número inteiro diferente de zero. Negativo tira pontos.');
    }
    if (!motivo.trim()) {
      return setErro('O ajuste exige motivo — é o que permite auditar depois.');
    }
    if (
      !confirm(
        `Lançar ${n > 0 ? '+' : ''}${formatar(n)} pontos para ${c.nome}?\n\n` +
          `Saldo hoje: ${formatar(c.saldo)}\nSaldo depois: ${formatar(c.saldo + n)}\n\n` +
          `Isto não pode ser apagado. Corrigir depois exige outro lançamento.`,
      )
    ) {
      return;
    }

    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('points_ledger')
      .insert({
        user_id: c.id,
        kind: 'adjust',
        amount: n,
        source: 'ops',
        reason: motivo.trim(),
        idempotency_key: `ops:${c.id}:${Date.now()}`,
      });

    if (error) setErro(error.message);
    else {
      setRecado(`Ajuste de ${n > 0 ? '+' : ''}${formatar(n)} lançado para ${c.nome}.`);
      setAjustando(null);
      setPontos('');
      setMotivo('');
    }
    await carregar();
    setOcupado(false);
  }

  async function alternarBeneficio(b: BeneficioOps) {
    setOcupado(true);
    const { error } = await supabase()
      .from('benefits')
      .update({ is_active: !b.ativo, updated_at: new Date().toISOString() })
      .eq('id', b.id);
    if (error) setErro(error.message);
    await carregar();
    setOcupado(false);
  }

  if (erro && !clientes)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!clientes || !regra) return <p className="muted">Carregando…</p>;

  const semRegra = regra.versao === null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Fidelidade</p>
          <h1>Fly Points e benefícios</h1>
        </div>
        <p className="muted">{clientes.length} clientes</p>
      </div>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <section className="bloco">
        <div className="cabecalho">
          <h2>A regra em vigor</h2>
          {regra.versao ? <span className="selo selo--ok">{regra.versao}</span> : null}
        </div>

        {semRegra ? (
          <p className="aviso">
            Não há regra decidida. Enquanto isso, <strong>nenhuma compra credita pontos</strong> — o
            sistema não inventa uma regra por conta própria.
          </p>
        ) : null}

        <dl className="facts">
          <div>
            <dt>Por unidade de moeda</dt>
            <dd>{regra.porUnidade ?? '—'} pontos</dd>
          </div>
          <div>
            <dt>Chega em prime</dt>
            <dd>{regra.limiarPrime !== null ? formatar(regra.limiarPrime) : 'a definir'}</dd>
          </div>
          <div>
            <dt>Chega em elite</dt>
            <dd>{regra.limiarElite !== null ? formatar(regra.limiarElite) : 'a definir'}</dd>
          </div>
          <div>
            <dt>Validade</dt>
            <dd>{regra.validadeMeses !== null ? `${regra.validadeMeses} meses` : 'nunca vence'}</dd>
          </div>
        </dl>

        <p className="muted">
          A regra vive em <span className="mono">app_config</span> e vale para os lançamentos novos.
          Cada lançamento guarda a versão que o gerou, então mudar a regra não reescreve o passado.
        </p>
      </section>

      <section className="secao">
        <div className="cabecalho">
          <h2>Clientes</h2>
          <p className="muted">Pacote, saldo e ajuste</p>
        </div>

        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pacote</th>
                <th>Saldo</th>
                <th>Nível</th>
                <th>Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.nome}</strong>
                    <br />
                    <span className="mono muted">{c.flyId}</span>
                  </td>
                  <td>
                    <select
                      value={c.pacote ?? ''}
                      disabled={ocupado}
                      onChange={(e) => void definirPacote(c.id, e.target.value)}
                      aria-label={`Pacote de ${c.nome}`}
                    >
                      <option value="" disabled>
                        sem pacote
                      </option>
                      {PACOTES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="mono">{formatar(c.saldo)}</td>
                  <td>{nivelDe(c.saldo, regra)}</td>
                  <td>
                    <button
                      type="button"
                      className={ajustando === c.id ? 'botao' : 'botao botao--fantasma'}
                      onClick={() => {
                        setAjustando(ajustando === c.id ? null : c.id);
                        setPontos('');
                        setMotivo('');
                        setErro(null);
                      }}
                    >
                      {ajustando === c.id ? 'Fechando' : 'Ajustar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ajustando ? (
          <div className="bloco">
            {(() => {
              const c = clientes.find((x) => x.id === ajustando);
              if (!c) return null;
              const n = Number(pontos);
              const previsto = Number.isFinite(n) ? c.saldo + n : c.saldo;
              return (
                <>
                  <h3>Ajustar {c.nome}</h3>
                  <p className="muted">
                    O ajuste <strong>não edita o passado</strong>: lança um movimento novo. Para
                    desfazer depois é preciso outro lançamento — o extrato guarda os dois.
                  </p>

                  <div className="form form--linha">
                    <label className="field">
                      <span className="muted">Pontos (negativo tira)</span>
                      <input
                        value={pontos}
                        onChange={(e) => setPontos(e.target.value)}
                        placeholder="-500"
                        inputMode="numeric"
                      />
                    </label>
                    <label className="field">
                      <span className="muted">Motivo</span>
                      <input
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Cortesia por atraso no transfer"
                      />
                    </label>
                  </div>

                  <p className="muted">
                    Saldo hoje <span className="mono">{formatar(c.saldo)}</span> → depois{' '}
                    <span className="mono">
                      <strong>{formatar(previsto)}</strong>
                    </span>
                  </p>

                  {previsto < 0 ? (
                    <p className="aviso">
                      Este ajuste deixaria o saldo negativo. O banco aceita — ajuste existe
                      justamente para corrigir erro —, mas confira antes.
                    </p>
                  ) : null}

                  <div className="acoes">
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void lancarAjuste(c)}
                    >
                      Lançar ajuste
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </section>

      <section className="secao">
        <div className="cabecalho">
          <h2>Benefícios</h2>
          <p className="muted">{beneficios.filter((b) => b.ativo).length} ativos</p>
        </div>

        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Benefício</th>
                <th>Custo</th>
                <th>Estoque</th>
                <th>Nível mínimo</th>
                <th>Ativo</th>
              </tr>
            </thead>
            <tbody>
              {beneficios.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.titulo}</strong>
                    <br />
                    <span className="mono muted">{b.chave}</span>
                  </td>
                  <td className="mono">{formatar(b.custo)}</td>
                  <td className="mono">{b.estoque === null ? 'ilimitado' : b.estoque}</td>
                  <td>{b.nivelMinimo ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={b.ativo ? 'botao' : 'botao botao--fantasma'}
                      disabled={ocupado}
                      aria-pressed={b.ativo}
                      onClick={() => void alternarBeneficio(b)}
                    >
                      {b.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted">
          Benefício ativo aparece na Carteira do cliente. Estoque zero mostra “esgotado” em vez de
          sumir — o cliente precisa saber que existe.
        </p>
      </section>
    </>
  );
}
