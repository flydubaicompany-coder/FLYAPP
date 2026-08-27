/**
 * Qual provedor atende este app, agora.
 *
 * Duas chaves decidem, e as duas vivem no banco — nunca no bundle:
 *
 * - `feature_flags['payments.checkout']` — o interruptor. Desligado, ninguém
 *   cobra nada, e a tela cai no atendimento humano. Nasce desligado.
 * - `app_config['payments.provider']` — qual adapter. Hoje só `sandbox`
 *   existe; `PENDENTE` é o valor honesto enquanto P09 não for decidido.
 *
 * São duas e não uma porque desligar um provedor com problema, sem apagar qual
 * provedor era, é uma operação que se faz às três da manhã.
 *
 * Nome desconhecido cai no desligado, e **não** no sandbox. Um erro de
 * digitação na configuração não pode virar "cobra de mentira em produção".
 */

import { createLogger } from '@fly/config';
import { ProvedorDesligado } from './desligado';
import { ProvedorSandbox, type OpcoesSandbox } from './sandbox';
import type { ProvedorDePagamento } from './tipos';

const logger = createLogger({ service: 'payments' });

export interface ContextoDoProvedor {
  /** `feature_flags['payments.checkout'].is_enabled`. */
  readonly checkoutLigado: boolean;
  /** `app_config['payments.provider']`. */
  readonly provedor: string | null;
  /** Só é usado se o escolhido for o sandbox. */
  readonly sandbox: OpcoesSandbox;
}

export function escolherProvedor(ctx: ContextoDoProvedor): ProvedorDePagamento {
  if (!ctx.checkoutLigado) return new ProvedorDesligado();

  switch (ctx.provedor) {
    case 'sandbox':
      return new ProvedorSandbox(ctx.sandbox);
    case null:
    case 'PENDENTE':
      return new ProvedorDesligado();
    default:
      logger.warn('provedor de pagamento desconhecido; caindo no desligado', {
        provedor: ctx.provedor,
      });
      return new ProvedorDesligado();
  }
}
