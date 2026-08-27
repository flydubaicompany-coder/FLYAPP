import { useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';
import { palette } from '@/theme';
import {
  AssistSheet,
  BottomNav,
  FloatingActionRail,
  pathForRoute,
  routeFromPathname,
  shouldShowCart,
} from '@/navigation';

/**
 * Casca das cinco abas (spec §4).
 *
 * A barra do react-navigation e substituida por `BottomNav` porque o botao
 * central precisa se projetar **acima** da barra — algo que a tabBar padrao
 * nao permite sem gambiarra de margem negativa.
 *
 * A coluna flutuante e a folha do Fly Assist vivem aqui, e nao em cada tela,
 * porque a §4.2 exige que o Fly Assist permaneca acessivel nas telas criticas.
 */

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const activeRoute = routeFromPathname(pathname);

  const [assistOpen, setAssistOpen] = useState(false);
  const [sosConfirming, setSosConfirming] = useState(false);

  // Fase 1 e casca: carrinho, alerta e progresso ainda nao vem de dado real.
  // Estes valores ficam zerados de proposito — a Fase 4 liga o progresso da
  // viagem e a Fase 5 liga o carrinho.
  const cartCount = 0;
  const tripHasAlert = false;
  const tripProgress = undefined;

  function closeAssist() {
    setAssistOpen(false);
    setSosConfirming(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Tabs
        screenOptions={{ headerShown: false, animation: 'none' }}
        // A barra propria e desenhada abaixo, fora do Tabs, para poder
        // sobrepor o botao central.
        tabBar={() => null}
      >
        <Tabs.Screen name="index" options={{ title: 'Início' }} />
        <Tabs.Screen name="passeios" options={{ title: 'Passeios' }} />
        <Tabs.Screen name="viagem" options={{ title: 'Minha Viagem' }} />
        <Tabs.Screen name="carteira" options={{ title: 'Carteira' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      </Tabs>

      <FloatingActionRail
        cartCount={cartCount}
        showCart={shouldShowCart(activeRoute)}
        onOpenCart={() => router.push('/carrinho')}
        onOpenAssist={() => setAssistOpen(true)}
      />

      <BottomNav
        activeRoute={activeRoute}
        onNavigate={(route) => router.replace(pathForRoute(route))}
        tripHasAlert={tripHasAlert}
        tripProgress={tripProgress}
      />

      <AssistSheet
        visible={assistOpen}
        onClose={closeAssist}
        sosConfirming={sosConfirming}
        onRequestSosConfirm={() => setSosConfirming(true)}
        onChoose={(choice) => {
          closeAssist();
          router.push(`/assist/${choice}`);
        }}
      />
    </View>
  );
}
