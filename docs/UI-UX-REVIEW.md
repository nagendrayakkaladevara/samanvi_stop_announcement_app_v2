# Samanvi Driver v2 — UI and UX review

> Historical review of the September 2026 prototype. Its saved-library/demo flows have been replaced by the online-only architecture in [BACKEND.md](BACKEND.md). Current checks and browser audit instructions are in [VERIFICATION.md](VERIFICATION.md); the old screenshots below are retained as historical evidence.

Review date: 27 September 2026.

All ten screens in the fresh v2 app were reviewed, and the changes below were applied to the source. The focus was preparing route audio, finding the right announcement, understanding playback/output status, and recovering from missing downloads or service errors.

Mobbin was requested as a reference source. Both reference searches returned a paid-plan access requirement. No Mobbin screens were retrieved, and this report does not claim a Mobbin benchmark. Findings come from source inspection, direct review of the browser preview, and interaction checks.

## Screen-by-screen findings and changes

| Screen        | Finding                                                                                                                                   | Applied improvement                                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome       | A fixed layout could make the primary action difficult to reach on short screens or with larger text. Setup needed a clearer explanation. | Scrollable onboarding, a short choose/save/connect explanation, one Get started action, and a visible demo label.                                                                                                                             |
| Home          | Unpublished lunch audio appeared actionable. Secondary labels were small, and the library was less direct to reach.                       | Disabled, explicitly labelled unavailable audio; direct Library action; clearer route/speaker status; larger labels and quick-action layout that stacks at larger native font scales.                                                         |
| Routes        | The current route relied too much on its border. Search recovery and selection failure needed clearer behavior.                           | Current route badge and accessible current state, result count, clear-search control, readable origin/destination, and navigation only after the route selection is saved successfully.                                                       |
| Route audio   | Download readiness and route updates were not distinct enough. A route with zero stops could be treated as ready.                         | Ordered stop labels, explicit download/update actions, current playback state, and a genuine no-stops empty state with a recovery action.                                                                                                     |
| Player        | An error or interrupted/completed announcement could be labelled Paused. Icon-only controls were harder to understand.                    | Separate loading, playing, paused, stopped, interrupted, error, and completed labels; text labels for Restart/Stop and the central action; accurate file format; one clear output card; accessible progress values.                           |
| Bus speaker   | Pairing instructions pushed the test action down. Browser controls implied capabilities the preview does not have.                        | Output status first, a visible test action using an available saved recording, concise setup steps, and clear browser capability messaging. Native connection controls remain available in native builds.                                     |
| Audio library | Download actions sat below content. Missing files could lead back to the same screen without starting recovery.                           | Readiness summary, actions above the lists, common/route groups, last-sync time, direct retry/download from each missing row, current-route labels, and update indicators. Downloading a different cached route preserves the selected route. |
| Records       | The placeholder was a dead end and could imply that history was already being collected.                                                  | Explicit statement that no history is recorded, Coming soon status, and a Go to route audio action.                                                                                                                                           |
| Settings      | Small labels and switches needed stronger consistency. Turning off the speaker guard lacked a prominent explanation.                      | Readable captions, consistent switch colors, native switch hit slop, roomier preference rows, and an explanatory notice when the speaker check is off.                                                                                        |
| Help          | Instructions required users to find the recovery screen themselves.                                                                       | Expandable topics with accessible expanded state, one topic open initially, and direct links to the relevant speaker or download action.                                                                                                      |

## Highest-impact fixes

1. Missing-audio rows now perform the download in place instead of sending the user back into the library.
2. A download for another cached route no longer changes the driver's current route.
3. Failed route selection remains on the picker with an error, so the app does not continue with an unsaved selection.
4. Playback errors, interruptions, and completion have their own labels and recovery actions.
5. Unpublished audio and zero-stop routes no longer imply that audio is ready to play.
6. A new error is brought into view even when the user has scrolled down a long library.

## Shared visual and interaction rules

- A single red accent identifies primary actions and the selected navigation tab. Green is reserved for saved/ready status; amber for caution; blue for informational messages.
- Shared screen gutters are 20 units, normal vertical gaps are 16, and cards use an 18-unit radius. Headings, body text, captions, buttons, and status pills use shared components.
- Primary buttons have a minimum height of 54 units. Icon controls have a minimum 44-by-44 target; quiet actions also have a minimum 44-unit height. Native switches retain their platform behavior with added hit slop.
- Standard body text is 15 units, secondary text is generally 13–14, and tab/status labels are 12. Text can wrap; decorative icons are excluded from accessibility labels.
- The muted text/background pair has a calculated contrast of 5.08:1; subtle placeholder text is 4.64:1; white primary-button text against red is 5.56:1. These token checks are not a full accessibility certification.
- Selected, unavailable, saved, downloading, update, and playback states use words and/or icons alongside color.
- Screen padding accounts for the mini-player and bottom navigation. Back screens use their safe-area inset. Onboarding scrolls when it cannot fit vertically.
- Browser accessibility attributes expose route/current-item state, expanded Help sections, loading state, and progress values. Native screen-reader and large-text behavior still require device checks.

## Verification and evidence

The demo browser audit covers onboarding, the unavailable quick action, speaker guarding, actual sample-file playback, pause/resume/restart/stop/completion/replay, route search and selection, preferences, Help, and playback across navigation. Nine entered-app screens were checked for horizontal document/text clipping at widths of 320, 390, 430, and 768 pixels. Welcome was checked at 390 × 844 and 320 × 640. The browser preview remains phone-width at wider viewport sizes.

The service-fixture audit covers bootstrap, route manifests, initial downloads, a simulated failed selection save, missing-file recovery, a 503 refresh failure with old audio still playable, route updates, zero stops, and an empty published catalog. These use intercepted API-shaped responses and real bundled sample files; they are not tests against a deployed service.

Both browser audits completed with zero page errors. TypeScript, ESLint, and all 16 domain tests passed. Web and Android JavaScript exports passed; the Android export does not compile the native modules or produce an APK.

Evidence:

- [Current screen screenshots](screenshots/)
- [Before-review screenshots](ui-review/before/)
- [Empty/error/completion and narrow-screen screenshots](ui-review/states/)
- [Demo browser report](ui-review/browser-check.json)
- [Service-fixture report](ui-review/api-check.json)
- [Verification scope](VERIFICATION.md)

## Repeating the browser audit

The optional runner is `scripts/verify-ui.cjs`. It needs Playwright and an installed Chromium browser. Playwright is not included in the mobile app's runtime or locked dependencies. Supply an existing tools installation with `SAMANVI_PLAYWRIGHT_ROOT`, or install Playwright in a separate test-tools directory and point that variable at the directory containing its `package.json`.

Export and run the demo with no real API URL configured:

```sh
EXPO_PUBLIC_API_BASE_URL= npx expo export --platform web --clear
node scripts/verify-ui.cjs
```

Run the service fixtures separately:

```sh
EXPO_PUBLIC_API_BASE_URL=https://announcements.example.test/api/v1 npx expo export --platform web --output-dir dist-ui-api --clear
node scripts/verify-ui.cjs --api
```

The fixture hostname is intercepted by the runner. Do not configure it in a mobile build. `--clear` prevents a previous environment-specific bundle from being reused. Rebuild the normal demo or use the real API URL afterward. Optional `SAMANVI_BROWSER_EXECUTABLE` and `SAMANVI_BROWSER_ARGS_JSON` variables support an existing Chromium installation. The runner starts and closes its own local preview server.

## Remaining improvements and release checks

| Priority                                  | Next step                                                                                                                                            | Why it remains                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Before a driver pilot                     | Test TalkBack/VoiceOver, 150% and 200% text, display scaling, keyboard focus, safe areas, Back navigation, and readability on a real phone outdoors. | Browser layouts cannot prove native accessibility or readability in the driver's environment.                                |
| Before a driver pilot                     | Test the actual bus speaker, disconnect/reconnect, calls, background playback, offline cold start, and low storage.                                  | These depend on native modules, OS behavior, and hardware. See [DEVICE-TESTS.md](DEVICE-TESTS.md).                           |
| Before restricted access                  | Define driver login and route-assignment behavior with the backend.                                                                                  | The existing mobile endpoints expose published routes without driver authentication.                                         |
| Before production navigation is finalized | Implement useful Records history, or remove the empty Records destination from primary navigation.                                                   | The honest placeholder is now recoverable, but still occupies a primary tab. This needs a product-scope decision.            |
| Content improvement                       | Publish the missing lunch announcement and use a stable common-audio purpose/category field.                                                         | Current quick-action matching depends on recording titles; a stable purpose field supports reliable naming and localization. |
| Usability validation                      | Observe drivers preparing a route, playing a stop, and recovering from disconnected output while safely parked.                                      | This review improves consistency and recovery paths; it does not replace testing with actual drivers.                        |

The native Kotlin/Swift module has not been compiled or exercised here. No live-backend test, store upload, or new deployment is claimed.
