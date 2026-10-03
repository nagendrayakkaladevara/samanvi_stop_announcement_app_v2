# Backend integration

The adapter follows `docs/announcements-api.md` and `src/routes/mobile-announcements.route.ts` in [samanvi-ticketing-tool-Backend at commit 3fa513f22d91497174a78e29e0e8efcbf6cfaf4b](https://github.com/nagendrayakkaladevara/samanvi-ticketing-tool-Backend/tree/3fa513f22d91497174a78e29e0e8efcbf6cfaf4b).

Set the environment variable to the backend origin **including `/api/v1`**. The adapter appends the following paths:

| Method | Path appended to the base URL                    | Response `data`                            |
| ------ | ------------------------------------------------ | ------------------------------------------ |
| GET    | `/mobile/announcements/bootstrap`                | `{ welcomeAudio, commonAudios, routes }`   |
| GET    | `/mobile/announcements/routes/:routeId/manifest` | Route fields with ordered `audios` entries |

Both responses must be wrapped as `{ "success": true, "data": ... }`. The bootstrap already supplies the route list, so the separate `/routes` listing endpoint is not needed by this client.

Route summaries include `id`, `routeCode`, `name`, `origin`, `destination`, positive integer `version`, ISO `updatedAt`, and `_count: { audios: number }`. A manifest contains the route fields and `audios: [{ position, stopLabel, audio }]`; `_count` is not required on a manifest. `stopLabel` can be null. Stops are displayed in ascending `position`.

An audio object has these fields:

```ts
type AudioAsset = {
  id: string;
  title: string;
  description: string | null;
  category: "stop_announcement" | "common_audio" | "welcome_note";
  originalFileName: string;
  mimeType:
    | "audio/mpeg"
    | "audio/mp4"
    | "audio/aac"
    | "audio/wav"
    | "audio/x-wav"
    | "audio/ogg";
  sizeBytes: string; // Backend BigInt serialization, from 1 byte to 50 MiB
  durationMs: number | null;
  checksumSha256: string | null; // 64 hexadecimal characters when supplied
  status: "ready";
  blobUrl: string | null;
  downloadUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Audio URLs must use HTTPS. `downloadUrl` takes precedence over `blobUrl`; at least one must be usable when downloading a non-bundled asset. Expired download URLs require a fresh bootstrap/manifest. Use MP3 for the broadest compatibility in this pilot; acceptance of a MIME type in the contract does not prove that every device can decode every codec in that container.

API requests time out after 20 seconds. Individual audio downloads have a 120-second cancellation timer. Downloads are sequential to limit memory while optional SHA-256 checks read a complete file. A route snapshot is committed after all of its files validate; a failed update leaves the prior snapshot usable. New revisions use different filenames.

The metadata and selected route persist in native SQLite, scoped by the configured API URL. Demo and service catalogs use separate keys. Audio files live in the app's document directory. The application reopens the saved catalog without requiring a fresh API request; the driver can explicitly refresh common audio or check the selected route's manifest. Selecting a route and downloading its audio are separate operations: recovering files for another cached route does not change the selected route. A failed selection save keeps the picker open for retry.

Bootstrap refresh removes cached route manifests for routes that are no longer published. An offline phone retains its last saved content until it refreshes. This cache is not an entitlement or immediate revocation system.

## Driver identity remains a backend task

The reviewed mobile endpoints are intentionally unauthenticated and expose published routes. The backend's administrator login is not a driver login contract. This implementation does not send administrator credentials or invent a token exchange.

Before adding the UX sign-in flow, define driver authentication, refresh/revocation behavior, the driver profile, and route assignment rules. Then add secure token storage and authorization headers to the adapter. A separate playback-history contract is also needed if the Records screen becomes active.

Quick buttons currently match common audio titles containing `lunch`, `dinner`, or `toilet`/`washroom`, case-insensitively. All common audio is available in the library. A stable backend `purpose` field would make localized quick-button mapping reliable.

The client code was checked against this contract. No deployed API endpoint or production credentials were configured for this build.
