# Online mobile API contract

Base: `EXPO_PUBLIC_API_BASE_URL`, including `/api/v1`. Every announcement request uses the separate mobile-driver bearer token. Auth login/refresh/logout and device binding use the existing `/mobile/auth` endpoints.

Success envelope: `{ "success": true, "data": ... }`. Responses are private and `no-store`.

| Method | Path | Data |
| --- | --- | --- |
| GET | `/mobile/announcements/bootstrap` | `routes`, `quickAnnouncements`, nullable `recordsDriveUrl`, `maxPinnedRoutes: 3` |
| GET | `/mobile/announcements/routes` | `{ routes }`, optional search |
| GET | `/mobile/announcements/routes/:id/announcements` | `{ routeId, route, announcements }` |
| GET | `/mobile/announcements/quick-announcements` | `{ quickAnnouncements }` |
| GET | `/mobile/announcements/audios/:id` | Currently available streaming audio |
| GET | `/mobile/announcements/config` | `{ recordsDriveUrl }` |
| GET | `/mobile/users/me/pinned-routes` | `{ routes, maxPinnedRoutes: 3 }` |
| POST / DELETE | `/mobile/users/me/pinned-routes/:id` | Updated pinned routes; mutations are idempotent |

Route cards: `{ id, routeId, startLocation, endLocation, via, busType, isPinned }`. URL parameters use the internal `id`; `routeId` is the human-readable code such as `ST-A02`. `busType` is `AC` or `Non-AC`; empty Via means a direct route.

Audio: `{ id, title, audioUrl, mimeType?, durationMs? }`. Audio URLs must use HTTPS. Route announcements add an explicit positive integer `sequence`, returned in strictly ascending order. Gaps are allowed and displayed as received. The app does not infer the order.

Quick announcements:
- `welcome-note`: `type: MULTIPLE`, `audios: [...]` containing all ready welcome-note assets.
- `dinner-break` / `toilet-break`: `type: SINGLE`, `audioUrl` plus a single `audio` object. Both are null if unavailable.

Home refreshes `/quick-announcements` on focus and before a quick button is played. The button shows the mapped audio title, not an inferred mapping based on its title/category. If a mapping is removed or replaced while Home is open, the next tap uses the live selection and never intentionally plays the previously mapped file. Failed mapping checks show an error without starting playback; leaving Home cancels the pending playback intent.

The backend rejects a fourth pin with HTTP 409 and `code: PIN_LIMIT_REACHED`. Pins are user-specific. On a failed mutation the app reloads server state; it never queues a write for later.

Before playback/resume, the app resolves the audio against the live backend. Expo Audio streams the URL with `downloadFirst: false`. Catalog data is held in memory only and reloaded on startup, route entry and reconnect. Network loss stops the player. API requests time out after 20 seconds; player loading has a 30-second recovery timeout.

## Admin/deployment setup

Apply backend migration `20261005120000_online_route_announcements` before deploying the matching frontend/mobile code. In Audio App, review route Via/bus type (existing rows migrate to `Non-AC`), configure Dinner/Toilet common audios, upload welcome-note files and set the Records Drive URL. The Records URL must be HTTPS on `drive.google.com`; the mobile app has no hard-coded folder.

Administrators can now choose Dinner Break or Toilet Break during frontend upload, or use Map to app on an existing Common audio file. The admin backend maps it through `PUT /announcements/audios/:audioId/break-mapping` using the existing settings fields; the mobile contract is unchanged. No new migration is needed for mapping.
