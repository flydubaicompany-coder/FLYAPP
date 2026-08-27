/**
 * Mapeamento entre caminho e aba.
 *
 * Isolado de componente de proposito: e logica pura, e as cinco abas da §4 sao
 * um contrato que merece teste — nao algo para descobrir clicando.
 */

export type TabRoute = 'index' | 'passeios' | 'viagem' | 'carteira' | 'perfil';

/** Ordem em que as abas aparecem na barra. `viagem` e o botao central. */
export const TAB_ORDER: readonly TabRoute[] = ['index', 'passeios', 'viagem', 'carteira', 'perfil'];

export const CENTRAL_ROUTE: TabRoute = 'viagem';

export const TAB_LABELS: Record<TabRoute, string> = {
  index: 'Início',
  passeios: 'Passeios',
  viagem: 'Minha Viagem',
  carteira: 'Carteira',
  perfil: 'Perfil',
};

const SEGMENT_TO_ROUTE: Record<string, TabRoute> = {
  '': 'index',
  passeios: 'passeios',
  viagem: 'viagem',
  carteira: 'carteira',
  perfil: 'perfil',
};

/**
 * Qual aba um caminho ativa.
 *
 * Cai em `index` para qualquer caminho desconhecido, em vez de deixar a barra
 * sem selecao — um deep link quebrado nao deve produzir uma barra fantasma.
 */
export function routeFromPathname(pathname: string): TabRoute {
  const segment = pathname.split('/').filter(Boolean)[0] ?? '';
  return SEGMENT_TO_ROUTE[segment] ?? 'index';
}

/**
 * Caminho de cada aba, como uniao literal.
 *
 * `string` nao serve: o Expo Router tipa rotas (`typedRoutes`), e devolver
 * `string` desliga justamente a checagem que impede um deep link para uma rota
 * que nao existe.
 */
export type TabPath = '/' | '/passeios' | '/viagem' | '/carteira' | '/perfil';

const PATH_BY_ROUTE: Record<TabRoute, TabPath> = {
  index: '/',
  passeios: '/passeios',
  viagem: '/viagem',
  carteira: '/carteira',
  perfil: '/perfil',
};

/** Caminho de navegacao de uma aba. A raiz e `/`, nao `/index`. */
export function pathForRoute(route: TabRoute): TabPath {
  return PATH_BY_ROUTE[route];
}

/** O carrinho aparece principalmente em Passeios, ofertas e Carteira (§4.2). */
export const ROUTES_WITH_CART: readonly TabRoute[] = ['index', 'passeios', 'carteira'];

export function shouldShowCart(route: TabRoute): boolean {
  return ROUTES_WITH_CART.includes(route);
}
