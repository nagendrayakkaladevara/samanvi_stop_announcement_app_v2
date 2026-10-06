# Samanvi Driver

Online-only Expo SDK 57 / React Native driver announcement app. Routes, audio sequence, quick announcements, Records configuration and up to three pins per driver come from the authenticated backend.

## Development

Use Node.js 22.13+ and npm. Set `EXPO_PUBLIC_API_BASE_URL` in `.env` to the HTTPS backend origin plus `/api/v1`, then:

```sh
npm ci
npm run verify
npm run web
```

Sign in with an administrator-created mobile-driver account. The service must implement the contract in [BACKEND.md](docs/BACKEND.md). A missing API URL shows a configuration error.

## Navigation

- **Home:** existing greeting and speaker status, Welcome Note selection, direct Dinner/Toilet playback, and Pinned Routes. Without pins, a single View Route Announcements button opens Audio.
- **Audio:** all published routes with route code, start/end, Via, bus type and Pin/Unpin. Open a route to load announcements in backend sequence order. Tap any audio to stream it; the active row and player indicate playback.
- **Records:** one centered button opens the current configured Google Drive folder.
- **Settings:** speaker controls, audio library, sign-out, keep-awake/speaker-check preferences and support.

The app has no persistent catalog, media downloads, local route selection, queued mutations or demo fallback. Only authentication and user preferences persist. Network loss interrupts playback; API errors offer retry. Pin changes are committed by the backend before the UI updates.

## Native build

The local audio-route module observes Android/iOS output devices. It requires a development or preview build; Expo Go does not include it.

```sh
npx eas-cli@latest build --platform android --profile preview
```

Set the API URL in the corresponding EAS environment before building. Native projects are generated using the configuration in `app.json`. The streaming architecture removes the SQLite plugin, so ship a new native build.

## Source map

| Area | Location |
| --- | --- |
| Expo Router screens | `src/app/` |
| Streaming player and catalog state | `src/state/` |
| API and secure preferences/session storage | `src/services/` |
| API schemas and playback gate | `src/domain/` |
| Shared UI and route cards | `src/ui/` |
| Native audio-output observation | `modules/samanvi-audio-route/` |

See [VERIFICATION.md](docs/VERIFICATION.md) for checks, [DEVICE-TESTS.md](docs/DEVICE-TESTS.md) for native scenarios, and [MEDIA.md](docs/MEDIA.md) for browser-test audio attribution.
