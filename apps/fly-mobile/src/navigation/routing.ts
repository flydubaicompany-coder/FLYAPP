/**
 * Mapeamento entre caminho e aba.
 *
 * Isolado de componente de proposito: e logica pura, e as cinco abas da §4 sao
 * um contrato que merece teste — nao algo para descobrir clicando.
 */

export type TabRoute = 'index' | 'passeios' | 'viagem' | 'carteira' | 'perfil' | 'galeria';

/** Ordem em que as abas aparecem na barra. `viagem` e o botao central. */
export const TAB_ORDER: readonly TabRoute[] = ['index', 'passeios', 'viagem', 'carteira', 'perfil'];

/**
 * Trip Mode — release Dubai, setembro de 2026.
 *
 * Quatro destinos em vez de cinco. Passeios e Carteira **nao somem do app**:
 * as telas continuam existindo e acessiveis por link, e voltam a ser aba no
 * dia em que o Trip Mode for desligado. O que some da barra e o que nao faz
 * parte desta viagem — barra e promessa, e prometer Carteira sem valor de
 * ponto definido (P45/P46) e prometer o que nao se cumpre.
 *
 * A Galeria sobe para aba porque na viagem ela e destino diario, e nao
 * consequencia de outra tela.
 */
export const TRIP_TAB_ORDER: readonly TabRoute[] = ['index', 'viagem', 'galeria', 'perfil'];

export const CENTRAL_ROUTE: TabRoute = 'viagem';

export const TAB_LABELS: Record<TabRoute, string> = {
  index: 'Início',
  passeios: 'Passeios',
  viagem: 'Minha Viagem',
  carteira: 'Carteira',
  perfil: 'Perfil',
  galeria: 'Galeria',
};

const SEGMENT_TO_ROUTE: Record<string, TabRoute> = {
  '': 'index',
  passeios: 'passeios',
  viagem: 'viagem',
  carteira: 'carteira',
  perfil: 'perfil',
  galeria: 'galeria',
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
export type TabPath = '/' | '/passeios' | '/viagem' | '/carteira' | '/perfil' | '/galeria';

const PATH_BY_ROUTE: Record<TabRoute, TabPath> = {
  index: '/',
  passeios: '/passeios',
  viagem: '/viagem',
  carteira: '/carteira',
  perfil: '/perfil',
  galeria: '/galeria',
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

/**
 * As abas de agora.
 *
 * Uma funcao, e nao duas constantes soltas, para que exista **um** lugar onde
 * a barra decide o que mostrar. Quem escrever a terceira variante amanha nao
 * precisa achar os quatro pontos que leem a lista.
 */
export function tabsFor(tripMode: boolean): readonly TabRoute[] {
  return tripMode ? TRIP_TAB_ORDER : TAB_ORDER;
}

/**
 * Como os destinos se distribuem em volta do botao central.
 *
 * Com cinco abas sao dois de cada lado e o centro no meio — o desenho
 * original. Com quatro, um lado teria dois e o outro um, e o botao central
 * sairia do eixo. A solucao e dar **peso igual aos dois lados**: o lado com um
 * destino ocupa a mesma largura do lado com dois, e o botao continua no
 * centro exato.
 */
export function tabSides(tabs: readonly TabRoute[]): {
  left: readonly TabRoute[];
  right: readonly TabRoute[];
} {
  const semCentro = tabs.filter((t) => t !== CENTRAL_ROUTE);
  const corte = tabs.indexOf(CENTRAL_ROUTE);
  // O centro fica onde a lista o colocou; o que sobra antes vai para a
  // esquerda, o resto para a direita.
  const naEsquerda = corte < 0 ? Math.ceil(semCentro.length / 2) : corte;
  return { left: semCentro.slice(0, naEsquerda), right: semCentro.slice(naEsquerda) };
}
