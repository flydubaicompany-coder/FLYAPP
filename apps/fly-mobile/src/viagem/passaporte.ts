/**
 * Validação do passaporte digitado (§7.5).
 *
 * Módulo puro porque é onde os erros de digitação são pegos — e digitação é
 * exatamente o que este fluxo tem de frágil. Não há foto do documento nem OCR:
 * o que a Fly recebe é o que a pessoa escreveu, e um dígito trocado no número
 * vira passagem emitida com documento inválido.
 *
 * Nada aqui valida se o passaporte **existe**. Isso é conferência humana, e a
 * coluna `verified_at` é quem carrega esse fato.
 */

export interface DadosDoPassaporte {
  nomeCompleto: string;
  numero: string;
  paisEmissor: string;
  nacionalidade: string;
  nascimento: string;
  emissao: string;
  validade: string;
}

export type CampoDoPassaporte = keyof DadosDoPassaporte;

export type Erros = Partial<Record<CampoDoPassaporte, string>>;

/**
 * Normaliza o número como o banco normaliza.
 *
 * A mesma regra existe num gatilho do Postgres. Duplicar não é descuido: sem
 * ela aqui, a pessoa digita "AB 123 456", vê "AB 123 456" na tela e recebe um
 * erro de duplicata que não explica nada — porque no banco já era "AB123456".
 */
export function normalizarNumero(bruto: string): string {
  return bruto.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Data no formato dd/mm/aaaa vira ISO. Devolve `null` se não for data. */
export function paraIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;

  const [, dia, mes, ano] = m;
  const iso = `${ano}-${mes}-${dia}`;

  // `new Date('2026-02-31')` não lança — vira 3 de março. A volta ao texto é
  // o que pega dia inválido.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === iso ? iso : null;
}

export function deIso(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Código de país de três letras. */
function paisValido(v: string): boolean {
  return /^[A-Za-z]{3}$/.test(v.trim());
}

export function validar(d: DadosDoPassaporte, hoje: Date = new Date()): Erros {
  const erros: Erros = {};

  if (d.nomeCompleto.trim().length < 3) {
    erros.nomeCompleto = 'Escreva o nome exatamente como está no passaporte.';
  }

  const numero = normalizarNumero(d.numero);
  if (numero.length < 5) {
    erros.numero = 'O número parece curto demais. Confira no documento.';
  }

  if (!paisValido(d.paisEmissor)) {
    erros.paisEmissor = 'Use a sigla de três letras. Brasil é BRA.';
  }

  if (d.nacionalidade.trim() && !paisValido(d.nacionalidade)) {
    erros.nacionalidade = 'Use a sigla de três letras, ou deixe em branco.';
  }

  const validade = paraIso(d.validade);
  if (!validade) {
    erros.validade = 'Data no formato dd/mm/aaaa.';
  } else if (new Date(`${validade}T00:00:00Z`) <= hoje) {
    // Vencido não é "quase certo": é o erro que faz alguém chegar no balcão e
    // descobrir que não viaja.
    erros.validade = 'Este passaporte já venceu.';
  }

  if (d.emissao.trim()) {
    const emissao = paraIso(d.emissao);
    if (!emissao) {
      erros.emissao = 'Data no formato dd/mm/aaaa.';
    } else if (validade && emissao >= validade) {
      erros.emissao = 'A emissão tem que ser anterior à validade.';
    }
  }

  if (d.nascimento.trim()) {
    const nascimento = paraIso(d.nascimento);
    if (!nascimento) {
      erros.nascimento = 'Data no formato dd/mm/aaaa.';
    } else if (new Date(`${nascimento}T00:00:00Z`) >= hoje) {
      erros.nascimento = 'A data de nascimento não pode ser no futuro.';
    }
  }

  return erros;
}

export function estaValido(erros: Erros): boolean {
  return Object.keys(erros).length === 0;
}

/**
 * Quanto tempo o passaporte ainda cobre depois do fim da viagem.
 *
 * Devolve o número de dias, sem julgar. A regra dos seis meses varia por
 * destino e nacionalidade — a §33 proíbe a Fly afirmar ao cliente uma regra
 * que não confirmou, e por isso o limite vive em `app_config`, marcado como
 * pendente. O que o app afirma sozinho é aritmética: vence antes do fim.
 */
export function folgaEmDias(validadeIso: string, fimDaViagemIso: string): number {
  const ms =
    new Date(`${validadeIso}T00:00:00Z`).getTime() -
    new Date(`${fimDaViagemIso}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000);
}
