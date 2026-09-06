/**
 * Alertas da viagem, calculados do próprio roteiro.
 *
 * A §46 pede push; o push deste projeto registra token e nunca entregou uma
 * notificação de verdade. Fazer o lançamento depender disso seria trocar uma
 * viagem por uma integração.
 *
 * Então o alerta é **derivado**: sai da data e da hora que a operação já
 * escreveu em cada atividade. Não há tabela nova, não há job, não há push — e
 * por isso não há como o alerta divergir do roteiro. Quando o push amadurecer,
 * ele passa a **empurrar** o que esta função já calcula.
 *
 * Nada aqui inventa texto. "Leve seu passaporte" só aparece se alguém escreveu
 * isso em `what_to_bring`; o app não deduz o que levar.
 */

export type NivelDeAlerta = 'agora' | 'hoje' | 'amanha' | 'importante' | 'mudou';

export interface AtividadeParaAlerta {
  id: string;
  titulo: string;
  /** Hora de sair, quando a operação a definiu. É ela que vale para o "agora". */
  saidaEm: string | null;
  comecaEm: string | null;
  local: string | null;
  levar: string | null;
  instrucoes: string | null;
  mudouEm: string | null;
  notaDaMudanca: string | null;
}

export interface Alerta {
  id: string;
  nivel: NivelDeAlerta;
  titulo: string;
  corpo: string;
  atividadeId: string;
  /** Para ordenar: quanto menor, mais em cima. */
  peso: number;
}

/**
 * Quanto tempo antes um compromisso vira "AGORA".
 *
 * Duas horas. Menos que isso não dá tempo de trocar de roupa e descer; mais
 * que isso e tudo vira urgente, que é o mesmo que nada ser.
 */
export const JANELA_AGORA_MIN = 120;

/** Depois de começar, o alerta ainda vale por meia hora — quem se atrasou precisa dele. */
const TOLERANCIA_DEPOIS_MIN = 30;

/** Mudança de roteiro é notícia por 48h. Depois vira roteiro. */
const JANELA_MUDANCA_H = 48;

const PESO: Record<NivelDeAlerta, number> = {
  agora: 0,
  mudou: 1,
  importante: 2,
  hoje: 3,
  amanha: 4,
};

function minutosEntre(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / 60000);
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function ehAmanha(agora: Date, quando: Date): boolean {
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  return mesmoDia(amanha, quando);
}

function horaCurta(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "em 45 minutos", "em 2h10", "agora". */
export function faltaTexto(minutos: number): string {
  if (minutos <= 0) return 'agora';
  if (minutos < 60) return `em ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `em ${h}h` : `em ${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Os alertas de agora, em ordem de urgência.
 *
 * `agora` entra por parâmetro, e não de `new Date()` lá dentro: função que lê
 * o relógio sozinha não se testa — só se observa.
 */
export function alertasDoRoteiro(
  atividades: readonly AtividadeParaAlerta[],
  agora: Date = new Date(),
): Alerta[] {
  const saida: Alerta[] = [];

  for (const a of atividades) {
    const referencia = a.saidaEm ?? a.comecaEm;
    const quando = referencia ? new Date(referencia) : null;
    const valido = quando !== null && !Number.isNaN(quando.getTime());

    // Mudança de roteiro é o alerta que não depende de hora de atividade: ela
    // vale mesmo para uma atividade de depois de amanhã.
    if (a.mudouEm && a.notaDaMudanca) {
      const mudou = new Date(a.mudouEm);
      if (!Number.isNaN(mudou.getTime())) {
        const horas = (agora.getTime() - mudou.getTime()) / 3_600_000;
        if (horas >= 0 && horas <= JANELA_MUDANCA_H) {
          saida.push({
            id: `${a.id}:mudou`,
            nivel: 'mudou',
            titulo: 'MUDOU',
            corpo: `${a.titulo}: ${a.notaDaMudanca}`,
            atividadeId: a.id,
            peso: PESO.mudou,
          });
        }
      }
    }

    if (!valido) continue;
    const faltam = minutosEntre(agora, quando);

    if (faltam <= JANELA_AGORA_MIN && faltam >= -TOLERANCIA_DEPOIS_MIN) {
      saida.push({
        id: `${a.id}:agora`,
        nivel: 'agora',
        titulo: 'AGORA',
        corpo: a.local
          ? `${a.titulo} ${faltaTexto(faltam)} — ${a.local}.`
          : `${a.titulo} ${faltaTexto(faltam)}.`,
        atividadeId: a.id,
        peso: PESO.agora,
      });
    } else if (mesmoDia(agora, quando) && faltam > JANELA_AGORA_MIN) {
      saida.push({
        id: `${a.id}:hoje`,
        nivel: 'hoje',
        titulo: 'HOJE',
        corpo: `Hoje às ${horaCurta(quando)}: ${a.titulo}.`,
        atividadeId: a.id,
        peso: PESO.hoje,
      });
    } else if (ehAmanha(agora, quando)) {
      saida.push({
        id: `${a.id}:amanha`,
        nivel: 'amanha',
        titulo: 'AMANHÃ',
        corpo: `Amanhã às ${horaCurta(quando)} temos ${a.titulo}.`,
        atividadeId: a.id,
        peso: PESO.amanha,
      });
    }

    // "Leve o passaporte" só é útil enquanto dá tempo de pegar. Depois de sair
    // do hotel, o aviso vira cobrança.
    const orientacao = a.levar ?? a.instrucoes;
    if (orientacao && mesmoDia(agora, quando) && faltam > -TOLERANCIA_DEPOIS_MIN) {
      saida.push({
        id: `${a.id}:importante`,
        nivel: 'importante',
        titulo: 'IMPORTANTE',
        corpo: `${a.titulo}: ${orientacao}`,
        atividadeId: a.id,
        peso: PESO.importante,
      });
    }
  }

  return saida.sort((x, y) => x.peso - y.peso || x.corpo.localeCompare(y.corpo));
}

/**
 * O próximo compromisso — um só, o que a Home destaca.
 *
 * É o mais próximo que ainda não passou da tolerância. Passa a bola para o
 * seguinte assim que o anterior vence, sem ninguém marcar nada como feito.
 */
export function proximoCompromisso(
  atividades: readonly AtividadeParaAlerta[],
  agora: Date = new Date(),
): AtividadeParaAlerta | null {
  const candidatos = atividades
    .map((a) => {
      const ref = a.saidaEm ?? a.comecaEm;
      const d = ref ? new Date(ref) : null;
      return d && !Number.isNaN(d.getTime()) ? { a, faltam: minutosEntre(agora, d) } : null;
    })
    .filter((c): c is { a: AtividadeParaAlerta; faltam: number } => c !== null)
    .filter((c) => c.faltam >= -TOLERANCIA_DEPOIS_MIN)
    .sort((x, y) => x.faltam - y.faltam);

  return candidatos[0]?.a ?? null;
}
