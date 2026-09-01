/**
 * O valor digitado da nota, em centavos.
 *
 * Modulo puro, sem React nem Expo: teste nao consegue importar de arquivo que
 * arrasta `expo-image-picker` ou o cliente do Supabase junto. Foi a segunda
 * vez que isso mordeu — a primeira foi `carteira/pacote.ts`.
 *
 * Cada pessoa digita de um jeito, e o teclado do iPhone oferece ponto onde o
 * brasileiro escreve virgula. Errar aqui manda valor errado para a revisao, e
 * ninguem confere o que o app entendeu — so o que a pessoa escreveu.
 */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '');
  if (!limpo) return null;
  // O ultimo separador e o decimal; ponto seguido de tres digitos e milhar.
  const normalizado = limpo.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
