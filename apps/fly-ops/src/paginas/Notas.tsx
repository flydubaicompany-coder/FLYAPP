import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Fila de notas fiscais (§41, entrega 11).
 *
 * **Sem OCR**, por decisão do dono: o cliente fotografa e digita, e a
 * conferência é humana. Esta tela existe para que essa conferência seja
 * rápida — foto e campos declarados lado a lado, e duas decisões.
 *
 * A foto abre por **URL assinada de curta duração**, nunca por link público:
 * o bucket é privado e continua sendo.
 *
 * **Recusar exige motivo** — o banco obriga, e a tela explica antes: o cliente
 * precisa saber o que corrigir, senão manda a mesma nota de novo.
 */

type Situacao = 'received' | 'in_review' | 'approved' | 'rejected' | 'duplicate';

interface Nota {
  id: string;
  cliente: string;
  flyId: string;
  caminho: string;
  estabelecimento: string | null;
  centavos: number | null;
  moeda: string | null;
  emitidaEm: string | null;
  situacao: Situacao;
  observacao: string | null;
  duplicataDe: string | null;
  enviadaEm: string;
}

const ROTULO: Record<Situacao, string> = {
  received: 'Na fila',
  in_review: 'Em conferência',
  approved: 'Aprovada',
  rejected: 'Não aceita',
  duplicate: 'Repetida',
};

function dinheiro(centavos: number | null, moeda: string | null): string {
  if (centavos === null || !moeda) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(
      centavos / 100,
    );
  } catch {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

export function Notas() {
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [foto, setFoto] = useState<{ id: string; url: string } | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [soFila, setSoFila] = useState(true);

  const carregar = useCallback(async () => {
    const db = supabase();

    const { data, error } = await db
      .from('receipts')
      .select(
        'id, user_id, storage_path, merchant, amount_cents, currency, issued_on, status, review_note, duplicate_of, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return setErro(error.message);

    const ids = [...new Set((data ?? []).map((n) => n.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, public_id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

    const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

    setNotas(
      (data ?? []).map((n) => {
        const p = porId.get(n.user_id);
        return {
          id: n.id,
          cliente: p?.preferred_name ?? p?.display_name ?? 'Cliente',
          flyId: p?.public_id ?? '—',
          caminho: n.storage_path,
          estabelecimento: n.merchant,
          centavos: n.amount_cents === null ? null : Number(n.amount_cents),
          moeda: n.currency,
          emitidaEm: n.issued_on,
          situacao: n.status as Situacao,
          observacao: n.review_note,
          duplicataDe: n.duplicate_of,
          enviadaEm: n.created_at,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function verFoto(n: Nota) {
    setErro(null);
    // 60 segundos: tempo de olhar, e não de compartilhar por aí.
    const { data, error } = await supabase().storage.from('notas').createSignedUrl(n.caminho, 60);
    if (error) return setErro(error.message);
    if (data) setFoto({ id: n.id, url: data.signedUrl });
  }

  async function decidir(n: Nota, situacao: Situacao) {
    const nota = (motivo[n.id] ?? '').trim();
    if (situacao === 'rejected' && !nota) {
      return setErro('Recusar exige motivo — o cliente precisa saber o que corrigir.');
    }

    setOcupado(true);
    setErro(null);
    setRecado(null);

    const { data: sessao } = await supabase().auth.getUser();
    const { error } = await supabase()
      .from('receipts')
      .update({
        status: situacao,
        review_note: nota || null,
        reviewed_by: sessao.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', n.id);

    if (error) setErro(error.message);
    else setRecado(`Nota de ${n.cliente}: ${ROTULO[situacao].toLowerCase()}.`);

    await carregar();
    setOcupado(false);
  }

  if (erro && !notas)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!notas) return <p className="muted">Carregando…</p>;

  const fila = notas.filter((n) => n.situacao === 'received' || n.situacao === 'in_review');
  const visiveis = soFila ? fila : notas;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Financeiro</p>
          <h1>Notas fiscais</h1>
        </div>
        <p className="muted">{fila.length} na fila</p>
      </div>

      <p className="muted">
        Sem OCR: o cliente fotografa e digita, e a conferência é sua. Os campos abaixo são{' '}
        <strong>o que a pessoa declarou</strong> — confira contra a foto antes de aprovar.
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
          className={soFila ? 'botao' : 'botao botao--fantasma'}
          aria-pressed={soFila}
          onClick={() => setSoFila(!soFila)}
        >
          {soFila ? 'Mostrando só a fila' : 'Mostrando todas'}
        </button>
      </div>

      {visiveis.length === 0 ? (
        <p className="muted">Nada para conferir.</p>
      ) : (
        visiveis.map((n) => (
          <section key={n.id} className="bloco">
            <div className="cabecalho">
              <div>
                <p className="kicker">
                  {n.cliente} · <span className="mono">{n.flyId}</span>
                </p>
                <h3>{n.estabelecimento ?? 'Sem estabelecimento'}</h3>
              </div>
              <span
                className={
                  n.situacao === 'approved'
                    ? 'selo selo--ok'
                    : n.situacao === 'rejected'
                      ? 'selo selo--revogado'
                      : n.situacao === 'duplicate'
                        ? 'selo'
                        : 'selo selo--pendente'
                }
              >
                {ROTULO[n.situacao]}
              </span>
            </div>

            <dl className="facts">
              <div>
                <dt>Valor declarado</dt>
                <dd className="mono">{dinheiro(n.centavos, n.moeda)}</dd>
              </div>
              <div>
                <dt>Data da nota</dt>
                <dd className="mono">{n.emitidaEm ?? '—'}</dd>
              </div>
              <div>
                <dt>Enviada em</dt>
                <dd className="mono">{new Date(n.enviadaEm).toLocaleDateString('pt-BR')}</dd>
              </div>
            </dl>

            {n.situacao === 'duplicate' ? (
              <p className="aviso">
                O sistema marcou como repetida: mesmo estabelecimento, valor e data de uma nota que
                este cliente já enviou. Confira as duas — pode ser engano do sistema.
              </p>
            ) : null}

            {n.observacao ? <p className="muted">Observação: {n.observacao}</p> : null}

            <div className="acoes">
              <button
                type="button"
                className="botao botao--fantasma"
                onClick={() => void verFoto(n)}
              >
                Ver a foto
              </button>
            </div>

            {foto?.id === n.id ? (
              <div className="bloco">
                <img
                  src={foto.url}
                  alt={`Nota de ${n.cliente}`}
                  style={{ maxWidth: '100%', borderRadius: '1rem', display: 'block' }}
                />
                <p className="muted">
                  Link temporário, vale 60 segundos. O arquivo continua privado.
                </p>
              </div>
            ) : null}

            {n.situacao !== 'approved' && n.situacao !== 'rejected' ? (
              <>
                <div className="form form--linha">
                  <label className="field">
                    <span className="muted">Observação (obrigatória para recusar)</span>
                    <input
                      value={motivo[n.id] ?? ''}
                      onChange={(e) => setMotivo({ ...motivo, [n.id]: e.target.value })}
                      placeholder="Foto ilegível — reenvie com a nota inteira no quadro"
                    />
                  </label>
                </div>

                <div className="acoes">
                  <button
                    type="button"
                    className="botao"
                    disabled={ocupado}
                    onClick={() => void decidir(n, 'approved')}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void decidir(n, 'rejected')}
                  >
                    Não aceitar
                  </button>
                  {n.situacao === 'received' ? (
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado}
                      onClick={() => void decidir(n, 'in_review')}
                    >
                      Marcar em conferência
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        ))
      )}
    </>
  );
}
