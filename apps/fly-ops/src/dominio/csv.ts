/**
 * CSV de exportação (§46, entrega 11).
 *
 * Estava escrito duas vezes — em Auditoria e em Relatórios — e as duas cópias
 * já divergiam no tratamento do nulo. Exportação é o formato que sai do
 * produto e entra na planilha de outra pessoa; duas versões dele é uma a mais.
 *
 * Tudo entre aspas, sempre. Não é preguiça de decidir quando precisa: nome de
 * cliente com vírgula é comum, endereço com aspas acontece, e observação com
 * quebra de linha é o caso que quebra o arquivo inteiro sem avisar — a
 * planilha simplesmente lê uma linha a mais e ninguém repara.
 */

/** Uma célula. Aspas dobram; `null` e `undefined` viram vazio, e não "null". */
export function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return '""';
  const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * As colunas saem da **primeira** linha.
 *
 * Vale porque toda origem aqui é uma consulta: as linhas têm o mesmo formato
 * por construção. Se um dia não tiverem, a coluna que falta sai vazia em vez
 * de deslocar o arquivo — é o que `celula(undefined)` garante.
 */
export function paraCsv(linhas: readonly Record<string, unknown>[]): string {
  const primeira = linhas[0];
  if (primeira === undefined) return '';
  const colunas = Object.keys(primeira);
  return [
    colunas.map(celula).join(','),
    ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(',')),
  ].join('\n');
}
