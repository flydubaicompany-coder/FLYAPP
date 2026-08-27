/**
 * Para onde um toque em notificação leva (§38.10 e §22.3).
 *
 * O critério da §38 é exigente e fácil de ler errado:
 *
 *   "notificação abre contexto **ou pede login e retorna ao contexto**"
 *
 * Ou seja: tocar num aviso deslogado não pode terminar na tela de entrada. O
 * destino tem que sobreviver ao login e ser retomado depois. Este módulo é
 * puro justamente por isso — a parte difícil é a decisão, não a navegação, e
 * decisão testável vale mais que uma que só se verifica no aparelho.
 */

/** Rotas para as quais uma notificação pode apontar. */
const PREFIXOS_CONHECIDOS = [
  '/',
  '/passeios',
  '/viagem',
  '/carteira',
  '/perfil',
  '/eventos',
  '/notificacoes',
  '/carrinho',
  '/catalogo',
] as const;

export interface Aviso {
  id: string;
  deepLink: string | null;
  categoria: string;
  critica: boolean;
}

export type Decisao =
  /** Vai direto. */
  | { acao: 'navegar'; rota: string }
  /** Guarda o destino, manda entrar, e retoma depois. */
  | { acao: 'pedirLogin'; retomar: string }
  /** Sem destino útil: abre a central, que sempre existe. */
  | { acao: 'abrirCentral' };

/**
 * Um deep link só é aceito se apontar para dentro do app.
 *
 * Uma notificação é conteúdo que chega de fora. Empurrar `router.push` com
 * uma string arbitrária vinda do servidor — ou de um push forjado — é abrir
 * uma porta de redirecionamento. Só passam as rotas que o app tem.
 */
export function rotaValida(link: string | null): string | null {
  if (!link) return null;
  if (!link.startsWith('/')) return null;
  // `//host` seria interpretado como URL absoluta em algumas plataformas.
  if (link.startsWith('//')) return null;
  if (link.includes('://')) return null;

  const caminho = link.split('?')[0] ?? '';
  const conhecido = PREFIXOS_CONHECIDOS.some(
    (p) => caminho === p || (p !== '/' && caminho.startsWith(`${p}/`)),
  );
  return conhecido ? link : null;
}

/**
 * O que fazer ao tocar num aviso.
 *
 * `autenticado` é o estado no momento do toque — que, num push recebido com o
 * app fechado, é frequentemente "ainda não sei". Quem chama resolve a sessão
 * antes; aqui, não saber é tratado como não estar.
 */
export function decidir(aviso: Aviso, autenticado: boolean): Decisao {
  const rota = rotaValida(aviso.deepLink);

  if (!rota) return { acao: 'abrirCentral' };
  if (autenticado) return { acao: 'navegar', rota };

  return { acao: 'pedirLogin', retomar: rota };
}

/**
 * Destino guardado entre o toque e o fim do login.
 *
 * Fica em memória de propósito. Um destino pendente que sobrevive a um
 * fechamento do app leva alguém a abrir a Fly no dia seguinte e cair, sem
 * contexto, numa tela de detalhe de ontem.
 */
let pendente: string | null = null;

export function guardarPendente(rota: string): void {
  pendente = rotaValida(rota);
}

/** Devolve e limpa. Retomar duas vezes seria navegar duas vezes. */
export function consumirPendente(): string | null {
  const r = pendente;
  pendente = null;
  return r;
}

export function temPendente(): boolean {
  return pendente !== null;
}

/** Chamado no logout: o destino de outra sessão não pertence à próxima. */
export function limparPendente(): void {
  pendente = null;
}
