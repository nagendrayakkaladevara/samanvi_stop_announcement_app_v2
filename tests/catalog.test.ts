import assert from "node:assert/strict";
import { test } from "node:test";
import { audioSchema, bootstrapSchema, configSchema, formatDuration, pinnedRoutesSchema, quickAnnouncementSchema, routeAnnouncementsSchema } from "../src/domain/catalog";
import { isExternal, outputWasLost, PlaybackGate, type Output } from "../src/domain/playback-gate";
import { audioFormat, playbackPresentation } from "../src/domain/presentation";
import { initialRepeatPlaybackState, recordPlayback, shouldWarnBeforePlayback } from "../src/domain/repeat-playback";

const audio = { id: "a1", title: "Starting point", audioUrl: "https://media.example.com/start.mp3", mimeType: "audio/mpeg" };
const route = { id: "r1", routeId: "ST-A02", startLocation: "Hyderabad", endLocation: "Amalapuram", via: "Vijayawada", busType: "AC", isPinned: true };

test("accepts online bootstrap without local file metadata", () => {
  const result = bootstrapSchema.parse({ routes: [route], quickAnnouncements: [], recordsDriveUrl: null, maxPinnedRoutes: 3 });
  assert.equal(result.routes[0].routeId, "ST-A02");
  assert.deepEqual(audioSchema.parse(audio), audio);
});
test("rejects insecure and device-local audio sources", () => {
  for (const audioUrl of ["http://media.example.com/start.mp3", "file:///start.mp3", "blob:local", "javascript:alert(1)"])
    assert.equal(audioSchema.safeParse({ ...audio, audioUrl }).success, false);
});
test("requires explicit ascending backend sequence, allowing gaps", () => {
  const payload = { routeId: route.routeId, route, announcements: [{ ...audio, sequence: 2 }, { ...audio, id: "a2", sequence: 7 }] };
  assert.equal(routeAnnouncementsSchema.parse(payload).announcements[1].sequence, 7);
  for (const sequence of [undefined, 0, -1, 1.5, 2, 1])
    assert.equal(routeAnnouncementsSchema.safeParse({ ...payload, announcements: [payload.announcements[0], { ...audio, sequence }] }).success, false);
});
test("welcome notes support multiple choices and single actions require an explicit audio", () => {
  assert.equal(quickAnnouncementSchema.parse({ id: "welcome-note", name: "Welcome Note", type: "MULTIPLE", audios: [audio, { ...audio, id: "a2" }] }).type, "MULTIPLE");
  assert.equal(quickAnnouncementSchema.safeParse({ id: "dinner-break", name: "Dinner Break", type: "SINGLE", audioUrl: audio.audioUrl, audio }).success, true);
  assert.equal(quickAnnouncementSchema.safeParse({ id: "dinner-break", name: "Dinner Break", type: "SINGLE", audios: [audio] }).success, false);
  assert.equal(quickAnnouncementSchema.safeParse({ id: "toilet-break", name: "Toilet Break", type: "SINGLE", audioUrl: null, audio: null }).success, true);
});
test("rejects an invalid pin limit or oversized server pin response", () => {
  assert.equal(pinnedRoutesSchema.safeParse({ routes: Array(4).fill(route), maxPinnedRoutes: 3 }).success, false);
  assert.equal(pinnedRoutesSchema.safeParse({ routes: [route], maxPinnedRoutes: 4 }).success, false);
});
test("records only opens a configured secure Google Drive URL", () => {
  assert.equal(configSchema.safeParse({ recordsDriveUrl: "https://drive.google.com/drive/folders/123" }).success, true);
  assert.equal(configSchema.safeParse({ recordsDriveUrl: null }).success, true);
  for (const recordsDriveUrl of ["http://drive.google.com/123", "https://drive.google.com.evil.test/123", "https://evil.test/123", "javascript:alert(1)"])
    assert.equal(configSchema.safeParse({ recordsDriveUrl }).success, false);
});
test("warns before the fourth consecutive play of the same audio", () => {
  let state = initialRepeatPlaybackState;
  for (let count = 1; count <= 3; count++) {
    assert.equal(shouldWarnBeforePlayback(state, "a1"), false);
    state = recordPlayback(state, "a1");
    assert.equal(state.count, count);
  }
  assert.equal(shouldWarnBeforePlayback(state, "a1"), true);
  state = recordPlayback(state, "a2");
  assert.deepEqual(state, { audioId: "a2", count: 1 });
  assert.equal(shouldWarnBeforePlayback(state, "a1"), false);
});
test("new play, stop, and connection loss invalidate pending audio requests", () => {
  const gate = new PlaybackGate();
  const first = gate.next(); const second = gate.next();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.cancel();
  assert.equal(gate.isCurrent(second), false);
});
const speaker: Output = { kind: "bluetooth", name: "Bus audio", supported: true };
test("disconnecting or replacing the selected speaker interrupts playback", () => {
  assert.equal(outputWasLost(speaker, { kind: "speaker", name: "Phone", supported: true }), true);
  assert.equal(outputWasLost(speaker, { ...speaker, name: "Other headset" }), true);
  assert.equal(outputWasLost(speaker, speaker), false);
});
test("unknown output never satisfies the existing speaker guard", () => {
  assert.equal(isExternal({ ...speaker, supported: false }), false);
  assert.equal(isExternal({ kind: "unknown", name: "Unknown", supported: false }), false);
  assert.equal(isExternal(speaker), true);
});
test("formats clock labels without invalid or negative values", () => {
  assert.equal(formatDuration(65.8), "1:05"); assert.equal(formatDuration(-2), "0:00"); assert.equal(formatDuration(NaN), "0:00");
});
test("player errors and interruptions offer recovery rather than a paused state", () => {
  assert.equal(playbackPresentation("error", false).action, "Retry");
  assert.equal(playbackPresentation("interrupted", false).action, "Replay");
  assert.equal(playbackPresentation("finished", false).action, "Replay");
  assert.equal(playbackPresentation("paused", false).action, "Resume");
});
test("format labels handle both supplied and omitted MIME metadata", () => {
  assert.equal(audioFormat({ mimeType: "audio/mp4" }), "M4A");
  assert.equal(audioFormat({}), "Audio");
});
