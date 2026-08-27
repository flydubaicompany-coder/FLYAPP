import { useCallback, useState } from 'react';
import type { Database } from '@fly/domain-types';
import { supabase } from '../auth/client';

type TipoDeQr = Database['public']['Enums']['qr_kind'];

/**
 * Leitor de QR (§7.8 e §39, entrega do Fly Crew).
 *
 * A câmera não está aqui. O campo de texto está — e é de propósito: um leitor
 * de código de barras USB, ou um celular com app de câmera nativo, entrega o
 * token como texto digitado. Isso funciona hoje, em qualquer aparelho da
 * operação, sem depender de permissão de câmera no navegador.
 *
 * A tela existe para deixar cada recusa **distinta**. "Não deu" é inútil para
 * quem está no portão: expirado se resolve com um código novo, já usado é
 * conversa com o cliente, e escopo errado é o cliente na fila errada.
 */

interface Leitura {
  resultado: string;
  tipo: string | null;
  pessoa: string | null;
  atividade: string | null;
  usos: number | null;
  limite: number | null;
  em: string;
}

const ROTULO: Record<string, { texto: string; classe: string; oQueFazer: string }> = {
  ok: {
    texto: 'Liberado',
    classe: 'ok',
    oQueFazer: 'Presença registrada.',
  },
  already_used: {
    texto: 'Já usado',
    classe: 'erro',
    oQueFazer: 'Este código já foi lido. Confirme com a pessoa se ela já passou.',
  },
  expired: {
    texto: 'Expirado',
    classe: 'erro',
    oQueFazer: 'Peça para gerar um código novo no app.',
  },
  revoked: {
    texto: 'Revogado',
    classe: 'erro',
    oQueFazer: 'Este código foi cancelado. Fale com a coordenação.',
  },
  wrong_scope: {
    texto: 'Tipo errado',
    classe: 'erro',
    oQueFazer: 'Este código não é para esta leitura.',
  },
  unknown: {
    texto: 'Não reconhecido',
    classe: 'erro',
    oQueFazer: 'Código inválido. Use check-in manual se a pessoa estiver na lista.',
  },
};

const TIPOS: { valor: TipoDeQr | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Qualquer tipo' },
  { valor: 'activity_checkin', rotulo: 'Check-in de atividade' },
  { valor: 'ticket', rotulo: 'Ingresso' },
  { valor: 'benefit', rotulo: 'Benefício' },
  { valor: 'wristband', rotulo: 'Pulseira' },
];

export function Scanner() {
  const [token, setToken] = useState('');
  const [tipoEsperado, setTipoEsperado] = useState<TipoDeQr | ''>('');
  const [historico, setHistorico] = useState<Leitura[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  const ler = useCallback(
    async (valor: string) => {
      const limpo = valor.trim();
      if (!limpo) return;

      setLendo(true);
      setErro(null);

      const { data, error } = await supabase().rpc('ler_qr', {
        p_token: limpo,
        ...(tipoEsperado ? { p_expected_kind: tipoEsperado } : {}),
      });

      setLendo(false);
      setToken('');

      if (error) return setErro(error.message);

      const r = Array.isArray(data) ? data[0] : data;
      if (!r) return setErro('Sem resposta do servidor.');

      setHistorico((h) =>
        [
          {
            resultado: r.resultado,
            tipo: r.kind,
            pessoa: r.pessoa,
            atividade: r.atividade,
            usos: r.usos,
            limite: r.limite,
            em: new Date().toLocaleTimeString('pt-BR'),
          },
          ...h,
        ].slice(0, 20),
      );
    },
    [tipoEsperado],
  );

  const ultima = historico[0];
  const info = ultima ? ROTULO[ultima.resultado] : null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="kicker">Operação</p>
          <h1>Leitor de QR</h1>
        </div>
        <p className="muted">{historico.length} leituras nesta sessão</p>
      </div>

      <p className="muted">
        Aponte um leitor de código para o campo abaixo, ou cole o token. Toda leitura fica
        registrada — inclusive as recusadas.
      </p>

      {erro ? (
        <p role="alert" className="erro">
          {erro}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ler(token);
        }}
      >
        <label className="field">
          <span>Tipo esperado</span>
          <select
            value={tipoEsperado}
            onChange={(e) => setTipoEsperado(e.target.value as TipoDeQr | '')}
            aria-label="Tipo de código esperado"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Código</span>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Leia ou cole o código"
            aria-label="Código lido"
            autoFocus
            disabled={lendo}
          />
        </label>

        <button type="submit" className="botao" disabled={lendo || !token.trim()}>
          {lendo ? 'Lendo…' : 'Ler'}
        </button>
      </form>

      {ultima && info ? (
        <div className={`resultado resultado--${info.classe}`} role="status" aria-live="polite">
          <p className="kicker">{info.texto}</p>
          {ultima.pessoa ? <h2>{ultima.pessoa}</h2> : null}
          {ultima.atividade ? <p className="muted">{ultima.atividade}</p> : null}
          <p>{info.oQueFazer}</p>
          {ultima.limite ? (
            <p className="muted mono">
              {ultima.usos} de {ultima.limite} usos
            </p>
          ) : null}
        </div>
      ) : null}

      {historico.length > 1 ? (
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Resultado</th>
                <th>Pessoa</th>
                <th>Atividade</th>
              </tr>
            </thead>
            <tbody>
              {historico.slice(1).map((l, i) => (
                <tr key={`${l.em}-${i}`}>
                  <td className="mono">{l.em}</td>
                  <td className={l.resultado === 'ok' ? 'muted' : 'pendente'}>
                    {ROTULO[l.resultado]?.texto ?? l.resultado}
                  </td>
                  <td>{l.pessoa ?? '—'}</td>
                  <td className="muted">{l.atividade ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
