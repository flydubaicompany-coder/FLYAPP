/**
 * Mala Pronta (§30 item 5 e §45, entrega 8).
 *
 * A lista é **derivada**, e este arquivo é a derivação. Ele junta três fontes
 * e devolve uma lista sem repetição:
 *
 *   1. o roteiro — `what_to_bring` e `dress_code` das atividades, que a
 *      operação já preenche desde a Fase 4;
 *   2. os itens que a Fly curou para a viagem ou o destino;
 *   3. o que a própria pessoa acrescentou.
 *
 * **Clima não entra.** Exigiria provedor de meteorologia, e a §33 não deixa
 * declarar integração sem credencial e homologação. A tela diz que a lista vem
 * do roteiro.
 *
 * Puro de propósito.
 */

export type FonteDoItem = 'roteiro' | 'fly' | 'proprio';

export interface ItemDaMala {
  /** Texto normalizado — é a chave, porque item de roteiro não tem id. */
  chave: string;
  rotulo: string;
  fonte: FonteDoItem;
  marcado: boolean;
  /** De qual atividade veio, quando veio do roteiro. */
  de?: string;
}

/**
 * Normaliza o texto do item.
 *
 * Minúsculas, sem acento e sem espaço repetido. "Protetor solar" e "protetor
 * solar" são o mesmo item, e sem isto a lista mostraria os dois — um marcado e
 * outro não.
 */
export function chaveDoItem(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Quebra o `what_to_bring` de uma atividade em itens.
 *
 * A operação escreve texto corrido: "Protetor solar, chapéu e água". Vírgula,
 * ponto e vírgula e quebra de linha separam; " e " **não** separa, porque
 * "camisa e calça de linho" viraria dois itens errados.
 */
export function itensDoTexto(texto: string | null): string[] {
  if (texto === null) return [];
  return texto
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && t.length <= 120);
}

export interface AtividadeComItens {
  titulo: string;
  oQueLevar: string | null;
  trajeSugerido: string | null;
}

export interface Marcacao {
  item: string;
  marcado: boolean;
  proprio: boolean;
}

/**
 * A lista final.
 *
 * Item repetido entre fontes aparece **uma vez**, e fica com a fonte de maior
 * precedência: o que a pessoa acrescentou vence o que a Fly curou, que vence o
 * que veio do roteiro. Sem isso, "passaporte" apareceria três vezes.
 */
export function montarMala(
  atividades: readonly AtividadeComItens[],
  curados: readonly string[],
  marcacoes: readonly Marcacao[],
): ItemDaMala[] {
  const porChave = new Map<string, ItemDaMala>();
  const marcado = new Map(marcacoes.map((m) => [chaveDoItem(m.item), m.marcado]));

  const por = (rotulo: string, fonte: FonteDoItem, de?: string) => {
    const chave = chaveDoItem(rotulo);
    if (chave === '') return;
    const jaTem = porChave.get(chave);
    // Precedência: proprio > fly > roteiro. Quem chega depois só sobrescreve
    // se for de fonte mais forte.
    const peso = { roteiro: 1, fly: 2, proprio: 3 };
    if (jaTem !== undefined && peso[jaTem.fonte] >= peso[fonte]) return;
    porChave.set(chave, {
      chave,
      rotulo: jaTem?.rotulo ?? rotulo,
      fonte,
      marcado: marcado.get(chave) ?? false,
      ...(de === undefined ? {} : { de }),
    });
  };

  for (const a of atividades) {
    for (const item of itensDoTexto(a.oQueLevar)) por(item, 'roteiro', a.titulo);
    for (const item of itensDoTexto(a.trajeSugerido)) por(item, 'roteiro', a.titulo);
  }
  for (const c of curados) por(c, 'fly');
  for (const m of marcacoes) {
    if (m.proprio) por(m.item, 'proprio');
  }

  return [...porChave.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

/** Quantos já foram separados. */
export function progresso(itens: readonly ItemDaMala[]): { feitos: number; total: number } {
  return { feitos: itens.filter((i) => i.marcado).length, total: itens.length };
}
