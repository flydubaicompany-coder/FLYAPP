import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette, space } from '@/theme';
import { Kicker, Text } from './Text';

/**
 * Cabecalho de tela: volta, titulo e um slot a direita.
 *
 * O `kicker` sempre foi o nome da secao de onde a tela veio — "Passeios",
 * "Sua viagem", "Privacidade". Em `docs/design/extracao/03-meus-passeios.html`
 * esse mesmo lugar e uma **volta dourada com chevron**, e nao um rotulo morto.
 *
 * Entao: com `onBack`, o kicker vira essa volta. Mesmo texto, mesmo dourado,
 * mesma posicao — agora tocavel, com area de 44 e o chevron de 19 em traco
 * 2.3 do design. Sem `onBack` ele continua sendo o rotulo de antes, que e o
 * certo para as telas de aba, que nao tem para onde voltar.
 *
 * `accessibilityRole="header"` faz o leitor de tela oferecer navegacao por
 * cabecalho, o que economiza dezenas de toques em telas longas.
 */
export interface AppHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Sino de notificacao, avatar, acao secundaria. */
  trailing?: ReactNode;
  /** Torna o kicker uma volta. Sem ele o kicker e so rotulo. */
  onBack?: (() => void) | undefined;
}

function ChevronVolta() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5l-7 7 7 7"
        stroke={palette.gold}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AppHeader({ kicker, title, subtitle, trailing, onBack }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        {kicker && onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voltar para ${kicker}`}
            onPress={onBack}
            style={styles.voltar}
            testID="cabecalho-voltar"
          >
            <ChevronVolta />
            <Text variant="body" tone="gold" style={styles.voltarTexto}>
              {kicker}
            </Text>
          </Pressable>
        ) : kicker ? (
          <Kicker>{kicker}</Kicker>
        ) : null}

        <Text variant="largeTitle" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    marginBottom: space.xl,
  },
  texts: {
    flex: 1,
    gap: space.sm,
  },
  /* O recuo de 8 devolve o chevron ao alinhamento do titulo: a area de toque
     cresce para fora, e nao para dentro do texto. */
  voltar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 36,
    marginLeft: -8,
    paddingHorizontal: 8,
  },
  voltarTexto: { fontSize: 15, fontWeight: '500', letterSpacing: -0.21 },
  trailing: {
    paddingTop: space.xs,
  },
});
