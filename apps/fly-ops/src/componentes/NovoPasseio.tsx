import { useEffect, useState } from 'react';
import { supabase } from '../auth/client';
import { slugValido, sugerirSlug } from '../dominio/slug';

/**
 * Cadastro de passeio (P42).
 *
 * Ate hoje o Catalogo listava, editava e publicava — mas **nao inseria**. Todo
 * passeio deste projeto entrou por SQL escrito a mao, o que deixava o dono
 * dependente de alguem com acesso ao banco para cada experiencia nova.
 *
 * O formulario pede so o que a tabela exige (titulo, slug, categoria). Preco,
 * horario, foto, politica e o texto longo continuam no bloco do passeio, que
 * ja existe: cadastrar e um ato, montar a venda e outro.
 *
 * **Nasce sempre como rascunho.** Publicar continua sendo um clique separado
 * e deliberado, com o aviso de que vai para a vitrine do cliente.
 */

interface Categoria {
  key: string;
  label: string;
}

export interface NovoPasseioProps {
  /** Recebe o id do passeio criado, para a pagina recarregar e abri-lo. */
  aoCriar: (id: string) => void;
}

export function NovoPasseio({ aoCriar }: NovoPasseioProps) {
  const [aberto, setAberto] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [titulo, setTitulo] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [cidade, setCidade] = useState('');
  const [resumo, setResumo] = useState('');
  const [duracao, setDuracao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || categorias.length > 0) return;
    void (async () => {
      const { data, error } = await supabase()
        .from('tour_categories')
        .select('key, label')
        .order('sort_order');
      if (error) return setErro(error.message);
      const lista = data ?? [];
      setCategorias(lista);
      if (lista.length > 0 && !categoria) setCategoria(lista[0]?.key ?? '');
    })();
  }, [aberto, categorias.length, categoria]);

  /* O slug acompanha o titulo ate alguem mexer nele. Depois disso ele para de
     se mexer sozinho — endereco publico nao muda nas costas de quem digitou. */
  function mudarTitulo(valor: string) {
    setTitulo(valor);
    if (!slugEditado) setSlug(sugerirSlug(valor));
  }

  function limpar() {
    setTitulo('');
    setSlug('');
    setSlugEditado(false);
    setCidade('');
    setResumo('');
    setDuracao('');
    setErro(null);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!titulo.trim()) return setErro('O passeio precisa de um título.');
    if (!slugValido(slug))
      return setErro(
        'O endereço precisa começar com letra e usar só minúsculas, números e hífen — por exemplo «ceia-no-deserto».',
      );
    if (!categoria) return setErro('Escolha uma categoria.');

    const minutos = duracao.trim() ? Number(duracao) : null;
    if (minutos !== null && (!Number.isInteger(minutos) || minutos <= 0))
      return setErro('A duração é em minutos inteiros, maior que zero.');

    setSalvando(true);
    const { data, error } = await supabase()
      .from('tours')
      .insert({
        title: titulo.trim(),
        slug,
        category_key: categoria,
        city: cidade.trim() || null,
        summary: resumo.trim() || null,
        duration_minutes: minutos,
        // Rascunho sempre. Publicar é outro ato, e a tabela já recusa publicar
        // sem política de cancelamento.
        status: 'draft',
      })
      .select('id')
      .single();
    setSalvando(false);

    if (error) {
      setErro(
        error.code === '23505'
          ? `Já existe um passeio com o endereço «${slug}». Troque o endereço.`
          : error.message,
      );
      return;
    }

    limpar();
    setAberto(false);
    if (data) aoCriar(data.id);
  }

  if (!aberto) {
    return (
      <div className="acoes">
        <button type="button" className="botao" onClick={() => setAberto(true)}>
          Cadastrar passeio
        </button>
      </div>
    );
  }

  return (
    <section className="bloco">
      <div className="cabecalho">
        <div>
          <p className="kicker">Novo</p>
          <h2>Cadastrar passeio</h2>
        </div>
        <button
          type="button"
          className="botao botao--fantasma"
          onClick={() => {
            limpar();
            setAberto(false);
          }}
        >
          Cancelar
        </button>
      </div>

      <p className="muted">
        Nasce como rascunho. Preço, horários, fotos e política ficam no bloco do passeio, depois de
        criado — e só então ele pode ir para a vitrine.
      </p>

      <form onSubmit={(e) => void criar(e)} className="form">
        <div className="form--linha">
          <label className="field">
            <span className="muted">Título</span>
            <input
              value={titulo}
              onChange={(e) => mudarTitulo(e.target.value)}
              placeholder="Ceia no Deserto"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="muted">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form--linha">
          <label className="field">
            <span className="muted">Endereço na vitrine</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlugEditado(true);
                setSlug(e.target.value);
              }}
              placeholder="ceia-no-deserto"
              className="mono"
              required
            />
          </label>

          <label className="field">
            <span className="muted">Cidade</span>
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Dubai" />
          </label>

          <label className="field">
            <span className="muted">Duração (minutos)</span>
            <input
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              inputMode="numeric"
              placeholder="240"
            />
          </label>
        </div>

        <label className="field">
          <span className="muted">Resumo</span>
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            rows={2}
            placeholder="Uma linha que o cliente lê no card da vitrine."
          />
        </label>

        {erro ? (
          <p role="alert" className="erro">
            {erro}
          </p>
        ) : null}

        <div className="acoes">
          <button type="submit" className="botao" disabled={salvando}>
            {salvando ? 'Cadastrando…' : 'Cadastrar como rascunho'}
          </button>
        </div>
      </form>
    </section>
  );
}
