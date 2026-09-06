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
  tabsFor,
} from '@/navigation';
import { ASSUNTOS, emModoViagem, useSuporteFly, type AssuntoDeSuporte } from '@/trip';

/**
 * Casca das abas (spec §4).
 *
 * A barra do react-navigation e substituida por `BottomNav` porque o botao
 * central precisa se projetar **acima** da barra — algo que a tabBar padrao
 * nao permite sem gambiarra de margem negativa.
 *
 * A coluna flutuante e a folha do Fly Assist vivem aqui, e nao em cada tela,
 * porque a §4.2 exige que o Fly Assist permaneca acessivel nas telas criticas.
 *
 * ## Trip Mode
 *
 * No release da viagem a barra tem quatro destinos em vez de cinco, e o botao
 * flutuante de ajuda abre o WhatsApp da operacao com a mensagem pronta. As
 * telas de Passeios e Carteira **continuam registradas** — some a aba, nao a
 * tela: `href: null` tira da barra do Expo Router sem tirar a rota, e um deep
 * link para `/passeios` continua abrindo.
 */

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const activeRoute = routeFromPathname(pathname);

  const modoViagem = emModoViagem();
  const abas = tabsFor(modoViagem);
  const suporte = useSuporteFly();

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
        <Tabs.Screen
          name="passeios"
          options={{ title: 'Passeios', ...(modoViagem ? { href: null } : {}) }}
        />
        <Tabs.Screen name="viagem" options={{ title: 'Minha Viagem' }} />
        <Tabs.Screen
          name="carteira"
          options={{ title: 'Carteira', ...(modoViagem ? { href: null } : {}) }}
        />
        <Tabs.Screen
          name="galeria"
          options={{ title: 'Galeria', ...(modoViagem ? {} : { href: null }) }}
        />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      </Tabs>

      {/* No Trip Mode a casca e desenhada na raiz (`CascaDaViagem`), porque a
          barra do desenho aparece tambem nas rotas empilhadas. Aqui fica so a
          do produto completo. */}
      {modoViagem ? null : (
        <>
          <FloatingActionRail
            cartCount={cartCount}
            showCart={shouldShowCart(activeRoute)}
            onOpenCart={() => router.push('/carrinho')}
            onOpenAssist={() => setAssistOpen(true)}
          />

          <BottomNav
            activeRoute={activeRoute}
            tabs={abas}
            onNavigate={(route) => router.replace(pathForRoute(route))}
            tripHasAlert={tripHasAlert}
            tripProgress={tripProgress}
          />
        </>
      )}

      <AssistSheet
        visible={assistOpen}
        onClose={closeAssist}
        sosConfirming={sosConfirming}
        onRequestSosConfirm={() => setSosConfirming(true)}
        onChoose={(choice) => {
          closeAssist();
          router.push(`/assist/${choice}`);
        }}
        {...(modoViagem
          ? {
              assuntosDaViagem: ASSUNTOS.map((a) => ({ chave: a.chave, rotulo: a.rotulo })),
              canalPronto: suporte.pronto,
              onEscolherAssunto: (chave: string) => {
                void suporte.abrirSuporte(chave as AssuntoDeSuporte);
              },
            }
          : {})}
      />
    </View>
  );
}
