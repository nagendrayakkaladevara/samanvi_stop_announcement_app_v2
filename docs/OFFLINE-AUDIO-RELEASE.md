# Pinned offline audio and appearance release

Implemented on 2026-10-10. This supersedes the original plan's online-only baseline.

## Driver behavior

1. Sign in, open Audio, and pin up to three frequently used routes.
2. Keep the app open while it prepares audio. Each route shows ready/total counts, download progress, connection/Wi-Fi waiting, or a useful retry error.
3. Wait for **Ready offline** before departure. Ready pinned audio plays without network calls, including pause/resume/replay and an offline cold restart.
4. A successful authenticated sync authorizes downloaded audio for 30 days. The next refresh immediately applies the current routes, pins and available audio; unchanged files are reused. At expiry reconnect and sync (or sign in again if the online session has expired).
5. Unpinning removes offline eligibility and cancels route-only queued work. Shared media stays while another pin needs it; loaded playback sources are protected from physical deletion until released.
6. Settings includes Light, Dark and System appearance; Wi-Fi-only downloads; 100/250/500 MB limits; sync and retry. Preferences persist across restarts and theme changes do not remount the player.

Only pinned route files download. Quick/common announcements, unpinned routes and Records remain online features. Files are account-scoped; sign-out immediately removes in-app access and clears the lease. A later successful login/sync by the same driver can reuse verified unchanged bytes.

## Implementation

- Backend: additive authenticated `/mobile/announcements/sync`, consistent complete pin snapshots, revision-based unchanged responses, server-issued 30-day expiry. Existing endpoints remain compatible.
- Catalog: validated per-account JSON snapshot, safe file replacement, in-flight request deduplication, 15-minute foreground freshness and reconnect debounce. Failed network sync retains last good data/expiry.
- Downloads: Expo SDK 57 FileSystem persistent document directory, sequential queue, native pause/resume state, 45-second stalled-transfer detection, up to three attempts with backoff, explicit retry, disk/budget checks, shared content keys, temporary files and hash/size verification.
- Download lifecycle: foreground preparation; pause when backgrounded or the selected network policy blocks downloads. Resume on return/connectivity restoration. A hard process kill without native resume data may require restarting the unfinished file; it cannot mark a partial file ready.
- Local playback: source resolution before playback, using the app-managed verified path; local audio continues on signal loss. Existing speaker protection, lock-screen, call interruption and repeated-play behavior remain.
- Authentication: immediate saved-session restoration; on-demand token refresh; transport failures no longer log the driver out. Confirmed online rejection removes access. Offline clock checks detect substantial rollback using a persisted high-water mark; this is not DRM against a modified/rooted client.
- Appearance: contextual light/dark palettes across screens, cards, player, forms, tabs and status bar, with persistent explicit/system selection. Existing Samanvi branding is retained.
- Web preview: persistent catalog/preferences and normal streaming; native downloads are explicitly identified as Android/iOS-only.

The catalog/index uses small JSON files rather than SQLite: only three route manifests are downloaded, and native media files hold the bytes. Playback checks the current manifest as well as local file integrity. Download updates never overwrite a live source's file; content keys change with bytes.

## Deployment

1. Deploy the updated backend. No new Prisma migration, secret, storage bucket, Worker or admin UI change is required for this feature. Existing admin uploads, mappings, publishing and pins continue to drive the mobile catalog.
2. Run `npm ci` in the mobile repository and ensure the production `EXPO_PUBLIC_API_BASE_URL` is configured for the EAS profile.
3. Build a fresh APK: `npx eas-cli@latest build --platform android --profile preview`. `expo-file-system` and `expo-system-ui` were added through `npx expo install`; an OTA-only update is insufficient for binaries missing these modules.
4. The native folders are ignored/generated; EAS generates configuration from `app.json`. If building locally from an existing generated native folder, regenerate its configuration with Expo before building.
5. Install on real driver hardware and complete the device scenarios in [DEVICE-TESTS.md](DEVICE-TESTS.md), especially cold offline launch, Bluetooth output, partial download recovery and background playback.

No production deployment, R2 settings change or APK build is performed by the source changes. CDN cache rules and audio transcoding remain infrastructure/media-production optimizations; they are not required for the offline path and are not claimed as deployed. These changes reduce repeat reads/API work, not the GB of audio stored in R2.

## Verification

Automated domain tests cover the 30-day boundary and clock rollback, complete/unchanged sync contracts, pin eligibility and shared media, zero-network local source resolution, corruption fallback, waiting on in-flight preparation, cancellation, retry and storage/network gating. Backend tests cover authenticated snapshot scope, user-scoped revisions, metadata/media identity, removals, failed sync and renewal duration.

The browser fixture audit checks existing route/quick playback and mappings, persisted pins, preserved catalog/auth after service failure, persisted light/dark selection, responsive layout and reduced navigation-triggered API requests. It cannot verify native FileSystem, real R2 range behavior, speaker hardware or OS audio interruptions.

Run `npm run verify`, the backend test/build scripts, and Expo Android/web exports before building. See [VERIFICATION.md](VERIFICATION.md) for the recorded results.
