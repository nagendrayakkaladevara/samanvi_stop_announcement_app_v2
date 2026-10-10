import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineSnapshotSchema, syncResponseSchema, type AudioAsset, type OfflineSnapshot } from "../src/domain/catalog";
import { advanceLease, eligibleAudio, leaseValid, newLease, OFFLINE_WINDOW_MS, pinnedMedia } from "../src/domain/offline";
import { DownloadManager } from "../src/domain/download-manager";
import { resolveAudioSource } from "../src/domain/audio-source";
import type { OfflineStorage, StoredMedia } from "../src/services/offline-storage.types";

const key = "a".repeat(64), otherKey = "b".repeat(64);
const audio: AudioAsset = { id: "a1", title: "Stop", audioUrl: "https://media.test/one.mp3", mimeType: "audio/mpeg", contentRevision: key, sizeBytes: 10 };
const route = { id: "r1", routeId: "R1", startLocation: "A", endLocation: "B", via: "", busType: "AC" as const, isPinned: true };
const snapshot: OfflineSnapshot = { catalog: { routes: [route], quickAnnouncements: [], maxPinnedRoutes: 3, recordsDriveUrl: null },
  pinnedRoutes: [{ route, routeId: "R1", announcements: [{ ...audio, sequence: 1 }] }] };
const lease = () => newLease(key, "2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z", 100_000);

test("offline lease expires at 30 days and only authenticated sync issues a new window", () => {
  assert.equal(leaseValid(lease(), 100_000 + OFFLINE_WINDOW_MS - 1), true);
  assert.equal(leaseValid(lease(), 100_000 + OFFLINE_WINDOW_MS), false);
  const used = advanceLease(lease(), 100_000 + OFFLINE_WINDOW_MS + 1);
  assert.equal(leaseValid(used, 100_000), false);
  assert.equal(leaseValid(advanceLease(lease(), 500_000), 400_000), false);
  assert.throws(() => newLease(key, "2026-10-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"));
});

test("full sync rejects missing pinned playlists and accepts unchanged renewal without manifests", () => {
  assert.equal(offlineSnapshotSchema.safeParse(snapshot).success, true);
  assert.equal(offlineSnapshotSchema.safeParse({ ...snapshot, pinnedRoutes: [] }).success, false);
  const envelope = { revision: key, serverTime: "2026-10-01T00:00:00.000Z", offlineUntil: "2026-10-31T00:00:00.000Z" };
  assert.equal(syncResponseSchema.safeParse({ ...envelope, unchanged: true }).success, true);
  assert.equal(syncResponseSchema.safeParse({ ...envelope, unchanged: false }).success, false);
  assert.equal(syncResponseSchema.safeParse({ ...envelope, unchanged: false, ...snapshot }).success, true);
});

test("unpinning removes eligibility, quick audio is excluded, and shared media deduplicates", () => {
  const second = { ...route, id: "r2" };
  const shared: OfflineSnapshot = { catalog: { ...snapshot.catalog, routes: [route, second],
    quickAnnouncements: [{ id: "welcome-note", name: "Welcome", type: "MULTIPLE", audios: [{ ...audio, id: "quick", contentRevision: otherKey }] }] },
    pinnedRoutes: [...snapshot.pinnedRoutes, { ...snapshot.pinnedRoutes[0], route: second }] };
  assert.equal(pinnedMedia(shared).size, 1);
  assert.equal(eligibleAudio(shared, audio), true);
  assert.equal(eligibleAudio(shared, { ...audio, contentRevision: otherKey }), false);
  const unpinned = { ...shared, catalog: { ...shared.catalog, routes: [{ ...route, isPinned: false }, { ...second, isPinned: false }] } };
  assert.equal(eligibleAudio(unpinned, audio), false);
  assert.equal(pinnedMedia(unpinned).size, 0);
});

test("ready local playback works offline with zero API calls; revoked-during-read sources are refused", async () => {
  let calls = 0, holds = 0, allowed = true;
  const deps = { localAllowed: () => allowed, online: () => false, leaseValid: () => true,
    localUri: async () => "file:///verified.mp3", hold: () => { holds++; }, release: () => { holds--; }, invalidate: () => {},
    fetchAudio: async () => { calls++; return audio; } };
  for (let i = 0; i < 4; i++) {
    assert.equal((await resolveAudioSource(audio, deps)).local, true);
    deps.release();
  }
  assert.equal(calls, 0); assert.equal(holds, 0);
  await assert.rejects(resolveAudioSource(audio, { ...deps, localUri: async () => { allowed = false; return "file:///old.mp3"; } }), /not ready offline/);
  assert.equal(holds, 0); assert.equal(calls, 0);
});

test("a corrupt or missing file is invalidated; only online fallback calls the API", async () => {
  let calls = 0, invalidated = 0;
  const deps = { localAllowed: () => true, online: () => true, leaseValid: () => true,
    localUri: async () => null, hold: () => {}, release: () => {}, invalidate: () => { invalidated++; },
    fetchAudio: async () => { calls++; return audio; } };
  assert.equal((await resolveAudioSource(audio, deps)).local, false);
  assert.equal(calls, 1); assert.equal(invalidated, 1);
  await assert.rejects(resolveAudioSource(audio, { ...deps, localAllowed: () => false, online: () => false, leaseValid: () => false }), /expired/);
  assert.equal(calls, 1);
});

test("play during a pinned download waits for the same transfer instead of starting a stream", async () => {
  let ready = false, requests = 0, preparations = 0;
  const source = await resolveAudioSource(audio, {
    localAllowed: () => true, online: () => true, leaseValid: () => true,
    localUri: async () => ready ? "file:///ready.mp3" : null,
    hold: () => {}, release: () => {}, invalidate: () => {},
    prepare: async () => { preparations++; ready = true; },
    fetchAudio: async () => { requests++; return audio; },
  });
  assert.equal(source.local, true); assert.equal(preparations, 1); assert.equal(requests, 0);
});

function fakeStore() {
  const files = new Map<string, StoredMedia>();
  const requests: string[] = [];
  const storage: OfflineStorage = {
    supported: true, async readSnapshot() { return null; }, async writeSnapshot() {},
    async media() { return [...files.values()]; }, async localUri(key) { return files.has(key) ? `file:///${key}` : null; },
    async download(item) {
      requests.push(item.contentRevision!);
      const result = { key: item.contentRevision!, sizeBytes: item.sizeBytes!, sha256: key, fileName: `${key}.mp3` };
      files.set(result.key, result); return result;
    },
    async prune(keep) { for (const key of files.keys()) if (!keep.has(key)) files.delete(key); }, usedBytes() { return files.size * 10; },
  };
  return { storage, files, requests };
}
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

test("queue downloads once per content, metadata edits reuse bytes, and removal preserves an active file", async () => {
  const { storage, files, requests } = fakeStore();
  const manager = new DownloadManager(storage, () => {});
  await manager.initialize(); manager.configure(snapshot, true, 1000); await settle();
  assert.deepEqual(requests, [key]);
  manager.configure({ ...snapshot, pinnedRoutes: [{ ...snapshot.pinnedRoutes[0], announcements: [{ ...audio, title: "New label", sequence: 3 }] }] }, true, 1000);
  await settle(); assert.deepEqual(requests, [key]);
  manager.hold(key);
  manager.configure(null, true, 1000); await settle(); assert.equal(files.has(key), true);
  manager.release(key); manager.configure(null, true, 1000); await settle(); assert.equal(files.has(key), false);
  await manager.dispose();
});

test("pin removal cancels an in-flight download and never marks a partial file ready", async () => {
  const { storage } = fakeStore();
  let aborted = false;
  storage.download = async (_audio, signal) => new Promise((resolve) => {
    signal.addEventListener("abort", () => { aborted = true; resolve(null); });
  });
  const manager = new DownloadManager(storage, () => {});
  await manager.initialize(); manager.configure(snapshot, true, 1000); await settle();
  assert.equal(manager.statuses.get(key)?.state, "downloading");
  manager.configure(null, true, 1000); await settle();
  assert.equal(aborted, true); assert.notEqual(manager.statuses.get(key)?.state, "ready");
  await manager.dispose();
});

test("Wi-Fi/background gating defers transfers and budget errors protect existing downloads", async () => {
  const { storage, requests } = fakeStore();
  const manager = new DownloadManager(storage, () => {});
  await manager.initialize(); manager.configure(snapshot, false, 1000); await settle(); assert.equal(requests.length, 0);
  manager.configure(snapshot, true, 5); await settle(); assert.equal(requests.length, 0);
  assert.match(manager.statuses.get(key)?.error ?? "", /limit/);
  manager.configure(snapshot, true, 1000); manager.retry(); await settle(); assert.equal(requests.length, 1);
  await manager.dispose();
});

test("concurrent playback waiters share the active download and cancel on unpin", async () => {
  const { storage, requests } = fakeStore();
  let finish!: (entry: StoredMedia) => void;
  storage.download = async (item, signal) => {
    requests.push(item.contentRevision!);
    return new Promise((resolve) => {
      finish = resolve;
      signal.addEventListener("abort", () => resolve(null));
    });
  };
  const manager = new DownloadManager(storage, () => {});
  await manager.initialize(); manager.configure(snapshot, true, 1000); await settle();
  const first = manager.prepare(key), second = manager.prepare(key);
  finish({ key, sizeBytes: 10, sha256: key, fileName: `${key}.mp3` });
  await Promise.all([first, second]);
  assert.deepEqual(requests, [key]);
  manager.invalidate(key); await settle();
  const cancelled = assert.rejects(manager.prepare(key), /paused/);
  manager.configure(null, true, 1000);
  await cancelled; await manager.dispose();
});

test("download retries are bounded and an explicit retry recovers", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { storage } = fakeStore();
  let calls = 0;
  const download = storage.download;
  storage.download = async (...args) => {
    calls++;
    if (calls <= 3) throw new Error("Signal dropped");
    return download(...args);
  };
  const manager = new DownloadManager(storage, () => {});
  await manager.initialize(); manager.configure(snapshot, true, 1000);
  for (let attempt = 0; attempt < 4; attempt++) { await settle(); context.mock.timers.tick(5000); }
  await settle();
  assert.equal(calls, 3);
  assert.equal(manager.statuses.get(key)?.state, "failed");
  manager.retry(); await settle();
  assert.equal(calls, 4); assert.equal(manager.statuses.get(key)?.state, "ready");
  await manager.dispose();
});
