// Web preview intentionally streams. Native media/files are never advertised as
// downloaded in the browser; Metro resolves offline-storage.native.ts on devices.
import type { OfflineStorage } from "./offline-storage.types";
export function createOfflineStorage(userId: string): OfflineStorage {
  const key = `samanvi.catalog.v1.${userId}`;
  return {
    supported: false,
    async readSnapshot() { const raw = globalThis.localStorage?.getItem(key); return raw ? JSON.parse(raw) : null; },
    async writeSnapshot(value) { globalThis.localStorage?.setItem(key, JSON.stringify(value)); },
    async media() { return []; },
    async localUri() { return null; },
    async download() { throw new Error("Offline downloads are available in the Android/iOS app."); },
    async prune() {},
    usedBytes() { return 0; },
  };
}
