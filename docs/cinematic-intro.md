# Cinematic launch intro

## Actual bus integrated

The user supplied `assets/intro/samanvi-bus-original.png` (865 × 466). Its visible coach pixels are preserved in `assets/intro/samanvi-bus.png` (817 × 459, 591,496 bytes). A hand-traced, supersampled alpha mask removes the road, guardrail, vegetation, water and lower-left inset, including the open gap behind the exterior mirror. There is no generated vehicle, repainted lettering, recoloring or invented rear view.

The actual-photo cinematic sequence is **enabled** via `src/ui/intro/assets.ts`. The 450 ms official-logo fallback remains only for reduced motion or failed asset loading. The source image is retained for reproducibility but is not imported into the production bundle.

## Reproduce / review the cutout

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-intro-bus.ps1` from the project root on Windows after `npm ci`. It uses Windows System.Drawing and the existing Expo image-tooling `pngjs` package (no new dependencies). The hand-traced mask is intentionally specific to this photograph's dimensions. Clearing invisible RGB pixels and lossless adaptive PNG filtering reduce the initial 990,894-byte cutout to 591,496 bytes without changing visible pixels. No upscaling or color quantization is applied.

Inspect `docs/intro-cutout-review.png` on both theme backgrounds. The original body, windshield lettering, curtains, striped livery, mirror and tyres remain intact. The source photo's daylight reflections remain natural photographic pixels, including in the night scene; a single source view cannot provide physically relit 3D geometry.

The frame uses the cutout's true aspect ratio, with wheel contact anchored to the curved highway rather than arbitrary image-box padding. The same bundled image works offline on both themes.

No new native packages are required. Reanimated drives native transforms/opacity; SVG scenery is static, without per-frame React renders. The same photograph is used throughout: modest perspective/roll and continuous framing, **no fake front-to-rear rotation**. No artificial spinning wheel overlays are added to a photograph. Native motion blur is intentionally not simulated with duplicate ghost buses; the softened trail strokes and camera movement provide the restrained movement cue.

## Timing

| Time | Scene |
| --- | --- |
| 0–300 ms | Existing app icon, fade/scale |
| 300–600 ms | Highway/trails emerge from below |
| 600–900 ms | Minimal layered mountains/city, night or sunrise |
| 900–1300 ms | Actual cutout approaches, peaks at closest framing |
| 1300–1700 ms | Framing follows as bus recedes |
| 1700–2000 ms | Bus/environment dissolve; trails converge |
| 2000–2300 ms | Original blue/red PNG wordmark fades/scales in |
| 2300–2600 ms | Clean logo hold |
| after 2600 ms | 180 ms crossfade to already-mounted application |

The root-level overlay stays mounted across ordinary routing/auth changes and is removed once. Backgrounding finishes the intro, rather than replaying a stale journey. Reduced motion bypasses scenery and transforms, using a short static logo with a 100 ms exit. Saved theme restoration completes before the native splash is hidden. If authentication restoration takes longer, hold the final logo rather than exposing a loader or blank frame. Missing/failed cutouts degrade to the short official-brand fallback.

## Validation checklist

- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run export:android`.
- For browser evidence: `npm run export:web`, then set `SAMANVI_PLAYWRIGHT_ROOT` to a separate Playwright installation and optionally `SAMANVI_BROWSER_EXECUTABLE` to Chromium/Edge, then run `node scripts/verify-intro.cjs`. This checks actual bus visibility in both themes, intro dismissal into the existing login when unauthenticated, reduced-motion bypass, live preference changes, failed-image fallback and browser runtime errors. Paused-clock captures at nominal 1300/1700/2300 ms are in `docs/intro-validation/`; they do not measure native frame rate.
- Test a **release build** on Android and iOS; Expo Go/dev client do not reproduce the native splash faithfully.
- Cold launch in light/dark/system modes and with a saved theme different from system. Inspect splash-to-intro handoff and final exit for flashes.
- With the approved bus configured, record the entire timeline on a low-end physical device; inspect 900/1300/1700/2000/2300 ms frames, road contact, alpha edges and readable actual branding. Tune framing to the source photo as needed.
- Navigate, sign out/in, background/resume: no replay. Kill/relaunch: replay once.
- Enable reduced motion (including browser preference); verify no moving scenery. Test toggling it during playback.
- Test cold launch offline, denied browser storage, failed asset load, slow auth restore, compact/tall screens, and screen reader focus after the overlay disappears.

The actual bus asset blocker is resolved. Physical-device visual/performance approval, authenticated-home handoff and release-build native splash checks remain outstanding. Browser screenshots and automated tests are not substitutes for those checks.

### Current verification

- TypeScript and ESLint: passed.
- Unit tests: 39 passed, including photo-pixel preservation, alpha-mask/background removal, size budget and camera continuity.
- Production Android and web exports: passed; both include the 591 KB cutout, not the original source photograph.
- Production-web smoke test in Edge: passed for both themes, final dismissal, reduced motion, live preference change, failed cutout loading and zero page runtime errors.
- Visual evidence: `intro-cutout-review.png` and `intro-validation/{dark,light}-{1300,1700,2300}.png`.
