/**
 * Barreira de dado pessoal (§23.1 e §38.11).
 *
 * A taxonomia é tipada, mas tipo não impede alguém de passar o e-mail do
 * cliente dentro de um campo `origem: string`. Esta barreira olha o **valor**,
 * não só o nome do campo, e é a última coisa que roda antes do envio.
 *
 * Ela redige em vez de lançar erro. Analytics que derruba o app em produção
 * é pior que analytics que perde um campo — mas a contagem de redações fica
 * exposta, para que um teste, e não a sorte, garanta que a barreira funciona.
 */

import { redact } from '@fly/config';

/** E-mail. Deliberadamente frouxo: aqui, falso positivo é barato. */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * UUID.
 *
 * Todo identificador da taxonomia é slug ou chave curta, de propósito. Um
 * UUID aparecendo numa propriedade é, quase sempre, um `user_id` que escapou.
 */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/**
 * Sequência longa de dígitos: telefone, CPF, passaporte, cartão.
 *
 * O piso de 8 dígitos deixa passar ano, contagem e preço em centavos, que são
 * legítimos, e pega telefone (10+) e documento.
 */
const DIGITOS_LONGOS = /\d[\d\s.\-()]{7,}/;

/** JWT ou token opaco longo. */
const TOKEN = /\b[A-Za-z0-9_-]{32,}\b/;

const PADROES: readonly [RegExp, string][] = [
  [EMAIL, 'email'],
  [UUID, 'uuid'],
  [TOKEN, 'token'],
  [DIGITOS_LONGOS, 'digitos'],
];

export const REDIGIDO = '[pii]';

export interface ResultadoLimpeza {
  props: Record<string, unknown>;
  /** Quantos valores foram redigidos. Zero é o esperado em código correto. */
  redacoes: number;
  /** Que padrões dispararam, para o aviso em desenvolvimento ser útil. */
  motivos: readonly string[];
}

function suspeito(texto: string): string | null {
  for (const [padrao, motivo] of PADROES) {
    if (padrao.test(texto)) return motivo;
  }
  return null;
}

/**
 * Limpa as propriedades de um evento.
 *
 * Duas passadas: primeiro a redação por nome de campo do `@fly/config`, que
 * já conhece `password`, `token`, `passaporte` e companhia; depois a inspeção
 * de valor, que pega o que passou com nome inocente.
 */
export function limpar(props: Record<string, unknown>): ResultadoLimpeza {
  const porNome = redact(props) as Record<string, unknown>;

  const limpo: Record<string, unknown> = {};
  const motivos: string[] = [];

  for (const [chave, valor] of Object.entries(porNome)) {
    if (typeof valor === 'string') {
      const motivo = suspeito(valor);
      if (motivo) {
        limpo[chave] = REDIGIDO;
        motivos.push(`${chave}:${motivo}`);
        continue;
      }
    }

    // Objeto aninhado numa propriedade de analytics é quase sempre um registro
    // inteiro que alguém jogou dentro. A taxonomia é plana; achatar aqui
    // esconderia o problema, então o valor sai como tipo e não como conteúdo.
    if (valor !== null && typeof valor === 'object') {
      limpo[chave] = Array.isArray(valor) ? `[array:${valor.length}]` : '[objeto]';
      motivos.push(`${chave}:aninhado`);
      continue;
    }

    limpo[chave] = valor;
  }

  return { props: limpo, redacoes: motivos.length, motivos };
}
