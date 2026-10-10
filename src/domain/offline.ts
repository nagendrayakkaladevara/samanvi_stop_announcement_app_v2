import type { AudioAsset, OfflineSnapshot } from "./catalog";

export const OFFLINE_WINDOW_MS = 30 * 86_400_000;
export const SYNC_FRESH_MS = 15 * 60_000;
export const DEFAULT_STORAGE_MB = 250;
export type OfflineLease = {
  revision: string;
  serverTime: number;
  offlineUntil: number;
  receivedAt: number;
  highWater: number;
  clockInvalid: boolean;
};

export function newLease(revision: string, serverTime: string, offlineUntil: string, now = Date.now()): OfflineLease {
  const start = Date.parse(serverTime), end = Date.parse(offlineUntil);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > OFFLINE_WINDOW_MS) {
    throw new Error("Invalid offline authorization. Refresh again.");
  }
  return { revision, serverTime: start, offlineUntil: end, receivedAt: now, highWater: now, clockInvalid: false };
}

// Compare elapsed device time with server-issued duration. Rolling back a device's
// clock beyond tolerance fails closed until another authenticated sync succeeds.
export function advanceLease(lease: OfflineLease, now = Date.now()): OfflineLease {
  return { ...lease, highWater: Math.max(now, lease.highWater),
    clockInvalid: lease.clockInvalid || now < lease.highWater - 60_000 || now < lease.receivedAt - 60_000 };
}
export function leaseValid(lease: OfflineLease | null, now = Date.now()): boolean {
  if (!lease) return false;
  const checked = advanceLease(lease, now);
  return !checked.clockInvalid && checked.serverTime + (checked.highWater - checked.receivedAt) < checked.offlineUntil;
}
export function mediaKey(audio: AudioAsset): string | null {
  return audio.contentRevision && audio.sizeBytes ? audio.contentRevision : null;
}
export function pinnedMedia(snapshot: OfflineSnapshot | null): Map<string, AudioAsset> {
  const media = new Map<string, AudioAsset>();
  for (const route of snapshot?.pinnedRoutes ?? []) {
    if (!snapshot?.catalog.routes.some((item) => item.id === route.route.id && item.isPinned)) continue;
    for (const audio of route.announcements) {
      const key = mediaKey(audio);
      if (key) media.set(key, audio);
    }
  }
  return media;
}
export function eligibleAudio(snapshot: OfflineSnapshot | null, audio: AudioAsset): boolean {
  return (snapshot?.pinnedRoutes ?? []).some((route) =>
    snapshot?.catalog.routes.some((item) => item.id === route.route.id && item.isPinned) &&
    route.announcements.some((item) => item.id === audio.id && mediaKey(item) !== null && mediaKey(item) === mediaKey(audio)));
}
