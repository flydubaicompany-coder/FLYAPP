import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';
import { paraCsv } from '../dominio/csv';

/**
 * Relatórios (§46, entrega 6) com exportação registrada (entrega 11).
 *
 * O critério que manda é "relatório reconcilia com ledgers". O de comércio não
 * soma pedidos e pronto: ele compara o que o pedido diz com o que os
 * pagamentos e estornos dizem, e mostra a diferença. Zero é o esperado;
 * qualquer outro número vira uma lista de pedidos para alguém olhar.
 *
 * **Patrocinadores não têm relatório de verdade**, e a tela diz isso em vez de
 * fingir. Não existe domínio de patrocinador neste projeto: existe um campo de
 * texto livre em `surprise_tasks`. Agrupá-lo é o que dá para fazer com
 * honestidade; criar uma entidade de patrocinador seria inventar termo
 * comercial, que a §33 proíbe. Registrado como P56.
 *
 * Cada relatório tem papel mínimo, conferido no servidor. Quem não pode vê a
 * recusa, e não uma tabela vazia — tabela vazia faz a pessoa achar que não há
 * dado.
 */

type Aba = 'viagem' | 'comercio' | 'suporte' | 'experiencia' | 'eventos' | 'patrocinio';

const ABAS: { chave: Aba; rotulo: string; papel: string }[] = [
  { chave: 'viagem', rotulo: 'Viagem', papel: 'quem opera a viagem' },
  { chave: 'comercio', rotulo: 'Comércio', papel: 'financeiro' },
  { chave: 'suporte', rotulo: 'Suporte', papel: 'suporte' },
  { chave: 'experiencia', rotulo: 'Experiência', papel: 'experiência' },
  { chave: 'eventos', rotulo: 'Eventos', papel: 'gerência' },
  { chave: 'patrocinio', rotulo: 'Patrocínio', papel: 'experiência ou financeiro' },
];

interface Viagem {
  id: string;
  nome: string;
}

type Linhas = Record<string, unknown>[];

function dinheiro(centavos: unknown, moeda = ''): string {
  if (typeof centavos !== 'number') return '—';
  return `${moeda} ${(centavos / 100).toFixed(2)}`.trim();
}

export function Relatorios() {
  const [aba, setAba] = useState<Aba>('viagem');
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagem, setViagem] = useState('');
  const [de, setDe] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [ate, setAte] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [linhas, setLinhas] = useState<Linhas | null>(null);
  const [divergentes, setDivergentes] = useState<Linhas>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    void supabase()
      .from('trips')
      .select('id, name')
      .order('starts_on', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const lista = (data ?? []).map((t) => ({ id: t.id, nome: t.name }));
        setViagens(lista);
        setViagem((v) => v || (lista[0]?.id ?? ''));
      });
  }, []);

  const rodar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setRecado(null);
    setDivergentes([]);
    const db = supabase();
    const janela = { p_de: `${de}T00:00:00Z`, p_ate: `${ate}T00:00:00Z` };

    const resposta = await (async () => {
      switch (aba) {
        case 'viagem':
          if (!viagem) return { data: [], error: null };
          return db.rpc('relatorio_viagem', { p_trip: viagem });
        case 'comercio':
          return db.rpc('relatorio_comercio', {
            ...janela,
            ...(viagem ? { p_trip: viagem } : {}),
          });
        case 'suporte':
          return db.rpc('relatorio_suporte', {
            ...janela,
            ...(viagem ? { p_trip: viagem } : {}),
          });
        case 'experiencia':
          if (!viagem) return { data: [], error: null };
          return db.rpc('relatorio_experiencia', { p_trip: viagem });
        case 'eventos':
          return db.rpc('relatorio_eventos', janela);
        case 'patrocinio':
          return db.rpc('relatorio_patrocinio', {
            ...janela,
            ...(viagem ? { p_trip: viagem } : {}),
          });
      }
    })();

    if (resposta.error) {
      setCarregando(false);
      setLinhas(null);
      // 42501 vem do servidor quando o papel não alcança. Dizer isso é melhor
      // do que mostrar tabela vazia: vazio parece "não há dado".
      return setErro(
        resposta.error.code === '42501'
          ? 'Seu papel não alcança este relatório. Peça à administração, ou peça o número a quem responde por ele.'
          : resposta.error.message,
      );
    }

    setLinhas((resposta.data ?? []) as Linhas);

    // A conferência do comércio só faz sentido se der para chegar às linhas.
    if (aba === 'comercio') {
      const { data } = await db.rpc('comercio_divergencias', {
        ...janela,
        ...(viagem ? { p_trip: viagem } : {}),
      });
      setDivergentes((data ?? []) as Linhas);
    }
    setCarregando(false);
  }, [aba, de, ate, viagem]);

  useEffect(() => {
    void rodar();
  }, [rodar]);

  const exportar = useCallback(async () => {
    const dados = linhas ?? [];
    const { error } = await supabase().rpc('registrar_exportacao', {
      p_relatorio: aba,
      p_escopo: { de, ate, trip: viagem || null } as never,
      p_linhas: dados.length,
    });
    if (error)
      return setErro(`Exportação não registrada, e por isso não foi feita: ${error.message}`);

    const blob = new Blob([paraCsv(dados)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${aba}-${de}-a-${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRecado(`${dados.length} linhas exportadas — e registrado que foi você.`);
  }, [aba, linhas, de, ate, viagem]);

  const comercio = aba === 'comercio' ? (linhas ?? []) : [];

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Relatórios</p>
          <h1>Os números, e o que não fecha</h1>
          <p className="muted">
            Exportar registra na trilha quem exportou, o quê e quantas linhas. Não é um porteiro —
            quem exporta já leu as linhas, e quem decidiu isso foi a RLS.
          </p>
        </div>
        <div className="acoes">
          <button
            type="button"
            className="botao"
            disabled={!linhas || linhas.length === 0}
            onClick={() => void exportar()}
          >
            Exportar CSV
          </button>
        </div>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      <div className="acoes">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            className={aba === a.chave ? 'botao' : 'botao botao--fantasma'}
            onClick={() => setAba(a.chave)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="form form--linha">
        <label className="field">
          <span>Viagem</span>
          <select value={viagem} onChange={(e) => setViagem(e.target.value)}>
            {aba === 'viagem' || aba === 'experiencia' ? null : <option value="">Todas</option>}
            {viagens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        {aba === 'viagem' || aba === 'experiencia' ? null : (
          <>
            <label className="field">
              <span>De</span>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </label>
            <label className="field">
              <span>Até</span>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </label>
          </>
        )}
        <button type="button" className="botao botao--fantasma" onClick={() => void rodar()}>
          Recalcular
        </button>
      </div>

      {aba === 'patrocinio' ? (
        <p className="pendente">
          Não existe cadastro de patrocinador neste projeto (P56). O que está abaixo é o agrupamento
          do campo de texto que a operação digita ao registrar quem bancou uma surpresa —
          &quot;Rolex&quot; e &quot;rolex &quot; aparecem como duas linhas, e aparecem de propósito:
          o problema é de cadastro, e escondê-lo aqui não o resolve.
        </p>
      ) : null}

      {carregando ? <p className="muted">Calculando…</p> : null}

      {!carregando && linhas && linhas.length === 0 ? (
        <p className="muted">Nada nessa janela.</p>
      ) : null}

      {!carregando && linhas && linhas.length > 0 ? (
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                {Object.keys(linhas[0] ?? {}).map((c) => (
                  <th key={c}>{c.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  {Object.entries(l).map(([c, v]) => (
                    <td key={c} className={typeof v === 'number' ? 'mono' : undefined}>
                      {c.endsWith('_cents') ? dinheiro(v) : String(v ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {comercio.length > 0 ? (
        <section className="secao">
          <h2>Reconciliação</h2>
          {divergentes.length === 0 ? (
            <p className="muted">
              Todo pedido pago bate com o que foi capturado e estornado. É o esperado — e é a única
              forma de saber que está certo.
            </p>
          ) : (
            <>
              <p className="pendente">
                {divergentes.length} pedido{divergentes.length === 1 ? '' : 's'} não fecha
                {divergentes.length === 1 ? '' : 'm'}. O total do pedido menos o capturado mais o
                estornado deveria dar zero.
              </p>
              <div className="tabela-envolvente">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Situação</th>
                      <th>Total</th>
                      <th>Capturado</th>
                      <th>Estornado</th>
                      <th>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divergentes.map((d, i) => (
                      <tr key={i}>
                        <td className="mono">{String(d.reference)}</td>
                        <td>{String(d.status)}</td>
                        <td className="mono">{dinheiro(d.total_cents, String(d.currency))}</td>
                        <td className="mono">{dinheiro(d.capturado_cents, String(d.currency))}</td>
                        <td className="mono">{dinheiro(d.estornado_cents, String(d.currency))}</td>
                        <td className="mono pendente">
                          {dinheiro(d.diferenca_cents, String(d.currency))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      <p className="muted">
        Papel mínimo de cada relatório: {ABAS.map((a) => `${a.rotulo} — ${a.papel}`).join(' · ')}.
      </p>
    </>
  );
}
