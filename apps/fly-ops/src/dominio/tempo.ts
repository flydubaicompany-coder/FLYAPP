/**
 * Tempo decorrido, para a fila do atendimento (§43, entrega 10).
 *
 * Mora aqui, e não dentro da tela, pela regra que já mordeu duas vezes neste
 * projeto: **função pura testável nunca fica no mesmo arquivo que um import
 * pesado**. A tela importa React e o cliente do Supabase; um teste que a
 * importasse arrastaria os dois junto.
 *
 * Nada aqui decide prazo. Prazo é promessa de nível de serviço, vive em
 * `app_config['support.sla_minutes']` e nasce `PENDENTE` — §33.
 */

/** Minutos entre dois instantes. `ate` nulo significa "até agora". */
export function minutosEntre(de: string, ate: string | null, agora: Date = new Date()): number {
  const fim = ate ? new Date(ate).getTime() : agora.getTime();
  return Math.max(0, Math.round((fim - new Date(de).getTime()) / 60000));
}

/** "12 min", "2 h 5 min", "3 dias". Sem biblioteca de datas. */
export function espera(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

/** Média inteira, em minutos. `null` quando não há o que medir. */
export function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

/**
 * O alvo de SLA, lido de `app_config['support.sla_minutes']`.
 *
 * Nasce `PENDENTE` — uma string, e não um objeto. Ler defensivamente é o que
 * faz a tela continuar honesta enquanto o dono não decide: sem alvo, ela mede
 * e não acusa atraso. Formato quando decidido:
 *
 *     {"sos": {"accept": 5, "first_response": 10}, "urgent": {…}, "chat": {…}}
 */
export type NivelDeAtendimento = 'chat' | 'urgent' | 'sos';

export interface AlvoDeSla {
  /** Minutos até alguém aceitar. `null` = não declarado. */
  aceite: number | null;
  /** Minutos até a primeira resposta da equipe. `null` = não declarado. */
  primeiraResposta: number | null;
}

export type AlvosDeSla = Record<NivelDeAtendimento, AlvoDeSla>;

const NIVEIS: NivelDeAtendimento[] = ['chat', 'urgent', 'sos'];

function minutos(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

export function lerAlvos(bruto: unknown): AlvosDeSla | null {
  if (bruto === null || typeof bruto !== 'object' || Array.isArray(bruto)) return null;

  const fonte = bruto as Record<string, unknown>;
  const alvos = {} as AlvosDeSla;
  let algum = false;

  for (const nivel of NIVEIS) {
    const linha = fonte[nivel];
    const obj =
      linha !== null && typeof linha === 'object' ? (linha as Record<string, unknown>) : {};
    const alvo: AlvoDeSla = {
      aceite: minutos(obj['accept']),
      primeiraResposta: minutos(obj['first_response']),
    };
    if (alvo.aceite !== null || alvo.primeiraResposta !== null) algum = true;
    alvos[nivel] = alvo;
  }

  // Objeto sem nenhum número útil é o mesmo que não ter alvo. Devolver um
  // objeto vazio faria a tela dizer "há prazo" e nunca marcar nada.
  return algum ? alvos : null;
}
