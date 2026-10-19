# Cinematic launch intro

## Asset blocker — not ready for visual sign-off

The chat storyboard is a visual reference, not a source photograph available on disk. No actual bus photograph or transparent cutout was accessible in this checkout. **No bus has been fabricated, downloaded, or substituted.** Background removal and bus-specific visual validation therefore remain pending.

The app currently shows the official logo for 450 ms, then crossfades into the existing authenticated home or login screen. It does **not** claim to show the completed moving-bus animation. The complete 2.5D timeline is implemented but only enabled when an approved actual-bus cutout is configured.

## Supply the actual bus

1. Save the original front-three-quarter photograph locally. Extract the coach using a careful foreground mask (include mirrors, headlights, wheels; exclude the original ground/shadow). Preserve all original body colors, lettering, curtains and reflections. Do not use a screenshot cropped from the storyboard.
2. Export a tightly cropped, transparent sRGB PNG to `assets/intro/samanvi-bus.png`. Target 1000–1200 px width, preferably below 600 KB. Inspect the alpha edges on both light and dark backgrounds; no white halo or clipped mirrors. Keep wheels along the bottom of the image so the independent contact shadow aligns correctly.
3. In `src/ui/intro/config.ts`, replace `null` with `require("../../../assets/intro/samanvi-bus.png")`. Use a bundled static asset, not a remote URI (startup must work offline).
4. Update the asset-blocker test to verify the configured asset rather than `null`. Calibrate bus framing/shadow against the actual cutout before approving the PR.

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
- Test a **release build** on Android and iOS; Expo Go/dev client do not reproduce the native splash faithfully.
- Cold launch in light/dark/system modes and with a saved theme different from system. Inspect splash-to-intro handoff and final exit for flashes.
- With the approved bus configured, record the entire timeline on a low-end physical device; inspect 900/1300/1700/2000/2300 ms frames, road contact, alpha edges and readable actual branding. Tune framing to the source photo as needed.
- Navigate, sign out/in, background/resume: no replay. Kill/relaunch: replay once.
- Enable reduced motion (including browser preference); verify no moving scenery. Test toggling it during playback.
- Test cold launch offline, denied browser storage, failed asset load, slow auth restore, compact/tall screens, and screen reader focus after the overlay disappears.

Physical-device visual/performance approval is outstanding until the real asset is supplied. Automated timing tests are not a substitute for that approval.
