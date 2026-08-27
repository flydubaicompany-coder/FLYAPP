/**
 * Moedas aceitas (§6.3).
 *
 * Espelha o domínio `public.currency_code`, que é `char(3)` com `check`. O
 * gerador de tipos não sabe ler um `check` — ele devolve `string` —, então
 * esta lista é a única forma de o TypeScript recusar `'GBP'` antes do banco
 * recusar.
 *
 * A lista é curta de propósito: moeda nova exige decisão registrada e
 * migration, não um literal solto numa tela.
 *
 * Mora aqui, e não no app cliente, porque pedido, pagamento e carteira falam
 * de moeda — e uma união duplicada em três pacotes diverge no dia em que a
 * quarta moeda entrar.
 */

export const MOEDAS = ['BRL', 'AED', 'USD', 'EUR'] as const;

export type Moeda = (typeof MOEDAS)[number];

export function isMoeda(value: string): value is Moeda {
  return (MOEDAS as readonly string[]).includes(value);
}
