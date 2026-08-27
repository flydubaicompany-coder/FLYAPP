import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Passaportes (§7.5 e §9).
 *
 * A Fly precisa destes dados para emitir passagem — é o serviço que o cliente
 * contratou. Não há consentimento a pedir: é execução de contrato.
 *
 * O que a tela **não** faz, e é deliberado:
 *
 * - **Não edita.** Quem digita é o dono do documento, que o tem na mão. Se a
 *   operação pudesse corrigir, o erro de digitação viraria responsabilidade
 *   de quem nunca viu o passaporte.
 * - **Não mostra o número na listagem.** Aparece ao abrir, e abrir deixa
 *   registro. Uma lista com trinta números na tela é trinta números num
 *   print de reunião.
 *
 * Conferir é a única escrita, e toca duas colunas.
 */

interface Item {
  id: string;
  userId: string;
  cliente: string;
  pais: string;
  validade: string;
  conferidoEm: string | null;
}

interface Aberto {
  id: string;
  nomeCompleto: string;
  numero: string;
  pais: string;
  nacionalidade: string | null;
  nascimento: string | null;
  emissao: string | null;
  validade: string;
  conferidoEm: string | null;
}

function diasAte(iso: string): number {
  return Math.floor((new Date(`${iso}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

export function Passaportes() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const db = supabase();

    const { data, error } = await db
      .from('passports')
      .select('id, user_id, issuing_country, expires_on, verified_at')
      .order('expires_on');

    if (error) return setErro(error.message);

    const ids = [...new Set((data ?? []).map((p) => p.user_id))];
    const { data: perfis } = await db
      .from('profiles')
      .select('id, display_name, preferred_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

    const nome = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? '—']),
    );

    setItens(
      (data ?? []).map((p) => ({
        id: p.id,
        userId: p.user_id,
        cliente: nome.get(p.user_id) ?? '—',
        pais: p.issuing_country,
        validade: p.expires_on,
        conferidoEm: p.verified_at,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Abrir registra na auditoria.
   *
   * A negativa vem em `permitido`, e não como erro: a função precisa gravar a
   * tentativa antes de recusar, e `raise` desfaria essa gravação junto com o
   * resto da transação.
   */
  async function abrir(id: string) {
    setOcupado(id);
    setErro(null);

    const { data, error } = await supabase().rpc('ver_passaporte', { p_id: id });
    setOcupado(null);

    const linha = Array.isArray(data) ? data[0] : data;
    if (error || !linha) return setErro('Não consegui abrir este passaporte.');
    if (!linha.permitido) return setErro('Você não tem acesso a este passaporte.');

    setAberto({
      id: linha.id as string,
      nomeCompleto: linha.full_name as string,
      numero: linha.number as string,
      pais: linha.issuing_country as string,
      nacionalidade: linha.nationality,
      nascimento: linha.birth_date,
      emissao: linha.issued_on,
      validade: linha.expires_on as string,
      conferidoEm: linha.verified_at,
    });
  }

  async function conferir(id: string, confere: boolean) {
    setOcupado(id);
    const { error } = await supabase().rpc('conferir_passaporte', {
      p_id: id,
      p_confere: confere,
    });
    if (error) setErro(error.message);
    setOcupado(null);
    await carregar();
    if (aberto?.id === id) await abrir(id);
  }

  if (erro && !itens)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!itens) return <p className="muted">Carregando…</p>;

  const pendentes = itens.filter((i) => !i.conferidoEm).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Passaportes</h1>
        </div>
        <p className="muted">
          {itens.length} cadastrados · {pendentes} aguardando conferência
        </p>
      </div>

      <p className="muted">
        Os dados são digitados pelo cliente. Confira contra o documento antes de emitir qualquer
        passagem — um caractere diferente é embarque negado no balcão. Abrir um passaporte fica
        registrado na auditoria.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      <div className="tabela-envolvente">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>País</th>
              <th>Validade</th>
              <th>Situação</th>
              <th>Dados</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const dias = diasAte(i.validade);
              return (
                <tr key={i.id}>
                  <td>
                    <strong>{i.cliente}</strong>
                  </td>
                  <td className="mono">{i.pais}</td>
                  <td className="mono">
                    {i.validade}
                    {dias < 180 ? (
                      <>
                        {' '}
                        <span className="pendente">{dias < 0 ? 'vencido' : `${dias} dias`}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <span className={i.conferidoEm ? 'muted' : 'pendente'}>
                      {i.conferidoEm ? 'Conferido' : 'Aguardando'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="botao botao--fantasma"
                      disabled={ocupado === i.id}
                      aria-label={`Abrir passaporte de ${i.cliente}`}
                      onClick={() => void abrir(i.id)}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {itens.length === 0 ? <p className="muted">Nenhum passaporte cadastrado ainda.</p> : null}

      {aberto ? (
        <section className="secao">
          <div className="cabecalho">
            <div>
              <p className="kicker">Passaporte</p>
              <h2>{aberto.nomeCompleto}</h2>
            </div>
            <button type="button" className="botao botao--fantasma" onClick={() => setAberto(null)}>
              Fechar
            </button>
          </div>

          <div className="bloco">
            <div className="tabela-envolvente">
              <table className="tabela">
                <tbody>
                  <tr>
                    <th>Nome no documento</th>
                    <td className="mono">{aberto.nomeCompleto}</td>
                  </tr>
                  <tr>
                    <th>Número</th>
                    <td className="mono">{aberto.numero}</td>
                  </tr>
                  <tr>
                    <th>País emissor</th>
                    <td className="mono">{aberto.pais}</td>
                  </tr>
                  <tr>
                    <th>Nacionalidade</th>
                    <td className="mono">{aberto.nacionalidade ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Nascimento</th>
                    <td className="mono">{aberto.nascimento ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Emissão</th>
                    <td className="mono">{aberto.emissao ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Validade</th>
                    <td className="mono">{aberto.validade}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="acoes">
              {aberto.conferidoEm ? (
                <>
                  <span className="muted">
                    Conferido em {new Date(aberto.conferidoEm).toLocaleString('pt-BR')}
                  </span>
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado === aberto.id}
                    onClick={() => void conferir(aberto.id, false)}
                  >
                    Desfazer conferência
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="botao"
                  disabled={ocupado === aberto.id}
                  onClick={() => void conferir(aberto.id, true)}
                >
                  Confere com o documento
                </button>
              )}
            </div>

            <p className="muted">
              Para corrigir um dado, peça ao cliente. A operação não edita passaporte: quem digita é
              quem tem o documento na mão.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}
