/**
 * CTAs de evento (§5.6 e §38.8).
 *
 * A §5.6 lista sete CTAs aceitos. O tipo é fechado no banco e aqui — inventar
 * um oitavo seria decidir produto no código.
 *
 * O caso que exige cuidado é "Abrir no Fly Cup": o destino é **outro
 * aplicativo**, que pode não estar instalado. Sem fallback, o toque não faz
 * nada e o cliente conclui que o app está quebrado.
 */

export type CtaKind =
  | 'view_event'
  | 'buy_ticket'
  | 'join_list'
  | 'watch'
  | 'view_results'
  | 'open_fly_cup'
  | 'want_dubai';

export interface EventoCta {
  id: string;
  kind: CtaKind;
  label: string;
  targetUrl: string | null;
}

/** Onde o Fly Cup vive na web, quando o app não está instalado. */
export const FLY_CUP_WEB = 'https://flycup.com.br';

export type Destino =
  | { tipo: 'externo'; url: string }
  | { tipo: 'appExterno'; deepLink: string; fallback: string }
  | { tipo: 'interno'; rota: string }
  | { tipo: 'nenhum' };

/**
 * Para onde um CTA leva.
 *
 * `open_fly_cup` devolve o par deep link + fallback, e não só a URL: quem
 * chama precisa saber que há um segundo caminho a tentar.
 */
export function destinoDe(cta: EventoCta): Destino {
  if (cta.kind === 'open_fly_cup') {
    return {
      tipo: 'appExterno',
      // O Fly Cup registra o scheme `flycup://`. Sem app instalado, o sistema
      // recusa e caímos na web.
      deepLink: cta.targetUrl ?? 'flycup://',
      fallback: cta.targetUrl?.startsWith('http') ? cta.targetUrl : FLY_CUP_WEB,
    };
  }

  if (!cta.targetUrl) return { tipo: 'nenhum' };

  if (cta.targetUrl.startsWith('http://') || cta.targetUrl.startsWith('https://')) {
    return { tipo: 'externo', url: cta.targetUrl };
  }

  if (cta.targetUrl.startsWith('/')) {
    return { tipo: 'interno', rota: cta.targetUrl };
  }

  // Qualquer outro scheme (`fly://`, `mailto:`, `tel:`) sai como externo.
  return { tipo: 'externo', url: cta.targetUrl };
}

export type ResultadoAbertura =
  | { ok: true; via: 'deepLink' | 'fallback' | 'externo' }
  | { ok: false; motivo: 'sem_destino' | 'falhou' };

/**
 * Abre o CTA, tentando o deep link antes do fallback.
 *
 * `abrir` e `podeAbrir` são injetados para o teste não precisar do `Linking`
 * do React Native — e para o comportamento de fallback ser verificável, que é
 * justamente a parte que ninguém testa manualmente porque exige desinstalar
 * um app.
 */
export async function abrirCta(
  cta: EventoCta,
  abrir: (url: string) => Promise<unknown>,
  podeAbrir: (url: string) => Promise<boolean>,
): Promise<ResultadoAbertura> {
  const destino = destinoDe(cta);

  if (destino.tipo === 'nenhum') return { ok: false, motivo: 'sem_destino' };

  if (destino.tipo === 'appExterno') {
    try {
      if (await podeAbrir(destino.deepLink)) {
        await abrir(destino.deepLink);
        return { ok: true, via: 'deepLink' };
      }
    } catch {
      // `canOpenURL` falha em algumas plataformas quando o scheme não está
      // declarado. Isso não é motivo para desistir — é motivo para o fallback.
    }

    try {
      await abrir(destino.fallback);
      return { ok: true, via: 'fallback' };
    } catch {
      return { ok: false, motivo: 'falhou' };
    }
  }

  const url = destino.tipo === 'externo' ? destino.url : destino.rota;
  try {
    await abrir(url);
    return { ok: true, via: 'externo' };
  } catch {
    return { ok: false, motivo: 'falhou' };
  }
}

/** Rótulo padrão de cada CTA, quando o painel não definir um. */
export const ROTULO_PADRAO: Record<CtaKind, string> = {
  view_event: 'Ver evento',
  buy_ticket: 'Comprar ingresso',
  join_list: 'Entrar na lista',
  watch: 'Assistir',
  view_results: 'Ver resultados',
  open_fly_cup: 'Abrir no Fly Cup',
  want_dubai: 'Quero viver isso em Dubai',
};
