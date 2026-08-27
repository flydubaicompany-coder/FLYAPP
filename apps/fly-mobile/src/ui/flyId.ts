/**
 * Apresentacao do Fly ID.
 *
 * Modulo puro, separado do componente: sao funcoes de string, e mante-las
 * dentro de FlyQR.tsx obrigaria o teste a carregar o runtime do React Native
 * so para conferir onde entra um espaco.
 */

/** `TTA7Q4S7HR` vira `TTA7Q 4S7HR` — mais facil de ditar na base. */
export function formatar(value: string): string {
  const meio = Math.ceil(value.length / 2);
  return `${value.slice(0, meio)} ${value.slice(meio)}`;
}

/** Leitor de tela lendo `AB3F` como palavra nao ajuda ninguem na fila. */
export function soletrar(value: string): string {
  return value.split('').join(' ');
}
