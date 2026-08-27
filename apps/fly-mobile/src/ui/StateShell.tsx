import type { ReactNode } from 'react';
import {
  ErrorState,
  LoadingSkeleton,
  OfflineState,
  PermissionDeniedState,
  type ErrorStateProps,
  type OfflineStateProps,
  type PermissionDeniedStateProps,
} from './StateViews';

/**
 * O estado de uma tela, como um unico valor.
 *
 * Booleans separados (`isLoading`, `hasError`, `isOffline`) permitem
 * combinacoes que nao existem — carregando e com erro ao mesmo tempo — e
 * escondem o caso que ninguem tratou. Uma uniao discriminada torna cada
 * estado explicito e obriga o `switch` a ser exaustivo.
 */
export type ScreenState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'empty' }
  | { kind: 'error'; error: Error }
  | { kind: 'offline'; lastSyncedAt?: Date | undefined }
  | { kind: 'permissionDenied'; what: string; why: string };

export interface StateShellProps<T> {
  state: ScreenState<T>;
  children: (data: T) => ReactNode;
  /** O que mostrar quando `kind` for `empty`. Sem isso, nao ha vazio possivel. */
  empty?: ReactNode;
  loadingLabel?: string;
  onRetry?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
  errorProps?: Partial<ErrorStateProps>;
  offlineProps?: Partial<OfflineStateProps>;
  permissionProps?: Partial<PermissionDeniedStateProps>;
}

/** Rotula "sincronizado há X" sem depender de biblioteca de datas. */
export function formatLastSynced(lastSyncedAt: Date, now: Date = new Date()): string {
  const minutos = Math.max(0, Math.round((now.getTime() - lastSyncedAt.getTime()) / 60000));
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

export function StateShell<T>({
  state,
  children,
  empty,
  loadingLabel,
  onRetry,
  onOpenSettings,
  errorProps,
  offlineProps,
  permissionProps,
}: StateShellProps<T>) {
  switch (state.kind) {
    case 'loading':
      return <LoadingSkeleton {...(loadingLabel ? { label: loadingLabel } : {})} />;

    case 'ready':
      return <>{children(state.data)}</>;

    case 'empty':
      return <>{empty}</>;

    case 'error':
      return <ErrorState {...errorProps} {...(onRetry ? { onRetry } : {})} />;

    case 'offline':
      return (
        <OfflineState
          {...offlineProps}
          {...(state.lastSyncedAt ? { lastSyncedLabel: formatLastSynced(state.lastSyncedAt) } : {})}
          {...(onRetry ? { onRetry } : {})}
        />
      );

    case 'permissionDenied':
      return (
        <PermissionDeniedState
          what={state.what}
          why={state.why}
          {...permissionProps}
          {...(onOpenSettings ? { onOpenSettings } : {})}
        />
      );
  }
}
