import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/client';
import { useSessao } from '../auth/sessao';

/**
 * Configuração e flags (§46, entrega 10).
 *
 * O critério da §46 — "nenhuma mudança comum exige editar código" — falhava na
 * primeira: mudar `support.sla_minutes` ou ligar uma flag era SQL. E SQL é
 * pior do que código, porque não fica registro de quem mudou nem de qual era o
 * valor antes.
 *
 * As policies de escrita destas duas tabelas foram removidas nesta fase. Esta
 * tela não escreve nelas: ela chama `definir_config` e `definir_flag`, que
 * gravam o valor anterior na trilha. Se alguém abrir o console e tentar um
 * `update` direto, o banco recusa.
 *
 * **Valor é JSON.** Não é frescura de formato: metade da configuração deste
 * projeto é objeto — `{"prime": null, "elite": null}`, `{"BR": "190"}` — e um
 * campo de texto que "converte sozinho" transformaria `190` em `"190"` no dia
 * em que alguém digitasse sem aspas.
 *
 * "Por ambiente" não tem controle aqui: ambiente é projeto do Supabase
 * separado, e a linha da flag naquele banco já é o valor daquele ambiente.
 */

interface Config {
  chave: string;
  valor: unknown;
  descricao: string | null;
  publica: boolean;
  atualizadoEm: string;
}

interface Flag {
  chave: string;
  ligada: boolean;
  descricao: string | null;
}

interface Sobreposicao {
  tripId: string;
  viagem: string;
  chave: string;
  ligada: boolean;
}

interface Viagem {
  id: string;
  nome: string;
}

interface Item {
  id: string;
  rotulo: string;
  nota: string | null;
  viagem: string | null;
  ativo: boolean;
}

/** `"PENDENTE"` é a marca deste projeto para regra que o dono ainda não deu. */
function pendente(valor: unknown): boolean {
  return valor === 'PENDENTE';
}

export function Configuracao() {
  const { estado } = useSessao();
  const ehAdmin = estado.tipo === 'logado' && estado.papeis.includes('admin');

  const [configs, setConfigs] = useState<Config[] | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [sobreposicoes, setSobreposicoes] = useState<Sobreposicao[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [novaChave, setNovaChave] = useState({
    chave: '',
    valor: '',
    descricao: '',
    publica: false,
  });
  const [novaFlag, setNovaFlag] = useState({ chave: '', descricao: '' });
  const [sobrepor, setSobrepor] = useState({ viagem: '', chave: '', ligada: 'true' });
  const [novoItem, setNovoItem] = useState({ rotulo: '', nota: '', viagem: '' });

  const carregar = useCallback(async () => {
    const db = supabase();
    const [cfgRes, flagRes, sobRes, viagemRes, itemRes] = await Promise.all([
      db.from('app_config').select('key, value, description, is_public, updated_at').order('key'),
      db.from('feature_flags').select('key, is_enabled, description').order('key'),
      db.from('trip_feature_flags').select('trip_id, key, is_enabled'),
      db.from('trips').select('id, name').order('starts_on', { ascending: false }).limit(100),
      db
        .from('packing_items')
        .select('id, label, note, trip_id, is_active')
        .order('sort_order')
        .limit(200),
    ]);

    if (cfgRes.error) return setErro(cfgRes.error.message);

    const nomeDaViagem = new Map((viagemRes.data ?? []).map((t) => [t.id, t.name]));

    setConfigs(
      (cfgRes.data ?? []).map((c) => ({
        chave: c.key,
        valor: c.value,
        descricao: c.description,
        publica: c.is_public,
        atualizadoEm: c.updated_at,
      })),
    );
    setFlags(
      (flagRes.data ?? []).map((f) => ({
        chave: f.key,
        ligada: f.is_enabled,
        descricao: f.description,
      })),
    );
    setSobreposicoes(
      (sobRes.data ?? []).map((s) => ({
        tripId: s.trip_id,
        viagem: nomeDaViagem.get(s.trip_id) ?? 'Viagem removida',
        chave: s.key,
        ligada: s.is_enabled,
      })),
    );
    setViagens((viagemRes.data ?? []).map((t) => ({ id: t.id, nome: t.name })));
    setItens(
      (itemRes.data ?? []).map((i) => ({
        id: i.id,
        rotulo: i.label,
        nota: i.note,
        viagem: i.trip_id ? (nomeDaViagem.get(i.trip_id) ?? null) : null,
        ativo: i.is_active,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const chamar = useCallback(
    async (executar: () => Promise<{ ok: boolean; motivo: string | null } | string>) => {
      setOcupado(true);
      setRecado(null);
      setErro(null);
      const r = await executar();
      setOcupado(false);
      if (typeof r === 'string') return setErro(r);
      setRecado(r.ok ? (r.motivo ?? 'Salvo.') : (r.motivo ?? 'Não deu.'));
      if (r.ok) await carregar();
    },
    [carregar],
  );

  const salvarConfig = (chave: string) =>
    void chamar(async () => {
      const texto = rascunho[chave];
      if (texto === undefined) return 'Nada mudou.';
      let valor: unknown;
      try {
        valor = JSON.parse(texto);
      } catch {
        // Recusar aqui é melhor do que aceitar e gravar a string errada: o
        // valor vai para o app inteiro, e uma aspa a mais vira bug de tela.
        return 'Isso não é JSON válido. Texto vai entre aspas: "PENDENTE".';
      }
      const { data, error } = await supabase().rpc('definir_config', {
        p_key: chave,
        p_value: valor as never,
      });
      if (error) return error.message;
      const l = data?.[0];
      setRascunho((r) => {
        const { [chave]: _fora, ...resto } = r;
        return resto;
      });
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const criarConfig = () =>
    void chamar(async () => {
      let valor: unknown;
      try {
        valor = JSON.parse(novaChave.valor);
      } catch {
        return 'Isso não é JSON válido.';
      }
      const { data, error } = await supabase().rpc('definir_config', {
        p_key: novaChave.chave.trim(),
        p_value: valor as never,
        ...(novaChave.descricao.trim() ? { p_description: novaChave.descricao.trim() } : {}),
        p_is_public: novaChave.publica,
      });
      if (error) return error.message;
      const l = data?.[0];
      if (l?.ok) setNovaChave({ chave: '', valor: '', descricao: '', publica: false });
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const alternarFlag = (chave: string, ligada: boolean) =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('definir_flag', {
        p_key: chave,
        p_enabled: ligada,
      });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const criarFlag = () =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('definir_flag', {
        p_key: novaFlag.chave.trim(),
        p_enabled: false,
        ...(novaFlag.descricao.trim() ? { p_description: novaFlag.descricao.trim() } : {}),
      });
      if (error) return error.message;
      const l = data?.[0];
      if (l?.ok) setNovaFlag({ chave: '', descricao: '' });
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const salvarSobreposicao = (trip: string, chave: string, ligada: boolean | null) =>
    void chamar(async () => {
      const { data, error } = await supabase().rpc('definir_flag_da_viagem', {
        p_trip: trip,
        p_key: chave,
        p_enabled: ligada as boolean,
      });
      if (error) return error.message;
      const l = data?.[0];
      return { ok: l?.ok ?? false, motivo: l?.motivo ?? null };
    });

  const criarItem = () =>
    void chamar(async () => {
      const { error } = await supabase()
        .from('packing_items')
        .insert({
          label: novoItem.rotulo.trim(),
          note: novoItem.nota.trim() || null,
          trip_id: novoItem.viagem || null,
        });
      if (error) return error.message;
      setNovoItem({ rotulo: '', nota: '', viagem: '' });
      return { ok: true, motivo: 'Item na lista.' };
    });

  if (erro && !configs)
    return (
      <p role="alert" className="erro">
        {erro}
      </p>
    );
  if (!configs) return <p className="muted">Carregando…</p>;

  const pendentes = configs.filter((c) => pendente(c.valor));

  return (
    <>
      <header className="cabecalho">
        <div>
          <p className="kicker">Configuração</p>
          <h1>O que o app lê antes de mostrar qualquer coisa</h1>
          <p className="muted">
            Toda mudança aqui vira linha na trilha, com o valor anterior. Escrever direto nas
            tabelas não é possível — nem para a administração.
          </p>
        </div>
      </header>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}
      {recado ? <p className="aviso">{recado}</p> : null}

      {pendentes.length > 0 ? (
        <section className="secao">
          <h2>Esperando decisão do dono</h2>
          <p className="muted">
            Estas {pendentes.length} chaves estão em{' '}
            <span className="mono">&quot;PENDENTE&quot;</span>. O código não inventa o valor delas
            (§33) — enquanto estiverem assim, a tela do cliente mostra que falta em vez de mostrar
            um número chutado.
          </p>
          <ul>
            {pendentes.map((c) => (
              <li key={c.chave} className="mono pendente">
                {c.chave}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="secao">
        <h2>Configuração</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Chave</th>
                <th>Valor (JSON)</th>
                <th>Cliente lê?</th>
                {ehAdmin ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.chave}>
                  <td>
                    <span className="mono">{c.chave}</span>
                    {c.descricao ? <p className="muted">{c.descricao}</p> : null}
                  </td>
                  <td>
                    {ehAdmin ? (
                      <textarea
                        rows={1}
                        className="mono"
                        value={rascunho[c.chave] ?? JSON.stringify(c.valor)}
                        onChange={(e) => setRascunho((r) => ({ ...r, [c.chave]: e.target.value }))}
                      />
                    ) : (
                      <span className="mono">{JSON.stringify(c.valor)}</span>
                    )}
                  </td>
                  <td>{c.publica ? 'Sim' : 'Não'}</td>
                  {ehAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        disabled={ocupado || rascunho[c.chave] === undefined}
                        onClick={() => salvarConfig(c.chave)}
                      >
                        Salvar
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ehAdmin ? (
          <div className="form form--linha">
            <label className="field">
              <span>Chave nova</span>
              <input
                value={novaChave.chave}
                placeholder="area.assunto"
                onChange={(e) => setNovaChave({ ...novaChave, chave: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Valor (JSON)</span>
              <input
                className="mono"
                value={novaChave.valor}
                placeholder='"PENDENTE"'
                onChange={(e) => setNovaChave({ ...novaChave, valor: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Descrição</span>
              <input
                value={novaChave.descricao}
                onChange={(e) => setNovaChave({ ...novaChave, descricao: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Cliente lê</span>
              <input
                type="checkbox"
                checked={novaChave.publica}
                onChange={(e) => setNovaChave({ ...novaChave, publica: e.target.checked })}
              />
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novaChave.chave.trim() || !novaChave.valor.trim()}
              onClick={criarConfig}
            >
              Criar
            </button>
          </div>
        ) : null}
      </section>

      <section className="secao">
        <h2>Flags</h2>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Chave</th>
                <th>Global</th>
                <th>Sobreposta em</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const sobre = sobreposicoes.filter((s) => s.chave === f.chave);
                return (
                  <tr key={f.chave}>
                    <td>
                      <span className="mono">{f.chave}</span>
                      {f.descricao ? <p className="muted">{f.descricao}</p> : null}
                    </td>
                    <td>
                      {ehAdmin ? (
                        <button
                          type="button"
                          className="botao botao--fantasma"
                          disabled={ocupado}
                          onClick={() => alternarFlag(f.chave, !f.ligada)}
                        >
                          {f.ligada ? 'Ligada' : 'Desligada'}
                        </button>
                      ) : (
                        <span className={f.ligada ? 'selo selo--ok' : 'selo selo--pendente'}>
                          {f.ligada ? 'Ligada' : 'Desligada'}
                        </span>
                      )}
                    </td>
                    <td className="muted">
                      {sobre.length === 0
                        ? '—'
                        : sobre
                            .map((s) => `${s.viagem}: ${s.ligada ? 'ligada' : 'desligada'}`)
                            .join(' · ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {ehAdmin ? (
          <div className="form form--linha">
            <label className="field">
              <span>Flag nova</span>
              <input
                value={novaFlag.chave}
                placeholder="area.assunto"
                onChange={(e) => setNovaFlag({ ...novaFlag, chave: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Descrição</span>
              <input
                value={novaFlag.descricao}
                onChange={(e) => setNovaFlag({ ...novaFlag, descricao: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="botao"
              disabled={ocupado || !novaFlag.chave.trim()}
              onClick={criarFlag}
            >
              Criar desligada
            </button>
          </div>
        ) : null}

        <h3>Sobrepor numa viagem</h3>
        <p className="muted">
          Ausência de sobreposição significa &quot;vale a global&quot;, e não &quot;desligada&quot;.
          Sobrepor é de quem responde pela viagem; criar a flag continua sendo da administração.
        </p>
        <div className="form form--linha">
          <label className="field">
            <span>Viagem</span>
            <select
              value={sobrepor.viagem}
              onChange={(e) => setSobrepor({ ...sobrepor, viagem: e.target.value })}
            >
              <option value="">Escolha</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Flag</span>
            <select
              value={sobrepor.chave}
              onChange={(e) => setSobrepor({ ...sobrepor, chave: e.target.value })}
            >
              <option value="">Escolha</option>
              {flags.map((f) => (
                <option key={f.chave} value={f.chave}>
                  {f.chave}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Valor</span>
            <select
              value={sobrepor.ligada}
              onChange={(e) => setSobrepor({ ...sobrepor, ligada: e.target.value })}
            >
              <option value="true">Ligada nesta viagem</option>
              <option value="false">Desligada nesta viagem</option>
              <option value="">Sem sobreposição (volta à global)</option>
            </select>
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !sobrepor.viagem || !sobrepor.chave}
            onClick={() =>
              salvarSobreposicao(
                sobrepor.viagem,
                sobrepor.chave,
                sobrepor.ligada === '' ? null : sobrepor.ligada === 'true',
              )
            }
          >
            Aplicar
          </button>
        </div>
      </section>

      <section className="secao">
        <h2>Mala Pronta</h2>
        <p className="muted">
          A lista da Mala Pronta vem do roteiro — do que a operação escreve em cada atividade. Estes
          itens são o acréscimo curado: o que vale para a viagem inteira e não está em atividade
          nenhuma. Criados na Fase 10, ficaram sem tela até agora.
        </p>
        <div className="form form--linha">
          <label className="field">
            <span>Item</span>
            <input
              value={novoItem.rotulo}
              onChange={(e) => setNovoItem({ ...novoItem, rotulo: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Observação</span>
            <input
              value={novoItem.nota}
              onChange={(e) => setNovoItem({ ...novoItem, nota: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Viagem</span>
            <select
              value={novoItem.viagem}
              onChange={(e) => setNovoItem({ ...novoItem, viagem: e.target.value })}
            >
              <option value="">Todas</option>
              {viagens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="botao"
            disabled={ocupado || !novoItem.rotulo.trim()}
            onClick={criarItem}
          >
            Acrescentar
          </button>
        </div>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th>Observação</th>
                <th>Viagem</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id}>
                  <td>{i.rotulo}</td>
                  <td className="muted">{i.nota ?? '—'}</td>
                  <td className="muted">{i.viagem ?? 'Todas'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {itens.length === 0 ? <p className="muted">Nenhum item curado ainda.</p> : null}
      </section>
    </>
  );
}
