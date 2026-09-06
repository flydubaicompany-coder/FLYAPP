import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Trilha legível (§46, entrega 9) e exportação registrada (entrega 11).
 *
 * `audit_logs` existe desde a Fase 0 e catorze funções escrevem nela. Ninguém
 * nunca a leu: não havia tela. Uma trilha que não se lê é uma trilha que não
 * serve — e a auditoria de paridade a registrou como lacuna.
 *
 * A tela traduz a ação para português. `papel.concedido` não diz nada para
 * quem está apurando um incidente às onze da noite; "Papel concedido" diz.
 * O que não é traduzido aparece cru, com o código: inventar um rótulo bonito
 * para uma ação desconhecida esconderia justamente a ação que ninguém esperava.
 *
 * Além de `audit_logs`, três trilhas próprias entram aqui:
 *
 *   • **QR** — inclusive as leituras recusadas. Uma sequência delas é o sinal
 *     mais barato de bilhete circulando;
 *   • **cofre** — quem abriu documento de quem, e por qual permissão;
 *   • **assistente** — o gasto e, principalmente, a ferramenta **recusada**.
 *
 * A exportação sai do que já está na tela, e é registrada. Ela **não é um
 * porteiro**: quem exporta já leu as linhas, e quem decidiu isso foi a RLS.
 * O que o registro dá é rastro — "alguém baixou a base" deixa de ser suposição.
 */

type Aba = 'trilha' | 'qr' | 'cofre' | 'assistente';

interface Linha {
  id: number;
  quando: string;
  quem: string;
  papel: string | null;
  acao: string;
  entidade: string;
  alvo: string | null;
  metadados: unknown;
}

interface Leitura {
  id: number;
  quando: string;
  quem: string;
  resultado: string;
  nota: string | null;
}

interface Acesso {
  id: number;
  quando: string;
  quem: string;
  documento: string;
  via: string;
}

interface Conversa {
  id: string;
  quando: string;
  quem: string;
  provedor: string;
  resultado: string;
  entrada: number | null;
  saida: number | null;
  centavos: number | null;
  recusadas: number;
  /** `null` = a pessoa não opinou. Diferente de "achou ruim". */
  util: boolean | null;
}

const ROTULO_ACAO: Record<string, string> = {
  'papel.concedido': 'Papel concedido',
  'papel.revogado': 'Papel revogado',
  'atribuicao.criada': 'Atribuída a uma viagem',
  'atribuicao.revogada': 'Atribuição revogada',
  'config.criada': 'Configuração criada',
  'config.alterada': 'Configuração alterada',
  'flag.alterada': 'Flag alterada',
  'flag_viagem.alterada': 'Flag sobreposta numa viagem',
  'flag_viagem.removida': 'Sobreposição de flag removida',
  'aviso.enviado': 'Aviso enviado',
  'passagem.aceita': 'Passagem de turno assumida',
  'estoque.movimento': 'Movimento de estoque',
  exportacao: 'Exportação',
};

const ROTULO_QR: Record<string, string> = {
  ok: 'Aceito',
  unknown: 'Código desconhecido',
  expired: 'Expirado',
  revoked: 'Revogado',
  wrong_scope: 'Fora do escopo',
  exhausted: 'Sem usos',
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

/** CSV com aspas dobradas: nome de cliente com vírgula é comum. */
function paraCsv(linhas: Record<string, unknown>[]): string {
  const primeira = linhas[0];
  if (primeira === undefined) return '';
  const colunas = Object.keys(primeira);
  const celula = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [colunas.join(','), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(','))].join(
    '\n',
  );
}

export function Auditoria() {
  const [aba, setAba] = useState<Aba>('trilha');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [filtroAcao, setFiltroAcao] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');

  const carregar = useCallback(async () => {
    const db = supabase();
    const [trilhaRes, qrRes, cofreRes, runsRes, callsRes, feedbackRes] = await Promise.all([
      db
        .from('audit_logs')
        .select('id, occurred_at, actor_id, actor_role, action, entity_type, entity_id, metadata')
        .order('occurred_at', { ascending: false })
        .limit(300),
      db
        .from('qr_scans')
        .select('id, scanned_at, scanned_by, result, note')
        .order('scanned_at', { ascending: false })
        .limit(150),
      db
        .from('document_access_log')
        .select('id, accessed_at, accessed_by, document_id, via')
        .order('accessed_at', { ascending: false })
        .limit(150),
      db
        .from('assistant_runs')
        .select(
          'id, created_at, user_id, provedor, resultado, tokens_entrada, tokens_saida, custo_estimado_centavos',
        )
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('assistant_tool_calls').select('run_id, autorizada').limit(1000),
      db.from('assistant_feedback').select('run_id, util').limit(500),
    ]);

    if (trilhaRes.error) return setErro(trilhaRes.error.message);

    const ids = [
      ...new Set([
        ...(trilhaRes.data ?? []).map((l) => l.actor_id),
        ...(qrRes.data ?? []).map((l) => l.scanned_by),
        ...(cofreRes.data ?? []).map((l) => l.accessed_by),
        ...(runsRes.data ?? []).map((l) => l.user_id),
      ]),
    ].filter((v): v is string => v !== null);

    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );

    const utilPorRun = new Map((feedbackRes.data ?? []).map((f) => [f.run_id, f.util]));

    const recusadasPorRun = new Map<string, number>();
    for (const c of callsRes.data ?? []) {
      if (!c.autorizada) {
        recusadasPorRun.set(c.run_id, (recusadasPorRun.get(c.run_id) ?? 0) + 1);
      }
    }

    setLinhas(
      (trilhaRes.data ?? []).map((l) => ({
        id: l.id,
        quando: l.occurred_at,
        quem: l.actor_id ? (nomeDe.get(l.actor_id) ?? 'Conta removida') : 'Sistema',
        papel: l.actor_role,
        acao: l.action,
        entidade: l.entity_type,
        alvo: l.entity_id,
        metadados: l.metadata,
      })),
    );
    setLeituras(
      (qrRes.data ?? []).map((l) => ({
        id: l.id,
        quando: l.scanned_at,
        quem: l.scanned_by ? (nomeDe.get(l.scanned_by) ?? 'Conta removida') : '—',
        resultado: l.result,
        nota: l.note,
      })),
    );
    setAcessos(
      (cofreRes.data ?? []).map((l) => ({
        id: l.id,
        quando: l.accessed_at,
        quem: nomeDe.get(l.accessed_by) ?? 'Conta removida',
        documento: l.document_id,
        via: l.via,
      })),
    );
    setConversas(
      (runsRes.data ?? []).map((r) => ({
        id: r.id,
        quando: r.created_at,
        quem: nomeDe.get(r.user_id) ?? 'Conta removida',
        provedor: r.provedor,
        resultado: r.resultado,
        entrada: r.tokens_entrada,
        saida: r.tokens_saida,
        centavos: r.custo_estimado_centavos,
        recusadas: recusadasPorRun.get(r.id) ?? 0,
        util: utilPorRun.get(r.id) ?? null,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const t = filtroTexto.trim().toLowerCase();
    return (linhas ?? []).filter(
      (l) =>
        (!filtroAcao || l.acao === filtroAcao) &&
        (!t ||
          l.quem.toLowerCase().includes(t) ||
          l.entidade.toLowerCase().includes(t) ||
          (l.alvo ?? '').toLowerCase().includes(t)),
    );
  }, [linhas, filtroAcao, filtroTexto]);

  const acoes = useMemo(() => [...new Set((linhas ?? []).map((l) => l.acao))].sort(), [linhas]);

  const exportar = useCallback(async () => {
    const dados = filtradas.map((l) => ({
      quando: l.quando,
      quem: l.quem,
      papel: l.papel ?? '',
      acao: l.acao,
      entidade: l.entidade,
      alvo: l.alvo ?? '',
      metadados: JSON.stringify(l.metadados),
    }));

    // Registra ANTES de entregar o arquivo. Se o registro falhar, não exporta:
    // a ordem inversa deixaria exportação sem rastro sempre que a rede caísse.
    const { error } = await supabase().rpc('registrar_exportacao', {
      p_relatorio: 'auditoria',
      p_escopo: { acao: filtroAcao || null, termo: filtroTexto || null } as never,
      p_linhas: dados.length,
    });
    if (error)
      return setErro(`Exportação não registrada, e por isso não foi feita: ${error.message}`);

    const blob = new Blob([paraCsv(dados)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRecado(`${dados.length} linhas exportadas — e registrado que foi você.`);
  }, [filtradas, filtroAcao, filtroTexto]);

  if (erro && !linhas)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!linhas) return <p className="muted">Carregando…</p>;

  const recusas = leituras.filter((l) => l.resultado !== 'ok').length;
  const ferramentasRecusadas = conversas.reduce((s, c) => s + c.recusadas, 0);

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Auditoria</p>
          <h1>Quem fez o quê</h1>
          <p className="muted">
            A trilha é append-only: não há caminho de edição nem de exclusão, e não existe nem para
            a administração.
          </p>
        </div>
        <div className="acoes">
          <button type="button" className="botao botao--fantasma" onClick={() => void carregar()}>
            Atualizar
          </button>
          <button type="button" className="botao" onClick={() => void exportar()}>
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
        {(['trilha', 'qr', 'cofre', 'assistente'] as const).map((a) => (
          <button
            key={a}
            type="button"
            className={aba === a ? 'botao' : 'botao botao--fantasma'}
            onClick={() => setAba(a)}
          >
            {a === 'trilha'
              ? `Trilha (${linhas.length})`
              : a === 'qr'
                ? `QR (${recusas} recusas)`
                : a === 'cofre'
                  ? `Cofre (${acessos.length})`
                  : `Assistente (${ferramentasRecusadas} recusas)`}
          </button>
        ))}
      </div>

      {aba === 'trilha' ? (
        <section className="secao">
          <div className="form form--linha">
            <label className="field">
              <span>Ação</span>
              <select value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)}>
                <option value="">Todas</option>
                {acoes.map((a) => (
                  <option key={a} value={a}>
                    {ROTULO_ACAO[a] ?? a}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Pessoa, entidade ou id</span>
              <input value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
            </label>
          </div>

          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Sobre</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{quando(l.quando)}</td>
                    <td>
                      {l.quem}
                      {l.papel ? <span className="muted"> · {l.papel}</span> : null}
                    </td>
                    <td>
                      {ROTULO_ACAO[l.acao] ?? <span className="mono pendente">{l.acao}</span>}
                    </td>
                    <td className="mono muted">
                      {l.entidade}
                      {l.alvo ? ` · ${l.alvo}` : ''}
                    </td>
                    <td className="mono muted">{JSON.stringify(l.metadados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtradas.length === 0 ? <p className="muted">Nada com esse filtro.</p> : null}
        </section>
      ) : null}

      {aba === 'qr' ? (
        <section className="secao">
          <p className="muted">
            A leitura recusada fica registrada junto com a aceita. Guardar só o sucesso apagaria o
            sinal: uma sequência de recusas é bilhete circulando.
          </p>
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem leu</th>
                  <th>Resultado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {leituras.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{quando(l.quando)}</td>
                    <td>{l.quem}</td>
                    <td>
                      <span
                        className={l.resultado === 'ok' ? 'selo selo--ok' : 'selo selo--revogado'}
                      >
                        {ROTULO_QR[l.resultado] ?? l.resultado}
                      </span>
                    </td>
                    <td className="muted">{l.nota ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {aba === 'cofre' ? (
        <section className="secao">
          <p className="muted">
            Quem abriu documento de quem, e por qual permissão. O `via` é a razão pela qual o acesso
            foi concedido, e é ele que responde numa apuração.
          </p>
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem abriu</th>
                  <th>Documento</th>
                  <th>Por quê</th>
                </tr>
              </thead>
              <tbody>
                {acessos.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{quando(a.quando)}</td>
                    <td>{a.quem}</td>
                    <td className="mono muted">{a.documento}</td>
                    <td>{a.via}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {acessos.length === 0 ? <p className="muted">Nenhum documento aberto ainda.</p> : null}
        </section>
      ) : null}

      {aba === 'assistente' ? (
        <section className="secao">
          <p className="muted">
            O assistente nasce desligado (D220). Enquanto estiver, esta lista fica vazia — e é o
            esperado. A coluna que importa quando ele ligar é a de ferramentas recusadas: uma
            sequência delas é alguém tentando alcançar dado alheio pelo assistente.
          </p>
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem perguntou</th>
                  <th>Provedor</th>
                  <th>Resultado</th>
                  <th>Tokens</th>
                  <th>Custo estimado</th>
                  <th>Serviu?</th>
                  <th>Recusas</th>
                </tr>
              </thead>
              <tbody>
                {conversas.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{quando(c.quando)}</td>
                    <td>{c.quem}</td>
                    <td className="muted">{c.provedor}</td>
                    <td>{c.resultado}</td>
                    <td className="mono">
                      {c.entrada ?? '—'} / {c.saida ?? '—'}
                    </td>
                    <td className="mono">
                      {c.centavos === null ? '—' : `${(c.centavos / 100).toFixed(2)}`}
                    </td>
                    <td>{c.util === null ? '—' : c.util ? 'Sim' : 'Não'}</td>
                    <td className={c.recusadas > 0 ? 'mono pendente' : 'mono'}>{c.recusadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {conversas.length === 0 ? (
            <p className="muted">Nenhuma conversa — o assistente está desligado.</p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
