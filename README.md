# Samanvi Driver

Expo SDK 57 / React Native driver announcement app with offline audio for up to three pinned routes and Light, Dark, and System appearance modes. Routes, audio sequence, quick announcements, Records configuration and pins come from the authenticated backend.

## Development

Use Node.js 22.13+ and npm. Set `EXPO_PUBLIC_API_BASE_URL` in `.env` to the HTTPS backend origin plus `/api/v1`, then:

```sh
npm ci
npm run verify
npm run web
```

Sign in with an administrator-created mobile-driver account. The service must implement the contract in [BACKEND.md](docs/BACKEND.md). A missing API URL shows a configuration error.

## Navigation

- **Home:** existing greeting and speaker status, Welcome Note selection, direct Dinner/Toilet playback, and Pinned Routes. Quick buttons show their mapped file, refresh stale mappings when Home is focused, and resolve the current mapping again before playback. An unconfigured button can be tapped to check for newly mapped audio. Without pins, a single View Route Announcements button opens Audio.
- **Audio:** all published routes with route code, start/end, Via, bus type and Pin/Unpin. Pinning prepares that route's audio on native devices. Wait for **Ready offline** before departure. Ready local files play without network requests; unpinned routes stream online. Backend sequence and gaps are preserved.
- **Records:** one centered button opens the current configured Google Drive folder.
- **Settings:** Light/Dark/System appearance, download status/storage limits, Wi-Fi-only controls, sync/retry, speaker controls, audio library, sign-out, keep-awake preferences and support.

The catalog and verified pinned-route audio persist per account. Offline permission lasts 30 days after a successful authenticated sync; the next successful sync immediately reconciles removals, changes and pins, renewing access to unchanged files without downloading them again. Failed network requests preserve saved data and do not sign the driver out or extend offline access. Pin changes remain server-confirmed. Quick/common announcements and Records require internet.

Downloads run while the app is in the foreground, with one resumable transfer at a time. Switching apps pauses the queue; returning resumes preparation. Network loss does not interrupt local playback. Browser preview persists metadata and themes but streams media rather than claiming native offline downloads.

## Native build

The local audio-route module observes Android/iOS output devices. It requires a development or preview build; Expo Go does not include it.

```sh
npx eas-cli@latest build --platform android --profile preview
```

Deploy the matching backend first, then build a new APK with the production API URL in the EAS environment. This release adds `expo-file-system` and `expo-system-ui`; it requires a new native build. Native projects are generated using `app.json`. No new database migration or admin frontend API change is required for offline sync. See [OFFLINE-AUDIO-RELEASE.md](docs/OFFLINE-AUDIO-RELEASE.md) for deployment and device checks.

## Source map

| Area | Location |
| --- | --- |
| Expo Router screens | `src/app/` |
| Local-first player, catalog and auth state | `src/state/` |
| API, native media storage, secure lease/preferences/session storage | `src/services/` |
| API schemas, download queue, offline policy and playback gate | `src/domain/` |
| Shared UI and route cards | `src/ui/` |
| Native audio-output observation | `modules/samanvi-audio-route/` |

See [VERIFICATION.md](docs/VERIFICATION.md) for checks, [DEVICE-TESTS.md](docs/DEVICE-TESTS.md) for native scenarios, and [MEDIA.md](docs/MEDIA.md) for browser-test audio attribution.

## Architecture

The [original optimization plan](docs/OFFLINE-AUDIO-OPTIMIZATION-PLAN.md) records the architecture review and selected policies. The [release implementation notes](docs/OFFLINE-AUDIO-RELEASE.md) describe the implemented behavior and deployment requirements.
