/**
 * Ligação com o `expo-notifications` (§38.10).
 *
 * Todo o raciocínio de push vive nos módulos puros ao lado. Aqui só se traduz
 * a API do Expo para eles — e é por isso que este arquivo não tem `if` de
 * regra de negócio.
 *
 * O que este arquivo **não** faz: fingir que o push está funcionando. Obter
 * um token real exige um projeto EAS com credenciais de APNs e FCM, que a Fly
 * ainda não tem. Sem elas, `obterToken` devolve `null` com motivo — e a §33
 * proíbe declarar integração pronta sem credencial e homologação. O ambiente
 * de teste em `./teste` existe justamente para que o resto do caminho
 * (recepção, deep link, retomada após login) seja verificável hoje.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { EstadoPermissao } from './permissao';

/**
 * A web não tem push nativo.
 *
 * `getLastNotificationResponseAsync` e os listeners lançam ali — não devolvem
 * vazio, lançam. Como a web é superfície de contingência (§21.1) e o app
 * inteiro roda nela em desenvolvimento, cada função abaixo sai cedo em vez de
 * derrubar a tela. Descobri isso abrindo o app no navegador: a Home carregava
 * e um erro não tratado subia do `usePush`.
 */
const SEM_PUSH_NATIVO = Platform.OS === 'web';

/**
 * Executa algo do `expo-notifications` sem deixar a falha subir.
 *
 * A checagem de plataforma acima cobre o caso conhecido, mas não é suficiente
 * sozinha: o módulo também falha num simulador sem os serviços do Google, num
 * build de desenvolvimento sem o plugin nativo, e em qualquer combinação que
 * ainda não vimos. Push é recurso acessório — nenhuma dessas situações pode
 * derrubar a tela de quem está viajando.
 */
async function tentar<T>(fn: () => Promise<T>, seFalhar: T): Promise<T> {
  if (SEM_PUSH_NATIVO) return seFalhar;
  try {
    return await fn();
  } catch {
    return seFalhar;
  }
}

function tentarSync<T>(fn: () => T, seFalhar: T): T {
  if (SEM_PUSH_NATIVO) return seFalhar;
  try {
    return fn();
  } catch {
    return seFalhar;
  }
}

/**
 * O aviso chega com o app aberto: mostra.
 *
 * O padrão do Expo é engolir a notificação quando o app está em primeiro
 * plano. Para alerta operacional — mudança de ponto de encontro — engolir é
 * o pior comportamento possível.
 */
tentarSync(
  () =>
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    }),
  undefined,
);

function traduzir(status: Notifications.PermissionStatus): EstadoPermissao {
  if (status === 'granted') return 'concedida';
  if (status === 'denied') return 'negada';
  return 'indeterminado';
}

export async function permissaoAtual(): Promise<EstadoPermissao> {
  const status = await tentar(async () => (await Notifications.getPermissionsAsync()).status, null);
  return status ? traduzir(status) : 'indeterminado';
}

export async function pedirPermissao(): Promise<EstadoPermissao> {
  const status = await tentar(
    async () => (await Notifications.requestPermissionsAsync()).status,
    null,
  );
  return status ? traduzir(status) : 'indeterminado';
}

export type ResultadoToken =
  | { ok: true; token: string }
  | { ok: false; motivo: 'sem_permissao' | 'sem_credencial' | 'simulador' | 'web' };

/**
 * O token de push deste aparelho.
 *
 * Cada `motivo` de falha é diferente e merece tratamento diferente na tela —
 * "sem credencial" é problema da Fly, "sem permissão" é escolha da pessoa.
 */
export async function obterToken(): Promise<ResultadoToken> {
  if (Platform.OS === 'web') return { ok: false, motivo: 'web' };

  if ((await permissaoAtual()) !== 'concedida') return { ok: false, motivo: 'sem_permissao' };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

  if (!projectId) return { ok: false, motivo: 'sem_credencial' };

  const token = await tentar(
    async () => (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    null,
  );

  // Simulador de iOS não emite token, e isso não é erro do app.
  return token ? { ok: true, token } : { ok: false, motivo: 'simulador' };
}

/** Payload que a Fly envia dentro de `data`. */
export interface DadosDoPush {
  notificationId?: string;
  deepLink?: string;
  categoria?: string;
}

function extrair(resposta: Notifications.NotificationResponse): DadosDoPush {
  const data = resposta.notification.request.content.data;
  return typeof data === 'object' && data !== null ? (data as DadosDoPush) : {};
}

/** Avisa quando alguém tocar numa notificação. Devolve a função de desinscrever. */
export function aoTocar(callback: (dados: DadosDoPush) => void): () => void {
  return tentarSync(
    () => {
      const sub = Notifications.addNotificationResponseReceivedListener((r) =>
        callback(extrair(r)),
      );
      return () => sub.remove();
    },
    () => undefined,
  );
}

/** Avisa quando uma notificação chegar com o app aberto. */
export function aoReceber(callback: (dados: DadosDoPush) => void): () => void {
  return tentarSync(
    () => {
      const sub = Notifications.addNotificationReceivedListener((n) => {
        const data = n.request.content.data;
        callback(typeof data === 'object' && data !== null ? (data as DadosDoPush) : {});
      });
      return () => sub.remove();
    },
    () => undefined,
  );
}

/**
 * O toque que abriu o app do zero.
 *
 * Este é o caso que os listeners não cobrem: quando o app estava fechado, a
 * resposta já aconteceu antes de qualquer listener existir.
 */
export async function tocouParaAbrir(): Promise<DadosDoPush | null> {
  const r = await tentar(() => Notifications.getLastNotificationResponseAsync(), null);
  return r ? extrair(r) : null;
}
