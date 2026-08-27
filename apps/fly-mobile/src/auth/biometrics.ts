import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Biometria do aparelho.
 *
 * Ela protege o acesso ao app e ao cofre da viagem (§23.4). NAO e
 * reconhecimento facial para organizar fotos: aquilo e outra finalidade, exige
 * consentimento separado e fornecedor adequado, e nao esta aqui.
 *
 * A chave biometrica nunca sai do aparelho. O que guardamos no banco e apenas
 * o booleano `devices.biometric_enabled`, para a operacao saber que aquele
 * aparelho tem a protecao ligada.
 */

export type BiometricSupport =
  | { kind: 'unsupported'; reason: 'platform' | 'no_hardware' | 'not_enrolled' }
  | { kind: 'available'; types: LocalAuthentication.AuthenticationType[] };

export async function checkBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') return { kind: 'unsupported', reason: 'platform' };

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { kind: 'unsupported', reason: 'no_hardware' };

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return { kind: 'unsupported', reason: 'not_enrolled' };

  return {
    kind: 'available',
    types: await LocalAuthentication.supportedAuthenticationTypesAsync(),
  };
}

export type BiometricResult =
  { ok: true } | { ok: false; reason: 'cancelled' | 'unavailable' | 'failed' };

/**
 * Pede a biometria.
 *
 * `disableDeviceFallback` fica false de proposito: quem nao consegue usar a
 * digital precisa do PIN do aparelho como saida. Sem isso, uma mao molhada no
 * deserto tranca o cliente para fora do proprio roteiro.
 */
export async function requestBiometric(prompt: string): Promise<BiometricResult> {
  const support = await checkBiometricSupport();
  if (support.kind === 'unsupported') return { ok: false, reason: 'unavailable' };

  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });

  if (resultado.success) return { ok: true };
  const cancelou =
    'error' in resultado &&
    (resultado.error === 'user_cancel' || resultado.error === 'system_cancel');
  return { ok: false, reason: cancelou ? 'cancelled' : 'failed' };
}

/** Rotulo humano do que o aparelho oferece. */
export function biometricLabel(support: BiometricSupport): string {
  if (support.kind === 'unsupported') {
    return support.reason === 'not_enrolled'
      ? 'Configure a biometria nos ajustes do aparelho'
      : 'Este aparelho não oferece biometria';
  }
  const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
  if (support.types.includes(FACIAL_RECOGNITION)) return 'Reconhecimento facial';
  if (support.types.includes(FINGERPRINT)) return 'Impressão digital';
  return 'Biometria do aparelho';
}
