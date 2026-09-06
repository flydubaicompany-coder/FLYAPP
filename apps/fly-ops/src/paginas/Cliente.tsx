import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../auth/client';

/**
 * Ficha do hóspede — lacuna 1 da auditoria de paridade, e a de maior risco.
 *
 * `customer_preferences`, `preference_items`, `emergency_contacts` e
 * `companionships` existem desde a Fase 2 e nenhum painel os lia. Quer dizer:
 * a alergia estava no banco e não chegava a quem serve a refeição; o contato
 * de emergência estava no banco e não chegava a quem atende o SOS.
 *
 * Duas decisões de exibição, e as duas são deliberadas:
 *
 *   • **Alergia e restrição alimentar aparecem sempre.** São dado sensível, e
 *     ainda assim ficam abertas: são exatamente o dado cuja demora causa dano.
 *     Esconder atrás de um clique é seguro para a Fly e ruim para quem come.
 *
 *   • **O resto do que é sensível fica atrás de um clique.** Condição de saúde
 *     não é operacional na maior parte do dia, e esta tela abre num saguão de
 *     hotel, num notebook que outras pessoas enxergam. A §23 pede o mínimo, e
 *     o mínimo aqui é não mostrar o que ninguém pediu para ver.
 *
 * Os rótulos vêm da chave, e não de um catálogo copiado do app: o catálogo
 * mora em `@fly/mobile` e copiá-lo criaria duas listas que divergem na semana
 * seguinte. O que decide o tratamento é `is_sensitive`, que vem na linha.
 */

/** As duas exceções operacionais. Vivem aqui, e o comentário acima é o porquê. */
const SEMPRE_VISIVEIS = ['saude.alergias', 'saude.restricoes'];

interface Preferencia {
  chave: string;
  valor: unknown;
  sensivel: boolean;
}

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  parentesco: string | null;
  principal: boolean;
}

interface Vinculo {
  id: string;
  outro: string;
  papel: string;
  tipo: string;
  escopos: string[];
  revogado: boolean;
}

interface Ficha {
  nome: string;
  publicId: string | null;
  idioma: string;
  passo: string | null;
  concluidoEm: string | null;
  papeis: string[];
  canal: string | null;
  rankingOptIn: boolean | null;
  imagemAutorizada: boolean | null;
  surpresaOptIn: boolean | null;
  preferencias: Preferencia[];
  contatos: Contato[];
  vinculos: Vinculo[];
  consentimentos: { finalidade: string; concedido: boolean; quando: string | null }[];
  viagens: { id: string; nome: string; status: string }[];
  pedidos: { id: string; referencia: string; situacao: string; quando: string }[];
  casos: { id: string; assunto: string | null; nivel: string; situacao: string }[];
  pontos: number | null;
}

function rotuloDaChave(chave: string): string {
  const partes = chave.split('.').map((t) => t.replace(/_/g, ' '));
  return partes.join(' · ');
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) return valor.map((v) => String(v)).join(', ');
  return JSON.stringify(valor);
}

export function Cliente() {
  const { id } = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarSensivel, setMostrarSensivel] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    const db = supabase();

    const [
      perfilRes,
      papeisRes,
      prefRes,
      itensRes,
      contatosRes,
      vinculosRes,
      consentRes,
      membroRes,
      pedidosRes,
      casosRes,
      pontosRes,
    ] = await Promise.all([
      db
        .from('profiles')
        .select(
          'id, public_id, preferred_name, display_name, locale, onboarding_step, onboarding_completed_at',
        )
        .eq('id', id)
        .maybeSingle(),
      db.from('user_roles').select('role').eq('user_id', id),
      db
        .from('customer_preferences')
        .select('communication_channel, ranking_opt_in, image_authorization, surprise_opt_in')
        .eq('user_id', id)
        .maybeSingle(),
      db.from('preference_items').select('key, value, is_sensitive').eq('user_id', id),
      db
        .from('emergency_contacts')
        .select('id, name, phone, relationship, is_primary')
        .eq('user_id', id)
        .order('is_primary', { ascending: false }),
      db
        .from('companionships')
        .select('id, responsible_id, dependent_id, kind, scopes, revoked_at')
        .or(`responsible_id.eq.${id},dependent_id.eq.${id}`),
      db.from('current_consents').select('purpose_key, granted, recorded_at').eq('user_id', id),
      db.from('trip_members').select('trip_id, trips(id, name, status)').eq('user_id', id),
      db
        .from('orders')
        .select('id, reference, status, placed_at')
        .eq('user_id', id)
        .order('placed_at', { ascending: false })
        .limit(10),
      db
        .from('support_cases')
        .select('id, subject, level, status')
        .eq('user_id', id)
        .order('opened_at', { ascending: false })
        .limit(10),
      db.from('points_balance').select('balance').eq('user_id', id).maybeSingle(),
    ]);

    if (perfilRes.error) return setErro(perfilRes.error.message);
    if (!perfilRes.data)
      return setErro('Não encontrei esse cliente — ou o seu papel não o alcança.');

    // O outro lado de cada vínculo precisa de nome.
    const outros = (vinculosRes.data ?? []).map((v) =>
      v.responsible_id === id ? v.dependent_id : v.responsible_id,
    );
    const { data: perfisOutros } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', outros.length > 0 ? outros : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfisOutros ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );

    const p = perfilRes.data;
    setFicha({
      nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
      publicId: p.public_id,
      idioma: p.locale,
      passo: p.onboarding_step,
      concluidoEm: p.onboarding_completed_at,
      papeis: (papeisRes.data ?? []).map((r) => r.role),
      canal: prefRes.data?.communication_channel ?? null,
      rankingOptIn: prefRes.data?.ranking_opt_in ?? null,
      imagemAutorizada: prefRes.data?.image_authorization ?? null,
      surpresaOptIn: prefRes.data?.surprise_opt_in ?? null,
      preferencias: (itensRes.data ?? []).map((i) => ({
        chave: i.key,
        valor: i.value,
        sensivel: i.is_sensitive,
      })),
      contatos: (contatosRes.data ?? []).map((c) => ({
        id: c.id,
        nome: c.name,
        telefone: c.phone,
        parentesco: c.relationship,
        principal: c.is_primary,
      })),
      vinculos: (vinculosRes.data ?? []).map((v) => ({
        id: v.id,
        outro:
          nomeDe.get(v.responsible_id === id ? v.dependent_id : v.responsible_id) ?? 'Sem nome',
        papel: v.responsible_id === id ? 'responsável por' : 'sob responsabilidade de',
        tipo: v.kind,
        escopos: v.scopes ?? [],
        revogado: v.revoked_at !== null,
      })),
      consentimentos: (consentRes.data ?? []).map((c) => ({
        finalidade: c.purpose_key ?? '—',
        concedido: c.granted ?? false,
        quando: c.recorded_at,
      })),
      viagens: (membroRes.data ?? []).flatMap((m) =>
        m.trips === null ? [] : [{ id: m.trips.id, nome: m.trips.name, status: m.trips.status }],
      ),
      pedidos: (pedidosRes.data ?? []).map((o) => ({
        id: o.id,
        referencia: o.reference,
        situacao: o.status,
        quando: o.placed_at,
      })),
      casos: (casosRes.data ?? []).map((c) => ({
        id: c.id,
        assunto: c.subject,
        nivel: c.level,
        situacao: c.status,
      })),
      pontos: pontosRes.data?.balance ?? null,
    });
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!ficha) return <p className="muted">Carregando…</p>;

  const operacionais = ficha.preferencias.filter(
    (p) => !p.sensivel || SEMPRE_VISIVEIS.includes(p.chave),
  );
  const reservadas = ficha.preferencias.filter(
    (p) => p.sensivel && !SEMPRE_VISIVEIS.includes(p.chave),
  );
  const alertas = ficha.preferencias.filter((p) => SEMPRE_VISIVEIS.includes(p.chave));

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">
            <Link to="/clientes">Clientes</Link>
          </p>
          <h1>{ficha.nome}</h1>
          <p className="muted">
            <span className="mono">{ficha.publicId ?? '—'}</span> · {ficha.idioma}
            {ficha.papeis.length > 0 ? ` · ${ficha.papeis.join(', ')}` : ''}
          </p>
        </div>
      </header>

      {alertas.length > 0 ? (
        <section className="destaque">
          <h2>Alergias e restrições</h2>
          {alertas.map((a) => (
            <p key={a.chave}>
              <strong>{rotuloDaChave(a.chave)}:</strong> {texto(a.valor)}
            </p>
          ))}
        </section>
      ) : (
        <p className="muted">
          Nenhuma alergia ou restrição registrada. Isso é diferente de &quot;não tem&quot;: pode ser
          que ninguém tenha perguntado.
        </p>
      )}

      <section className="secao">
        <h2>Contatos de emergência</h2>
        {ficha.contatos.length === 0 ? (
          <p className="pendente">
            Nenhum contato de emergência. Quem atender um SOS desta pessoa não terá para quem ligar.
          </p>
        ) : (
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Parentesco</th>
                </tr>
              </thead>
              <tbody>
                {ficha.contatos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.nome}
                      {c.principal ? <span className="selo selo--ok">Principal</span> : null}
                    </td>
                    <td>
                      <a className="mono" href={`tel:${c.telefone.replace(/[^\d+]/g, '')}`}>
                        {c.telefone}
                      </a>
                    </td>
                    <td className="muted">{c.parentesco ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>Preferências</h2>
        <div className="facts">
          <div>
            <strong>{ficha.canal ?? '—'}</strong>
            <span>canal preferido</span>
          </div>
          <div>
            <strong>{ficha.imagemAutorizada ? 'Sim' : 'Não'}</strong>
            <span>autoriza imagem</span>
          </div>
          <div>
            <strong>{ficha.rankingOptIn ? 'Sim' : 'Não'}</strong>
            <span>aparece no ranking</span>
          </div>
          <div>
            <strong>{ficha.surpresaOptIn ? 'Sim' : 'Não'}</strong>
            <span>aceita surpresa</span>
          </div>
        </div>

        <div className="tabela-envolvente">
          <table className="tabela">
            <tbody>
              {operacionais.map((p) => (
                <tr key={p.chave}>
                  <td>{rotuloDaChave(p.chave)}</td>
                  <td>{texto(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {operacionais.length === 0 ? <p className="muted">Nada preenchido ainda.</p> : null}

        {reservadas.length > 0 ? (
          <div className="bloco">
            <h3>Dado sensível</h3>
            {mostrarSensivel ? (
              <>
                {reservadas.map((p) => (
                  <p key={p.chave}>
                    <strong>{rotuloDaChave(p.chave)}:</strong> {texto(p.valor)}
                  </p>
                ))}
                <button
                  type="button"
                  className="botao botao--fantasma"
                  onClick={() => setMostrarSensivel(false)}
                >
                  Esconder
                </button>
              </>
            ) : (
              <>
                <p className="muted">
                  {reservadas.length} campo{reservadas.length === 1 ? '' : 's'} que a pessoa marcou
                  como sensível. Esta tela costuma abrir num lugar onde outras pessoas enxergam.
                </p>
                <button type="button" className="botao" onClick={() => setMostrarSensivel(true)}>
                  Mostrar
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="secao">
        <h2>Vínculos</h2>
        {ficha.vinculos.length === 0 ? (
          <p className="muted">Viaja sozinho, ou ninguém registrou o vínculo.</p>
        ) : (
          ficha.vinculos.map((v) => (
            <p key={v.id} className={v.revogado ? 'muted' : undefined}>
              {v.papel} <strong>{v.outro}</strong> ({v.tipo}) — vê: {v.escopos.join(', ')}
              {v.revogado ? ' · revogado' : ''}
            </p>
          ))
        )}
      </section>

      <section className="secao">
        <h2>Consentimentos</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Finalidade</th>
                <th>Situação</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {ficha.consentimentos.map((c) => (
                <tr key={c.finalidade}>
                  <td className="mono">{c.finalidade}</td>
                  <td>
                    <span className={c.concedido ? 'selo selo--ok' : 'selo selo--revogado'}>
                      {c.concedido ? 'Concedido' : 'Negado'}
                    </span>
                  </td>
                  <td className="mono muted">
                    {c.quando ? new Date(c.quando).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ficha.consentimentos.length === 0 ? (
          <p className="muted">Nenhum consentimento registrado.</p>
        ) : null}
      </section>

      <section className="secao">
        <h2>Histórico</h2>
        <div className="facts">
          <div>
            <strong>{ficha.viagens.length}</strong>
            <span>viagem{ficha.viagens.length === 1 ? '' : 'ns'}</span>
          </div>
          <div>
            <strong>{ficha.pedidos.length}</strong>
            <span>pedidos recentes</span>
          </div>
          <div>
            <strong>{ficha.casos.length}</strong>
            <span>casos</span>
          </div>
          <div>
            <strong>{ficha.pontos ?? '—'}</strong>
            <span>Fly Points</span>
          </div>
        </div>

        {ficha.viagens.map((t) => (
          <p key={t.id} className="muted">
            {t.nome} · {t.status}
          </p>
        ))}

        {ficha.casos.length > 0 ? (
          <div className="bloco">
            <h3>Casos</h3>
            {ficha.casos.map((c) => (
              <p key={c.id} className="muted">
                {c.nivel} · {c.situacao} — {c.assunto ?? 'sem assunto'}
              </p>
            ))}
          </div>
        ) : null}

        {ficha.pedidos.length > 0 ? (
          <div className="bloco">
            <h3>Pedidos</h3>
            {ficha.pedidos.map((o) => (
              <p key={o.id} className="muted">
                <span className="mono">{o.referencia}</span> · {o.situacao} ·{' '}
                {new Date(o.quando).toLocaleDateString('pt-BR')}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
