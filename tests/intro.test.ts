import assert from "node:assert/strict";
import { test } from "node:test";
import { introDuration, introTiming } from "../src/ui/intro/config";
import { busPose, sceneFrame, smoothProgress } from "../src/ui/intro/motion";

test("cinematic intro follows the 2.6 second storyboard", () => {
  assert.deepEqual(Object.values(introTiming).slice(0, 8), [300, 600, 900, 1300, 1700, 2000, 2300, 2600]);
  assert.equal(introDuration(true, false), 2600);
});

test("reduced motion bypasses the journey even with a bus asset", () => {
  assert.equal(introDuration(true, true), 450);
  assert.equal(introDuration(false, true), 450);
});

test("missing approved photo uses a short branded fallback, not an empty journey", () => {
  assert.equal(introDuration(false, false), 450);
});

test("actual-photo motion approaches the camera then recedes without exposing an unseen view", () => {
  const entrance = busPose(900);
  const closest = busPose(1300);
  const distance = busPose(1800);
  assert.equal(closest.scale, 1);
  assert.ok(entrance.scale < closest.scale);
  assert.ok(distance.scale < entrance.scale);
  assert.ok(distance.y < closest.y);
  for (let time = 0; time <= 2600; time += 10) {
    const pose = busPose(time);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.scale > 0 && pose.scale <= 1);
    assert.ok(Math.abs(pose.yaw) <= 4);
    assert.ok(Math.abs(pose.roll) <= 1.2);
  }
});

test("camera framing is continuous at its closest point", () => {
  const before = busPose(1299);
  const peak = busPose(1300);
  const after = busPose(1301);
  for (const key of Object.keys(peak) as (keyof typeof peak)[]) {
    assert.ok(Math.abs(before[key] - peak[key]) < 0.01);
    assert.ok(Math.abs(after[key] - peak[key]) < 0.01);
  }
  assert.deepEqual(busPose(2600), busPose(1880));
});

test("soft scene overlaps preserve a visible brand or journey throughout the handoff", () => {
  for (let time = 0; time <= 2600; time += 8) {
    const frame = sceneFrame(time);
    assert.ok(Math.max(frame.iconOpacity, frame.road, frame.trailOpacity, frame.logoOpacity) > 0.25, `Empty handoff at ${time}ms`);
    for (const key of ["iconOpacity", "environment", "road", "trailReveal", "trailOpacity", "trailConvergence", "busOpacity", "logoOpacity"] as const) {
      assert.ok(frame[key] >= 0 && frame[key] <= 1, `${key} out of range at ${time}ms`);
    }
  }
  assert.equal(sceneFrame(2300).logoOpacity, 1);
  assert.equal(sceneFrame(2300).trailOpacity, 0);
  assert.equal(sceneFrame(2300).environment, 0);
  assert.deepEqual(sceneFrame(2300), sceneFrame(2600), "Final logo hold must be completely still");
});

test("camera easing has no acceleration discontinuity at either end", () => {
  const epsilon = 0.001;
  assert.equal(smoothProgress(-1, 0, 1), 0);
  assert.equal(smoothProgress(2, 0, 1), 1);
  const startAcceleration = (smoothProgress(2 * epsilon, 0, 1) - 2 * smoothProgress(epsilon, 0, 1)) / epsilon ** 2;
  const endAcceleration = (1 - 2 * smoothProgress(1 - epsilon, 0, 1) + smoothProgress(1 - 2 * epsilon, 0, 1)) / epsilon ** 2;
  assert.ok(Math.abs(startAcceleration) < 0.06);
  assert.ok(Math.abs(endAcceleration) < 0.06);
});
