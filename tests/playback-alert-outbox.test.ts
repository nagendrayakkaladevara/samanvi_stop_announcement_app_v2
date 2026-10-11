import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackAlertOutbox, type PlaybackAlertEvent } from "../src/domain/playback-alert-outbox";

const event: PlaybackAlertEvent = { eventId: "f14a32a8-6f06-4a3c-8bc1-6f30d4ce56d0", audioId: "audio-1", playCount: 4, playedAt: "2026-10-11T10:00:00.000Z" };
function storage() {
  const events = new Map<string, PlaybackAlertEvent>();
  return { events, read: async () => [...events.values()], write: async (id: string, value: PlaybackAlertEvent) => { events.set(id, value); }, remove: async (id: string) => { events.delete(id); } };
}
test("persists offline events, retaining their playback time", async () => {
  const store = storage();
  const outbox = new PlaybackAlertOutbox(store, async () => { throw new Error("offline"); }, () => true);
  await outbox.enqueue(event);
  await assert.rejects(outbox.flush(), /offline/);
  assert.deepEqual([...store.events.values()], [event]);
  const delivered: PlaybackAlertEvent[] = [];
  const restarted = new PlaybackAlertOutbox(store, async (value) => { delivered.push(value); }, () => true);
  await restarted.flush();
  assert.deepEqual(delivered, [event]);
  assert.equal(store.events.size, 0);
});
test("coalesces parallel deliveries", async () => {
  const store = storage();
  let calls = 0;
  const outbox = new PlaybackAlertOutbox(store, async () => { calls++; }, () => true);
  await outbox.enqueue(event);
  await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);
  assert.equal(calls, 1);
});
test("does not send a previous user's events under another account", async () => {
  const store = storage();
  let calls = 0;
  const outbox = new PlaybackAlertOutbox(store, async () => { calls++; }, () => false);
  await outbox.enqueue(event);
  await outbox.flush();
  assert.equal(calls, 0);
  assert.equal(store.events.size, 1);
});
