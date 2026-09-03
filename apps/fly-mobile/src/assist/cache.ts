/**
 * O mínimo que precisa sobreviver a uma queda de conexão (§43, entrega 12).
 *
 * "Ligação funciona sem chat" é critério da §43, e uma ligação sem número não
 * funciona. Então o número de emergência, o aviso da §12.4 e os telefones das
 * Bases Fly ficam salvos no aparelho, e a tela de ajuda continua servindo
 * offline — sem thread, mas com o que se disca.
 *
 * **Só isso.** Nada de conversa, nada de localização: mensagem e localização
 * não entram em cache pela mesma razão que não entram em analytics (§43).
 *
 * Puro de propósito: quem grava é o hook, que já é impuro. Aqui só se
 * serializa e se lê — e ler é onde mora o risco, porque o que volta do
 * armazenamento pode ser de uma versão antiga do app.
 */

export interface BaseSalva {
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

export interface ContatosSalvos {
  /** Número de emergência pública do país. */
  emergencia: string | null;
  /** O aviso de que o SOS não substitui emergência pública (§12.4). */
  aviso: string | null;
  bases: BaseSalva[];
  salvoEm: string;
}

export const CHAVE_CONTATOS = 'fly.assist.contatos';

export function serializarContatos(c: ContatosSalvos): string {
  return JSON.stringify(c);
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

/** Devolve `null` para qualquer coisa que não seja exatamente o que se espera. */
export function lerContatos(bruto: string | null): ContatosSalvos | null {
  if (bruto === null || bruto === '') return null;

  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return null;
  }

  if (json === null || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;

  const salvoEm = texto(o['salvoEm']);
  if (salvoEm === null) return null;

  const bases: BaseSalva[] = Array.isArray(o['bases'])
    ? (o['bases'] as unknown[])
        .filter((b): b is Record<string, unknown> => b !== null && typeof b === 'object')
        .map((b) => ({
          nome: texto(b['nome']) ?? 'Base Fly',
          telefone: texto(b['telefone']),
          endereco: texto(b['endereco']),
        }))
    : [];

  const contatos: ContatosSalvos = {
    emergencia: texto(o['emergencia']),
    aviso: texto(o['aviso']),
    bases,
    salvoEm,
  };

  // Guardar um cache que não ajuda em nada é pior do que não guardar: a tela
  // diria "salvo" e não teria o que discar.
  if (contatos.emergencia === null && contatos.bases.every((b) => b.telefone === null)) {
    return null;
  }
  return contatos;
}
