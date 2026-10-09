# Verification record

## Break audio mapping update — 9 October 2026

- Mobile typecheck and lint passed; 15 domain tests passed.
- Backend build/typecheck and 63 tests passed, including mapping permissions, readiness/URL checks, preserved settings, moving/removing mappings and serializable-conflict handling.
- Frontend production build and changed-file lint passed; 20 audio tests passed, including auto-mapping after verification and retries without another storage upload.
- Expo Android and web exports passed (JavaScript/Hermes bundles, not an APK build). The fixture-backed browser audit passed with zero page errors and covers replacing/removing a Toilet Break mapping while Home stays open, picking up a newly configured mapping on tap, and displaying the mapped file title.
- A separate fixture-backed frontend browser check passed for mapping an existing file, Dinner/Toilet upload dropdown options, progress-bar visibility, and a failed mapping retry without a duplicate upload.

Use `SAMANVI_UI_EVIDENCE_DIR` when running the browser audit to save new reports/screenshots outside the historical `docs/online-validation` evidence. These checks do not claim a native APK build, real R2 upload or physical-device/speaker verification.

The online-only route-announcement implementation was validated on 6 October 2026.

## Automated results

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

No physical-device, native APK/IPA compilation, actual Bluetooth/bus speaker, OS interruption, Drive-app handoff or live production backend test is claimed. Complete `docs/DEVICE-TESTS.md` using the deployed backend and a development/preview native build. Backend, admin and mobile must be released together because the mobile bootstrap contract changed.
