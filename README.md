# Samanvi Driver 2.0

A fresh React Native + Expo + TypeScript app for Samanvi Travels driver announcements, based on the [mobile UX requirements](https://nagendrayakkaladevara.github.io/samanvi-travels-mobile-ux/).

This is a working pilot source project. It includes the mobile UI, sample audio, offline storage implementation, API adapter, and Android/iOS audio-route modules. Native compilation and physical speaker testing remain to be completed. No APK or IPA is included.

The application identifier is `com.samanvitravels.driver.v2`, with its own storage and URL scheme. There is no data migration from the older app.

## Start here

Use Node.js 22.13 or newer and npm. From this directory:

```sh
npm ci
npm run verify
npm run web
```

With no API URL configured, the app opens a demo library with four real sample announcements: dinner break, toilet break, Vijayawada, and Visakhapatnam. Lunch is shown as unavailable because no lunch recording is bundled.

In the browser, open **Check speaker → Test on this device** to try audio. Speaker detection requires a native build. The browser adapter is a UI preview: audio blobs last for the current page session and are populated again on reload.

## Build an Android APK

The local audio-route module requires a custom app build. Use the preview APK to test offline startup, Bluetooth, and background playback; Expo Go cannot validate this integration.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Choose your Expo account and a **new project** during configuration. The CLI links this source to that project and manages Android signing if selected. Install the APK from the completed EAS build. A preview build includes its JavaScript and bundled demo media; it does not require a Metro development server.

For development on a phone:

```sh
npx eas-cli@latest build --platform android --profile development
npm start
```

Install the development build, then open the Metro link in that app. Developers with Android Studio and the matching Android SDK can also use `npm run android`. For iOS, use an EAS iOS build with the appropriate Apple signing and device provisioning, or `npm run ios` on a configured Mac.

Run the scenarios in [DEVICE-TESTS.md](docs/DEVICE-TESTS.md) before a driver pilot. An Android JavaScript export does not compile Kotlin, create an APK, or prove Bluetooth behavior.

## Connect the announcement service

For local development, copy `.env.example` to `.env` and set:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-HOST/api/v1
```

Replace the placeholder with the deployed backend URL and restart Metro with `npm start -- --clear`. This is a public API base URL; it must not contain an admin token or other secret.

For a cloud preview build, set `EXPO_PUBLIC_API_BASE_URL` as a plaintext variable in the linked EAS project's **preview** environment. Use the corresponding **development** and **production** environments for those profiles. Local `.env` files are excluded from source control, so configure cloud variables explicitly before building. The URL is included when JavaScript is bundled; changing it requires a new bundle/build.

The app consumes the existing mobile bootstrap and route-manifest endpoints. It validates their responses, downloads common announcements, and lets the driver select and download a published route. See [BACKEND.md](docs/BACKEND.md) for the exact contract and remaining backend work.

The reviewed mobile API exposes published announcements without driver authentication. This pilot therefore uses **Get started**, with no simulated sign-in. Driver login, token storage, and driver-specific route assignment require a driver authentication contract from the backend.

## Included behavior

| Area            | Implementation                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Home            | Quick announcements, selected route, speaker status, library progress                                 |
| Routes          | Search, empty states, selection, cached version/update information                                    |
| Announcements   | Ordered stop audio and route download flow                                                            |
| Playback        | One shared player, pause/resume/restart/stop, progress, mini-player, switch confirmation              |
| Offline library | Native SQLite metadata and files in the app's document directory                                      |
| Download checks | HTTPS, declared size, optional SHA-256, staged files, snapshot saved after all required files succeed |
| Speaker         | System output observation, output-change interruption, explicit device test, pairing instructions     |
| Settings        | Persistent keep-awake and speaker-check preferences                                                   |
| Help            | Connection, download, offline, and interruption guidance                                              |
| Records         | Coming-soon screen; no playback history is recorded                                                   |

The speaker check is enabled by default. Unknown output blocks ordinary playback, while an explicit device test can bypass the check. Pairing remains in system settings. This app does not scan nearby Bluetooth devices or manage pairing itself.

## Technology and source map

| Part                      | Choice                                                | Location                       |
| ------------------------- | ----------------------------------------------------- | ------------------------------ |
| App                       | Expo SDK 57, React Native 0.86, React 19, TypeScript  | `package.json`                 |
| Navigation                | Expo Router                                           | `src/app/`                     |
| UI                        | React Native primitives, shared styles, Feather icons | `src/ui/`                      |
| Domain validation         | Zod, revision checks, playback request gate           | `src/domain/`                  |
| Data and preferences      | Small React context providers                         | `src/state/`                   |
| Backend                   | Typed fetch adapter for the existing service          | `src/services/api.ts`          |
| Native storage            | Expo SQLite, File System, Crypto                      | `src/services/storage.ts`      |
| Browser preview           | localStorage and temporary audio blobs                | `src/services/storage.web.ts`  |
| Audio                     | Expo Audio and Keep Awake                             | `src/state/playback.tsx`       |
| Native output observation | Android MediaRouter; iOS AVAudioSession               | `modules/samanvi-audio-route/` |
| Build profiles            | EAS development, preview, production                  | `eas.json`                     |

The native `android/` and `ios/` app directories are generated by Expo during builds. Configure them through `app.json` and modules rather than committing hand-edited generated projects. Rebuild the native app after changing a native module or plugin configuration.

## Verification and limits

All ten screens received a UI and UX review. Changes include clearer status labels, larger controls, grouped audio, direct missing-download recovery, explicit route selection, and labelled playback controls. See [UI-UX-REVIEW.md](docs/UI-UX-REVIEW.md) for every screen's findings, before/after screenshots, and remaining improvements. Mobbin references could not be retrieved because the connector required a paid plan.

TypeScript, ESLint, 16 domain tests, demo and service-fixture browser checks, and web/Android JavaScript exports passed. Expo autolinking found the local module for both platforms during the initial implementation. The updated verification record and screenshots are in `docs/`.

The Kotlin/Swift module has not yet been compiled in an APK/IPA. Bluetooth disconnection timing, calls and other audio interruptions, locked-screen playback, and native storage persistence require physical-device tests. A live backend URL was not supplied, so service integration was checked against the reviewed API contract, not a deployed service.

Android's system route API may classify wired or Bluetooth LE outputs differently across phones. This implementation accepts Android routes identified as Bluetooth; unknown/other output stays blocked by the default check. iOS additionally recognizes wired outputs. Test the actual phone and bus hardware before relying on detection.

Old audio revision files are retained to preserve usable downloads during failed updates. Automatic storage cleanup is a future maintenance task. Existing same-size files are checked for presence and size during restoration; SHA-256 is verified when a file is downloaded, not on every launch.

## References and media

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS environment variables](https://docs.expo.dev/eas/environment-variables/manage/)
- [Media sources](docs/MEDIA.md)

The screen layouts and application code are new. Four sample audio recordings were copied from the existing Samanvi audio project for a functional demo.
