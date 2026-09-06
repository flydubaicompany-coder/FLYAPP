import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { palette } from '@/theme';
import { SessionProvider } from '@/auth/session';
import { AnalyticsProvider } from '@/analytics/provider';
import { usePush } from '@/push/usePush';
import { CascaDaViagem } from '@/trip/CascaDaViagem';

/**
 * Raiz. As cinco abas vivem em `(tabs)`; rotas empilhadas — carrinho, Fly
 * Assist, catalogo, health — ficam por cima delas.
 *
 * `userInterfaceStyle` no app.json ja fixa tema escuro. O Fly nao tem tema
 * claro: o design e preto e grafite por decisao de marca, nao por preferencia
 * de sistema.
 */

/**
 * Serviços que precisam existir enquanto o app estiver aberto, e que dependem
 * da sessão.
 *
 * `usePush` fica aqui, e não numa tela, porque um toque em notificação pode
 * chegar com qualquer tela em foco — inclusive nenhuma, quando o toque é o que
 * abre o app. Não desenha nada.
 */
function ServicosDoApp() {
  usePush();
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <AnalyticsProvider>
          <ServicosDoApp />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="carrinho" options={{ presentation: 'modal' }} />
            <Stack.Screen name="entrar" options={{ presentation: 'modal' }} />
            <Stack.Screen name="assist/[choice]" options={{ presentation: 'modal' }} />
          </Stack>

          {/* A casca do Trip Mode fica FORA do Stack, sobre ele: no desenho a
              barra aparece em todas as telas, e varias delas sao rotas
              empilhadas. Dentro de `(tabs)` ela nao existiria ali. Fora do
              modo viagem este componente devolve null. */}
          <CascaDaViagem />
        </AnalyticsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
