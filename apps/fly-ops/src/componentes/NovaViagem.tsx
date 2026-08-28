import { useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Criacao de viagem (P42).
 *
 * A pagina Viagens sabia criar **dia** e **atividade** dentro de uma viagem
 * que ja existia — mas nao a viagem. Toda viagem deste projeto nasceu de SQL
 * escrito a mao, o que travava o dono de atender um cliente novo sozinho.
 *
 * A viagem nasce como **rascunho**: dia, roteiro e viajantes entram depois, e
 * so entao ela vira a viagem que o cliente ve no app.
 */

interface Destino {
  id: string;
  nome: string;
  pais: string;
}

export interface NovaViagemProps {
  aoCriar: (id: string) => void;
}

export function NovaViagem({ aoCriar }: NovaViagemProps) {
  const [aberto, setAberto] = useState(false);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [nome, setNome] = useState('');
  const [destino, setDestino] = useState('');
  const [comeca, setComeca] = useState('');
  const [termina, setTermina] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || destinos.length > 0) return;
    void (async () => {
      const { data, error } = await supabase()
        .from('destinations')
        .select('id, name, country')
        .order('name');
      if (error) return setErro(error.message);
      const lista = (data ?? []).map((d) => ({ id: d.id, nome: d.name, pais: d.country }));
      setDestinos(lista);
      if (lista.length > 0 && !destino) setDestino(lista[0]?.id ?? '');
    })();
  }, [aberto, destinos.length, destino]);

  function limpar() {
    setNome('');
    setComeca('');
    setTermina('');
    setErro(null);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) return setErro('A viagem precisa de um nome.');
    if (!destino) return setErro('Escolha o destino.');
    if (!comeca || !termina) return setErro('Informe as duas datas.');
    // O banco tem a mesma regra (`trips_ends_after_starts`); a tela explica
    // antes de o operador ver um erro de constraint.
    if (termina < comeca) return setErro('A volta não pode ser antes da ida.');

    setSalvando(true);
    const { data, error } = await supabase()
      .from('trips')
      .insert({
        name: nome.trim(),
        destination_id: destino,
        starts_on: comeca,
        ends_on: termina,
        status: 'draft',
      })
      .select('id')
      .single();
    setSalvando(false);

    if (error) return setErro(error.message);

    limpar();
    setAberto(false);
    if (data) aoCriar(data.id);
  }

  if (!aberto) {
    return (
      <div className="acoes">
        <button type="button" className="botao" onClick={() => setAberto(true)}>
          Criar viagem
        </button>
      </div>
    );
  }

  return (
    <section className="bloco">
      <div className="cabecalho">
        <div>
          <p className="kicker">Nova</p>
          <h2>Criar viagem</h2>
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
        Nasce como rascunho. Depois de criada, você adiciona os dias, o roteiro e os viajantes — e é
        aí que ela aparece no app de quem viaja.
      </p>

      <form onSubmit={(e) => void criar(e)} className="form">
        <div className="form--linha">
          <label className="field">
            <span className="muted">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Dubai · Família Mendes"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="muted">Destino</span>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome} · {d.pais}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form--linha">
          <label className="field">
            <span className="muted">Ida</span>
            <input
              type="date"
              value={comeca}
              onChange={(e) => setComeca(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="muted">Volta</span>
            <input
              type="date"
              value={termina}
              onChange={(e) => setTermina(e.target.value)}
              required
            />
          </label>
        </div>

        {erro ? (
          <p role="alert" className="erro">
            {erro}
          </p>
        ) : null}

        <div className="acoes">
          <button type="submit" className="botao" disabled={salvando}>
            {salvando ? 'Criando…' : 'Criar como rascunho'}
          </button>
        </div>
      </form>
    </section>
  );
}
