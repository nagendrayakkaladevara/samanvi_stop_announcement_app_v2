import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const SESSION_KEY = "samanvi.mobile.auth.session.v1";
const INSTALLATION_KEY = "samanvi.mobile.installation.v1";

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export type MobileAuthSession = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    driverId: string | null;
  };
};

export async function loadAuthSession(): Promise<MobileAuthSession | null> {
  const raw = await getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileAuthSession;
  } catch {
    await setItem(SESSION_KEY, null);
    return null;
  }
}

export const saveAuthSession = (session: MobileAuthSession | null) =>
  setItem(SESSION_KEY, session ? JSON.stringify(session) : null);

export async function getInstallationId(): Promise<string> {
  const existing = await getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await setItem(INSTALLATION_KEY, created);
  return created;
}
