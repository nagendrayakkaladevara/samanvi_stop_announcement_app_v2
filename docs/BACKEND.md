# Mobile API contract

Base: `EXPO_PUBLIC_API_BASE_URL`, including `/api/v1`. Every announcement request uses the separate mobile-driver bearer token. Auth login/refresh/logout and device binding use `/mobile/auth` endpoints. Success envelope: `{ "success": true, "data": ... }`. Responses remain private and `no-store`; the app explicitly manages its per-account catalog and files.

| Method | Path | Data |
| --- | --- | --- |
| POST | `/mobile/announcements/sync` | Version-aware full pinned snapshot or unchanged renewal, described below |
| GET | `/mobile/announcements/bootstrap` | Legacy/online fallback: `routes`, `quickAnnouncements`, nullable `recordsDriveUrl`, `maxPinnedRoutes: 3` |
| GET | `/mobile/announcements/routes` | `{ routes }`, optional search |
| GET | `/mobile/announcements/routes/:id/announcements` | `{ routeId, route, announcements }` |
| GET | `/mobile/announcements/quick-announcements` | `{ quickAnnouncements }` |
| GET | `/mobile/announcements/audios/:id` | Currently available online audio |
| GET | `/mobile/announcements/config` | `{ recordsDriveUrl }` |
| GET | `/mobile/users/me/pinned-routes` | `{ routes, maxPinnedRoutes: 3 }` |
| POST / DELETE | `/mobile/users/me/pinned-routes/:id` | Updated pinned routes; idempotent, server-confirmed mutations |

Route cards: `{ id, routeId, startLocation, endLocation, via, busType, isPinned, version? }`. URL parameters use internal `id`; `routeId` is the human-readable code. `busType` is `AC` or `Non-AC`.

Audio: `{ id, title, audioUrl, mimeType?, durationMs?, sizeBytes?, contentRevision?, checksumSha256? }`. Remote URLs must be HTTPS. `sizeBytes` and the 64-character lowercase hexadecimal `contentRevision` are required for downloaded media in sync snapshots. `checksumSha256` may be null for existing uploads. The native client verifies exact byte count and any supplied SHA-256, then stores a locally computed SHA-256 for future corruption checks. Storage ETag is not used as a SHA-256 checksum.

Route announcements add `sequence`: a positive integer, strictly ascending, with gaps preserved. Title/label/order edits do not change media content identity.

Quick announcements:
- `welcome-note`: `type: MULTIPLE`, `audios: [...]` containing ready welcome-note assets.
- `dinner-break` / `toilet-break`: `type: SINGLE`, `audioUrl` plus `audio`, both null if unavailable.
- Quick audio remains online-only. Home reuses recent metadata on focus and resolves the latest mapping when a quick action is tapped.

## Pinned-route synchronization

Request: `POST /mobile/announcements/sync` with JSON `{}` initially, or `{ "revision": "<previous snapshot SHA-256>" }` subsequently. Revision is user-scoped. The server uses a repeatable-read transaction for a consistent snapshot.

Changed/initial response data:

```json
{
  "revision": "<64-character SHA-256>",
  "unchanged": false,
  "serverTime": "2026-10-10T00:00:00.000Z",
  "offlineUntil": "2026-11-09T00:00:00.000Z",
  "catalog": {
    "routes": [],
    "quickAnnouncements": [],
    "recordsDriveUrl": null,
    "maxPinnedRoutes": 3
  },
  "pinnedRoutes": []
}
```

`catalog` has the bootstrap shape. `pinnedRoutes` is the complete set of this driver's published pins (maximum three), each with the route-announcements response shape. Absence from this complete snapshot removes offline eligibility; no separate tombstone feed is needed. It contains only ready/playable audio.

When the submitted revision matches, the server returns `unchanged: true`, the same `revision`, and fresh `serverTime`/`offlineUntil`, omitting `catalog` and `pinnedRoutes`. HTTP status is 200 in both cases. Unchanged renewal still performs authorization and database reads, but saves response bytes; the mobile 15-minute freshness window and in-flight deduplication reduce actual request count.

Only successful authenticated sync renews the 30-day lease. Failed/partial responses, playback, pin changes, app restarts and token refresh alone cannot renew it. Local authorization metadata is stored in native SecureStore separately from media/catalog files. Large backward clock changes require reauthorization. Logout and confirmed account/session revocation remove local access. A disconnected device cannot learn revocation until sync or lease expiry.

## Playback and compatibility

- Verified, authorized pinned downloads play/resume/replay with no playback API or media requests.
- If a pinned file is being prepared, tapping it waits for the same queue transfer. Deferred downloads (for example Wi-Fi-only on cellular) may use online streaming when requested.
- Online-only audio resolves current availability before starting. Resuming an already loaded source does not perform another lookup.
- Server-confirmed pins trigger full sync. A fourth pin returns HTTP 409 with `code: PIN_LIMIT_REACHED`.
- Metadata refresh failures preserve the last good catalog. Authentication transport failures preserve the saved session; explicit auth rejection clears it.
- Old mobile clients can continue using existing endpoints. New clients fall back to the online bootstrap if the sync endpoint returns 404 during staggered deployment.

No database migration is added by this feature; existing route versions and audio metadata are reused. Deploy backend before distributing the new native app.
