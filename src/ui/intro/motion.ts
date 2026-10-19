import { introTiming as timing } from "./config";

/** Quintic easing: position, velocity AND acceleration meet at scene boundaries. */
export function smoothProgress(time: number, from: number, to: number) {
  "worklet";
  const t = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function curve(t: number, a: number, b: number, c: number, d: number) {
  "worklet";
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** Front-tyre contact point in the same 400 × 860 space as the highway.
 * Scaling about this contact point keeps the cutout on the road on every size.
 */
export function busPose(milliseconds: number) {
  "worklet";
  const approach = smoothProgress(milliseconds, timing.environment - 30, timing.entrance);
  const journey = smoothProgress(milliseconds, timing.entrance, timing.dissolve - 120);
  return {
    x: 170 + 48 * approach + curve(journey, 0, -148, -38, 26),
    y: 548 + 60 * approach + curve(journey, 0, -68, -168, -190),
    scale: 0.72 + 0.28 * approach - 0.9 * journey,
    roll: -0.45 + 0.45 * approach - 0.35 * journey,
    yaw: -1.8 + 1.8 * approach + 1.2 * journey,
  };
}

/** One shared frame clock; overlaps deliberately bridge every storyboard scene. */
export function sceneFrame(time: number) {
  "worklet";
  const reveal = smoothProgress(time, 300, 660);
  return {
    iconOpacity: 1 - smoothProgress(time, 280, 510),
    iconScale: 0.985 + 0.015 * smoothProgress(time, 0, 280),
    environment: smoothProgress(time, 480, 900) * (1 - smoothProgress(time, 1640, 2020)),
    road: reveal * (1 - smoothProgress(time, 1690, 2050)),
    trailReveal: smoothProgress(time, 320, 820),
    trailOpacity: reveal * (1 - smoothProgress(time, 1970, 2170)),
    trailConvergence: smoothProgress(time, 1700, 2130),
    cameraScale: 1.018 - 0.018 * smoothProgress(time, 800, 1880),
    distantScale: 1.008 - 0.008 * smoothProgress(time, 600, 1880),
    busOpacity: smoothProgress(time, 870, 1030) * (1 - smoothProgress(time, 1710, 1900)),
    logoOpacity: smoothProgress(time, 1960, 2240),
    logoScale: 0.985 + 0.015 * smoothProgress(time, 1960, timing.logo),
  };
}
