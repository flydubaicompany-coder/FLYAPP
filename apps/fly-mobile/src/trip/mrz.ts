/**
 * A faixa legível por máquina do passaporte (ICAO 9303, TD3).
 *
 * O desenho mostra as duas linhas de `<` no rodapé do cartão — é a assinatura
 * visual de uma página de passaporte, e sem elas o cartão parece um crachá.
 *
 * ## Por que calcular, e não desenhar um texto qualquer
 *
 * A MRZ **não é decoração**: é uma codificação definida, com dígitos
 * verificadores que saem dos próprios dados por uma conta de módulo. Escrever
 * uma linha plausível à mão seria fabricar um documento — e num app onde a
 * tela ao lado é o passaporte de verdade, alguém acabaria fotografando.
 *
 * Aqui ela é **transcrição**: sai do que a pessoa digitou em Perfil →
 * Passaporte, e nada mais. Campo que o projeto não guarda vira `<`, que é o
 * preenchimento que a própria norma define para "não informado" — e não um
 * valor inventado. O sexo é o caso: não há coluna, então vai `<`.
 */

/** Só A-Z e `<`. Acento vira a letra sem acento; o resto vira preenchimento. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '<');
}

/**
 * O dígito verificador da norma: pesos 7, 3, 1 em ciclo, soma módulo 10.
 *
 * `<` vale zero; letra vale a posição no alfabeto mais 10 (A = 10).
 */
export function digitoVerificador(campo: string): number {
  const PESOS = [7, 3, 1];
  let soma = 0;
  for (let i = 0; i < campo.length; i += 1) {
    const c = campo[i] ?? '<';
    const valor = c === '<' ? 0 : c >= '0' && c <= '9' ? Number(c) : c.charCodeAt(0) - 55;
    soma += valor * (PESOS[i % 3] as number);
  }
  return soma % 10;
}

function completar(texto: string, tamanho: number): string {
  return texto.slice(0, tamanho).padEnd(tamanho, '<');
}

/** `YYMMDD` a partir de `YYYY-MM-DD`. Sem data, seis `<`. */
export function dataMrz(iso: string | null): string {
  if (!iso || iso.length < 10) return '<<<<<<';
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

export interface DadosDoPassaporte {
  nomeCompleto: string;
  numero: string;
  paisEmissor: string;
  nacionalidade: string | null;
  nascimento: string | null;
  validade: string;
}

/**
 * As duas linhas de 44 caracteres.
 *
 * O sobrenome é a **última** palavra do nome completo, e os prenomes são o
 * resto. É a convenção que o projeto já usa em outros lugares, e é a única
 * possível com um campo de nome só — a norma quer os dois separados, e o
 * cadastro não os separa.
 */
export function linhasMrz(p: DadosDoPassaporte): [string, string] {
  const partes = normalizar(p.nomeCompleto).split('<').filter(Boolean);
  const sobrenome = partes.length > 1 ? (partes[partes.length - 1] as string) : (partes[0] ?? '');
  const prenomes = partes.length > 1 ? partes.slice(0, -1) : [];

  const nome = completar(`${sobrenome}<<${prenomes.join('<')}`, 39);
  const linha1 = `P<${completar(normalizar(p.paisEmissor), 3)}${nome}`;

  const numero = completar(normalizar(p.numero).replace(/</g, ''), 9);
  const nascimento = dataMrz(p.nascimento);
  const validade = dataMrz(p.validade);
  const nacionalidade = completar(normalizar(p.nacionalidade ?? p.paisEmissor), 3);

  // O sexo fica `<`: o projeto não guarda a informação, e a norma reserva o
  // preenchimento exatamente para isso.
  const opcional = completar('', 14);
  const parcial =
    `${numero}${digitoVerificador(numero)}` +
    nacionalidade +
    `${nascimento}${digitoVerificador(nascimento)}` +
    '<' +
    `${validade}${digitoVerificador(validade)}` +
    opcional;

  const composto = digitoVerificador(
    `${numero}${digitoVerificador(numero)}${nascimento}${digitoVerificador(nascimento)}${validade}${digitoVerificador(validade)}${opcional}`,
  );

  return [
    completar(linha1, 44),
    completar(`${parcial}${digitoVerificador(opcional)}${composto}`, 44),
  ];
}
