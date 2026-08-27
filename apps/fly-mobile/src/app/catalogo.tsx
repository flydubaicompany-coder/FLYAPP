import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  color,
  contrastRatioRounded,
  textContrastUse,
  typography,
  WCAG_AA,
} from '@fly/design-tokens';
import { palette, radius, space, textStyle, touchTarget } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Card,
  Kicker,
  OfflineBanner,
  Screen,
  StateShell,
  Text,
} from '@/ui';
import { CentralTripButton, FloatingActionRail } from '@/navigation';
import {
  cartStates,
  centralButtonStates,
  screenStates,
  SCREEN_STATE_NAMES,
  type ScreenStateName,
} from '@/fixtures/states';

/**
 * Catalogo de componentes (entrega de qualidade da §36).
 *
 * Uma rota do proprio app, e nao Storybook: em React Native, Storybook exige
 * um segundo runtime e um segundo build. Uma rota interna roda no aparelho de
 * verdade, com as safe areas, o texto dinamico e o leitor de tela reais — que
 * e exatamente onde os problemas aparecem.
 *
 * Todo dado vem de `@/fixtures/states`, nunca de dentro dos componentes.
 */

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Kicker>{titulo}</Kicker>
      {children}
    </View>
  );
}

export default function CatalogoScreen() {
  const [estado, setEstado] = useState<ScreenStateName>('loading');

  return (
    <Screen withBottomNav={false} testID="screen-catalogo">
      <AppHeader
        kicker="Fundação"
        title="Catálogo"
        subtitle="Componentes, estados e contraste medido — tudo com dado de fixture."
      />

      <Secao titulo="Tipografia">
        <Card>
          <View style={{ gap: space.md }}>
            {(Object.keys(typography.textStyle) as Array<keyof typeof typography.textStyle>).map(
              (nome) => (
                <View key={nome} style={{ gap: space.xxs }}>
                  <Text variant="body" tone="faint">
                    {`${nome} · ${typography.textStyle[nome].fontSize}px / ${typography.textStyle[nome].fontWeight}`}
                  </Text>
                  <Text variant={nome}>Fly leva você</Text>
                </View>
              ),
            )}
          </View>
        </Card>
      </Secao>

      <Secao titulo="Contraste medido">
        <Card>
          <View style={{ gap: space.sm }}>
            <Text variant="body" tone="muted">
              {`Sobre o fundo ${color.surface.base}. AA pede ${WCAG_AA.normalText}:1 para texto normal e ${WCAG_AA.largeText}:1 para texto grande e UI.`}
            </Text>
            {(Object.keys(color.text) as Array<keyof typeof color.text>).map((token) => {
              const razao = contrastRatioRounded(color.text[token], color.surface.base);
              const usos = textContrastUse[token];
              return (
                <View key={token} style={styles.linha}>
                  <Text variant="body" style={{ color: color.text[token] }}>
                    {token}
                  </Text>
                  <Text variant="body" tone="muted">
                    {`${razao}:1 · ${usos.length > 0 ? usos.join(', ') : 'só controle inativo'}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      </Secao>

      <Secao titulo="Botão central">
        <Card>
          <View style={styles.botoes}>
            {centralButtonStates.map((s) => (
              <View key={s.nome} style={styles.botaoSlot}>
                <View style={styles.botaoPalco}>
                  <CentralTripButton
                    focused={s.focused}
                    hasAlert={s.hasAlert}
                    progress={s.progress}
                    onPress={() => undefined}
                    label=""
                  />
                </View>
                <Text variant="body" tone="muted" style={styles.botaoRotulo}>
                  {s.nome}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Secao>

      <Secao titulo="Avisos">
        <View style={{ gap: space.md }}>
          <AlertBanner severity="info" title="Seu voo está confirmado" />
          <AlertBanner
            severity="warning"
            title="Escolha o jantar de amanhã"
            description="O prazo de confirmação vem do painel, nunca do código."
            actionLabel="Escolher"
            onAction={() => undefined}
          />
          <AlertBanner
            severity="critical"
            title="Ponto de encontro mudou"
            description="Confirme a leitura para a equipe saber que você viu."
            actionLabel="Confirmei"
            onAction={() => undefined}
          />
          <OfflineBanner lastSyncedLabel="há 12 min" />
        </View>
      </Secao>

      <Secao titulo="Estados de tela">
        <View style={styles.chips}>
          {SCREEN_STATE_NAMES.map((nome) => {
            const ativo = estado === nome;
            return (
              <Pressable
                key={nome}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={`Ver estado ${nome}`}
                onPress={() => setEstado(nome)}
                style={[styles.chip, ativo && styles.chipAtivo]}
                testID={`catalogo-estado-${nome}`}
              >
                <Text variant="body" tone={ativo ? 'gold' : 'muted'}>
                  {nome}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <StateShell
            state={screenStates[estado]}
            onRetry={() => setEstado('ready')}
            onOpenSettings={() => undefined}
            empty={
              <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
                Estado vazio precisa de conteúdo próprio — quem usa o StateShell decide qual.
              </Text>
            }
          >
            {(dado) => (
              <View style={{ gap: space.sm }}>
                <Text variant="section">{dado.titulo}</Text>
                <Text variant="body" tone="muted">
                  {dado.descricao}
                </Text>
              </View>
            )}
          </StateShell>
        </Card>
      </Secao>

      <Secao titulo="Coluna flutuante">
        <Card>
          <Text variant="body" tone="muted">
            {`Carrinho compacto quando vazio; contador em ${cartStates.filter((n) => n > 0).join(', ')} itens. O botão de emergência tem forma e cor distintas do carrinho, por exigência da §4.2.`}
          </Text>
        </Card>
      </Secao>

      {/* A coluna real, ancorada na tela, para conferir posicao e alvo. */}
      <FloatingActionRail
        cartCount={3}
        onOpenCart={() => undefined}
        onOpenAssist={() => undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: {
    gap: space.md,
    marginBottom: space.section,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  botoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xl,
  },
  botaoSlot: {
    alignItems: 'center',
    gap: space.sm,
    width: 120,
  },
  // O botao central se posiciona em absoluto com `top` negativo; este palco
  // devolve a altura que ele ocuparia, para o catalogo nao colapsar.
  botaoPalco: {
    height: 44,
    width: 74,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  botaoRotulo: {
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  chipAtivo: {
    borderColor: palette.goldBorder,
    backgroundColor: palette.goldFill,
  },
  hidden: {
    ...textStyle('caption'),
  },
});
