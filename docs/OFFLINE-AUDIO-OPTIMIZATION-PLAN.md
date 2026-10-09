# Offline audio and API cost optimization plan

Status: proposed; documentation only. No behavior described as proposed below is implemented by this document.

Reviewed: 2026-10-09.

## Goal

Allow drivers to play prepared announcements reliably in weak or absent signal, while reducing per-play API requests, repeated media downloads, and associated backend/database and delivery costs.

**Recommendation: download once, play locally, and synchronize changes occasionally.** Reducing metadata API calls alone will not prevent audio buffering. Files must be available on the phone before entering a low-signal area.

## Review scope and current architecture

The review covered mobile navigation, authentication, catalog state, playback, native speaker-output integration, announcement APIs, database models, and the active admin audio-upload flow. This is an audio-focused architecture review, not an audit of unrelated ticketing features or production infrastructure.

```text
Admin web app
  -> Backend issues a signed upload URL
  -> Browser uploads directly to Cloudflare R2
  -> Backend verifies size/content type and stores metadata
  -> Administrator assigns audio to routes and publishes them

Driver mobile app
  -> Refreshes authentication
  -> Fetches bootstrap (routes, quick announcements, configuration, pins)
  -> Fetches a route playlist when its screen gains focus
  -> Resolves audio against the backend before each play/resume
  -> Streams directly from the media storage URL
```

The current online-only behavior is intentional: `README.md` and `docs/BACKEND.md` document it, and the backend playback endpoint explicitly validates current availability to prevent playback from stale screen data.

### Existing foundations to retain

- Media bytes already bypass the application backend.
- Uploads use unique storage keys and conditional writes to prevent overwriting.
- Routes have version numbers, incremented on route edits, playlist edits, and archiving.
- Audio records include size, storage ETag, and an optional SHA-256 checksum.
- The player includes speaker checks, Bluetooth/output-loss handling, background playback, lock-screen controls, repeated-play warnings, and cancellation protection.
- Driver authentication includes device binding and server-side session/account checks.

A full application rewrite is unnecessary.

### Current bottlenecks

Mobile paths are relative to this repository. Backend and admin paths refer to sibling projects in the reviewed workspace; they are not files in this repository.

| Behavior | Source | Consequence |
| --- | --- | --- |
| `fetchAudio()` runs before every play/replay | `src/state/playback.tsx` | Adds a backend round trip before playback |
| Resume calls `fetchAudio()` but does not use the returned URL | `src/state/playback.tsx` | Resuming depends on connectivity even when the source is already loaded |
| Player streams with `downloadFirst: false`; no persistent media manager exists | `src/state/playback.tsx`, `package.json` | Repeated playback can request media again; no guaranteed offline availability |
| Network loss explicitly pauses the player | `src/state/playback.tsx` | Playback is interrupted even if bytes might already be buffered |
| Catalog is memory-only, hidden offline, and cleared on refresh failure | `src/state/library.tsx` | Previously loaded announcements disappear during poor connectivity |
| Bootstrap reloads on foreground events and connectivity-dependent effect changes | `src/state/library.tsx` | Frequent app switching/reconnection can trigger repeat requests |
| Route data is cleared and reloaded on screen focus | `src/app/route-announcements.tsx` | Returning from the player can reload the playlist |
| Startup and foreground auth refresh failures invalidate the saved session | `src/state/auth.tsx` | A timeout or temporary outage can sign the driver out |
| Requests and announcement responses use `no-store` | `src/services/api.ts`; backend `src/routes/mobile-announcements.route.ts` | No conditional metadata caching strategy |
| Every authenticated request checks the session/account in the database | backend `src/middleware/mobile-auth.ts` | Per-play requests incur authorization work as well as an audio lookup |

Relevant upstream sources:

- Backend: `src/lib/mobile-announcements.ts`, `src/lib/r2-storage.ts`, `src/routes/announcement-audios.route.ts`, `src/routes/announcement-routes.route.ts`, `src/auth/mobile-auth.service.ts`, `prisma/schema.prisma`.
- Admin: `frontend/samanviticketingtool-viteFE/samanviissuereport/src/features/audio-app/announcements.service.ts`.

No per-play speech-generation service was found in this audio flow. The app plays uploaded files; the optimizations target API/database work, media reads/delivery, and driver data usage.

## Proposed architecture

```text
Occasional authenticated sync
          |
          v
Persistent catalog and route playlists
          |
          v
Download queue -> R2/CDN -> Verified local audio files
                                  |
                                  v
                           Local-first player
```

Playing a verified downloaded announcement within the approved offline-access window must make **zero playback API requests and zero media requests**. Background synchronization is independent of the play action.

### 1. Persistent media storage and download manager

- Store prepared-trip downloads in an app-private persistent directory, not only an OS-clearable cache.
- Store one copy per media/content identity, shared across route references for the signed-in account.
- Maintain a durable index of content revision, local path, expected size/checksum, download state, last use, and protection references.
- Use explicit states such as queued, downloading, paused, verifying, ready, and failed.
- Download to a temporary location. Validate size and authoritative checksum where supplied, then promote the completed file and update the index safely.
- Never expose partial or failed downloads as playable.
- Recover safely from process termination between file promotion and index updates; reconcile orphan files and missing indexed files at startup.
- Support persisted pause/resume state, cancellation, bounded retries with backoff/jitter, and recovery after restart.
- Start with low download concurrency (one or two tasks), prioritize driver-selected audio, and deduplicate concurrent requests for the same file.
- Check available storage before downloads. Never evict an active source or a route explicitly protected for a trip.
- Track route references so removing one route does not delete an audio still needed by another.

Suggested starting policy:

- Prepare common announcements automatically, subject to the driver's download/network preference.
- Add a **Download for trip** action for each route.
- Offer automatic preparation of pinned routes, with explicit Wi-Fi-only/mobile-data controls.
- Use a configurable storage budget; evict only unprotected least-recently-used content.
- Do not download every published route to every device.

The app uses Expo SDK 57. Its versioned FileSystem documentation provides persistent files and download tasks with pause/resume support. Use SDK-compatible `expo-file-system`; SQLite is a suitable option for the durable catalog/download index. Install native packages using `npx expo install` and ship a compatible native build.

`downloadFirst: true` alone is not a persistent, versioned offline-download system. Do not rely on transient native buffers as durable downloads, or load entire media libraries into JavaScript memory.

### 2. Local-first playback

```text
Verified local file available and offline access permitted?
  Yes -> Play immediately without server validation
  No  -> Online? Download, verify, then play
                Offline? Explain that this announcement needs downloading
```

- Resume/replay local sources without `fetchAudio()`.
- Do not pause local playback when internet connectivity changes.
- Preserve output-device guards, phone-call/audio interruptions, lock-screen behavior, repeated-play warnings, and cancellation protection.
- Keep remote URLs HTTPS-only. Resolve app-managed local paths internally; do not allow arbitrary device paths in server payloads.
- Use source-specific loading/recovery behavior instead of treating every failure as an internet error.
- For short announcements, prefer a complete download before playback. If streaming fallback remains, label it online-only and avoid simultaneous independent stream/download transfers for the same audio.

An announcement that was never downloaded cannot be guaranteed to play with poor or absent signal. Pre-trip preparation is part of the solution.

### 3. Durable catalog and controlled refresh

Persist route summaries, quick announcements, selected/downloaded route playlists, configuration, revisions, and the last successful sync time.

- Restore saved data immediately on startup.
- Preserve it on network/temporary server failures and show its last-updated state.
- Refresh in the background without clearing usable screens.
- Reuse route data when navigating back from the player.
- Deduplicate in-flight bootstrap/route requests.
- Refresh on foreground only when stale; consider a configurable 15-30-minute initial freshness window.
- Debounce reconnect events and use retry backoff to avoid request storms.
- Keep pin mutations server-confirmed for the MVP; offline write queues are outside this plan.

Network reachability is not a reliable measure of connection quality. Use actual download progress/timeouts and user preferences rather than treating a connected network as a strong signal.

### 4. Version-aware synchronization

Extend the authenticated mobile contract to expose:

- Route version and ordered playlist metadata.
- File size and stable media/content revision.
- Authoritative SHA-256 checksum where available.
- Catalog/settings revision and removed/unpublished items.
- Offline authorization expiry or a separately defined offline entitlement.

Use the existing route version and audio metadata where appropriate, but distinguish metadata revision from content identity:

- Label, order, title, and other metadata changes should not re-download unchanged bytes.
- Changing media bytes must change the content identity and object URL/key.
- An R2 ETag is not automatically a SHA-256 checksum.
- Route version alone cannot detect independent audio/settings changes. Sync invalidation must cover uploads, audio edits/availability, route changes, settings, and removals.
- A full snapshot must clearly identify its scope/completeness before absence is interpreted as removal. Delta responses need explicit tombstones/removal entries.

Start with version-aware bootstrap/route endpoints. Add a batched sync endpoint later to return only changed manifests/assets and removals for the driver's prepared routes.

Private conditional responses can reduce metadata response bytes. **HTTP 304 still makes an API request** and may still incur authorization/database work. Freshness windows, batching, and deduplication reduce request count. Keep personalized pins/session data out of shared public caches; retain `no-store` for sensitive authentication responses.

### 5. Network-safe authentication

- Restore the saved session without blocking permitted downloaded playback on an online refresh.
- Refresh access tokens when needed rather than on every foreground event; retain the shared refresh operation.
- Retain session state on timeouts, connection failures, and temporary server errors.
- Invalidate access on confirmed authentication failures/revocation and explicit logout, not generic transport failure.
- Preserve device binding and server-side checks for online operations.
- Scope persistent metadata and download access to the signed-in account. Stop playback and remove local access on logout; define whether physical files are immediately deleted or retained inaccessible for later cleanup.
- Do not treat an expired access token as unlimited offline permission; apply the approved offline authorization policy separately.

## Required business/security decision

The existing implementation checks availability before every playback. Offline playback cannot preserve immediate revocation: a disconnected device cannot learn that an administrator removed an audio, unpublished a route, or disabled an account.

Recommended policy, subject to approval:

- Permit local playback for a bounded period after successful online authorization (for example, a configurable 24-72 hours).
- Define and validate the offline entitlement, device/account binding, expiry, and clock-change behavior.
- Apply confirmed account restrictions and content removals when reconnecting.
- Remove revoked entries from playable playlists during successful sync; do not confuse a failed sync with removal.
- Require reconnection when offline authorization expires.

**Immediate remote revocation and guaranteed disconnected playback are incompatible requirements.** Approve this tradeoff before removing per-play server validation. Existing public media URLs also mean API availability checks are not a complete media-access-control mechanism; stricter content confidentiality would need a separate access-control design.

## Media delivery and file-size optimization

After reliable local playback is established:

- Verify whether the configured R2 public base URL uses a production custom domain/CDN and suitable cache rules; deployment settings were not audited.
- Set long-lived cache headers for immutable media objects, using a new object key for new bytes.
- Validate CDN cache hits, byte-range/resume behavior, content types, and CORS.
- Standardize speech assets to mono AAC/M4A or MP3 where device support and quality permit.
- Test 48-64 kbps speech against current uploads on real bus speakers, including Telugu pronunciation/intelligibility.
- Generate optimized assets once during upload processing, not during playback; account for processing cost and preserve originals as needed.
- Avoid proxying media through application API functions.

## Implementation phases

| Phase | Deliverables | Exit criteria |
| --- | --- | --- |
| 1. Contract and access policy | Approve offline entitlement; expose route/content revisions, sizes/checksums; define removal semantics | Backend/mobile agree on identity, expiry, and sync behavior |
| 2. Offline playback MVP | Durable catalog/index; persistent download manager; local-first playback; network-safe auth | Downloaded route plays after an offline cold restart without playback network requests |
| 3. Trip preparation UX | Download-for-trip; ready/total count; progress, retry, Wi-Fi controls, storage management | Driver can confirm route readiness before departure |
| 4. Efficient sync | Freshness windows, request deduplication, conditional/batched updates, tombstones | Unchanged content is not downloaded again; returning to a screen does not force requests |
| 5. Delivery optimization | CDN review, audio-format optimization, production metrics | Measured improvements in downloaded bytes, storage reads, and costs |

Deploy additive backend changes first and preserve the existing API contract for older app versions. Gate the new playback path during rollout and test a small driver cohort before broader release. Treat offline storage dependencies as a native-build change; do not assume an OTA update can add native modules to existing binaries.

### Main code touchpoints

Mobile changes:

- `src/state/auth.tsx`: restore/offline authorization and transport-error handling.
- `src/state/library.tsx`: persistent restoration, stale-data retention, sync scheduling.
- `src/state/playback.tsx`: local source resolution and removal of per-play online dependencies.
- `src/services/api.ts`: revisions, conditional/batched sync, refresh timing/error classification.
- `src/domain/catalog.ts`: versioned manifest schemas; keep remote URLs distinct from trusted local sources.
- `src/app/route-announcements.tsx`: cached route data and download-for-trip controls.
- Library, player, Home, Settings, and Help: readiness/status/error copy and storage controls.
- Add separate catalog-storage, media-cache, download-manager, and sync services rather than placing all logic in the player provider.

Backend changes:

- `src/lib/mobile-announcements.ts` and `src/routes/mobile-announcements.route.ts`: manifest metadata and sync contract.
- Audio/route/settings mutation paths: reliable revision invalidation and removal semantics.
- Authentication contract: offline entitlement if approved.
- `src/lib/r2-storage.ts` and upload processing: immutable media cache headers, authoritative identity/integrity metadata, optional optimized variants.

Update `README.md`, `docs/BACKEND.md`, and device/verification instructions when implementation ships. Tests that intentionally enforce online-only behavior must be revised alongside the new policy, not removed indiscriminately.

## Acceptance criteria

- [ ] Download a route, terminate the app, restart offline, and play every downloaded announcement within the allowed offline window.
- [ ] Repeated play, pause, resume, and replay issue no playback API/media requests for a ready local file.
- [ ] Connectivity loss does not interrupt local playback or hide usable catalog entries.
- [ ] Auth timeout/temporary server failure does not delete a valid saved session; confirmed revocation does remove access.
- [ ] Undownloaded audio clearly explains the download requirement when offline.
- [ ] A partial, corrupted, or missing local file is never reported as ready; recovery is safe.
- [ ] Interrupted downloads recover after restart; resume behavior is verified on real Android/iOS devices and the actual CDN.
- [ ] Concurrent download/play requests do not fetch the same file twice.
- [ ] Metadata-only edits and route reorderings do not re-download unchanged audio bytes; explicit sequence and gaps remain intact.
- [ ] New media content is verified and replaces the previous usable version safely; failed updates preserve permitted known-good content.
- [ ] Successful sync reconciles removed audio/unpublished routes; temporary failures do not erase valid saved data.
- [ ] Offline entitlement expiry, clock changes, logout, account switching, and device-binding behavior are tested.
- [ ] Shared files survive removal of one route while another protected route references them.
- [ ] Low storage is handled without deleting active/protected trip audio.
- [ ] Bluetooth disconnect/replacement, phone-call interruptions, repeated-play warnings, lock-screen/background playback, and Android source-replacement constraints still work.
- [ ] Foreground/focus/reconnect events obey freshness/deduplication rules without refresh storms.
- [ ] Mobile lint, typecheck, unit tests, backend contract tests, and native device tests pass.
- [ ] Web preview behavior remains supported or explicitly distinguishes native-only offline downloads.

## Measurement and expected impact

Capture a baseline before rollout, then compare:

- Announcement API calls per active driver/trip and calls caused by play/resume.
- Local playback hit rate and time from tap to audible playback.
- Failed/interrupting plays under weak signal.
- Downloaded media bytes, retries, unique files, and duplicate transfers.
- Sync requests/response bytes and changed-versus-unchanged content.
- CDN cache-hit rate, origin reads, backend/database usage, and actual billing.

Keep diagnostics lightweight; batch optional telemetry rather than adding an API request per playback.

Illustrative example: a driver plays the same 20 announcements ten times.

- Current: 200 playback-validation API requests, plus resume validation; media may be fetched repeatedly depending on native/CDN caching.
- Proposed: 20 unique file downloads initially, occasional sync, and zero playback-validation requests for those local files.

This is not a guaranteed bill-reduction percentage. Production traffic, current caching, hosting plans, R2/CDN pricing, and initial prefetch volume determine actual savings. Downloading unused content can increase traffic, so focus preparation on common audio and routes drivers actually need.

## References and review validation

- [Expo SDK 57 FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)
- [Expo SDK 57 Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [Current mobile backend contract](BACKEND.md)
- [Native device checks](DEVICE-TESTS.md)
- [Verification instructions](VERIFICATION.md)

Mobile lint and TypeScript checks passed during the architecture review. No runtime/offline implementation or production billing/CDN audit was performed.
