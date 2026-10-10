import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { z } from "zod";
import { advanceLease, type OfflineLease } from "../domain/offline";

const schema = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/), serverTime: z.number(), offlineUntil: z.number(),
  receivedAt: z.number(), highWater: z.number(), clockInvalid: z.boolean() });
const key = (userId: string) => `samanvi.offline.lease.${userId.replace(/[^\w.-]/g, "_")}`;
const queues = new Map<string, Promise<void>>();
export async function readLease(userId: string): Promise<OfflineLease | null> {
  await queues.get(userId)?.catch(() => undefined);
  const raw = Platform.OS === "web" ? localStorage.getItem(key(userId)) : await SecureStore.getItemAsync(key(userId));
  try { return raw ? advanceLease(schema.parse(JSON.parse(raw))) : null; } catch { return null; }
}
async function persist(userId: string, lease: OfflineLease | null) {
  if (Platform.OS === "web") {
    if (lease) localStorage.setItem(key(userId), JSON.stringify(lease)); else localStorage.removeItem(key(userId));
  } else if (lease) await SecureStore.setItemAsync(key(userId), JSON.stringify(lease), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(key(userId));
}
export function writeLease(userId: string, lease: OfflineLease | null): Promise<void> {
  const operation = (queues.get(userId) ?? Promise.resolve()).catch(() => undefined).then(() => persist(userId, lease));
  queues.set(userId, operation);
  return operation;
}
