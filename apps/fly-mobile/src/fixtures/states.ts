import type { ScreenState } from '@/ui';

/**
 * Fixtures de estado visual (entrega §36.10: "fixtures fora dos componentes").
 *
 * Por que fora: componente que carrega o proprio dado de exemplo acaba
 * embarcando aquele dado no bundle de producao, e o "so pra testar" vira
 * conteudo real na loja. Aqui os dados ficam isolados, tipados e obviamente
 * ficticios.
 *
 * Nada aqui e valor de produto. Preco, horario, disponibilidade e regra sao
 * decisao do dono (§33) e chegam do Fly Ops.
 */

export interface CatalogSample {
  titulo: string;
  descricao: string;
}

export const screenStates = {
  loading: { kind: 'loading' },
  ready: {
    kind: 'ready',
    data: {
      titulo: 'Conteúdo carregado',
      descricao: 'Este é o estado normal, com dados na mão.',
    },
  },
  empty: { kind: 'empty' },
  error: { kind: 'error', error: new Error('Falha de exemplo') },
  offlineSemCache: { kind: 'offline' },
  offlineComCache: {
    kind: 'offline',
    // 12 minutos atras, para exercitar o rotulo "há 12 min".
    lastSyncedAt: new Date(Date.now() - 12 * 60 * 1000),
  },
  permissionDenied: {
    kind: 'permissionDenied',
    what: 'A Fly precisa da sua localização',
    why: 'Para levar a equipe até você quando pedir ajuda. Você pode revogar quando quiser.',
  },
} as const satisfies Record<string, ScreenState<CatalogSample>>;

export type ScreenStateName = keyof typeof screenStates;

export const SCREEN_STATE_NAMES = Object.keys(screenStates) as readonly ScreenStateName[];

/** Estados do botao central, para o catalogo e para os testes. */
export const centralButtonStates = [
  { nome: 'sem viagem ativa', focused: false, hasAlert: false, progress: undefined },
  { nome: 'viagem ativa, 40%', focused: false, hasAlert: false, progress: 0.4 },
  { nome: 'selecionado, 75%', focused: true, hasAlert: false, progress: 0.75 },
  { nome: 'com alteração', focused: false, hasAlert: true, progress: 0.4 },
] as const;

/** Estados do carrinho na coluna flutuante. */
export const cartStates = [0, 1, 3, 12] as const;
