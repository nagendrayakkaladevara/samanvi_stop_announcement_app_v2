import assert from "node:assert/strict";
import { test } from "node:test";
import {
  audioSchema,
  bootstrapSchema,
  formatDuration,
  isReady,
  manifestSchema,
  revisionOf,
  validateDownload,
  withSelectedRoute,
  type AudioAsset,
  type LibrarySnapshot,
} from "../src/domain/catalog";
import {
  isExternal,
  outputWasLost,
  PlaybackGate,
  type Output,
} from "../src/domain/playback-gate";
import {
  audioFormat,
  playbackPresentation,
  routeDownloadState,
} from "../src/domain/presentation";

const stamp = "2026-09-26T00:00:00.000Z";
const audio: AudioAsset = {
  id: "a1",
  title: "Vijayawada",
  description: null,
  category: "stop_announcement",
  originalFileName: "vja.mp3",
  mimeType: "audio/mpeg",
  sizeBytes: "100",
  durationMs: 12000,
  checksumSha256: null,
  status: "ready",
  blobUrl: "https://media.example.com/vja.mp3",
  downloadUrl: null,
  createdAt: stamp,
  updatedAt: stamp,
};
const route = {
  id: "r1",
  routeCode: "VJA-VSKP",
  name: "Vijayawada to Visakhapatnam",
  origin: "Vijayawada",
  destination: "Visakhapatnam",
  version: 1,
  updatedAt: stamp,
};
const snapshot: LibrarySnapshot = {
  schemaVersion: 1,
  source: "api",
  bootstrap: {
    routes: [{ ...route, _count: { audios: 1 } }],
    commonAudios: [],
    welcomeAudio: null,
  },
  manifests: {},
  files: {},
  selectedRouteId: null,
  lastSyncedAt: stamp,
};

test("accepts the existing mobile API bigint serialization and manifest shape", () => {
  assert.equal(
    bootstrapSchema.parse(snapshot.bootstrap).routes[0]._count.audios,
    1,
  );
  const value = manifestSchema.parse({
    ...route,
    description: null,
    audios: [{ position: 0, stopLabel: "Vijayawada", audio }],
  });
  assert.equal(value.audios[0].audio.sizeBytes, "100");
});
test("rejects insecure or local audio URLs before download", () => {
  for (const blobUrl of [
    "http://media.example.com/audio.mp3",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ])
    assert.equal(audioSchema.safeParse({ ...audio, blobUrl }).success, false);
});
test("bounds download size and rejects unready assets", () => {
  for (const sizeBytes of ["0", "-1", "broken", String(50 * 1024 * 1024 + 1)])
    assert.equal(audioSchema.safeParse({ ...audio, sizeBytes }).success, false);
  assert.equal(
    audioSchema.safeParse({ ...audio, status: "uploading" }).success,
    false,
  );
});
test("rejects malformed checksums rather than silently skipping verification", () => {
  assert.equal(
    audioSchema.safeParse({ ...audio, checksumSha256: "abcd" }).success,
    false,
  );
});
test("does not mark a previous audio revision as current", () => {
  const files = {
    a1: { uri: "file:///old.mp3", sizeBytes: 100, revision: revisionOf(audio) },
  };
  assert.equal(isReady({ files }, audio), true);
  assert.equal(
    isReady({ files }, { ...audio, updatedAt: "2026-09-27T00:00:00.000Z" }),
    false,
  );
  assert.equal(isReady({ files: {} }, audio), false);
});
test("rejects truncated downloads before their snapshot can be committed", () => {
  assert.throws(() => validateDownload(audio, 99), /Incomplete download/);
  assert.doesNotThrow(() => validateDownload(audio, 100));
});
test("validates SHA-256 when supplied and accepts case-insensitive hex", () => {
  const checked = { ...audio, checksumSha256: "A".repeat(64) };
  assert.throws(
    () => validateDownload(checked, 100, "b".repeat(64)),
    /verification failed/,
  );
  assert.throws(() => validateDownload(checked, 100), /verification failed/);
  assert.doesNotThrow(() => validateDownload(checked, 100, "a".repeat(64)));
});
test("route selection only accepts published routes and preserves previous snapshot", () => {
  assert.throws(
    () => withSelectedRoute(snapshot, "unpublished"),
    /no longer available/,
  );
  assert.equal(withSelectedRoute(snapshot, "r1").selectedRouteId, "r1");
  assert.equal(snapshot.selectedRouteId, null);
});
test("new play and stop actions invalidate stale asynchronous loads", () => {
  const gate = new PlaybackGate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.cancel();
  assert.equal(gate.isCurrent(second), false);
});
const speaker: Output = {
  kind: "bluetooth",
  name: "Bus audio",
  supported: true,
};
test("disconnecting or replacing the selected speaker interrupts playback", () => {
  assert.equal(
    outputWasLost(speaker, { kind: "speaker", name: "Phone", supported: true }),
    true,
  );
  assert.equal(
    outputWasLost(speaker, { ...speaker, name: "Other headset" }),
    true,
  );
  assert.equal(outputWasLost(speaker, speaker), false);
});
test("unknown output never satisfies the speaker guard", () => {
  assert.equal(isExternal({ ...speaker, supported: false }), false);
  assert.equal(
    isExternal({ kind: "unknown", name: "Unknown", supported: false }),
    false,
  );
  assert.equal(isExternal(speaker), true);
});
test("formats clock labels without invalid or negative values", () => {
  assert.equal(formatDuration(65.8), "1:05");
  assert.equal(formatDuration(-2), "0:00");
  assert.equal(formatDuration(NaN), "0:00");
});

test("a route with no stops is never presented as ready offline", () => {
  const empty = { ...snapshot, manifests: { r1: { ...route, audios: [] } } };
  assert.equal(routeDownloadState(empty, "r1").ready, false);
  assert.equal(routeDownloadState(empty, "r1").total, 0);
});

test("route readiness distinguishes saved old audio, updates, and missing files", () => {
  const saved: LibrarySnapshot = {
    ...snapshot,
    bootstrap: {
      ...snapshot.bootstrap,
      routes: [{ ...route, version: 2, _count: { audios: 2 } }],
    },
    manifests: {
      r1: { ...route, audios: [{ position: 0, stopLabel: null, audio }] },
    },
    files: {
      a1: {
        uri: "file:///vja.mp3",
        sizeBytes: 100,
        revision: revisionOf(audio),
      },
    },
  };
  assert.deepEqual(routeDownloadState(saved, "r1"), {
    total: 1,
    saved: 1,
    ready: true,
    needsUpdate: true,
  });
  assert.equal(routeDownloadState({ ...saved, files: {} }, "r1").ready, false);
  assert.equal(routeDownloadState(snapshot, "r1").ready, false);
});

test("player errors and interruptions offer recovery instead of claiming a paused state", () => {
  assert.equal(
    playbackPresentation("error", false).label,
    "Playback unavailable",
  );
  assert.equal(playbackPresentation("error", false).action, "Retry");
  assert.equal(playbackPresentation("interrupted", false).action, "Replay");
  assert.equal(playbackPresentation("stopped", false).action, "Play again");
  assert.equal(playbackPresentation("finished", false).action, "Replay");
  assert.equal(playbackPresentation("paused", false).action, "Resume");
});

test("non-MP3 announcements display their actual format", () => {
  assert.equal(audioFormat({ mimeType: "audio/mp4" }), "M4A");
  assert.equal(audioFormat({ mimeType: "audio/x-wav" }), "WAV");
});
