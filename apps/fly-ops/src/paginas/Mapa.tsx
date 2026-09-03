import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Os pontos do mapa (§12.1 e §43, entrega 1).
 *
 * Esta tela existe porque **endereço de hospital, de farmácia e de parceiro
 * não pode ficar no código**. A §33 não deixa inventar dado médico nem
 * parceiro, e o CLAUDE.md exige que conteúdo crítico seja operável sem
 * release. A tabela nasce vazia: o que estiver no mapa do cliente foi alguém
 * daqui que escreveu.
 *
 * **Publicar exige coordenada**, por constraint no banco. Um pino de clínica
 * que não leva a lugar nenhum é pior do que nenhum pino — e a hora de
 * descobrir isso não é a hora em que alguém precisa de uma clínica.
 */

type Tipo = 'attraction' | 'partner' | 'clinic' | 'hospital' | 'pharmacy';

const NOME_TIPO: Record<Tipo, string> = {
  attraction: 'Atração',
  partner: 'Parceiro',
  clinic: 'Clínica',
  hospital: 'Hospital',
  pharmacy: 'Farmácia',
};

const TIPOS: Tipo[] = ['clinic', 'hospital', 'pharmacy', 'attraction', 'partner'];

interface Lugar {
  id: string;
  tipo: Tipo;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  horario: string | null;
  observacao: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  destinoId: string | null;
}

interface Destino {
  id: string;
  nome: string;
}

const VAZIO = {
  tipo: 'attraction' as Tipo,
  nome: '',
  endereco: '',
  telefone: '',
  horario: '',
  observacao: '',
  latitude: '',
  longitude: '',
  destinoId: '',
};

export function Mapa() {
  const [lugares, setLugares] = useState<Lugar[] | null>(null);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(VAZIO);

  const carregar = useCallback(async () => {
    const db = supabase();

    const [lugaresRes, destinosRes] = await Promise.all([
      db
        .from('map_places')
        .select(
          'id, kind, name, address, phone, hours_note, notes, latitude, longitude, is_active, destination_id',
        )
        .order('kind')
        .order('sort_order'),
      db.from('destinations').select('id, name').order('name'),
    ]);

    if (lugaresRes.error) return setErro(lugaresRes.error.message);

    setDestinos((destinosRes.data ?? []).map((d) => ({ id: d.id, nome: d.name })));
    setLugares(
      (lugaresRes.data ?? []).map((l) => ({
        id: l.id,
        tipo: l.kind as Tipo,
        nome: l.name,
        endereco: l.address,
        telefone: l.phone,
        horario: l.hours_note,
        observacao: l.notes,
        latitude: l.latitude,
        longitude: l.longitude,
        ativo: l.is_active,
        destinoId: l.destination_id,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Aceita "25,2048" e "25.2048". Vírgula é como se digita em teclado pt-BR. */
  function coordenada(texto: string): number | null {
    const limpo = texto.trim().replace(',', '.');
    if (limpo === '') return null;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  }

  async function criar() {
    if (!novo.nome.trim()) return setErro('O lugar precisa de um nome — é o que o cliente lê.');

    const lat = coordenada(novo.latitude);
    const lng = coordenada(novo.longitude);
    if ((lat === null) !== (lng === null)) {
      return setErro('Meia coordenada não é lugar nenhum. Preencha as duas, ou nenhuma.');
    }

    setOcupado(true);
    setErro(null);
    setRecado(null);

    const { error } = await supabase()
      .from('map_places')
      .insert({
        kind: novo.tipo,
        name: novo.nome.trim(),
        address: novo.endereco.trim() || null,
        phone: novo.telefone.trim() || null,
        hours_note: novo.horario.trim() || null,
        notes: novo.observacao.trim() || null,
        latitude: lat,
        longitude: lng,
        destination_id: novo.destinoId || null,
      });

    if (error) setErro(error.message);
    else {
      setRecado('Cadastrado. Ele só aparece para o cliente quando você publicar.');
      setNovo(VAZIO);
    }
    await carregar();
    setOcupado(false);
  }

  async function publicar(l: Lugar, ativo: boolean) {
    if (ativo && (l.latitude === null || l.longitude === null)) {
      return setErro(
        `«${l.nome}» não tem coordenada. Sem ela o cliente vê um pino que não leva a lugar nenhum — o banco recusa, e com razão.`,
      );
    }
    setOcupado(true);
    setErro(null);
    const { error } = await supabase()
      .from('map_places')
      .update({ is_active: ativo })
      .eq('id', l.id);
    if (error) setErro(error.message);
    else setRecado(ativo ? 'Publicado.' : 'Tirado do mapa.');
    await carregar();
    setOcupado(false);
  }

  async function remover(l: Lugar) {
    if (!confirm(`Apagar «${l.nome}» do mapa? Isso não volta.`)) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabase().from('map_places').delete().eq('id', l.id);
    if (error) setErro(error.message);
    else setRecado('Apagado.');
    await carregar();
    setOcupado(false);
  }

  if (erro && !lugares)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!lugares) return <p className="muted">Carregando…</p>;

  const publicados = lugares.filter((l) => l.ativo).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Mapa</h1>
        </div>
        <p className="muted">
          {publicados} no mapa · {lugares.length - publicados} em rascunho
        </p>
      </div>

      <p className="muted">
        O app não tem mapa embutido: cada ponto abre a rota no app de mapas do celular do cliente.
        Endereço de serviço de saúde não é inventado pelo sistema — o que estiver aqui foi alguém
        desta equipe que escreveu.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="destaque">{recado}</p> : null}

      <section className="bloco">
        <h3>Novo ponto</h3>
        <div className="form">
          <label className="field">
            <span className="muted">Tipo</span>
            <select
              value={novo.tipo}
              onChange={(e) => setNovo({ ...novo, tipo: e.target.value as Tipo })}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {NOME_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">Nome</span>
            <input
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              placeholder="Hospital…"
            />
          </label>
          <label className="field">
            <span className="muted">Endereço</span>
            <input
              value={novo.endereco}
              onChange={(e) => setNovo({ ...novo, endereco: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="muted">Latitude</span>
            <input
              value={novo.latitude}
              onChange={(e) => setNovo({ ...novo, latitude: e.target.value })}
              placeholder="25.2048"
            />
          </label>
          <label className="field">
            <span className="muted">Longitude</span>
            <input
              value={novo.longitude}
              onChange={(e) => setNovo({ ...novo, longitude: e.target.value })}
              placeholder="55.2708"
            />
          </label>
          <label className="field">
            <span className="muted">Telefone</span>
            <input
              value={novo.telefone}
              onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="muted">Horário (texto livre)</span>
            <input
              value={novo.horario}
              onChange={(e) => setNovo({ ...novo, horario: e.target.value })}
              placeholder="24h"
            />
          </label>
          <label className="field">
            <span className="muted">Observação</span>
            <input
              value={novo.observacao}
              onChange={(e) => setNovo({ ...novo, observacao: e.target.value })}
              placeholder="Atende em inglês"
            />
          </label>
          <label className="field">
            <span className="muted">Destino</span>
            <select
              value={novo.destinoId}
              onChange={(e) => setNovo({ ...novo, destinoId: e.target.value })}
            >
              <option value="">— qualquer —</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="acoes">
          <button type="button" className="botao" disabled={ocupado} onClick={() => void criar()}>
            Cadastrar
          </button>
        </div>
      </section>

      {lugares.length === 0 ? (
        <p className="muted">
          Nenhum ponto cadastrado. Enquanto isso, o mapa do cliente mostra só as Bases Fly.
        </p>
      ) : (
        lugares.map((l) => (
          <section key={l.id} className="bloco">
            <div className="cabecalho">
              <div>
                <p className="kicker">{NOME_TIPO[l.tipo]}</p>
                <h3>{l.nome}</h3>
              </div>
              <span className={l.ativo ? 'selo selo--ok' : 'selo selo--pendente'}>
                {l.ativo ? 'No mapa' : 'Rascunho'}
              </span>
            </div>

            <dl className="facts">
              <div>
                <dt>Endereço</dt>
                <dd>{l.endereco ?? '—'}</dd>
              </div>
              <div>
                <dt>Coordenada</dt>
                <dd className="mono">
                  {l.latitude === null || l.longitude === null
                    ? 'sem coordenada'
                    : `${l.latitude}, ${l.longitude}`}
                </dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>{l.horario ?? '—'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd className="mono">{l.telefone ?? '—'}</dd>
              </div>
            </dl>

            {l.observacao ? <p className="muted">{l.observacao}</p> : null}

            <div className="acoes">
              <button
                type="button"
                className={l.ativo ? 'botao botao--fantasma' : 'botao'}
                disabled={ocupado}
                onClick={() => void publicar(l, !l.ativo)}
              >
                {l.ativo ? 'Tirar do mapa' : 'Publicar'}
              </button>
              <button
                type="button"
                className="botao botao--fantasma"
                disabled={ocupado}
                onClick={() => void remover(l)}
              >
                Apagar
              </button>
            </div>
          </section>
        ))
      )}
    </>
  );
}
