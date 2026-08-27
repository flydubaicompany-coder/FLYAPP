/**
 * Ambiente de teste de push (§38.10).
 *
 * A §38 pede push "com ambiente de teste". Sem credenciais de APNs e FCM não
 * há como enviar um push remoto de verdade — e inventar que há seria
 * exatamente o que a §33 proíbe.
 *
 * O que dá para testar hoje, e é a parte que costuma quebrar, é tudo depois
 * da entrega: a notificação local aparece, o toque é capturado, o deep link é
 * validado, o login intercepta e o contexto é retomado. Este módulo exercita
 * esse caminho inteiro com uma notificação **local**, que não depende de
 * servidor nem de credencial.
 *
 * Quando as credenciais existirem, o que muda é só quem entrega: o caminho
 * daqui para a frente já terá sido percorrido.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fly/domain-types';

export interface AvisoDeTeste {
  categoria: string;
  titulo: string;
  corpo: string;
  deepLink: string | null;
}

/**
 * Dispara uma notificação local agora.
 *
 * `data` carrega o mesmo formato que um push real carregaria, para o
 * receptor não precisar saber de onde veio.
 */
export async function dispararLocal(aviso: AvisoDeTeste): Promise<boolean> {
  // Na web não há notificação local pelo módulo nativo. O cenário continua
  // exercitando o resto do caminho — o registro na central acontece igual.
  if (Platform.OS === 'web') return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: aviso.titulo,
      body: aviso.corpo,
      data: {
        deepLink: aviso.deepLink ?? undefined,
        categoria: aviso.categoria,
        teste: true,
      },
    },
    // `null` dispara imediatamente.
    trigger: null,
  });

  return true;
}

/**
 * Grava o aviso também na central, como um push real faria.
 *
 * Um push que aparece na tela de bloqueio e não existe na central de
 * notificações é um aviso que some ao ser dispensado. Os dois caminhos
 * gravam, e testar só um esconde a diferença.
 */
export async function registrarNaCentral(
  db: SupabaseClient<Database>,
  userId: string,
  aviso: AvisoDeTeste,
): Promise<{ ok: boolean; motivo?: string }> {
  const { error } = await db.from('notifications').insert({
    user_id: userId,
    category_key: aviso.categoria,
    title: aviso.titulo,
    body: aviso.corpo,
    deep_link: aviso.deepLink,
  });

  return error ? { ok: false, motivo: error.message } : { ok: true };
}

/** Os casos que valem exercitar, incluindo os que dão errado. */
export const CENARIOS: readonly (AvisoDeTeste & { descricao: string })[] = [
  {
    descricao: 'Alerta operacional — categoria crítica, não silenciável',
    categoria: 'operational',
    titulo: 'Ponto de encontro mudou',
    corpo: 'O grupo sai do lobby, e não da entrada lateral.',
    deepLink: '/viagem',
  },
  {
    descricao: 'Evento novo — abre o detalhe',
    categoria: 'events',
    titulo: 'Legends Dubai Cup',
    corpo: 'As inscrições abriram.',
    deepLink: '/eventos/legends-dubai-cup',
  },
  {
    descricao: 'Sem deep link — deve cair na central, não na Home',
    categoria: 'events',
    titulo: 'Aviso sem contexto',
    corpo: 'Este não aponta para lugar nenhum.',
    deepLink: null,
  },
  {
    descricao: 'Deep link inválido — o app precisa recusar',
    categoria: 'events',
    titulo: 'Destino externo',
    corpo: 'Aponta para fora do app e deve ser bloqueado.',
    deepLink: 'https://exemplo.com/phishing',
  },
];
