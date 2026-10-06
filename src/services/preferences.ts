import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { z } from "zod";

const key = "samanvi.preferences.v3";
const schema = z.object({ keepAwake: z.boolean(), requireSpeaker: z.boolean(), entered: z.boolean() });
export type Preferences = z.infer<typeof schema>;
export const defaultPreferences: Preferences = { keepAwake: true, requireSpeaker: true, entered: false };

export async function readPreferences(): Promise<Preferences> {
  const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
  if (!raw) return defaultPreferences;
  try { return schema.parse(JSON.parse(raw)); } catch { return defaultPreferences; }
}
export async function savePreferences(value: Preferences): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(key, JSON.stringify(value));
  else await SecureStore.setItemAsync(key, JSON.stringify(value));
}
