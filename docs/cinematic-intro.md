# Cinematic launch intro

## Actual bus integrated

The user supplied `assets/intro/samanvi-bus-original.png` (865 × 466). Its visible coach pixels are preserved in `assets/intro/samanvi-bus.png` (817 × 459, 591,496 bytes). A hand-traced, supersampled alpha mask removes the road, guardrail, vegetation, water and lower-left inset, including the open gap behind the exterior mirror. There is no generated vehicle, repainted lettering, recoloring or invented rear view.

The actual-photo cinematic sequence is **enabled** via `src/ui/intro/assets.ts`. The 450 ms official-logo fallback remains only for reduced motion or failed asset loading. The source image is retained for reproducibility but is not imported into the production bundle.

## Reproduce / review the cutout

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-intro-bus.ps1` from the project root on Windows after `npm ci`. It uses Windows System.Drawing and the existing Expo image-tooling `pngjs` package (no new dependencies). The hand-traced mask is intentionally specific to this photograph's dimensions. Clearing invisible RGB pixels and lossless adaptive PNG filtering reduce the initial 990,894-byte cutout to 591,496 bytes without changing visible pixels. No upscaling or color quantization is applied.

Inspect `docs/intro-cutout-review.png` on both theme backgrounds. The original body, windshield lettering, curtains, striped livery, mirror and tyres remain intact. The source photo's daylight reflections remain natural photographic pixels, including in the night scene; a single source view cannot provide physically relit 3D geometry.

The frame uses the cutout's true aspect ratio, with wheel contact anchored to the curved highway rather than arbitrary image-box padding. The same bundled image works offline on both themes.

No new native packages are required. Reanimated drives transforms/opacity and the two light-ribbon paths on the UI thread, without per-frame React renders. Scenery and contact-light gradients are static. The same photograph is used throughout: modest perspective/roll and continuous framing, **no fake front-to-rear rotation**. No artificial spinning wheel overlays are added to a photograph. The softened trail strokes and camera movement provide the restrained movement cue while the real bus stays sharp.

## Refined motion and art direction

- Tonal, gently curved hills, diffused sunrise/evening light and a soft vignette give the photographic bus more breathing room.
- A single pair of thin blue/red ribbons replaces the doubled trails. They draw along the road, then smoothly interpolate their control points toward the logo's optical centre; the road itself never shrinks like a card.
- Quintic easing joins position, velocity and acceleration at shot boundaries. The approach is a restrained 0.72× to 1× push-in; the journey follows a curved path into the distance. Roll stays below half a degree and perspective below two degrees.
- The bus scales about its front-tyre contact point in the same normalized coordinate space as the road. Explicit SVG viewport sizing prevents road/contact drift on short screens. The foreground shares a 1.8% camera pullback; the distant landscape moves more slowly.
- The tyre's transform origin uses numeric `[x, y, 0]` coordinates computed from the image size. RN 0.86's string parser mishandles decimal percentages such as `50.8% 98.5%`; the numeric tuple avoids the Expo/native Z-position invariant while preserving the exact contact point. A regression test runs the installed React Native DEV style processor, which browser-only checks do not exercise.
- Radial contact shadows and a restrained headlamp reflection replace platform-specific blur filters. The final wordmark settles by only 1.5% and holds completely still from 2.3–2.6 seconds.
- The native splash hands off only after theme, layout and image decoding are ready. The existing icon stays visible through preparation. An 1800 ms asset/decode deadline falls back to static branding, and late loads cannot restart the sequence.
- Sequence completion and overlay removal follow Reanimated completion callbacks rather than wall-clock timers, preserving the full hold and exit even if JS work is delayed. Only actual backgrounding interrupts playback; iOS `inactive` launch notifications do not skip it.

## Timing

| Time | Scene |
| --- | --- |
| 0–300 ms | Existing app icon continues from native splash with a subtle scale settle |
| 300–600 ms | Highway dissolves in; ribbons begin drawing toward the horizon |
| 600–900 ms | Tonal hills and atmospheric night/sunrise lighting emerge |
| 900–1300 ms | Actual cutout approaches, peaks at closest framing |
| 1300–1700 ms | Framing follows as bus recedes |
| 1700–2000 ms | Bus/environment dissolve; trails converge |
| 2000–2300 ms | Original blue/red PNG wordmark fades/scales in |
| 2300–2600 ms | Clean logo hold |
| after 2600 ms | 220 ms eased crossfade to already-mounted application |

The root-level overlay stays mounted across ordinary routing/auth changes and is removed once. Backgrounding finishes the intro, rather than replaying a stale journey. Reduced motion bypasses scenery and transforms, using a short static logo with a 100 ms exit. Saved theme restoration completes before the native splash is hidden. If authentication restoration takes longer, hold the final logo rather than exposing a loader or blank frame. Missing/failed cutouts degrade to the short official-brand fallback.

## Validation checklist

- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run export:android`.
- For browser evidence: `npm run export:web`, then set `SAMANVI_PLAYWRIGHT_ROOT` to a separate Playwright installation and optionally `SAMANVI_BROWSER_EXECUTABLE` to Chromium/Edge, then run `node scripts/verify-intro.cjs`. This checks actual bus visibility in both themes, the complete duration/clean logo hold, 320×568 and 430×932 framing and shared road coordinates, dismissal into the existing login when unauthenticated, reduced-motion bypass, live preference changes, failed-image fallback and browser runtime errors. Paused-clock captures at nominal 900/1100/1300/1700/1950/2100/2300 ms are in `docs/intro-validation/`; they do not measure native frame rate.
- Test a **release build** on Android and iOS; Expo Go/dev client do not reproduce the native splash faithfully.
- Cold launch in light/dark/system modes and with a saved theme different from system. Inspect splash-to-intro handoff and final exit for flashes.
- With the approved bus configured, record the entire timeline on a low-end physical device; inspect 900/1300/1700/2000/2300 ms frames, road contact, alpha edges and readable actual branding. Tune framing to the source photo as needed.
- Navigate, sign out/in, background/resume: no replay. Kill/relaunch: replay once.
- Enable reduced motion (including browser preference); verify no moving scenery. Test toggling it during playback.
- Test cold launch offline, denied browser storage, failed asset load, slow auth restore, compact/tall screens, and screen reader focus after the overlay disappears.

The actual bus asset blocker is resolved. Physical-device visual/performance approval, authenticated-home handoff and release-build native splash checks remain outstanding. Browser screenshots and automated tests are not substitutes for those checks.

### Current verification

- TypeScript and ESLint: passed.
- Unit tests: 42 passed, including the native transform-origin validator, photo-pixel preservation, alpha-mask/background removal, size budget, camera continuity/acceleration and non-empty scene overlaps.
- Production Android and web exports: passed; both include the 591 KB cutout, not the original source photograph.
- Production-web smoke test in Edge: passed for both themes, duration/hold, compact/tall framing, road viewport alignment, final dismissal, reduced motion, live preference change, failed cutout loading and zero page runtime errors.
- Visual evidence: `intro-cutout-review.png` and the refreshed shot/transition captures in `intro-validation/`.
- Expo Doctor 1.21.5: 20/21 checks passed. The remaining version check recommends newer SDK 57 patches for nine Expo packages (`expo`, `@expo/metro-runtime`, `expo-asset`, `expo-constants`, `expo-crypto`, `expo-dev-client`, `expo-linking`, `expo-router`, `expo-splash-screen`). No dependency upgrades were made as part of the transform-origin fix.
