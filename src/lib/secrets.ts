// The phone's secure storage for the 24 words and private keys (see secrets-core.ts for the rules).

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { getItem, setItem, removeItem } from './kv';
import { store } from './store';
import { nsKey } from './ns';
import { hasScreenLock, makeSecrets, NoScreenLock, pickMode, secretOptions, upgradeToAuth, type Backend, type SecretMode, type UpgradeResult } from './secrets-core';

const web = Platform.OS === 'web';

/** True once a read showed the keys are gone for good (biometrics changed). The app shows a restore screen. */
export const keysLost = store(false);

let mode: SecretMode = 'auth';
const MODE_KEY = 'w.secmode';

/** Decide once, on first use, and remember (a non-secret flag). */
export async function initSecretMode() {
  if (web) return;
  const saved = await getItem(MODE_KEY).catch(() => null);
  if (saved === 'auth' || saved === 'device') {
    mode = saved;
    return;
  }
  let enrolled = false;
  try {
    enrolled = await LocalAuthentication.isEnrolledAsync();
  } catch {}
  mode = pickMode({ os: Platform.OS === 'ios' ? 'ios' : 'android', biometricsEnrolled: enrolled });
  await setItem(MODE_KEY, mode).catch(() => {});
}

// Android shows one fingerprint/face prompt at a time; a second read while one is open fails with
// "Authentication is already in progress". So secure-store calls run one after another.
let queue: Promise<unknown> = Promise.resolve();
const oneAtATime = <T,>(f: () => Promise<T>): Promise<T> => {
  const next = queue.then(f, f);
  queue = next.catch(() => {});
  return next;
};

const native: Backend = {
  get: (k, m) => oneAtATime(() => SecureStore.getItemAsync(k, secretOptions(m, SecureStore))),
  set: (k, v, m) => oneAtATime(() => SecureStore.setItemAsync(k, v, secretOptions(m, SecureStore))),
  del: (k) => SecureStore.deleteItemAsync(k),
};

// In a browser there is no secure hardware; keys stay in local storage as before (the web build is for trying the wallet).
const browser: Backend = { get: (k) => getItem(k), set: (k, v) => setItem(k, v), del: (k) => removeItem(k) };

/** Refuse to store keys on a phone with no screen lock at all. */
async function requireScreenLock() {
  if (web) return;
  let level = 1;
  try {
    level = await LocalAuthentication.getEnrolledLevelAsync();
  } catch {
    return; // can't tell: the platform's own storage rules still apply
  }
  if (!hasScreenLock(level)) throw new NoScreenLock();
}

const spaced = (b: Backend): Backend => ({
  get: (k, m) => b.get(nsKey(k), m),
  set: (k, v, m) => b.set(nsKey(k), v, m),
  del: (k) => b.del(nsKey(k)),
});

export const secrets = makeSecrets(spaced(web ? browser : native), () => mode, () => keysLost.set(true), requireScreenLock);

/**
 * Call after a successful unlock. A phone that stored its keys in 'device' mode (no biometric then) moves
 * them to 'auth' mode as soon as a biometric is enrolled. Never throws; on any trouble the keys stay as they were.
 */
export async function upgradeMode(names: string[]): Promise<UpgradeResult> {
  names = names.map((n) => nsKey(n));
  if (web) return 'not-needed';
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    const r = await upgradeToAuth({
      mode,
      enrolled: level >= 2,
      names,
      backend: native,
      saveMode: async (m) => {
        await setItem(MODE_KEY, m);
        mode = m;
      },
    });
    return r;
  } catch {
    return 'failed';
  }
}
