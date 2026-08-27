/**
 * O push, ligado ao app (§38.10).
 *
 * Este hook faz três coisas e nada mais:
 *
 * 1. registra o aparelho e o token quando há sessão e permissão;
 * 2. encaminha o toque numa notificação para `decidir()`;
 * 3. trata o caso do app aberto **pelo** toque, que os listeners não pegam.
 *
 * A decisão de para onde ir não está aqui — está em `./destino`, que é puro e
 * testado. Este arquivo só executa o que aquele decidiu.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { aoReceber, aoTocar, obterToken, permissaoAtual, tocouParaAbrir } from './adapter';
import { decidir, guardarPendente, type Aviso } from './destino';
import { registrarToken } from './registro';
import type { EstadoPermissao } from './permissao';

export interface EstadoPush {
  permissao: EstadoPermissao;
  /** Token registrado no servidor. `null` enquanto não houver credencial. */
  registrado: boolean;
  /** Por que não há token, quando não há. Aparece na tela de notificações. */
  motivo: string | null;
}

function paraAviso(dados: {
  notificationId?: string;
  deepLink?: string;
  categoria?: string;
}): Aviso {
  return {
    id: dados.notificationId ?? '',
    deepLink: dados.deepLink ?? null,
    categoria: dados.categoria ?? 'events',
    critica: dados.categoria === 'operational',
  };
}

export function usePush(): EstadoPush {
  const router = useRouter();
  const { state } = useSession();
  const [estado, setEstado] = useState<EstadoPush>({
    permissao: 'indeterminado',
    registrado: false,
    motivo: null,
  });

  const autenticado = state.kind === 'signedIn';
  const userId = autenticado ? state.profile.id : null;

  /** Executa a decisão de `./destino`. */
  const tratarToque = useCallback(
    (dados: { notificationId?: string; deepLink?: string; categoria?: string }) => {
      const d = decidir(paraAviso(dados), autenticado);

      if (d.acao === 'navegar') {
        router.push(d.rota as never);
        return;
      }

      if (d.acao === 'pedirLogin') {
        guardarPendente(d.retomar);
        router.push('/entrar');
        return;
      }

      router.push('/notificacoes');
    },
    [autenticado, router],
  );

  // O toque que abriu o app do zero. Roda uma vez: `getLastNotificationResponse`
  // continua devolvendo a mesma resposta enquanto o app viver, e sem esta
  // trava o app renavegaria a cada render.
  const jaTratouAbertura = useRef(false);
  useEffect(() => {
    if (jaTratouAbertura.current) return;
    jaTratouAbertura.current = true;

    void tocouParaAbrir().then((dados) => {
      if (dados) tratarToque(dados);
    });
  }, [tratarToque]);

  // Toque com o app já rodando.
  useEffect(() => aoTocar(tratarToque), [tratarToque]);

  // Chegada com o app aberto: não navega, só deixa o handler mostrar o banner.
  useEffect(() => aoReceber(() => undefined), []);

  // Registro do token.
  useEffect(() => {
    let vivo = true;

    void (async () => {
      const permissao = await permissaoAtual();
      if (!vivo) return;

      if (!userId || permissao !== 'concedida') {
        setEstado({ permissao, registrado: false, motivo: null });
        return;
      }

      const token = await obterToken();
      if (!vivo) return;

      if (!token.ok) {
        setEstado({ permissao, registrado: false, motivo: token.motivo });
        return;
      }

      const r = await registrarToken(supabase(), userId, token.token, {
        appVersion: Application.nativeApplicationVersion ?? null,
        model: null,
      });
      if (!vivo) return;

      setEstado({
        permissao,
        registrado: r.ok,
        motivo: r.ok ? null : r.motivo,
      });
    })();

    return () => {
      vivo = false;
    };
  }, [userId]);

  return estado;
}
