import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';

/**
 * Logística da viagem — lacunas 6, 7 e 8 da auditoria de paridade.
 *
 * Voo, hospedagem, transfer, o que está incluso e o cofre aparecem na Minha
 * Viagem do cliente desde a Fase 4, e nenhum deles tinha tela de operação:
 * mudar um portão de embarque era `update` no banco.
 *
 * A tela é por viagem, e não por tipo, porque é assim que a operação pensa —
 * "a viagem de setembro" é a unidade, e não "os voos".
 *
 * O cofre é **depósito sem leitura**. A equipe sobe o voucher para a pasta do
 * cliente e não consegue abrir o que já está lá: ler documento alheio exige
 * `document_grants`, e cada leitura vira linha em `document_access_log`. É a
 * caixa de correio do prédio — o carteiro põe dentro, e não tem a chave.
 */

type Aba = 'voos' | 'hospedagem' | 'transfers' | 'incluso' | 'cofre';

interface Viagem {
  id: string;
  nome: string;
}

interface Voo {
  id: string;
  companhia: string;
  numero: string;
  origem: string;
  destino: string;
  parte: string;
  chega: string;
  terminal: string | null;
  portao: string | null;
  situacao: string | null;
}

interface Hospedagem {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  entrada: string | null;
  saida: string | null;
  hospedes: number;
}

interface Transfer {
  id: string;
  titulo: string;
  origem: string;
  quando: string;
  destino: string | null;
  situacao: string;
  motorista: string | null;
  veiculo: string | null;
  placa: string | null;
  passageiros: number;
}

interface Inclusao {
  id: string;
  categoria: string;
  titulo: string;
  detalhes: string | null;
  situacao: string;
  opcional: boolean;
}

interface Documento {
  id: string;
  dono: string;
  tipo: string;
  titulo: string;
  conferidoEm: string | null;
}

const CATEGORIAS = [
  'air',
  'lodging',
  'food',
  'transport',
  'tours',
  'insurance',
  'benefits',
  'press_kit',
  'special',
] as const;

const SITUACOES_TRANSFER = [
  'scheduled',
  'driver_assigned',
  'en_route',
  'arrived',
  'boarded',
  'completed',
  'cancelled',
] as const;

const TIPOS_DOCUMENTO = [
  'ticket',
  'hotel_reservation',
  'insurance',
  'voucher',
  'authorization',
  'other',
] as const;

function quando(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—';
}

export function Logistica() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagem, setViagem] = useState('');
  const [aba, setAba] = useState<Aba>('voos');
  const [voos, setVoos] = useState<Voo[]>([]);
  const [hospedagens, setHospedagens] = useState<Hospedagem[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [inclusoes, setInclusoes] = useState<Inclusao[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [participantes, setParticipantes] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [novoVoo, setNovoVoo] = useState({
    companhia: '',
    numero: '',
    origem: '',
    destino: '',
    parte: '',
    chega: '',
  });
  const [novaHospedagem, setNovaHospedagem] = useState({ nome: '', endereco: '', telefone: '' });
  const [novoTransfer, setNovoTransfer] = useState({ titulo: '', origem: '', quando: '' });
  const [novaInclusao, setNovaInclusao] = useState({
    categoria: 'tours' as (typeof CATEGORIAS)[number],
    titulo: '',
    detalhes: '',
  });
  const [novoDoc, setNovoDoc] = useState({
    dono: '',
    tipo: 'voucher' as (typeof TIPOS_DOCUMENTO)[number],
    titulo: '',
  });

  useEffect(() => {
    void supabase()
      .from('trips')
      .select('id, name')
      .order('starts_on', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) return setErro(error.message);
        const lista = (data ?? []).map((t) => ({ id: t.id, nome: t.name }));
        setViagens(lista);
        setViagem((v) => v || (lista[0]?.id ?? ''));
      });
  }, []);

  const carregar = useCallback(async () => {
    if (!viagem) return;
    const db = supabase();

    const [vooRes, hospRes, transRes, incRes, docRes, membroRes] = await Promise.all([
      db
        .from('flights')
        .select(
          'id, airline, flight_number, origin_iata, destination_iata, departs_at, arrives_at, terminal, gate, status',
        )
        .eq('trip_id', viagem)
        .order('departs_at'),
      db
        .from('accommodations')
        .select('id, name, address, phone, checkin_at, checkout_at, accommodation_guests(user_id)')
        .eq('trip_id', viagem),
      db
        .from('transfers')
        .select(
          'id, title, pickup_point, pickup_at, dropoff_point, status, driver_name, vehicle_description, vehicle_plate, transfer_passengers(user_id)',
        )
        .eq('trip_id', viagem)
        .order('pickup_at'),
      db
        .from('trip_inclusions')
        .select('id, category, title, details, status, is_optional')
        .eq('trip_id', viagem)
        .order('sort_order'),
      db
        .from('documents')
        .select('id, owner_id, kind, title, reviewed_at')
        .eq('trip_id', viagem)
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('trip_members').select('user_id').eq('trip_id', viagem),
    ]);

    if (vooRes.error) return setErro(vooRes.error.message);

    const ids = (membroRes.data ?? []).map((m) => m.user_id);
    const { data: perfis } = await db
      .from('profiles')
      .select('id, preferred_name, display_name')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nomeDe = new Map(
      (perfis ?? []).map((p) => [p.id, p.preferred_name ?? p.display_name ?? 'Sem nome']),
    );
    setParticipantes(
      (perfis ?? []).map((p) => ({
        id: p.id,
        nome: p.preferred_name ?? p.display_name ?? 'Sem nome',
      })),
    );

    setVoos(
      (vooRes.data ?? []).map((f) => ({
        id: f.id,
        companhia: f.airline,
        numero: f.flight_number,
        origem: f.origin_iata,
        destino: f.destination_iata,
        parte: f.departs_at,
        chega: f.arrives_at,
        terminal: f.terminal,
        portao: f.gate,
        situacao: f.status,
      })),
    );
    setHospedagens(
      (hospRes.data ?? []).map((h) => ({
        id: h.id,
        nome: h.name,
        endereco: h.address,
        telefone: h.phone,
        entrada: h.checkin_at,
        saida: h.checkout_at,
        hospedes: (h.accommodation_guests ?? []).length,
      })),
    );
    setTransfers(
      (transRes.data ?? []).map((t) => ({
        id: t.id,
        titulo: t.title,
        origem: t.pickup_point,
        quando: t.pickup_at,
        destino: t.dropoff_point,
        situacao: t.status,
        motorista: t.driver_name,
        veiculo: t.vehicle_description,
        placa: t.vehicle_plate,
        passageiros: (t.transfer_passengers ?? []).length,
      })),
    );
    setInclusoes(
      (incRes.data ?? []).map((i) => ({
        id: i.id,
        categoria: i.category,
        titulo: i.title,
        detalhes: i.details,
        situacao: i.status,
        opcional: i.is_optional,
      })),
    );
    setDocumentos(
      (docRes.data ?? []).map((d) => ({
        id: d.id,
        dono: nomeDe.get(d.owner_id) ?? 'Fora desta viagem',
        tipo: d.kind,
        titulo: d.title,
        conferidoEm: d.reviewed_at,
      })),
    );
  }, [viagem]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const executar = useCallback(
    async (acao: () => Promise<string | null>, feito: string) => {
      setOcupado(true);
      setErro(null);
      setRecado(null);
      const problema = await acao();
      setOcupado(false);
      if (problema) return setErro(problema);
      setRecado(feito);
      await carregar();
    },
    [carregar],
  );

  const salvarCampo = (tabela: 'flights' | 'transfers', id: string, campos: object) =>
    void executar(async () => {
      const { error } = await supabase().from(tabela).update(campos).eq('id', id);
      return error?.message ?? null;
    }, 'Salvo.');

  const criarVoo = () =>
    void executar(async () => {
      const parte = new Date(novoVoo.parte);
      const chega = new Date(novoVoo.chega);
      if (Number.isNaN(parte.getTime()) || Number.isNaN(chega.getTime()))
        return 'Voo precisa de partida e chegada.';
      const { error } = await supabase().from('flights').insert({
        trip_id: viagem,
        airline: novoVoo.companhia.trim(),
        flight_number: novoVoo.numero.trim().toUpperCase(),
        origin_iata: novoVoo.origem.trim().toUpperCase(),
        destination_iata: novoVoo.destino.trim().toUpperCase(),
        departs_at: parte.toISOString(),
        arrives_at: chega.toISOString(),
        // Os fusos são obrigatórios: a tela do cliente mostra "chega às 6h de
        // Dubai", e sem fuso a conta sai errada por horas.
        origin_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        destination_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) return error.message;
      setNovoVoo({ companhia: '', numero: '', origem: '', destino: '', parte: '', chega: '' });
      return null;
    }, 'Voo criado. Confira os fusos: eles vieram deste computador.');

  const criarHospedagem = () =>
    void executar(async () => {
      const { error } = await supabase()
        .from('accommodations')
        .insert({
          trip_id: viagem,
          name: novaHospedagem.nome.trim(),
          address: novaHospedagem.endereco.trim() || null,
          phone: novaHospedagem.telefone.trim() || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      if (error) return error.message;
      setNovaHospedagem({ nome: '', endereco: '', telefone: '' });
      return null;
    }, 'Hospedagem criada.');

  const criarTransfer = () =>
    void executar(async () => {
      const d = new Date(novoTransfer.quando);
      if (Number.isNaN(d.getTime())) return 'Transfer precisa de horário.';
      const { error } = await supabase().from('transfers').insert({
        trip_id: viagem,
        title: novoTransfer.titulo.trim(),
        pickup_point: novoTransfer.origem.trim(),
        pickup_at: d.toISOString(),
      });
      if (error) return error.message;
      setNovoTransfer({ titulo: '', origem: '', quando: '' });
      return null;
    }, 'Transfer criado.');

  const criarInclusao = () =>
    void executar(async () => {
      const { error } = await supabase()
        .from('trip_inclusions')
        .insert({
          trip_id: viagem,
          category: novaInclusao.categoria,
          title: novaInclusao.titulo.trim(),
          details: novaInclusao.detalhes.trim() || null,
        });
      if (error) return error.message;
      setNovaInclusao({ categoria: 'tours', titulo: '', detalhes: '' });
      return null;
    }, 'Item incluído.');

  const conferir = (id: string) =>
    void executar(async () => {
      const { data: sessao } = await supabase().auth.getUser();
      const { error } = await supabase()
        .from('documents')
        .update({ reviewed_at: new Date().toISOString(), reviewed_by: sessao.user?.id ?? null })
        .eq('id', id);
      return error?.message ?? null;
    }, 'Documento conferido.');

  const enviarDocumento = (arquivo: File) =>
    void executar(async () => {
      if (!novoDoc.dono) return 'Escolha de quem é o documento.';
      const db = supabase();
      const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      // O caminho é `{owner_id}/{uuid}.{ext}` — a policy do bucket confere a
      // primeira pasta, e é ela que garante que o arquivo é do dono certo.
      const caminho = `${novoDoc.dono}/${crypto.randomUUID()}.${extensao}`;

      const { error: erroUpload } = await db.storage
        .from('documentos')
        .upload(caminho, arquivo, { contentType: arquivo.type });
      if (erroUpload) return erroUpload.message;

      const { error } = await db.from('documents').insert({
        owner_id: novoDoc.dono,
        trip_id: viagem,
        kind: novoDoc.tipo,
        title: novoDoc.titulo.trim() || arquivo.name,
        storage_path: caminho,
        mime_type: arquivo.type,
        size_bytes: arquivo.size,
      });
      if (error) {
        // Registro falhou depois do upload: o arquivo ficaria órfão no bucket.
        await db.storage.from('documentos').remove([caminho]);
        return error.message;
      }
      setNovoDoc({ dono: '', tipo: 'voucher', titulo: '' });
      return null;
    }, 'Documento no cofre do cliente. Você não consegue abri-lo — e é assim de propósito.');

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Logística</p>
          <h1>Voo, hotel, transfer, incluso e cofre</h1>
          <p className="muted">
            Tudo isto aparece na Minha Viagem do cliente desde a Fase 4. Até agora, mudar um portão
            de embarque era comando no banco.
          </p>
        </div>
        <label className="field">
          <span>Viagem</span>
          <select value={viagem} onChange={(e) => setViagem(e.target.value)}>
            {viagens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      <div className="acoes">
        {(['voos', 'hospedagem', 'transfers', 'incluso', 'cofre'] as const).map((a) => (
          <button
            key={a}
            type="button"
            className={aba === a ? 'botao' : 'botao botao--fantasma'}
            onClick={() => setAba(a)}
          >
            {a === 'voos'
              ? `Voos (${voos.length})`
              : a === 'hospedagem'
                ? `Hospedagem (${hospedagens.length})`
                : a === 'transfers'
                  ? `Transfers (${transfers.length})`
                  : a === 'incluso'
                    ? `Incluso (${inclusoes.length})`
                    : `Cofre (${documentos.length})`}
          </button>
        ))}
      </div>

      {aba === 'voos' ? (
        <section className="secao">
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Voo</th>
                  <th>Trecho</th>
                  <th>Parte</th>
                  <th>Chega</th>
                  <th>Terminal</th>
                  <th>Portão</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {voos.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.companhia} <span className="mono">{f.numero}</span>
                    </td>
                    <td className="mono">
                      {f.origem} → {f.destino}
                    </td>
                    <td className="mono">{quando(f.parte)}</td>
                    <td className="mono">{quando(f.chega)}</td>
                    <td>
                      <input
                        defaultValue={f.terminal ?? ''}
                        onBlur={(e) =>
                          salvarCampo('flights', f.id, { terminal: e.target.value || null })
                        }
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={f.portao ?? ''}
                        onBlur={(e) =>
                          salvarCampo('flights', f.id, { gate: e.target.value || null })
                        }
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={f.situacao ?? ''}
                        onBlur={(e) =>
                          salvarCampo('flights', f.id, { status: e.target.value || null })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {voos.length === 0 ? <p className="muted">Nenhum voo nesta viagem.</p> : null}

          <div className="form form--linha">
            <label className="field">
              <span>Companhia</span>
              <input
                value={novoVoo.companhia}
                onChange={(e) => setNovoVoo({ ...novoVoo, companhia: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Número</span>
              <input
                value={novoVoo.numero}
                onChange={(e) => setNovoVoo({ ...novoVoo, numero: e.target.value })}
              />
            </label>
            <label className="field">
              <span>De</span>
              <input
                maxLength={3}
                value={novoVoo.origem}
                onChange={(e) => setNovoVoo({ ...novoVoo, origem: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Para</span>
              <input
                maxLength={3}
                value={novoVoo.destino}
                onChange={(e) => setNovoVoo({ ...novoVoo, destino: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Parte</span>
              <input
                type="datetime-local"
                value={novoVoo.parte}
                onChange={(e) => setNovoVoo({ ...novoVoo, parte: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Chega</span>
              <input
                type="datetime-local"
                value={novoVoo.chega}
                onChange={(e) => setNovoVoo({ ...novoVoo, chega: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novoVoo.companhia.trim() || !novoVoo.numero.trim()}
              onClick={criarVoo}
            >
              Criar voo
            </button>
          </div>
        </section>
      ) : null}

      {aba === 'hospedagem' ? (
        <section className="secao">
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Endereço</th>
                  <th>Telefone</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Hóspedes</th>
                </tr>
              </thead>
              <tbody>
                {hospedagens.map((h) => (
                  <tr key={h.id}>
                    <td>{h.nome}</td>
                    <td className="muted">{h.endereco ?? '—'}</td>
                    <td className="mono">{h.telefone ?? '—'}</td>
                    <td className="mono">{quando(h.entrada)}</td>
                    <td className="mono">{quando(h.saida)}</td>
                    <td className="mono">{h.hospedes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hospedagens.length === 0 ? <p className="muted">Nenhuma hospedagem.</p> : null}

          <div className="form form--linha">
            <label className="field">
              <span>Nome</span>
              <input
                value={novaHospedagem.nome}
                onChange={(e) => setNovaHospedagem({ ...novaHospedagem, nome: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Endereço</span>
              <input
                value={novaHospedagem.endereco}
                onChange={(e) => setNovaHospedagem({ ...novaHospedagem, endereco: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Telefone</span>
              <input
                value={novaHospedagem.telefone}
                onChange={(e) => setNovaHospedagem({ ...novaHospedagem, telefone: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novaHospedagem.nome.trim()}
              onClick={criarHospedagem}
            >
              Criar
            </button>
          </div>
        </section>
      ) : null}

      {aba === 'transfers' ? (
        <section className="secao">
          <p className="muted">
            Motorista, veículo e placa só chegam ao cliente perto do horário, e só a quem embarca —
            a RLS da Fase 4 cuida disso. Preencher aqui não antecipa nada.
          </p>
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>Saída</th>
                  <th>De</th>
                  <th>Situação</th>
                  <th>Motorista</th>
                  <th>Veículo</th>
                  <th>Placa</th>
                  <th>Pax</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>{t.titulo}</td>
                    <td className="mono">{quando(t.quando)}</td>
                    <td className="muted">{t.origem}</td>
                    <td>
                      <select
                        defaultValue={t.situacao}
                        onChange={(e) => salvarCampo('transfers', t.id, { status: e.target.value })}
                      >
                        {SITUACOES_TRANSFER.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        defaultValue={t.motorista ?? ''}
                        onBlur={(e) =>
                          salvarCampo('transfers', t.id, { driver_name: e.target.value || null })
                        }
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={t.veiculo ?? ''}
                        onBlur={(e) =>
                          salvarCampo('transfers', t.id, {
                            vehicle_description: e.target.value || null,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={t.placa ?? ''}
                        onBlur={(e) =>
                          salvarCampo('transfers', t.id, { vehicle_plate: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="mono">{t.passageiros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transfers.length === 0 ? <p className="muted">Nenhum transfer.</p> : null}

          <div className="form form--linha">
            <label className="field">
              <span>Título</span>
              <input
                value={novoTransfer.titulo}
                onChange={(e) => setNovoTransfer({ ...novoTransfer, titulo: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Ponto de saída</span>
              <input
                value={novoTransfer.origem}
                onChange={(e) => setNovoTransfer({ ...novoTransfer, origem: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Quando</span>
              <input
                type="datetime-local"
                value={novoTransfer.quando}
                onChange={(e) => setNovoTransfer({ ...novoTransfer, quando: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novoTransfer.titulo.trim() || !novoTransfer.origem.trim()}
              onClick={criarTransfer}
            >
              Criar
            </button>
          </div>
        </section>
      ) : null}

      {aba === 'incluso' ? (
        <section className="secao">
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Item</th>
                  <th>Detalhes</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {inclusoes.map((i) => (
                  <tr key={i.id}>
                    <td className="muted">{i.categoria}</td>
                    <td>{i.titulo}</td>
                    <td className="muted">{i.detalhes ?? '—'}</td>
                    <td>
                      {i.situacao}
                      {i.opcional ? ' · opcional' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inclusoes.length === 0 ? <p className="muted">Nada declarado como incluso.</p> : null}

          <div className="form form--linha">
            <label className="field">
              <span>Categoria</span>
              <select
                value={novaInclusao.categoria}
                onChange={(e) =>
                  setNovaInclusao({
                    ...novaInclusao,
                    categoria: e.target.value as (typeof CATEGORIAS)[number],
                  })
                }
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Item</span>
              <input
                value={novaInclusao.titulo}
                onChange={(e) => setNovaInclusao({ ...novaInclusao, titulo: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Detalhes</span>
              <input
                value={novaInclusao.detalhes}
                onChange={(e) => setNovaInclusao({ ...novaInclusao, detalhes: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novaInclusao.titulo.trim()}
              onClick={criarInclusao}
            >
              Incluir
            </button>
          </div>
        </section>
      ) : null}

      {aba === 'cofre' ? (
        <section className="secao">
          <p className="muted">
            Você deposita e não lê. Abrir documento de cliente exige permissão explícita, e cada
            abertura vira linha na auditoria.
          </p>
          <div className="tabela-envolvente">
            <table className="tabela">
              <thead>
                <tr>
                  <th>De quem</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Conferido</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <td>{d.dono}</td>
                    <td className="muted">{d.tipo}</td>
                    <td>{d.titulo}</td>
                    <td className="mono muted">{quando(d.conferidoEm)}</td>
                    <td>
                      {d.conferidoEm ? null : (
                        <button
                          type="button"
                          className="botao botao--fantasma"
                          disabled={ocupado}
                          onClick={() => conferir(d.id)}
                        >
                          Marcar conferido
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {documentos.length === 0 ? <p className="muted">Cofre vazio nesta viagem.</p> : null}

          <div className="form form--linha">
            <label className="field">
              <span>De quem</span>
              <select
                value={novoDoc.dono}
                onChange={(e) => setNovoDoc({ ...novoDoc, dono: e.target.value })}
              >
                <option value="">Escolha</option>
                {participantes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tipo</span>
              <select
                value={novoDoc.tipo}
                onChange={(e) =>
                  setNovoDoc({
                    ...novoDoc,
                    tipo: e.target.value as (typeof TIPOS_DOCUMENTO)[number],
                  })
                }
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Título</span>
              <input
                value={novoDoc.titulo}
                onChange={(e) => setNovoDoc({ ...novoDoc, titulo: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Arquivo (PDF ou imagem)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/heic,application/pdf"
                disabled={ocupado || !novoDoc.dono}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) enviarDocumento(arquivo);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </section>
      ) : null}
    </>
  );
}
