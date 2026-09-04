/**
 * Taxonomia de eventos (§38.11).
 *
 * A lista é **fechada**. Analytics com nome de evento livre vira, em seis
 * meses, quarenta variações de "abriu_evento" e nenhuma pergunta respondida.
 * Quem precisa de um evento novo acrescenta aqui, e o compilador cobra o
 * formato das propriedades.
 *
 * As áreas são as que cada fase entregou: Home, eventos e notificações na
 * Fase 3; álbum, Fly Quest e galeria na Fase 9.
 */

import type { HomeState } from './tipos';

/**
 * Propriedades de cada evento.
 *
 * Nada aqui identifica pessoa. Não há `email`, `nome`, `telefone` nem
 * `user_id` — a identidade vive na sessão do coletor, e o §23.1 trata
 * comportamento e identidade como coisas que não se juntam de graça. IDs de
 * conteúdo (evento, categoria) são públicos e ficam.
 */
export interface EventosFly {
  // --- Home (§5) ---------------------------------------------------------
  /** A Home terminou de montar. `estado` é o que o servidor decidiu. */
  home_vista: {
    estado: HomeState;
    /** Quantas seções foram desenhadas de fato. */
    secoes: number;
    /** Quantos cards de "Acontece na Fly" havia. */
    eventos_em_destaque: number;
  };
  /** Alguém tocou numa seção da Home. */
  home_secao_tocada: {
    estado: HomeState;
    secao: string;
    /** Posição na tela, contando de 1. Responde "o que fica abaixo da dobra". */
    posicao: number;
  };

  // --- Acontece na Fly (§5.6) --------------------------------------------
  evento_visto: {
    evento_slug: string;
    categoria: string;
    /** De onde veio: 'home', 'lista' ou 'notificacao'. */
    origem: OrigemEvento;
  };
  evento_cta_tocado: {
    evento_slug: string;
    cta: string;
    /**
     * Como o destino abriu. `fallback` significa que o Fly Cup não estava
     * instalado — é a métrica que justifica ter escrito o fallback.
     */
    resultado: 'deepLink' | 'fallback' | 'externo' | 'sem_destino' | 'falhou';
  };
  evento_interesse_marcado: {
    evento_slug: string;
    marcado: boolean;
  };

  // --- Notificações (§26) ------------------------------------------------
  notificacao_recebida: {
    categoria: string;
    critica: boolean;
    /** App aberto, em segundo plano, ou fechado quando chegou. */
    estado_app: 'ativo' | 'fundo' | 'fechado';
  };
  notificacao_aberta: {
    categoria: string;
    critica: boolean;
    /** Se o toque exigiu login antes de chegar ao destino. */
    exigiu_login: boolean;
    /** Se o destino foi de fato alcançado ao final. */
    contexto_alcancado: boolean;
  };
  notificacao_preferencia_alterada: {
    categoria: string;
    ligada: boolean;
  };
  /**
   * O usuário respondeu ao pedido de permissão de push.
   *
   * Vale medir separado de `notificacao_recebida`: uma recusa alta em uma
   * versão do app é problema de quando se pede, não de o que se envia.
   */
  push_permissao_respondida: {
    concedida: boolean;
    /** Se já havia sido perguntado antes nesta instalação. */
    reperguntado: boolean;
  };

  // --- Experiência: álbum, Fly Quest e galeria (§13, §14.1) --------------
  /**
   * Só o que o banco **não** responde.
   *
   * A tentação aqui era instrumentar conquista de figurinha, Dia Completo e
   * missão concluída. Nenhum dos três entrou, e a razão é a mesma: eles já
   * estão em `sticker_unlocks`, `chapter_completions` e `quest_completions`,
   * com carimbo de hora e origem. Uma segunda cópia em analytics não
   * responderia nada de novo e divergiria da primeira no dia em que um
   * evento se perdesse — e aí haveria duas verdades sobre a mesma conquista.
   *
   * O que sobra é o que só o aparelho sabe: **que a tela foi aberta e com
   * que cara ela estava**.
   *
   * O que **nunca** entra: legenda de foto, caminho de arquivo, anotação de
   * escuta ativa, título de surpresa, nome de quem aparece numa foto. É o
   * critério da §44 — "analytics de experiência sem expor conteúdo privado".
   * E não há evento nenhum de `guest_insights` nem de `surprise_tasks`: medir
   * escuta ativa por analytics seria mandar para fora exatamente o que a
   * §13.4 diz que nem o cliente pode ler.
   */
  album_visto: {
    /** Quantos capítulos já abriram para esta pessoa. */
    capitulos: number;
    figurinhas_conquistadas: number;
    figurinhas_totais: number;
    dias_completos: number;
  };
  /**
   * Um código foi digitado. Inclusive os que não deram em nada.
   *
   * É a métrica que o banco não tem por completo: um código que o dedo errou
   * e nem chegou ao servidor não vira `qr_scans`. Erro repetido aqui é sinal
   * de código impresso ilegível, não de gente distraída.
   */
  codigo_resgatado: {
    /** O que o código entregou, sem dizer qual. */
    resultado: 'figurinha' | 'missao' | 'recusado';
    /** Repetição não é erro: é sinal de código circulando. */
    ja_tinha: boolean;
  };
  galeria_vista: {
    fotos: number;
    /** Em quantas a pessoa está marcada. Contagem, nunca qual. */
    apareco_em: number;
    /**
     * Se ela autorizou o uso da própria imagem. Responde por que a galeria
     * parece vazia sem precisar olhar foto nenhuma.
     */
    autoriza_imagem: boolean | null;
  };
}

export type OrigemEvento = 'home' | 'lista' | 'notificacao' | 'busca';

export type NomeEvento = keyof EventosFly;

/** Todos os nomes, para validar em tempo de execução o que vem de fora. */
export const NOMES_DE_EVENTO = [
  'home_vista',
  'home_secao_tocada',
  'evento_visto',
  'evento_cta_tocado',
  'evento_interesse_marcado',
  'notificacao_recebida',
  'notificacao_aberta',
  'notificacao_preferencia_alterada',
  'push_permissao_respondida',
  'album_visto',
  'codigo_resgatado',
  'galeria_vista',
] as const satisfies readonly NomeEvento[];

/**
 * Garantia em tempo de compilação de que a lista acima cobre a interface.
 *
 * Se alguém acrescentar um evento em `EventosFly` e esquecer de `NOMES_DE_EVENTO`,
 * esta linha para de compilar. É o único jeito de a lista não apodrecer.
 */
type Faltando = Exclude<NomeEvento, (typeof NOMES_DE_EVENTO)[number]>;
const _cobertura: Faltando extends never ? true : never = true;
void _cobertura;
