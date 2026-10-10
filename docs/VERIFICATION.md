# Verification record

## Pinned offline audio and themes — 10 October 2026

| Check | Result |
| --- | --- |
| Mobile `npm run verify` | Passed: TypeScript, ESLint and 26 tests |
| Backend `npm test` | Passed: 72 tests across six files |
| Backend `npm run build` | Passed |
| Expo dependency compatibility | `npx expo install --check` passed |
| Expo web export | Passed with fixture API URL |
| Expo Android export | Passed: Hermes/JavaScript bundle and assets |
| Fixture-backed browser audit | Passed: ten check groups, zero page errors |
| Git whitespace checks | Passed in mobile and backend |

New automated coverage includes expiry/clock rollback, complete versus incomplete sync, unchanged renewal, pin scope and shared files, local-source playback without API calls, missing/corrupt-source recovery, one transfer shared by simultaneous play requests, cancellation, bounded retries, and download policy/storage limits. Backend coverage includes the authenticated consistent snapshot, user-scoped revisions, metadata-only edits, removals and failed-sync behavior.

The browser audit covers existing route/quick playback, mappings, Records and pins; persisted catalog after API failure; Light/Dark persistence and System appearance changes; navigation request deduplication; incomplete-sync lease preservation; temporary token-refresh failure; and confirmed session revocation clearing both session and lease. Screenshots/reports for this run are in `C:\Users\HP\AppData\Local\Temp\opencode\offline-theme-evidence`.

The Android export checks JavaScript bundling, not an APK/native compilation. Real-device FileSystem transfers/resume, offline cold launch, Bluetooth/bus speakers, calls and background playback remain the device checks in [DEVICE-TESTS.md](DEVICE-TESTS.md). Deployment order and the APK command are in [OFFLINE-AUDIO-RELEASE.md](OFFLINE-AUDIO-RELEASE.md). No new admin frontend contract or Prisma migration is required for this release.

## Break audio mapping update — 9 October 2026

- Mobile typecheck and lint passed; 15 domain tests passed.
- Backend build/typecheck and 63 tests passed, including mapping permissions, readiness/URL checks, preserved settings, moving/removing mappings and serializable-conflict handling.
- Frontend production build and changed-file lint passed; 20 audio tests passed, including auto-mapping after verification and retries without another storage upload.
- Expo Android and web exports passed (JavaScript/Hermes bundles, not an APK build). The fixture-backed browser audit passed with zero page errors and covers replacing/removing a Toilet Break mapping while Home stays open, picking up a newly configured mapping on tap, and displaying the mapped file title.
- A separate fixture-backed frontend browser check passed for mapping an existing file, Dinner/Toilet upload dropdown options, progress-bar visibility, and a failed mapping retry without a duplicate upload.

Use `SAMANVI_UI_EVIDENCE_DIR` when running the browser audit to save new reports/screenshots outside the historical `docs/online-validation` evidence. These checks do not claim a native APK build, real R2 upload or physical-device/speaker verification.

The online-only route-announcement implementation was validated on 6 October 2026.

## Historical online-only results — 6 October 2026

| Check | Result | Scope |
| --- | --- | --- |
| Mobile TypeScript | Passed | `npm run typecheck` |
| Mobile ESLint | Passed | `npm run lint` over `src`, native module interfaces and tests |
| Mobile domain tests | 12 passed | Online bootstrap, URL validation, explicit sequence, quick announcements, pin limits, Records URL, playback races/output loss, labels and recovery states |
| Expo web export | Passed | SDK 57 browser bundle with fixture API URL and no bundled announcement audio |
| Expo Android export | Passed | Android Hermes bundle and assets; this is not an APK or native compilation |
| Online browser audit | Passed; zero page errors | Auth, pins, route playback, quick announcements, Records, failure/retry behavior and responsive layout |
| Backend build/typecheck | Passed | Matching mobile/admin API implementation |
| Backend tests | 25 passed | Four test files, including mobile API and concurrent pin behavior |
| Isolated migrations | Passed | All 17 migrations applied to a clean PGlite PostgreSQL instance; pin and bus-type constraints checked |
| Admin changed-file ESLint | Passed | Modified Audio App service, types and page |
| Admin audio tests | 5 passed | Existing audio-upload tests |
| Admin production build | Passed | TypeScript, Vite and PWA service-worker generation |

The full admin repository lint still reports pre-existing errors in unrelated source and generated `dev-dist` files. The files changed for this feature pass targeted linting.

## Browser audit

The fixture-backed React Native Web audit verified:

- authenticated live startup with no media download or persisted catalog;
- empty and three-pin Home states, the three-route limit, cross-tab synchronization and restoration after reload;
- route metadata and explicit backend sequence values, including gaps;
- audio resolution immediately before streaming and the active playback row;
- multiple Welcome Notes and direct Dinner/Toilet playback;
- the configured Google Drive request and the missing-configuration state;
- stream interruption on network loss, stale-catalog removal on a 503 response and retry recovery;
- no horizontal document overflow at 320, 390, 430 and 768 pixels; and
- no browser page errors.

The machine-readable report and screenshots are in `docs/online-validation/`.

To reproduce after exporting with the fixture API URL:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL='https://announcements.example.test/api/v1'
npx expo export --platform web --output-dir dist-ui-api --max-workers 2
$env:SAMANVI_PLAYWRIGHT_ROOT='C:\Users\HP\AppData\Local\Temp\opencode\validation'
$env:SAMANVI_BROWSER_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/verify-ui.cjs
```

Playwright is intentionally installed in the temporary validation directory rather than as an application dependency. The audit intercepts the fixture API and Drive navigation; it does not contact production.

## Remaining acceptance work

No physical-device, native APK/IPA compilation, actual Bluetooth/bus speaker, OS interruption, Drive-app handoff or live production backend test is claimed. Complete `docs/DEVICE-TESTS.md` using the deployed backend and a development/preview native build. The original 6 October bootstrap release required coordinated backend/admin/mobile deployment; the 2.1 offline-sync endpoint is additive and supports older clients.
