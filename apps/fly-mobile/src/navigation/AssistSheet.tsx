import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, shadowStyle, space, touchTarget } from '@/theme';
import { Kicker, Text } from '@/ui';

/**
 * A folha do Fly Assist (spec §4.2).
 *
 * Tres escolhas, exatamente como a spec define, em ordem crescente de
 * urgencia. A §4.2 tambem manda que "o envio de um SOS exige confirmacao
 * clara, mas nao pode obrigar o cliente a navegar por varias telas" — por isso
 * a confirmacao acontece **dentro desta folha**, em um segundo toque, e nao em
 * outra rota.
 *
 * Nada aqui envia nada ainda: o fluxo real de SOS e entrega da Fase 8, atras
 * da flag `sos.enabled`. O que existe e a casca, com o caminho de confirmacao
 * correto.
 */

export type AssistChoice = 'chat' | 'urgent' | 'sos';

export interface AssistSheetProps {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: AssistChoice) => void;
  /** Estado da confirmacao de SOS, controlado por quem usa a folha. */
  sosConfirming?: boolean;
  onRequestSosConfirm?: () => void;
  /** Contato oficial de emergencia. Vem do painel — nunca do codigo (§33). */
  emergencyPhoneLabel?: string;
}

interface Option {
  choice: AssistChoice;
  title: string;
  description: string;
  tone: 'neutral' | 'warning' | 'danger';
}

const OPTIONS: readonly Option[] = [
  {
    choice: 'chat',
    title: 'Falar com a Fly',
    description: 'Dúvida de roupa, horário, indicação.',
    tone: 'neutral',
  },
  {
    choice: 'urgent',
    title: 'Preciso de ajuda agora',
    description: 'Perdi o grupo, atraso, transfer.',
    tone: 'warning',
  },
  {
    choice: 'sos',
    title: 'SOS / Emergência',
    description: 'Saúde, risco ou emergência.',
    tone: 'danger',
  },
];

const TONE_COLOR = {
  neutral: palette.textMuted,
  warning: palette.warning,
  danger: palette.danger,
} as const;

export function AssistSheet({
  visible,
  onClose,
  onChoose,
  sosConfirming = false,
  onRequestSosConfirm,
  emergencyPhoneLabel,
}: AssistSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={onClose}
        testID="assist-scrim"
      />

      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}
        testID="assist-sheet"
      >
        <View style={styles.grabber} />

        <Kicker>Fly Assist</Kicker>
        <Text variant="section" style={styles.title}>
          Como podemos ajudar?
        </Text>

        {OPTIONS.map((option) => {
          const isSos = option.choice === 'sos';
          const confirming = isSos && sosConfirming;

          return (
            <Pressable
              key={option.choice}
              accessibilityRole="button"
              accessibilityLabel={confirming ? `Confirmar ${option.title}` : option.title}
              accessibilityHint={
                confirming ? 'Toque de novo para enviar o SOS' : option.description
              }
              onPress={() => {
                if (isSos && !confirming && onRequestSosConfirm) {
                  onRequestSosConfirm();
                  return;
                }
                onChoose(option.choice);
              }}
              style={({ pressed }) => [
                styles.option,
                isSos && styles.optionSos,
                confirming && styles.optionConfirming,
                pressed && styles.optionPressed,
              ]}
              testID={`assist-option-${option.choice}`}
            >
              <View style={[styles.dot, { backgroundColor: TONE_COLOR[option.tone] }]} />
              <View style={styles.optionTexts}>
                <Text variant="body" style={styles.optionTitle}>
                  {confirming ? 'Toque de novo para confirmar' : option.title}
                </Text>
                <Text variant="body" tone="muted">
                  {confirming ? 'A equipe Fly será acionada imediatamente.' : option.description}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {emergencyPhoneLabel ? (
          <Text variant="body" tone="muted" style={styles.fallback}>
            Sem conexão? Ligue para {emergencyPhoneLabel}.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          onPress={onClose}
          style={styles.cancel}
          testID="assist-cancel"
        >
          <Text variant="body" tone="muted">
            Cancelar
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.6)',
  },
  sheet: {
    marginTop: 'auto',
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    gap: space.md,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.strokeStrong,
    ...shadowStyle('sheet'),
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.strokeStrong,
    marginBottom: space.sm,
  },
  title: {
    marginBottom: space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    minHeight: touchTarget.min + space.md,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.background,
  },
  optionSos: {
    borderColor: 'rgba(240,84,84,.35)',
  },
  optionConfirming: {
    borderColor: palette.danger,
    backgroundColor: 'rgba(240,84,84,.12)',
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionTexts: {
    flex: 1,
    gap: space.xxs,
  },
  optionTitle: {
    fontWeight: '600',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: space.xs,
  },
  fallback: {
    textAlign: 'center',
  },
  cancel: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
