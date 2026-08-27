import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { AppHeader, Card, Kicker, Screen, Text } from '@/ui';

/**
 * Quem Somos (§9.2 e §37.7).
 *
 * O texto institucional vem de `app_config` no Fly Ops — a §3.8 e clara:
 * "tudo importante vem do painel". Enquanto o conteudo oficial nao e escrito,
 * a tela mostra o que ja e verdade e decisao registrada, sem inventar
 * historia de marca.
 */
export default function SobreScreen() {
  return (
    <Screen withBottomNav={false} testID="screen-sobre">
      <AppHeader kicker="Quem Somos" title="A Fly" />

      <Card>
        <View style={styles.bloco}>
          <Kicker>Promessa</Kicker>
          <Text variant="body" tone="muted">
            Transformar uma viagem em uma experiência guiada, personalizada, segura e memorável.
          </Text>
        </View>
      </Card>

      <View style={styles.secao}>
        <Kicker>Como trabalhamos</Kicker>
        <Card padding={space.lg}>
          <View style={styles.lista}>
            <Text variant="body" tone="muted">
              O próximo passo vem primeiro. O que você precisa fazer agora nunca fica escondido
              atrás de promoção.
            </Text>
            <Text variant="body" tone="muted">
              Tecnologia aumenta o cuidado humano — o app organiza a equipe para que o atendimento
              pareça pessoal, porque é.
            </Text>
            <Text variant="body" tone="muted">
              Privacidade por padrão. Passaporte, localização, saúde e preferências recebem acesso
              mínimo e auditável.
            </Text>
          </View>
        </Card>
      </View>

      <Text variant="body" tone="faint" style={styles.nota}>
        Termos, políticas e o texto institucional completo são publicados pelo Fly Ops.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.md },
  secao: { gap: space.md, marginTop: space.section },
  lista: { gap: space.lg },
  nota: { marginTop: space.section },
});
