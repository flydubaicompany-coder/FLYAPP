/**
 * O interruptor do Trip Mode — release Dubai, setembro de 2026.
 *
 * ## Por que é variável de ambiente, e não feature flag no banco
 *
 * O projeto inteiro prefere `feature_flags`, e com razão: mudar sem redeploy é
 * o que faz a operação não depender de código. Aqui é o contrário de
 * propósito.
 *
 * O Trip Mode muda **a navegação** — quantas abas existem e quais telas o
 * roteador registra. Uma flag de banco faria a barra inferior mudar de forma
 * enquanto a pessoa usa o app, e faria a build de produção carregar as duas
 * versões. O que se quer aqui é um **artefato separado**: um build para a
 * viagem, outro para o produto completo, saindo do mesmo código.
 *
 * Isso também garante o que foi pedido: a produção atual não muda. Sem a
 * variável, este arquivo devolve `false` e o app é exatamente o que era.
 *
 * O **conteúdo** continua vindo do banco: o número do WhatsApp está em
 * `app_config`, e o valor daqui é só a rede de segurança para o dia em que a
 * migration ainda não tiver sido aplicada.
 *
 * ⚠️ Referência estática a cada `process.env.EXPO_PUBLIC_*`. O Metro
 * **substitui no código** durante o bundle; acesso dinâmico não casa com a
 * substituição e o valor some no build de produção. Já custou um deploy.
 */

export interface ConfigDeViagem {
  /** Liga a navegação e as telas do Trip Mode. */
  ativo: boolean;
  /** Rede de segurança do WhatsApp. `app_config` tem precedência. */
  whatsappDeReserva: string | null;
}

export function configDeViagem(): ConfigDeViagem {
  return {
    ativo: process.env.EXPO_PUBLIC_FLY_TRIP_MODE === 'true',
    whatsappDeReserva: process.env.EXPO_PUBLIC_FLY_SUPPORT_WHATSAPP ?? null,
  };
}

/** Atalho para quem só precisa saber se está no modo viagem. */
export function emModoViagem(): boolean {
  return configDeViagem().ativo;
}
