import test from "node:test";
import assert from "node:assert/strict";
import { adjacentAudio } from "../src/domain/audio-playlist";

const playlist = [{ id: "first", sequence: 1 }, { id: "second", sequence: 5 }, { id: "third", sequence: 8 }];
test("previous/next follow the selected playlist even with sequence gaps", () => {
  assert.equal(adjacentAudio(playlist, "second", -1), playlist[0]);
  assert.equal(adjacentAudio(playlist, "second", 1), playlist[2]);
});
test("does not wrap at either end or navigate with no active audio", () => {
  assert.equal(adjacentAudio(playlist, "first", -1), null);
  assert.equal(adjacentAudio(playlist, "third", 1), null);
  assert.equal(adjacentAudio(playlist, "missing", 1), null);
  assert.equal(adjacentAudio(playlist, null, -1), null);
  assert.equal(adjacentAudio([], "first", 1), null);
});
test("single-audio actions have no previous/next audio", () => {
  assert.equal(adjacentAudio([playlist[0]], "first", -1), null);
  assert.equal(adjacentAudio([playlist[0]], "first", 1), null);
});
