export const introTiming = {
  icon: 300,
  road: 600,
  environment: 900,
  entrance: 1300,
  journey: 1700,
  dissolve: 2000,
  logo: 2300,
  end: 2600,
  exit: 220,
  reduced: 450,
} as const;

export function introDuration(hasBus: boolean, reducedMotion: boolean) {
  return hasBus && !reducedMotion ? introTiming.end : introTiming.reduced;
}
