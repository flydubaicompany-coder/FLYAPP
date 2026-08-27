/**
 * Quando pedir permissão de push (§38.10).
 *
 * O erro clássico é pedir na primeira abertura, antes de a pessoa saber o que
 * a Fly avisa. A recusa em iOS é definitiva — não há segunda caixa de diálogo,
 * só um caminho pelos Ajustes que ninguém percorre. Uma recusa aqui custa
 * todos os alertas operacionais daquela viagem.
 *
 * Então a regra é: pedir quando houver motivo visível. Ter viagem é motivo.
 * Ter aberto a central de notificações é motivo. Abrir o app pela primeira vez
 * não é.
 */

export type EstadoPermissao = 'indeterminado' | 'concedida' | 'negada';

export interface ContextoPedido {
  permissao: EstadoPermissao;
  /** A pessoa tem viagem confirmada — o motivo mais forte. */
  temViagem: boolean;
  /** Já abriu a central de notificações alguma vez. */
  viuCentral: boolean;
  /** Quantas vezes já foi perguntado nesta instalação. */
  vezesPerguntado: number;
}

export type Pedido =
  | { pedir: true; motivo: 'viagem' | 'central' }
  | { pedir: false; motivo: 'ja_respondeu' | 'sem_contexto' | 'ja_perguntou' };

/**
 * Uma pergunta por instalação.
 *
 * Em iOS, insistir não adianta: o sistema só mostra a caixa uma vez. Em
 * Android, insistir é assédio. O caminho de quem recusou e mudou de ideia é
 * a tela de notificações, que leva aos Ajustes.
 */
export const MAX_PERGUNTAS = 1;

export function devePedir(ctx: ContextoPedido): Pedido {
  if (ctx.permissao !== 'indeterminado') return { pedir: false, motivo: 'ja_respondeu' };
  if (ctx.vezesPerguntado >= MAX_PERGUNTAS) return { pedir: false, motivo: 'ja_perguntou' };
  if (ctx.temViagem) return { pedir: true, motivo: 'viagem' };
  if (ctx.viuCentral) return { pedir: true, motivo: 'central' };
  return { pedir: false, motivo: 'sem_contexto' };
}

/**
 * O que a tela diz antes da caixa do sistema.
 *
 * Texto que explica o que vai chegar, não que implora permissão. A frase
 * muda com o motivo porque "sua viagem" é concreto e "novidades" não é.
 */
export function textoDoPedido(motivo: 'viagem' | 'central'): string {
  return motivo === 'viagem'
    ? 'Para avisar mudança de roteiro, ponto de encontro e horário de voo, a Fly precisa enviar notificações.'
    : 'Ative as notificações para receber os avisos que você escolheu acompanhar.';
}
