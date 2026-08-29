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
  /** Saldo de Fly Points. */
  saldo: number;
  /** Saldo financeiro em centavos, e a moeda dele. */
  carteiraCentavos: number;
  moeda: string;
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

interface Periodo {
  id: string;
  chave: string;
  rotulo: string;
  dimensao: string;
  comeca: string;
  termina: string;
  base: string;
  criterio: string | null;
  publicado: boolean;
  calculadoEm: string | null;
  participantes: number;
}

interface CupomOps {
  codigo: string;
  rotulo: string;
  ativo: boolean;
}

interface VoucherOps {
  id: string;
  cliente: string;
  codigo: string;
  entregueEm: string;
  usadoEm: string | null;
}

interface Regra {
  limiarPrime: number | null;
  limiarElite: number | null;
  validadeMeses: number | null;
  porUnidade: number | null;
  versao: string | null;
}

const PACOTES = ['standard', 'black', 'billionaire'] as const;
type Pacote = (typeof PACOTES)[number];

/** Guarda de verdade, no lugar de um cast que afirma o que nao sabe. */
function ehPacote(v: string): v is Pacote {
  return (PACOTES as readonly string[]).includes(v);
}

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
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cupons, setCupons] = useState<CupomOps[]>([]);
  const [vouchers, setVouchers] = useState<VoucherOps[]>([]);
  const [vCliente, setVCliente] = useState('');
  const [vCupom, setVCupom] = useState('');
  const [regra, setRegra] = useState<Regra | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Ajuste em aberto: qual cliente, quantos pontos, por quê.
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [pontos, setPontos] = useState('');
  const [motivo, setMotivo] = useState('');

  // Credito de carteira: dinheiro, dominio separado dos pontos.
  const [creditando, setCreditando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [motivoValor, setMotivoValor] = useState('');

  const carregar = useCallback(async () => {
    const db = supabase();

    const [perfis, pacotes, saldos, carteiras, bens, config, pers, scores, cups, vchs] =
      await Promise.all([
        db.from('profiles').select('id, public_id, preferred_name, display_name').limit(200),
        db.from('customer_packages').select('user_id, package'),
        db.from('points_balance').select('user_id, balance'),
        db.from('wallet_balance').select('user_id, currency, balance_cents'),
        db
          .from('benefits')
          .select('id, key, title, points_cost, stock, min_level, is_active')
          .order('sort_order'),
        db
          .from('app_config')
          .select('key, value')
          .in('key', ['points.level_thresholds', 'points.validity_months', 'points.earning_rule']),
        db
          .from('ranking_periods')
          .select(
            'id, key, label, dimension, starts_on, ends_on, basis, criteria_note, is_published, computed_at',
          )
          .order('starts_on', { ascending: false }),
        db.from('ranking_scores').select('period_id'),
        db.from('coupons').select('code, label, is_active').order('code'),
        db
          .from('customer_vouchers')
          .select('id, user_id, coupon_code, granted_at, used_at')
          .order('granted_at', { ascending: false })
          .limit(50),
      ]);

    if (perfis.error) return setErro(perfis.error.message);

    const porPacote = new Map((pacotes.data ?? []).map((p) => [p.user_id, p.package]));
    const porSaldo = new Map((saldos.data ?? []).map((s) => [s.user_id, s.balance ?? 0]));
    const porCarteira = new Map(
      (carteiras.data ?? []).map((w) => [
        w.user_id,
        { centavos: Number(w.balance_cents ?? 0), moeda: w.currency },
      ]),
    );

    setClientes(
      (perfis.data ?? []).map((p) => ({
        id: p.id,
        nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
        flyId: p.public_id,
        pacote: porPacote.get(p.id) ?? null,
        saldo: porSaldo.get(p.id) ?? 0,
        carteiraCentavos: porCarteira.get(p.id)?.centavos ?? 0,
        moeda: porCarteira.get(p.id)?.moeda ?? 'AED',
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

    const porPeriodo = new Map<string, number>();
    for (const sc of scores.data ?? []) {
      porPeriodo.set(sc.period_id, (porPeriodo.get(sc.period_id) ?? 0) + 1);
    }

    setPeriodos(
      (pers.data ?? []).map((p) => ({
        id: p.id,
        chave: p.key,
        rotulo: p.label,
        dimensao: p.dimension,
        comeca: p.starts_on,
        termina: p.ends_on,
        base: p.basis,
        criterio: p.criteria_note,
        publicado: p.is_published,
        calculadoEm: p.computed_at,
        participantes: porPeriodo.get(p.id) ?? 0,
      })),
    );

    const nomePorId = new Map(
      (perfis.data ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? p.public_id]),
    );

    const listaCupons = (cups.data ?? []).map((x) => ({
      codigo: x.code,
      rotulo: x.label,
      ativo: x.is_active,
    }));
    setCupons(listaCupons);
    setVCupom((atual) => atual || (listaCupons.find((x) => x.ativo)?.codigo ?? ''));

    setVouchers(
      (vchs.data ?? []).map((v) => ({
        id: v.id,
        cliente: nomePorId.get(v.user_id) ?? 'Cliente',
        codigo: v.coupon_code,
        entregueEm: v.granted_at,
        usadoEm: v.used_at,
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
    if (!ehPacote(pacote)) return setErro(`Pacote desconhecido: ${pacote}`);
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('customer_packages')
      .upsert({ user_id: userId, package: pacote }, { onConflict: 'user_id' });
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

  async function vencerPontos() {
    if (
      !confirm(
        'Vencer os pontos que passaram da validade?\n\n' +
          'Cada lote vencido gera um lançamento de saída no extrato do cliente. ' +
          'Isto não pode ser apagado — desfazer exige um ajuste manual.',
      )
    ) {
      return;
    }
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { data, error } = await supabase().rpc('vencer_pontos', {});
    if (error) setErro(error.message);
    else {
      const r = Array.isArray(data) ? data[0] : data;
      setRecado(
        r && r.lotes > 0
          ? `${r.lotes} lote(s) vencido(s), ${formatar(r.pontos ?? 0)} pontos retirados.`
          : 'Nenhum lote venceu: não há ponto fora da validade.',
      );
    }
    await carregar();
    setOcupado(false);
  }

  async function alternarPublicacao(p: Periodo) {
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('ranking_periods')
      .update({ is_published: !p.publicado })
      .eq('id', p.id);
    // A constraint do banco recusa publicar sem criterio declarado. A tela
    // traduz, em vez de mostrar o texto da constraint.
    if (error) {
      setErro(
        error.code === '23514'
          ? `«${p.rotulo}» não tem os critérios escritos. Um ranking que ninguém sabe explicar gera briga — escreva antes de publicar.`
          : error.message,
      );
    }
    await carregar();
    setOcupado(false);
  }

  async function recalcular(p: Periodo) {
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { data, error } = await supabase().rpc('recalcular_ranking', { p_period: p.id });
    if (error) setErro(error.message);
    else {
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.ok) setRecado(`«${p.rotulo}» recalculado: ${r.participantes} participantes.`);
      else setErro(r?.motivo ?? 'não foi possível recalcular');
    }
    await carregar();
    setOcupado(false);
  }

  function dinheiro(centavos: number, moeda: string): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(
        centavos / 100,
      );
    } catch {
      return `${moeda} ${(centavos / 100).toFixed(2)}`;
    }
  }

  async function lancarCredito(c: ClienteFidelidade) {
    // Aceita "150" e "150,50". Virgula porque e o separador que se digita aqui.
    const n = Number(valor.replace(',', '.'));
    if (!Number.isFinite(n) || n === 0) {
      return setErro('O valor é um número diferente de zero. Negativo tira da carteira.');
    }
    if (!motivoValor.trim()) {
      return setErro('O crédito exige motivo — é dinheiro, e alguém vai auditar.');
    }

    const centavos = Math.round(n * 100);
    if (
      !confirm(
        `${centavos > 0 ? 'Creditar' : 'Debitar'} ${dinheiro(Math.abs(centavos), c.moeda)} ` +
          `${centavos > 0 ? 'para' : 'de'} ${c.nome}?\n\n` +
          `Saldo hoje: ${dinheiro(c.carteiraCentavos, c.moeda)}\n` +
          `Saldo depois: ${dinheiro(c.carteiraCentavos + centavos, c.moeda)}\n\n` +
          `Isto é dinheiro e não pode ser apagado. Corrigir exige outro lançamento.`,
      )
    ) {
      return;
    }

    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('wallet_entries')
      .insert({
        user_id: c.id,
        // Positivo que a Fly concede e `credit`; negativo e `adjust`, porque
        // `debit` e reservado a gasto do cliente na Fly.
        kind: centavos > 0 ? 'credit' : 'adjust',
        amount_cents: centavos,
        currency: c.moeda as 'AED',
        source: 'ops',
        reason: motivoValor.trim(),
        idempotency_key: `ops:wallet:${c.id}:${Date.now()}`,
      });

    if (error) setErro(error.message);
    else {
      setRecado(
        `${dinheiro(Math.abs(centavos), c.moeda)} ${centavos > 0 ? 'creditados para' : 'debitados de'} ${c.nome}.`,
      );
      setCreditando(null);
      setValor('');
      setMotivoValor('');
    }
    await carregar();
    setOcupado(false);
  }

  async function entregarVoucher() {
    if (!vCliente || !vCupom) return setErro('Escolha o cliente e o cupom.');
    setOcupado(true);
    setErro(null);
    setRecado(null);
    const { error } = await supabase()
      .from('customer_vouchers')
      .insert({ user_id: vCliente, coupon_code: vCupom });
    // A tabela impede o mesmo cupom duas vezes para a mesma pessoa.
    if (error) {
      setErro(
        error.code === '23505'
          ? 'Esse cliente já tem esse cupom. Um voucher por pessoa por código.'
          : error.message,
      );
    } else {
      setRecado('Voucher entregue. Já aparece na Carteira do cliente.');
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

        {regra.validadeMeses !== null ? (
          <>
            <p className="muted">
              O app promete ao cliente que cada ponto vale por{' '}
              <strong>{regra.validadeMeses} meses</strong>. Quem cumpre essa promessa é o botão
              abaixo: ele vence o <strong>saldo restante</strong> de cada lote fora da validade, do
              mais antigo para o mais novo. Um lote de 10.000 com 7.000 já gastos vence 3.000.
            </p>
            <div className="acoes">
              <button
                type="button"
                className="botao botao--fantasma"
                disabled={ocupado}
                onClick={() => void vencerPontos()}
              >
                Vencer pontos fora da validade
              </button>
            </div>
          </>
        ) : null}
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
                <th>Fly Points</th>
                <th>Nível</th>
                <th>Carteira</th>
                <th>Ações</th>
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
                  <td className="mono">{dinheiro(c.carteiraCentavos, c.moeda)}</td>
                  <td>
                    <button
                      type="button"
                      className={ajustando === c.id ? 'botao' : 'botao botao--fantasma'}
                      onClick={() => {
                        setAjustando(ajustando === c.id ? null : c.id);
                        setCreditando(null);
                        setPontos('');
                        setMotivo('');
                        setErro(null);
                      }}
                    >
                      {ajustando === c.id ? 'Fechando' : 'Pontos'}
                    </button>{' '}
                    <button
                      type="button"
                      className={creditando === c.id ? 'botao' : 'botao botao--fantasma'}
                      onClick={() => {
                        setCreditando(creditando === c.id ? null : c.id);
                        setAjustando(null);
                        setValor('');
                        setMotivoValor('');
                        setErro(null);
                      }}
                    >
                      {creditando === c.id ? 'Fechando' : 'Dinheiro'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {creditando ? (
          <div className="bloco">
            {(() => {
              const c = clientes.find((x) => x.id === creditando);
              if (!c) return null;
              const n = Number(valor.replace(',', '.'));
              const centavos = Number.isFinite(n) ? Math.round(n * 100) : 0;
              return (
                <>
                  <h3>Carteira de {c.nome}</h3>
                  <p className="muted">
                    Isto é <strong>dinheiro</strong>, e é domínio separado dos Fly Points. Serve
                    para cortesia, reembolso convertido em crédito e correção de operação. Como o
                    extrato é append-only, corrigir depois exige outro lançamento.
                  </p>

                  <div className="form form--linha">
                    <label className="field">
                      <span className="muted">Valor em {c.moeda} (negativo tira)</span>
                      <input
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="150,00"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="field">
                      <span className="muted">Motivo</span>
                      <input
                        value={motivoValor}
                        onChange={(e) => setMotivoValor(e.target.value)}
                        placeholder="Cortesia por atraso no transfer"
                      />
                    </label>
                  </div>

                  <p className="muted">
                    Saldo hoje <span className="mono">{dinheiro(c.carteiraCentavos, c.moeda)}</span>{' '}
                    → depois{' '}
                    <span className="mono">
                      <strong>{dinheiro(c.carteiraCentavos + centavos, c.moeda)}</strong>
                    </span>
                  </p>

                  {c.carteiraCentavos + centavos < 0 ? (
                    <p className="aviso">
                      Este lançamento deixaria a carteira negativa. O banco aceita — ajuste existe
                      para corrigir erro —, mas confira antes.
                    </p>
                  ) : null}

                  <div className="acoes">
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void lancarCredito(c)}
                    >
                      Lançar na carteira
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}

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

      <section className="secao">
        <div className="cabecalho">
          <h2>Vouchers</h2>
          <p className="muted">{vouchers.filter((v) => !v.usadoEm).length} em aberto</p>
        </div>

        <p className="muted">
          Cupom entregue a uma pessoa. Aparece na Carteira dela e some quando for usado. Os termos
          continuam no cupom — aqui não há cópia.
        </p>

        <div className="form form--linha">
          <label className="field">
            <span className="muted">Cliente</span>
            <select value={vCliente} onChange={(e) => setVCliente(e.target.value)}>
              <option value="">escolha</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {c.flyId}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">Cupom</span>
            <select value={vCupom} onChange={(e) => setVCupom(e.target.value)}>
              {cupons.map((c) => (
                <option key={c.codigo} value={c.codigo} disabled={!c.ativo}>
                  {c.codigo} · {c.rotulo}
                  {c.ativo ? '' : ' (inativo)'}
                </option>
              ))}
            </select>
          </label>
          <div className="acoes">
            <button
              type="button"
              className="botao"
              disabled={ocupado || !vCliente || !vCupom}
              onClick={() => void entregarVoucher()}
            >
              Entregar
            </button>
          </div>
        </div>

        {vouchers.length > 0 ? (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cupom</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td>{v.cliente}</td>
                    <td className="mono">{v.codigo}</td>
                    <td>
                      {v.usadoEm ? (
                        <span className="muted">usado</span>
                      ) : (
                        <span className="selo selo--ok">em aberto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="secao">
        <div className="cabecalho">
          <h2>Ranking</h2>
          <p className="muted">{periodos.filter((p) => p.publicado).length} publicados</p>
        </div>

        <p className="muted">
          O ranking é <strong>opt-in</strong>: quem não ativou no app não aparece, e quem desativa
          some na hora. A pontuação é normalizada de 0 a 1000 —{' '}
          <strong>valor gasto nunca é publicado</strong>, e a tabela nem tem essa coluna.
        </p>

        {periodos.length === 0 ? (
          <p className="aviso">
            Nenhum período ainda. Períodos são criados no banco por enquanto — a tela de criação
            entra junto com premiação.
          </p>
        ) : (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Dimensão</th>
                  <th>Janela</th>
                  <th>Base</th>
                  <th>Participantes</th>
                  <th>Recalcular</th>
                  <th>Publicar</th>
                </tr>
              </thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.rotulo}</strong>
                      <br />
                      <span className="mono muted">{p.chave}</span>
                      {p.criterio ? null : (
                        <>
                          <br />
                          <span className="pendente">sem critério escrito</span>
                        </>
                      )}
                    </td>
                    <td>{p.dimensao}</td>
                    <td className="mono">
                      {p.comeca} → {p.termina}
                    </td>
                    <td>{p.base === 'manual' ? 'digitada' : 'pontos ganhos'}</td>
                    <td className="mono">{p.participantes}</td>
                    <td>
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado || p.base === 'manual'}
                        onClick={() => void recalcular(p)}
                      >
                        Recalcular
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={p.publicado ? 'botao' : 'botao botao--fantasma'}
                        disabled={ocupado}
                        aria-pressed={p.publicado}
                        onClick={() => void alternarPublicacao(p)}
                      >
                        {p.publicado ? 'Publicado' : 'Rascunho'}
                      </button>
                    </td>
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
