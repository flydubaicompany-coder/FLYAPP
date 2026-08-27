import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Mídia e fornecedor de um passeio (§40.13).
 *
 * Vive fora de `Catalogo.tsx` porque aquele arquivo já faz publicação, preço e
 * inventário. Três assuntos numa tela é o que ninguém revisa.
 *
 * **A imagem vai para um bucket público.** Foto de passeio é material de
 * vitrine; passaporte é o oposto e mora em bucket privado com URL assinada. A
 * diferença está registrada na migration, e é deliberada.
 *
 * **O fornecedor não aparece para o cliente.** Nome e telefone de quem opera
 * não são informação de quem compra, e a RLS já recusa a leitura — isto aqui é
 * só a tela de quem pode.
 */

interface Media {
  id: string;
  caminho: string;
  alt: string | null;
  ordem: number;
}

interface Fornecedor {
  id: string;
  nome: string;
  contato: string | null;
}

export function MidiaEFornecedor({
  passeioId,
  fornecedorAtual,
  aoMudarFornecedor,
}: {
  passeioId: string;
  fornecedorAtual: string | null;
  aoMudarFornecedor: () => void;
}) {
  const [midias, setMidias] = useState<Media[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState('');
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const db = supabase();
    const [m, f] = await Promise.all([
      db
        .from('tour_media')
        .select('id, storage_path, alt_text, sort_order')
        .eq('tour_id', passeioId)
        .order('sort_order'),
      db
        .from('tour_suppliers')
        .select('id, name, contact_name')
        .eq('is_active', true)
        .order('name'),
    ]);

    if (m.error) return setErro(m.error.message);
    setMidias(
      (m.data ?? []).map((x) => ({
        id: x.id,
        caminho: x.storage_path,
        alt: x.alt_text,
        ordem: x.sort_order,
      })),
    );
    setFornecedores(
      (f.data ?? []).map((x) => ({ id: x.id, nome: x.name, contato: x.contact_name })),
    );
  }, [passeioId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function urlPublica(caminho: string): string {
    return supabase().storage.from('passeios').getPublicUrl(caminho).data.publicUrl;
  }

  async function enviar(arquivo: File) {
    setOcupado(true);
    setErro(null);

    // O caminho começa pelo id do passeio: apagar um passeio deixa a pasta
    // dele identificável, e duas pessoas subindo "capa.jpg" não colidem.
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const caminho = `${passeioId}/${crypto.randomUUID()}.${extensao}`;

    const { error: erroUpload } = await supabase()
      .storage.from('passeios')
      .upload(caminho, arquivo, { contentType: arquivo.type });

    if (erroUpload) {
      setErro(erroUpload.message);
      setOcupado(false);
      return;
    }

    const { error } = await supabase()
      .from('tour_media')
      .insert({
        tour_id: passeioId,
        storage_path: caminho,
        sort_order: midias.length + 1,
      });

    // Registro falhou depois do upload: o arquivo ficaria órfão no bucket,
    // ocupando espaço e sem ninguém sabendo que existe.
    if (error) {
      await supabase().storage.from('passeios').remove([caminho]);
      setErro(error.message);
    }

    if (arquivoRef.current) arquivoRef.current.value = '';
    await carregar();
    setOcupado(false);
  }

  async function descrever(id: string, alt: string) {
    await supabase().from('tour_media').update({ alt_text: alt }).eq('id', id);
    await carregar();
  }

  async function remover(m: Media) {
    setOcupado(true);
    // Linha primeiro, arquivo depois. Na ordem inversa, uma falha deixaria a
    // linha apontando para um arquivo que não existe mais — e a vitrine
    // mostraria um buraco.
    const { error } = await supabase().from('tour_media').delete().eq('id', m.id);
    if (error) setErro(error.message);
    else await supabase().storage.from('passeios').remove([m.caminho]);
    await carregar();
    setOcupado(false);
  }

  async function ligarFornecedor(id: string) {
    setOcupado(true);
    const { error } = await supabase()
      .from('tours')
      .update({ supplier_id: id === '' ? null : id })
      .eq('id', passeioId);
    if (error) setErro(error.message);
    aoMudarFornecedor();
    setOcupado(false);
  }

  async function criarFornecedor() {
    const nome = novoFornecedor.trim();
    if (nome.length < 2) return;
    setOcupado(true);
    const { data, error } = await supabase()
      .from('tour_suppliers')
      .insert({ name: nome })
      .select('id')
      .single();
    if (error) setErro(error.message);
    else if (data) await ligarFornecedor(data.id);
    setNovoFornecedor('');
    await carregar();
    setOcupado(false);
  }

  return (
    <div className="bloco">
      <h3>Mídia</h3>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      {midias.length === 0 ? (
        <p className="muted">
          Sem imagem. O card do cliente mostra o passeio sem foto — funciona, mas vende menos.
        </p>
      ) : (
        <ul>
          {midias.map((m) => (
            <li key={m.id}>
              <img
                src={urlPublica(m.caminho)}
                alt={m.alt ?? ''}
                width={96}
                height={64}
                style={{ objectFit: 'cover', borderRadius: 6, verticalAlign: 'middle' }}
              />{' '}
              <label>
                Descrição para leitor de tela
                <input
                  type="text"
                  defaultValue={m.alt ?? ''}
                  placeholder="O que a foto mostra"
                  onBlur={(e) => void descrever(m.id, e.target.value)}
                />
              </label>{' '}
              <button type="button" onClick={() => void remover(m)} disabled={ocupado}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <label>
        Enviar imagem
        <input
          ref={arquivoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={ocupado}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviar(arquivo);
          }}
        />
      </label>
      <p className="muted">
        JPEG, PNG ou WebP, até 10 MB. A descrição não é opcional na prática: sem ela, quem usa
        leitor de tela ouve «imagem» e segue sem saber o que perdeu.
      </p>

      <h3>Fornecedor</h3>
      <p className="muted">
        Quem opera o passeio, e para quem ligar quando o ônibus não chega. O cliente não vê este
        dado. Comissão, prazo e contrato não moram aqui — isso é regra comercial, e regra comercial
        não se inventa em campo de formulário.
      </p>

      <label>
        Fornecedor deste passeio
        <select
          value={fornecedorAtual ?? ''}
          onChange={(e) => void ligarFornecedor(e.target.value)}
          disabled={ocupado}
        >
          <option value="">sem fornecedor definido</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
              {f.contato ? ` — ${f.contato}` : ''}
            </option>
          ))}
        </select>
      </label>

      <label>
        Cadastrar fornecedor novo
        <input
          type="text"
          value={novoFornecedor}
          placeholder="Nome da empresa"
          onChange={(e) => setNovoFornecedor(e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => void criarFornecedor()}
        disabled={ocupado || novoFornecedor.trim().length < 2}
      >
        Cadastrar e ligar a este passeio
      </button>
    </div>
  );
}
