import { introTiming as timing } from "./config";

/** Photographic 2.5D motion only; the original view is never mirrored or spun. */
export function busPose(milliseconds: number) {
  "worklet";
  const a = Math.max(0, Math.min(1, (milliseconds - timing.environment) / (timing.entrance - timing.environment)));
  const j = Math.max(0, Math.min(1, (milliseconds - timing.entrance) / (timing.journey + 100 - timing.entrance)));
  // Zero velocity at the closest framing avoids an abrupt change of direction.
  const approach = a * a * (3 - 2 * a);
  const journey = j * j * (3 - 2 * j);
  return {
    x: 125 - 105 * approach + 16 * journey,
    y: 55 - 55 * approach - 145 * journey,
    scale: 0.35 + 0.65 * approach - 0.9 * journey,
    roll: -1.2 + 1.45 * approach - 1.05 * journey,
    yaw: -4 + 4 * approach + 3 * journey,
  };
}
