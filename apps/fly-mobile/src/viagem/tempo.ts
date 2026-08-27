/**
 * Formatação de horário no fuso do destino (§7.3).
 *
 * Todo horário de roteiro é mostrado no fuso de **onde a atividade acontece**,
 * nunca no do aparelho. Alguém que abre o app no avião, com o celular ainda no
 * horário de Brasília, precisa ler "20h" e entender 20h em Dubai.
 *
 * Módulo puro, e testado: é a conta que ninguém confere olhando a tela, porque
 * na tela do desenvolvedor os dois fusos costumam ser o mesmo.
 */

export function hora(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function dataCurta(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * Quanto falta, em texto.
 *
 * Abaixo de uma hora, conta em minutos: "em 40 min" é acionável, "em 1h" não.
 * Acima de um dia, para de contar horas — ninguém sai de casa com base em
 * "faltam 31 horas".
 */
export function faltam(iso: string | null, agora: Date = new Date()): string | null {
  if (!iso) return null;
  const alvo = new Date(iso).getTime();
  if (Number.isNaN(alvo)) return null;

  const ms = alvo - agora.getTime();
  if (ms <= 0) return 'agora';

  const min = Math.round(ms / 60000);
  if (min < 60) return `em ${min} min`;

  const h = Math.floor(min / 60);
  const restoMin = min % 60;
  if (h < 24) return restoMin === 0 ? `em ${h}h` : `em ${h}h${String(restoMin).padStart(2, '0')}`;

  const dias = Math.floor(h / 24);
  return dias === 1 ? 'amanhã' : `em ${dias} dias`;
}

/**
 * A janela em que a saída importa.
 *
 * Serve para a tela decidir quando destacar o horário de sair em vez do de
 * começar. Duas horas antes, "sai às 18h30" é o dado que muda o que a pessoa
 * faz agora; três dias antes, é ruído.
 */
export function saidaEminente(
  saidaIso: string | null,
  agora: Date = new Date(),
  janelaMinutos = 120,
): boolean {
  if (!saidaIso) return false;
  const ms = new Date(saidaIso).getTime() - agora.getTime();
  return ms > -15 * 60_000 && ms <= janelaMinutos * 60_000;
}

/** Rótulo do estado de uma atividade, para leitor de tela e para a tela. */
export const ROTULO_STATUS: Record<string, string> = {
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  in_progress: 'Acontecendo',
  done: 'Concluído',
  changed: 'Alterado',
  cancelled: 'Cancelado',
};
