import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Galeria e autorização de imagem (§13.5 e §44, entregas 8, 9 e 10).
 *
 * Três atos, nesta ordem: **subir**, **marcar quem aparece** e **liberar**.
 * A ordem importa — liberar antes de marcar publica uma foto cuja autorização
 * ninguém conferiu, e é justamente isso que a coluna "por que não aparece"
 * desta tela existe para impedir.
 *
 * **Marcação é manual**, como a §13.5 pede no primeiro estágio. Não há
 * reconhecimento facial, e não é por falta de biblioteca: rosto é dado
 * biométrico, e a §33 não deixa inventar tratamento de dado sensível.
 *
 * A regra que o banco aplica, e que esta tela apenas **explica**: uma foto só
 * chega ao cliente se estiver liberada, se ele estiver na viagem, e se
 * ninguém marcado nela tiver revogado o uso da própria imagem — incluindo
 * quem nunca respondeu.
 */

interface Marcado {
  id: string;
  userId: string;
  nome: string;
  autoriza: boolean | null;
}

interface Midia {
  id: string;
  caminho: string;
  legenda: string | null;
  credito: string | null;
  tipo: 'photo' | 'video';
  liberada: boolean;
  liberadaEm: string | null;
  marcados: Marcado[];
  url: string | null;
}

interface Viagem {
  id: string;
  nome: string;
}

interface Viajante {
  id: string;
  nome: string;
  autoriza: boolean | null;
}

export function Galeria() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagemId, setViagemId] = useState('');
  const [midias, setMidias] = useState<Midia[] | null>(null);
  const [viajantes, setViajantes] = useState<Viajante[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [credito, setCredito] = useState('');
  const [aMarcar, setAMarcar] = useState<Record<string, string>>({});
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregarViagens = useCallback(async () => {
    const { data, error } = await supabase()
      .from('trips')
      .select('id, name')
      .order('starts_on', { ascending: false });
    if (error) return setErro(error.message);
    const lista = (data ?? []).map((t) => ({ id: t.id, nome: t.name }));
    setViagens(lista);
    setViagemId((atual) => atual || (lista[0]?.id ?? ''));
  }, []);

  const carregar = useCallback(async () => {
    if (!viagemId) return setMidias([]);
    const db = supabase();

    const { data: linhas, error } = await db
      .from('trip_media')
      .select('id, storage_path, caption, credit, kind, is_released, released_at')
      .eq('trip_id', viagemId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) return setErro(error.message);

    const ids = (linhas ?? []).map((m) => m.id);
    const { data: tags } = await db
      .from('media_tags')
      .select('id, media_id, user_id')
      .in('media_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

    const { data: membros } = await db
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', viagemId);
    const membroIds = (membros ?? []).map((m) => m.user_id);

    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', membroIds.length > 0 ? membroIds : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Viajante']),
    );

    // A autorização de imagem, por pessoa. É o que explica cada foto que não
    // chega ao cliente.
    const { data: consentimentos } = await db
      .from('current_consents')
      .select('user_id, purpose_key, granted')
      .eq('purpose_key', 'image_use')
      .in('user_id', membroIds.length > 0 ? membroIds : ['00000000-0000-0000-0000-000000000000']);
    const autorizaDe = new Map((consentimentos ?? []).map((c) => [c.user_id, c.granted]));

    setViajantes(
      membroIds.map((id) => ({
        id,
        nome: nomeDe.get(id) ?? 'Viajante',
        autoriza: autorizaDe.get(id) ?? null,
      })),
    );

    const caminhos = (linhas ?? []).map((m) => m.storage_path);
    const assinadas = new Map<string, string>();
    if (caminhos.length > 0) {
      const { data: urls } = await db.storage.from('galeria').createSignedUrls(caminhos, 60 * 30);
      for (const u of urls ?? []) {
        if (u.path && u.signedUrl) assinadas.set(u.path, u.signedUrl);
      }
    }

    setMidias(
      (linhas ?? []).map((m) => ({
        id: m.id,
        caminho: m.storage_path,
        legenda: m.caption,
        credito: m.credit,
        tipo: m.kind as 'photo' | 'video',
        liberada: m.is_released,
        liberadaEm: m.released_at,
        url: assinadas.get(m.storage_path) ?? null,
        marcados: (tags ?? [])
          .filter((t) => t.media_id === m.id)
          .map((t) => ({
            id: t.id,
            userId: t.user_id,
            nome: nomeDe.get(t.user_id) ?? 'Viajante',
            autoriza: autorizaDe.get(t.user_id) ?? null,
          })),
      })),
    );
  }, [viagemId]);

  useEffect(() => {
    void carregarViagens();
  }, [carregarViagens]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(arquivo: File) {
    if (!viagemId) return;
    setOcupado(true);
    setErro(null);

    // A pasta é o id da viagem: apagar a viagem deixa a pasta identificável,
    // e dois fotógrafos subindo "DSC0001.jpg" não colidem.
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const caminho = `${viagemId}/${crypto.randomUUID()}.${extensao}`;

    const { error: erroUpload } = await supabase()
      .storage.from('galeria')
      .upload(caminho, arquivo, { contentType: arquivo.type });

    if (erroUpload) {
      setErro(erroUpload.message);
      setOcupado(false);
      return;
    }

    const { error } = await supabase()
      .from('trip_media')
      .insert({
        trip_id: viagemId,
        storage_path: caminho,
        kind: arquivo.type.startsWith('video/') ? 'video' : 'photo',
        credit: credito.trim() || null,
      });

    // Registro falhou depois do upload: o arquivo ficaria órfão no bucket,
    // ocupando espaço e sem ninguém sabendo que existe.
    if (error) {
      await supabase().storage.from('galeria').remove([caminho]);
      setErro(error.message);
    } else {
      setRecado('Enviada. Ela só vai para o cliente depois de liberada.');
    }

    if (arquivoRef.current) arquivoRef.current.value = '';
    await carregar();
    setOcupado(false);
  }

  async function marcar(m: Midia) {
    const userId = aMarcar[m.id] ?? '';
    if (!userId) return setErro('Escolha quem aparece na foto.');
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('media_tags')
      .insert({ media_id: m.id, user_id: userId });
    if (error) setErro(error.message);
    else {
      setRecado('Marcado.');
      setAMarcar({ ...aMarcar, [m.id]: '' });
    }
    await carregar();
    setOcupado(false);
  }

  async function desmarcar(tagId: string) {
    setOcupado(true);
    const { error } = await supabase().from('media_tags').delete().eq('id', tagId);
    if (error) setErro(error.message);
    await carregar();
    setOcupado(false);
  }

  async function liberar(m: Midia, liberada: boolean) {
    setOcupado(true);
    setErro(null);
    // `released_at` e `released_by` são carimbados por gatilho — mandar aqui
    // seria a segunda fonte da mesma verdade.
    const { error } = await supabase()
      .from('trip_media')
      .update({ is_released: liberada })
      .eq('id', m.id);
    if (error) setErro(error.message);
    else setRecado(liberada ? 'Liberada.' : 'Tirada da galeria.');
    await carregar();
    setOcupado(false);
  }

  function porQueNaoAparece(m: Midia): string | null {
    if (!m.liberada) return 'Ainda não liberada.';
    const semAutorizacao = m.marcados.filter((x) => x.autoriza !== true);
    if (semAutorizacao.length === 0) return null;
    const nomes = semAutorizacao.map((x) => x.nome).join(', ');
    return semAutorizacao.some((x) => x.autoriza === false)
      ? `Não aparece: ${nomes} retirou a autorização de uso de imagem.`
      : `Não aparece: ${nomes} ainda não respondeu sobre uso de imagem.`;
  }

  if (erro && !midias)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!midias) return <p className="muted">Carregando…</p>;

  const liberadas = midias.filter((m) => m.liberada).length;
  const visiveis = midias.filter((m) => porQueNaoAparece(m) === null).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Encantamento</p>
          <h1>Galeria</h1>
        </div>
        <p className="muted">
          {midias.length} enviadas · {liberadas} liberadas · {visiveis} chegam ao cliente
        </p>
      </div>

      <p className="muted">
        Liberar não basta: uma foto só chega ao cliente se <strong>ninguém marcado nela</strong>{' '}
        tiver revogado o uso da própria imagem — e quem nunca respondeu conta como não autorizado.
        Quem aplica essa regra é o banco; esta tela só mostra por quê.
      </p>

      <div className="form form--linha">
        <label className="field">
          <span className="muted">Viagem</span>
          <select value={viagemId} onChange={(e) => setViagemId(e.target.value)}>
            {viagens.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="muted">Crédito do fotógrafo</span>
          <input
            value={credito}
            onChange={(e) => setCredito(e.target.value)}
            placeholder="Equipe Fly"
          />
        </label>
        <label className="field">
          <span className="muted">Enviar arquivo</span>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviar(f);
            }}
          />
        </label>
      </div>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      {viajantes.some((v) => v.autoriza !== true) ? (
        <p className="aviso">
          Sem autorização de imagem:{' '}
          {viajantes
            .filter((v) => v.autoriza !== true)
            .map((v) => `${v.nome}${v.autoriza === false ? ' (retirou)' : ' (sem resposta)'}`)
            .join(', ')}
          . Foto marcada com essas pessoas não chega ao cliente.
        </p>
      ) : null}

      {midias.length === 0 ? (
        <p className="muted">Nenhuma mídia nesta viagem ainda.</p>
      ) : (
        midias.map((m) => {
          const motivo = porQueNaoAparece(m);
          return (
            <section key={m.id} className="bloco">
              <div className="cabecalho">
                <div>
                  <p className="kicker">{m.tipo === 'video' ? 'Vídeo' : 'Foto'}</p>
                  <h3>{m.legenda ?? m.caminho.split('/').pop()}</h3>
                </div>
                <span
                  className={
                    motivo === null ? 'selo selo--ok' : m.liberada ? 'selo selo--pendente' : 'selo'
                  }
                >
                  {motivo === null ? 'No álbum do cliente' : m.liberada ? 'Bloqueada' : 'Rascunho'}
                </span>
              </div>

              {m.url && m.tipo === 'photo' ? (
                <img
                  src={m.url}
                  alt={m.legenda ?? 'Foto da viagem'}
                  style={{ maxWidth: 280, borderRadius: 12 }}
                />
              ) : null}

              {motivo ? <p className="aviso">{motivo}</p> : null}

              <dl className="facts">
                <div>
                  <dt>Crédito</dt>
                  <dd>{m.credito ?? '—'}</dd>
                </div>
                <div>
                  <dt>Liberada em</dt>
                  <dd className="mono">
                    {m.liberadaEm ? new Date(m.liberadaEm).toLocaleString('pt-BR') : '—'}
                  </dd>
                </div>
              </dl>

              {m.marcados.length > 0 ? (
                <ul className="checks">
                  {m.marcados.map((x) => (
                    <li key={x.id}>
                      <span>
                        {x.nome} ·{' '}
                        {x.autoriza === true
                          ? 'autoriza a imagem'
                          : x.autoriza === false
                            ? 'retirou a autorização'
                            : 'sem resposta'}
                      </span>
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado}
                        onClick={() => void desmarcar(x.id)}
                      >
                        Desmarcar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Ninguém marcado. A foto vale como imagem da viagem.</p>
              )}

              <div className="form form--linha">
                <label className="field">
                  <span className="muted">Quem aparece</span>
                  <select
                    value={aMarcar[m.id] ?? ''}
                    onChange={(e) => setAMarcar({ ...aMarcar, [m.id]: e.target.value })}
                  >
                    <option value="">— escolha —</option>
                    {viajantes
                      .filter((v) => !m.marcados.some((x) => x.userId === v.id))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="acoes">
                  <button
                    type="button"
                    className="botao botao--fantasma"
                    disabled={ocupado}
                    onClick={() => void marcar(m)}
                  >
                    Marcar
                  </button>
                </div>
              </div>

              <div className="acoes">
                <button
                  type="button"
                  className={m.liberada ? 'botao botao--fantasma' : 'botao'}
                  disabled={ocupado}
                  onClick={() => void liberar(m, !m.liberada)}
                >
                  {m.liberada ? 'Tirar da galeria' : 'Liberar'}
                </button>
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
