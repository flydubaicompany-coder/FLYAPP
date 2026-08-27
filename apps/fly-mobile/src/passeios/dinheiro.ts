/**
 * Dinheiro (§6.3 e §6.5).
 *
 * Três regras, e todas existem porque a alternativa dá errado em produção:
 *
 * 1. **Centavos inteiros.** `0.1 + 0.2` não é `0.3` em ponto flutuante, e um
 *    total que erra um centavo é uma conciliação que não fecha.
 * 2. **A moeda anda junto.** Um número sem moeda é um número que alguém vai
 *    somar com outro de moeda diferente.
 * 3. **Não se converte.** A §33 proíbe inventar câmbio. Somar BRL com AED aqui
 *    devolve erro, não um total.
 */

import { type Moeda } from '@fly/domain-types';

// Reexportada para as telas continuarem importando dinheiro e moeda do mesmo
// lugar. A definicao mora em @fly/domain-types porque pagamento e carteira
// tambem falam de moeda.
export type { Moeda };

export interface Dinheiro {
  centavos: number;
  moeda: Moeda;
}

/** Locale de cada moeda, para o `Intl` formatar como se lê no lugar. */
const LOCALE: Record<Moeda, string> = {
  BRL: 'pt-BR',
  AED: 'ar-AE',
  USD: 'en-US',
  EUR: 'de-DE',
};

/**
 * Formata para leitura.
 *
 * O app é em português, então o AED sai com o símbolo árabe mas os
 * separadores do Brasil — é o que um brasileiro em Dubai lê sem tropeçar.
 */
export function formatar({ centavos, moeda }: Dinheiro): string {
  try {
    return new Intl.NumberFormat(moeda === 'BRL' ? 'pt-BR' : 'pt-BR', {
      style: 'currency',
      currency: moeda,
      minimumFractionDigits: 2,
    }).format(centavos / 100);
  } catch {
    // Ambiente sem a moeda no ICU: melhor mostrar o código do que quebrar.
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
}

/** Só o número, sem símbolo. Para quando a moeda já está dita ao lado. */
export function formatarValor({ centavos, moeda }: Dinheiro): string {
  return new Intl.NumberFormat(LOCALE[moeda] ?? 'pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

export type ResultadoSoma =
  { ok: true; total: Dinheiro } | { ok: false; motivo: 'moedas_diferentes'; moedas: Moeda[] };

/**
 * Soma, recusando moedas diferentes.
 *
 * Devolver erro em vez de converter é a decisão inteira: converter exigiria
 * uma taxa, e a taxa que o app inventasse seria diferente da que o cliente
 * paga no cartão. A tela pede para dividir a compra.
 */
export function somar(valores: readonly Dinheiro[]): ResultadoSoma {
  if (valores.length === 0) return { ok: true, total: { centavos: 0, moeda: 'BRL' } };

  const moedas = [...new Set(valores.map((v) => v.moeda))];
  if (moedas.length > 1) return { ok: false, motivo: 'moedas_diferentes', moedas };

  return {
    ok: true,
    total: {
      centavos: valores.reduce((s, v) => s + v.centavos, 0),
      moeda: moedas[0] as Moeda,
    },
  };
}

/**
 * Preço de uma linha.
 *
 * `cobrePessoas > 1` significa que o preço é do grupo inteiro — um privativo
 * de quatro custa por barco, não por cabeça. A mesma conta existe no servidor,
 * em `criar_pedido()`, e é ela que vale: esta aqui é para a tela mostrar o
 * total antes de o pedido existir.
 */
export function totalDaLinha(precoUnitario: Dinheiro, pessoas: number, cobrePessoas = 1): Dinheiro {
  return {
    centavos: cobrePessoas > 1 ? precoUnitario.centavos : precoUnitario.centavos * pessoas,
    moeda: precoUnitario.moeda,
  };
}

/** Desconto percentual, arredondando para baixo como o servidor faz. */
export function descontoPercentual(valor: Dinheiro, percentual: number): Dinheiro {
  return {
    // Divisão inteira, igual ao `(v_subtotal * pct) / 100` do Postgres. Se
    // arredondassem diferente, a tela mostraria um total e o servidor cobraria
    // outro — por um centavo, que é o suficiente para o cliente perder a
    // confiança.
    centavos: Math.floor((valor.centavos * percentual) / 100),
    moeda: valor.moeda,
  };
}

export function subtrair(a: Dinheiro, b: Dinheiro): ResultadoSoma {
  if (a.moeda !== b.moeda) {
    return { ok: false, motivo: 'moedas_diferentes', moedas: [a.moeda, b.moeda] };
  }
  return { ok: true, total: { centavos: a.centavos - b.centavos, moeda: a.moeda } };
}

/** Quanto tempo resta de uma reserva, em texto curto. */
export function tempoRestante(expiraEm: string, agora: Date = new Date()): string | null {
  const ms = new Date(expiraEm).getTime() - agora.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return null;

  const min = Math.floor(ms / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${min}:${String(seg).padStart(2, '0')}`;
}

export function reservaExpirou(expiraEm: string, agora: Date = new Date()): boolean {
  return new Date(expiraEm).getTime() <= agora.getTime();
}
