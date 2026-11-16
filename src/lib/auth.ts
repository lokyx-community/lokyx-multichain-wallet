// Proving it's you: Face ID or a fingerprint when the phone has one, the wallet passcode otherwise.
// Either one is enough. The phone does the face or finger check; the wallet only hears yes or no.

import { decoyOpen } from './ns';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { store } from './store';
import { wallet } from './wallet';

export type Bio = 'face' | 'finger' | 'iris' | null;

let cached: Bio | undefined;
export async function biometricKind(): Promise<Bio> {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') return (cached = null);
  try {
    const [hw, enrolled, level, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const L = LocalAuthentication.SecurityLevel;
    if (!hw || !enrolled || (level !== L.BIOMETRIC_WEAK && level !== L.BIOMETRIC_STRONG)) return (cached = null);
    const T = LocalAuthentication.AuthenticationType;
    cached = types.includes(T.FACIAL_RECOGNITION) ? 'face' : types.includes(T.FINGERPRINT) ? 'finger' : types.includes(T.IRIS) ? 'iris' : null;
    return cached;
  } catch {
    return (cached = null);
  }
}

export const bioName = (b: Bio) => (b === 'face' ? (Platform.OS === 'ios' ? 'Face ID' : 'Face unlock') : b === 'finger' ? (Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint') : b === 'iris' ? 'Iris' : 'Passcode');

// What the face check overlay shows: looking, then a tick when it passes.
export const faceState = store<{ phase: 'look' | 'ok'; kind: Bio } | null>(null);

/** Asks the phone. True only if the person passed. */
export async function askBiometric(reason: string): Promise<boolean> {
  const kind = await biometricKind();
  // On Android the system draws its own sheet; keep ours out of its way until it passes.
  if (Platform.OS === 'ios') faceState.set({ phase: 'look', kind });
  try {
    // 'weak' lets Android phones use face unlock, not only fingerprints
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Use passcode', disableDeviceFallback: true, requireConfirmation: false, biometricsSecurityLevel: 'weak' });
    if (r.success) {
      faceState.set({ phase: 'ok', kind });
      await new Promise((res) => setTimeout(res, 650));
    }
    return r.success;
  } catch {
    return false;
  } finally {
    faceState.set(null);
  }
}

// The passcode pad is drawn by <PasscodeHost/>; this is how code asks it to appear.
export const passcodeRequest = store<{ reason: string; resolve: (ok: boolean) => void } | null>(null);

export function askPasscode(reason: string): Promise<boolean> {
  return new Promise((resolve) => passcodeRequest.set({ reason, resolve }));
}

/** Face or finger first if it's on, then the passcode. */
export async function confirmIt(reason: string): Promise<boolean> {
  // In the decoy wallet only its passcode approves things: a face or finger belongs to the real owner.
  if (!decoyOpen.get() && wallet.get().settings.biometrics && (await biometricKind())) {
    if (await askBiometric(reason)) return true;
  }
  return askPasscode(reason);
}
