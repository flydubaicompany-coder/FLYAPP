import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, shadowStyle, space, touchTarget } from '@/theme';
import Svg, { Path } from 'react-native-svg';
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

/**
 * Trip Mode — o mesmo botao, outro destino.
 *
 * O botao flutuante fica onde estava: e ele que a §4.2 exige presente nas
 * telas criticas, e um segundo botao de ajuda seria a pior forma de resolver
 * isso. O que muda e **o que acontece ao tocar**. Em vez de abrir uma thread
 * que nunca foi provada em producao, a folha lista os assuntos e abre o
 * WhatsApp da operacao com nome, viagem e atividade ja escritos.
 *
 * Quando o atendimento proprio for provado, esta prop sai e a folha volta ao
 * comportamento original — nada foi apagado para isto existir.
 */
export interface AssuntoDaViagem {
  chave: string;
  rotulo: string;
}

export interface AssistSheetProps {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: AssistChoice) => void;
  /** Estado da confirmacao de SOS, controlado por quem usa a folha. */
  sosConfirming?: boolean;
  onRequestSosConfirm?: () => void;
  /** Contato oficial de emergencia. Vem do painel — nunca do codigo (§33). */
  emergencyPhoneLabel?: string;
  /** Presente = Trip Mode. Ausente = a folha de sempre. */
  assuntosDaViagem?: readonly AssuntoDaViagem[];
  onEscolherAssunto?: (chave: string) => void;
  /** Falso = nao ha numero configurado, e a folha diz isso em vez de agir. */
  canalPronto?: boolean;
  /** O texto que sera enviado, para a pessoa ler antes de tocar em enviar. */
  previaDaMensagem?: (chave: string) => string;
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
  assuntosDaViagem,
  onEscolherAssunto,
  canalPronto = true,
  previaDaMensagem,
}: AssistSheetProps) {
  const insets = useSafeAreaInsets();
  const modoViagem = assuntosDaViagem !== undefined && assuntosDaViagem.length > 0;
  const [assuntoEscolhido, setAssuntoEscolhido] = useState<string | null>(null);

  // Reabrir a folha nao pode trazer a escolha da vez passada: quem abre de novo
  // costuma ter outro problema.
  useEffect(() => {
    if (!visible) setAssuntoEscolhido(null);
  }, [visible]);

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
          {modoViagem ? 'Preciso de ajuda' : 'Como podemos ajudar?'}
        </Text>

        {modoViagem ? (
          <>
            {!canalPronto ? (
              <Text variant="body" tone="muted" style={styles.fallback}>
                O canal de atendimento ainda não foi configurado. Procure alguém da equipe Fly.
              </Text>
            ) : null}

            {assuntosDaViagem.map((assunto) => (
              <Pressable
                key={assunto.chave}
                accessibilityRole="button"
                accessibilityLabel={assunto.rotulo}
                accessibilityHint="Abre o WhatsApp da Fly com a mensagem pronta"
                disabled={!canalPronto}
                accessibilityState={{ selected: assuntoEscolhido === assunto.chave }}
                onPress={() => setAssuntoEscolhido(assunto.chave)}
                style={({ pressed }) => [
                  styles.option,
                  assunto.chave === 'urgente' && styles.optionSos,
                  assuntoEscolhido === assunto.chave && styles.optionConfirming,
                  pressed && styles.optionPressed,
                  !canalPronto && styles.optionDesligada,
                ]}
                testID={`trip-assunto-${assunto.chave}`}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        assunto.chave === 'urgente' ? TONE_COLOR.danger : TONE_COLOR.neutral,
                    },
                  ]}
                />
                <View style={styles.optionTexts}>
                  <Text variant="body" style={styles.optionTitle}>
                    {assunto.rotulo}
                  </Text>
                </View>
              </Pressable>
            ))}

            {assuntoEscolhido && previaDaMensagem ? (
              <>
                <View style={styles.previa}>
                  <Text variant="caption" style={styles.previaTitulo}>
                    MENSAGEM QUE SERÁ ENVIADA
                  </Text>
                  <ScrollView style={styles.previaRolagem} nestedScrollEnabled>
                    <Text variant="body" tone="muted" style={styles.previaTexto}>
                      {previaDaMensagem(assuntoEscolhido)}
                    </Text>
                  </ScrollView>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir WhatsApp da Fly"
                  onPress={() => {
                    const escolha = assuntoEscolhido;
                    onClose();
                    onEscolherAssunto?.(escolha);
                  }}
                  style={({ pressed }) => [styles.zap, pressed && styles.zapApertado]}
                  testID="trip-abrir-whatsapp"
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path
                      fill="#06280F"
                      d="M12 2.2A9.7 9.7 0 0 0 3.7 17l-1.3 4.8 5-1.3A9.7 9.7 0 1 0 12 2.2zm0 1.8a7.9 7.9 0 1 1-4 14.7l-.5-.3-2.9.8.8-2.8-.3-.5A7.9 7.9 0 0 1 12 4z"
                    />
                  </Svg>
                  <Text variant="body" style={styles.zapTexto}>
                    Abrir WhatsApp da Fly
                  </Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}

        {!modoViagem &&
          OPTIONS.map((option) => {
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
  optionDesligada: {
    opacity: 0.45,
  },
  previa: {
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  previaTitulo: {
    color: 'rgba(245,245,247,.35)',
    letterSpacing: 1.3,
  },
  // Teto de altura: a mensagem cresce com o contexto, e sem isto ela empurra
  // o botao de enviar para fora da folha — que e o unico botao que importa.
  previaRolagem: { marginTop: 8, maxHeight: 96 },
  previaTexto: { color: 'rgba(245,245,247,.62)', lineHeight: 19 },
  zap: {
    marginTop: 14,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1DB954',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  zapApertado: { opacity: 0.85 },
  zapTexto: { color: '#06280F', fontWeight: '700' },
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
