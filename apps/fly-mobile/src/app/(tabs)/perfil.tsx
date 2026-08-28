import { useRouter, type Href } from 'expo-router';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';
import { palette } from '@/theme';
import { AppHeader, EmptyState, ErrorState, FlyQR, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { CartaoDePontos } from '@/carteira/CarteiraBlocos';
import { ehPacote } from '@/carteira/pacote';
import { progressoDoSaldo } from '@/carteira/nivel';
import { useCarteira } from '@/carteira/useCarteira';
import {
  BotaoSair,
  CabecalhoDoPerfil,
  CartaoDeIdentidade,
  Divisor,
  Grupo,
  Linha,
  RodapeDaVersao,
  TituloDeSecao,
} from '@/perfil/PerfilBlocos';
import {
  AcompanhantesIcon,
  CadeadoIcon,
  DocumentoIcon,
  EngrenagemIcon,
  EscudoIcon,
  GloboIcon,
  InfoIcon,
  PessoaIcon,
  PulsoIcon,
  QuadradosIcon,
  SinoIcon,
  TelefoneIcon,
  TrofeuIcon,
} from '@/perfil/PerfilIcons';

/**
 * Perfil (§9 e §37.7), na composicao de `docs/design/extracao/06-perfil.html`.
 *
 * O design tem sete linhas; o app tem catorze rotas reais. **As catorze
 * ficaram.** Copiar a contagem do design apagaria consentimento, ranking,
 * acompanhantes e o ambiente interno — funcionalidade entregue nas Fases 2 a
 * 5. O que foi adotado e a *linguagem*: cartao de identidade, grupos de raio
 * 24 com fio recuado 48, titulos de secao em 9/700/+.15em, botao de sair
 * neutro e a assinatura no rodape.
 *
 * Tres coisas do design **nao** foram copiadas, e cada uma por um motivo:
 *
 * 1. **A faixa "FLY STATUS"**, com a barra Standard → Black → Billionaire e
 *    "faltam 8.400 pontos". Ela mistura as duas escalas que a D95 separou
 *    (pacote se compra, nivel de pontos se conquista) e depende da Fase 6,
 *    que nao foi aberta. Nao ha coluna de pacote nem de pontos no banco.
 * 2. **O interruptor de Notificacoes.** As preferencias sao por categoria e ha
 *    um gatilho no banco que proibe desligar as criticas (§26). Um botao
 *    unico de liga/desliga prometeria o que o sistema recusa. A linha leva
 *    para a tela que faz isso de verdade.
 * 3. **O "24h" dourado do Fly Assist.** E uma promessa de nivel de servico, e
 *    a §33 proibe inventar. O Fly Assist ja tem o botao flutuante em todas as
 *    telas — nao precisa de uma linha que afirme horario.
 *
 * O QR do Fly ID nao esta no design, mas e o coracao da Fase 2: e a
 * credencial que o cliente apresenta nas Bases Fly. Ficou, com a mesma
 * linguagem de vidro dos outros blocos.
 */

/** Nome do idioma a partir do codigo guardado no perfil. */
const IDIOMAS: Record<string, string> = {
  pt: 'Português',
  'pt-BR': 'Português',
  'pt-PT': 'Português',
  en: 'English',
  'en-US': 'English',
  'en-GB': 'English',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
};

function nomeDoIdioma(codigo: string): string {
  return IDIOMAS[codigo] ?? codigo;
}

export default function ProfileScreen() {
  const { state, signOut } = useSession();
  const router = useRouter();
  const ir = (href: Href) => () => router.push(href);

  // O Perfil mostra pacote e nivel, e as duas coisas moram na Carteira. E o
  // mesmo cartao de `CarteiraBlocos`, de proposito: duas implementacoes da
  // mesma barra de progresso viram duas contas diferentes com o tempo.
  const carteira = useCarteira(state.kind === 'signedIn' ? state.profile.id : null);

  if (state.kind === 'loading') {
    return (
      <Screen testID="screen-perfil">
        <LoadingSkeleton label="Carregando seu perfil" />
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen testID="screen-perfil">
        <ErrorState title="Não consegui carregar seu perfil" description={state.message} />
      </Screen>
    );
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen testID="screen-perfil">
        <AppHeader kicker="Perfil" title="Entre na sua conta" />
        <EmptyState
          title="A Fly é por convite"
          description="Use o link que a equipe enviou ou entre com a conta que você já ativou."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </Screen>
    );
  }

  const { profile, session } = state;
  // No cartao de identidade vem o nome completo, nao o apelido: e dele que
  // saem as duas iniciais do avatar. O apelido manda na saudacao da Home.
  const nome = profile.displayName ?? profile.preferredName ?? 'Viajante Fly';
  const versao = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null;

  return (
    <Screen bleed testID="screen-perfil">
      <CabecalhoDoPerfil
        titulo="Perfil"
        rotuloAjustes="Segurança da conta"
        aoAbrirAjustes={ir('/perfil/seguranca')}
        icone={<EngrenagemIcon />}
      />

      <CartaoDeIdentidade
        nome={nome}
        contato={session.user.email ?? null}
        pacote={
          carteira.kind === 'ready' && ehPacote(carteira.carteira.pacote)
            ? carteira.carteira.pacote
            : null
        }
      />

      {/* A faixa de Fly Points (D120). O canvas rotula esta barra de
          "Standard/Black/Billionaire", misturando as duas escalas que a D95
          separou — aqui ela e basic → prime → ELITE, que e o que de fato se
          conquista acumulando. O pacote fica no selo acima, na cor dele. */}
      {carteira.kind === 'ready' ? (
        <CartaoDePontos
          saldo={carteira.carteira.saldo}
          progresso={progressoDoSaldo(carteira.carteira.saldo, carteira.carteira.limiares)}
          validadeMeses={carteira.carteira.validadeMeses}
        />
      ) : null}

      <View style={styles.flyId}>
        <Text variant="caption" style={styles.flyIdKicker}>
          FLY ID
        </Text>
        <Text variant="body" style={styles.flyIdNota}>
          Apresente este código nas Bases Fly e nos check-ins.
        </Text>
        <View style={styles.flyIdQr}>
          <FlyQR value={profile.publicId} size={196} />
        </View>
      </View>

      <TituloDeSecao>CONTA</TituloDeSecao>
      <Grupo>
        <Linha
          icone={<PessoaIcon />}
          rotulo="Dados pessoais"
          onPress={ir('/perfil/dados')}
          testID="perfil-dados"
        />
        <Divisor />
        <Linha
          icone={<DocumentoIcon />}
          rotulo="Passaporte e documentos"
          onPress={ir('/perfil/passaporte')}
        />
        <Divisor />
        <Linha
          icone={<AcompanhantesIcon />}
          rotulo="Família e acompanhantes"
          onPress={ir('/perfil/acompanhantes')}
        />
        <Divisor />
        <Linha
          icone={<TelefoneIcon />}
          rotulo="Contato de emergência"
          onPress={ir('/perfil/emergencia')}
        />
      </Grupo>

      <TituloDeSecao>PREFERÊNCIAS</TituloDeSecao>
      <Grupo>
        <Linha
          icone={<EscudoIcon />}
          rotulo="Suas preferências"
          onPress={ir('/perfil/preferencias')}
        />
        <Divisor />
        <Linha icone={<SinoIcon />} rotulo="Notificações" onPress={ir('/notificacoes')} />
        <Divisor />
        <Linha
          icone={<GloboIcon />}
          rotulo="Idioma"
          valor={nomeDoIdioma(profile.locale)}
          onPress={ir('/perfil/dados')}
        />
      </Grupo>

      <TituloDeSecao>PRIVACIDADE E CONTA</TituloDeSecao>
      <Grupo>
        <Linha
          icone={<CadeadoIcon />}
          rotulo="Privacidade e consentimentos"
          onPress={ir('/perfil/privacidade')}
        />
        <Divisor />
        <Linha icone={<TrofeuIcon />} rotulo="Ranking Fly" onPress={ir('/perfil/ranking')} />
        <Divisor />
        <Linha icone={<EscudoIcon />} rotulo="Segurança" onPress={ir('/perfil/seguranca')} />
        <Divisor />
        <Linha icone={<InfoIcon />} rotulo="Quem Somos" onPress={ir('/perfil/sobre')} />
      </Grupo>

      <TituloDeSecao>AMBIENTE INTERNO</TituloDeSecao>
      <Grupo>
        <Linha
          icone={<QuadradosIcon />}
          rotulo="Catálogo de componentes"
          onPress={ir('/catalogo')}
        />
        <Divisor />
        <Linha icone={<SinoIcon />} rotulo="Teste de push" onPress={ir('/perfil/push')} />
        <Divisor />
        <Linha icone={<PulsoIcon />} rotulo="Health do app" onPress={ir('/health')} />
      </Grupo>

      <BotaoSair
        onPress={() => void signOut()}
        nota="Sair encerra a sessão em todos os aparelhos."
      />

      {versao ? <RodapeDaVersao versao={`Fly App ${versao}`} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flyId: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 26,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  flyIdKicker: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.35,
    color: 'rgba(245,245,247,.4)',
  },
  flyIdNota: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: -0.1,
    color: palette.textMuted,
  },
  flyIdQr: { marginTop: 14 },
});
