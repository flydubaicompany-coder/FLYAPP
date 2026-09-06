import { useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AssistSheet } from '@/navigation';
import { ASSUNTOS, type AssuntoDeSuporte } from './whatsapp';
import { TripChrome } from './TripChrome';
import { emModoViagem } from './modo';
import { useSuporteFly } from './useSuporteFly';

/**
 * A casca do Trip Mode, na raiz — e não dentro de `(tabs)`.
 *
 * No desenho a barra aparece em **todas** as telas: Roteiro, Voo, Documentos,
 * Galeria. No app essas telas são rotas empilhadas, fora do grupo de abas —
 * dentro de `(tabs)` a barra simplesmente não existiria nelas.
 *
 * Subir a casca para a raiz resolve sem mover nenhum arquivo de rota. Ela lê o
 * caminho e decide sozinha o que está ativo, o que também conserta um detalhe
 * que o mapeamento por aba errava: em `/viagem/roteiro`, a aba é "viagem" mas
 * o destino aceso tem de ser "Roteiro".
 *
 * Some nas telas onde ela atrapalha: login, convite, onboarding e nas modais.
 */

type Destino = 'home' | 'roteiro' | 'viagem' | 'carteira' | 'perfil';

/** Onde a barra não aparece. Fora do modo viagem, nada disto roda. */
const SEM_CASCA = ['/entrar', '/convite', '/onboarding', '/carrinho', '/assist', '/health'];

function destinoDoCaminho(caminho: string): Destino {
  if (caminho === '/' || caminho === '/index') return 'home';
  if (caminho.startsWith('/viagem/roteiro')) return 'roteiro';
  if (caminho.startsWith('/carteira')) return 'carteira';
  if (caminho.startsWith('/perfil')) return 'perfil';
  if (caminho.startsWith('/viagem')) return 'viagem';
  // Galeria, documentos, passeios e experiências não são destinos da barra.
  // Ficam sem seleção — melhor do que acender o destino errado.
  return 'home';
}

const CAMINHO: Record<Destino, string> = {
  home: '/',
  roteiro: '/viagem/roteiro',
  viagem: '/viagem',
  carteira: '/carteira',
  perfil: '/perfil',
};

export function CascaDaViagem() {
  const caminho = usePathname();
  const roteador = useRouter();
  const suporte = useSuporteFly();
  const [folhaAberta, setFolhaAberta] = useState(false);

  if (!emModoViagem()) return null;
  if (SEM_CASCA.some((p) => caminho.startsWith(p))) return null;

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
      pointerEvents="box-none"
    >
      <TripChrome
        ativo={destinoDoCaminho(caminho)}
        onIr={(destino) => {
          const alvo = CAMINHO[destino];
          // As três abas de raiz trocam a tela; Roteiro empilha, porque é o que
          // ela é no app — e voltar dela precisa levar de volta à viagem.
          if (destino === 'roteiro') roteador.push('/viagem/roteiro');
          else roteador.replace(alvo as '/' | '/viagem' | '/carteira' | '/perfil');
        }}
        onAjuda={() => setFolhaAberta(true)}
      />

      <AssistSheet
        visible={folhaAberta}
        onClose={() => setFolhaAberta(false)}
        onChoose={() => setFolhaAberta(false)}
        assuntosDaViagem={ASSUNTOS.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))}
        canalPronto={suporte.pronto}
        onEscolherAssunto={(chave) => {
          void suporte.abrirSuporte(chave as AssuntoDeSuporte);
        }}
      />
    </View>
  );
}
