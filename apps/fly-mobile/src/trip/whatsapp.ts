/**
 * Suporte e venda por WhatsApp — Trip Mode, Dubai set/2026.
 *
 * O MVP da viagem não constrói chat próprio: a Fase 8 já entregou atendimento
 * com thread, fila e SOS, mas ele **nunca foi visto logado** e a viagem é
 * amanhã. Enquanto isso, o canal que a operação já usa é o WhatsApp, e ele
 * funciona sem depender de nada que este projeto ainda não provou.
 *
 * O valor desta tela não é abrir o WhatsApp — qualquer link faz isso. É abrir
 * **com a mensagem pronta**: quem está perdido às onze da noite não digita
 * "estou na viagem Dubai, atividade Desert Safari". A mensagem carrega o
 * contexto que o app já sabe, e quem atende não precisa perguntar três vezes.
 *
 * Nada aqui inventa contato: o número vem da configuração, e sem ele a tela
 * diz que o canal não está configurado em vez de abrir um link quebrado.
 */

export type AssuntoDeSuporte =
  | 'urgente'
  | 'duvida'
  | 'transporte'
  | 'passeio'
  | 'hotel'
  | 'perdido'
  | 'outro';

export const ASSUNTOS: readonly { chave: AssuntoDeSuporte; rotulo: string }[] = [
  { chave: 'urgente', rotulo: 'Preciso de ajuda urgente' },
  { chave: 'duvida', rotulo: 'Tirar uma dúvida' },
  { chave: 'transporte', rotulo: 'Problema com transporte' },
  { chave: 'passeio', rotulo: 'Problema com passeio' },
  { chave: 'hotel', rotulo: 'Problema no hotel' },
  { chave: 'perdido', rotulo: 'Estou perdido' },
  { chave: 'outro', rotulo: 'Outro assunto' },
];

const ROTULO: Record<AssuntoDeSuporte, string> = Object.fromEntries(
  ASSUNTOS.map((a) => [a.chave, a.rotulo]),
) as Record<AssuntoDeSuporte, string>;

/**
 * Só dígitos, e com país.
 *
 * O `wa.me` recusa espaço, parêntese, traço e o `+`. Um número guardado como
 * "+55 21 98323-8650" abriria uma conversa com ninguém — e o erro apareceria
 * na mão do cliente, não na nossa.
 *
 * Devolve `null` para o que não parece telefone internacional, e é isso que
 * faz a tela dizer "canal não configurado" em vez de abrir um link morto.
 */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const digitos = bruto.replace(/\D/g, '');
  // 10 é o menor nacional com DDD; 15 é o teto do E.164.
  return digitos.length >= 10 && digitos.length <= 15 ? digitos : null;
}

export interface ContextoDaMensagem {
  nome: string | null;
  viagem: string | null;
  /** A atividade de agora, quando o roteiro souber qual é. */
  atividade?: string | null;
  /** Onde a pessoa deveria estar. Ajuda quem atende antes de qualquer pergunta. */
  local?: string | null;
}

/**
 * A mensagem de suporte.
 *
 * Linha vazia entre blocos, e nenhum campo com rótulo sem valor: "Atividade
 * atual: —" ocupa espaço e não diz nada. O que não se sabe simplesmente não
 * entra.
 */
export function mensagemDeSuporte(
  assunto: AssuntoDeSuporte,
  contexto: ContextoDaMensagem,
): string {
  const linhas = ['Olá, equipe Fly.'];

  linhas.push(
    contexto.nome ? `Sou ${contexto.nome}.` : 'Sou participante da viagem.',
  );
  if (contexto.viagem) linhas.push(`Estou participando da ${contexto.viagem}.`);

  linhas.push('', `Preciso de ajuda com: ${ROTULO[assunto]}`);

  if (contexto.atividade) {
    linhas.push(
      contexto.local
        ? `Atividade agora: ${contexto.atividade} — ${contexto.local}`
        : `Atividade agora: ${contexto.atividade}`,
    );
  }

  return linhas.join('\n');
}

/** A mensagem de "quero esta experiência". É venda, e por isso é curta. */
export function mensagemDeExperiencia(
  experiencia: string,
  contexto: Pick<ContextoDaMensagem, 'nome' | 'viagem'>,
): string {
  const linhas = [`Olá Fly, gostaria de reservar a experiência ${experiencia}.`];
  if (contexto.nome) linhas.push(`Sou ${contexto.nome}.`);
  if (contexto.viagem) linhas.push(`Estou na ${contexto.viagem}.`);
  return linhas.join('\n');
}

/**
 * O link.
 *
 * `wa.me` e não `api.whatsapp.com`: é o formato que o próprio WhatsApp
 * documenta para link direto, e o único que abre o aplicativo instalado em vez
 * do navegador no iOS.
 *
 * Devolve `null` quando não há número — quem chama decide o que dizer, e a
 * decisão é sempre a mesma: "o canal ainda não foi configurado".
 */
export function linkDeWhatsapp(telefone: string | null, mensagem: string): string | null {
  const numero = normalizarTelefone(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
