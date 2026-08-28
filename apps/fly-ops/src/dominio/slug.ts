/**
 * Slug de passeio.
 *
 * O slug e o endereco publico do passeio e entra em link compartilhado, entao
 * ele nao pode mudar sozinho depois. Aqui ele so e **sugerido** a partir do
 * titulo: quem cadastra ve o resultado e pode corrigir antes de salvar.
 *
 * O formato segue o mesmo de `destinations.slug`, que o banco ja obriga:
 * comeca com letra, so minusculas, digitos e hifen, de 2 a 64 caracteres.
 */

const FORMATO = /^[a-z][a-z0-9-]{1,63}$/;

/** Tira acento sem depender de tabela: NFD separa a letra do diacritico. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function sugerirSlug(titulo: string): string {
  const base = semAcento(titulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  // Um titulo que comeca com numero produziria slug invalido. O prefixo e
  // explicito para quem cadastra ver e poder trocar.
  if (base && !/^[a-z]/.test(base)) return `p-${base}`.slice(0, 64).replace(/-+$/g, '');
  return base;
}

export function slugValido(slug: string): boolean {
  return FORMATO.test(slug);
}
