import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { hitSlopFor, palette, radius, space, textStyle, touchTarget } from '@/theme';
import { Kicker, Text } from './Text';

/**
 * Os cinco estados que toda tela precisa tratar (spec §34 e DoD §31.3):
 * carregando, vazio, erro, offline e permissao negada.
 *
 * Eles existem como componentes de primeira classe justamente para que
 * ninguem "resolva depois" com um spinner improvisado. `StateShell` decide
 * qual mostrar; estes so desenham.
 */

const ACTION_MIN_HEIGHT = touchTarget.min;

function Action({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={hitSlopFor(ACTION_MIN_HEIGHT)}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      testID={testID}
    >
      <Text variant="body" tone="primary" style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function Frame({ children, testID }: { children: ReactNode; testID: string }) {
  return (
    <View style={styles.frame} testID={testID}>
      {children}
    </View>
  );
}

/**
 * Esqueleto de carregamento.
 *
 * Sem animacao: pulso continuo em fundo escuro cansa a vista e briga com
 * "reduzir movimento". O `ActivityIndicator` do sistema ja respeita a
 * preferencia do usuario.
 */
export function LoadingSkeleton({ label = 'Carregando' }: { label?: string }) {
  return (
    <Frame testID="state-loading">
      <ActivityIndicator color={palette.gold} accessibilityLabel={label} />
      <Text variant="body" tone="muted" style={styles.centered}>
        {label}
      </Text>
    </Frame>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Frame testID="state-empty">
      <Text variant="section" tone="primary" style={styles.centered}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="muted" style={styles.centered}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Action label={actionLabel} onPress={onAction} testID="state-empty-action" />
      ) : null}
    </Frame>
  );
}

export interface ErrorStateProps {
  title?: string;
  /** Mensagem curta e acionavel. Nunca cole stack trace nem corpo de resposta. */
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Algo não carregou',
  description = 'Tente de novo. Se continuar, a Fly está a um toque de distância.',
  onRetry,
}: ErrorStateProps) {
  return (
    <Frame testID="state-error">
      <Kicker tone="danger">Erro</Kicker>
      <Text variant="section" tone="primary" style={styles.centered}>
        {title}
      </Text>
      <Text variant="body" tone="muted" style={styles.centered}>
        {description}
      </Text>
      {onRetry ? (
        <Action label="Tentar de novo" onPress={onRetry} testID="state-error-retry" />
      ) : null}
    </Frame>
  );
}

export interface OfflineStateProps {
  /** Quando os dados em cache foram sincronizados. Formate antes de passar. */
  lastSyncedLabel?: string;
  onRetry?: () => void;
}

/**
 * Offline em tela cheia — para quando nada pode ser mostrado.
 * Quando ha cache utilizavel, prefira `OfflineBanner` e mantenha o conteudo.
 */
export function OfflineState({ lastSyncedLabel, onRetry }: OfflineStateProps) {
  return (
    <Frame testID="state-offline">
      <Kicker tone="warning">Sem conexão</Kicker>
      <Text variant="section" tone="primary" style={styles.centered}>
        Você está offline
      </Text>
      <Text variant="body" tone="muted" style={styles.centered}>
        {lastSyncedLabel
          ? `Mostrando o que foi sincronizado ${lastSyncedLabel}.`
          : 'Roteiro, documentos e contatos essenciais continuam disponíveis.'}
      </Text>
      {onRetry ? (
        <Action label="Tentar de novo" onPress={onRetry} testID="state-offline-retry" />
      ) : null}
    </Frame>
  );
}

export interface PermissionDeniedStateProps {
  /** O que o app queria fazer, em linguagem do usuario. */
  what: string;
  /** Por que precisa. Sem isso, a permissao parece intrusiva. */
  why: string;
  onOpenSettings?: () => void;
}

/**
 * Permissao negada.
 *
 * A §23.3 manda pedir permissao no contexto, nao no primeiro segundo. Esta
 * tela e o contexto: ela explica o porque antes de pedir de novo, e sempre
 * deixa o usuario seguir sem conceder.
 */
export function PermissionDeniedState({ what, why, onOpenSettings }: PermissionDeniedStateProps) {
  return (
    <Frame testID="state-permission-denied">
      <Kicker tone="warning">Permissão</Kicker>
      <Text variant="section" tone="primary" style={styles.centered}>
        {what}
      </Text>
      <Text variant="body" tone="muted" style={styles.centered}>
        {why}
      </Text>
      {onOpenSettings ? (
        <Action label="Abrir ajustes" onPress={onOpenSettings} testID="state-permission-settings" />
      ) : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.section,
    paddingHorizontal: space.lg,
  },
  centered: {
    textAlign: 'center',
  },
  action: {
    minHeight: ACTION_MIN_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    marginTop: space.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.strokeStrong,
    backgroundColor: palette.fillStrong,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    ...textStyle('body'),
    fontWeight: '600',
    textAlign: 'center',
  },
});
