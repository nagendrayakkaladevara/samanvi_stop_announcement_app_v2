# Native validation scenarios

Run on an Android/iOS build using the real backend and bus audio hardware.

| Scenario | Expected |
| --- | --- |
| Fresh install/sign-in | Backend-authenticated Home; only server-confirmed pins prepare media |
| Welcome Note | Multiple available files; chosen file streams |
| Dinner/Toilet | Each button plays its configured common audio directly |
| Pins | Pin 1–3 routes; fourth blocked; each pin prepares its playlist and shows accurate ready/total counts |
| Two drivers | Separate pinned routes per authenticated account |
| Concurrent pin requests | Backend rejects attempts exceeding three |
| Route entry | Route metadata and ordered positive sequence labels match admin configuration |
| Streaming controls | Pause/resume/replay/stop work; active row and mini-player match playback |
| Speaker guard | Default preference requires verified output; explicit phone test still works |
| Bluetooth disconnect/call | Playback interrupts and recovery controls are accurate |
| Screen lock/background | Local/streaming lock-screen playback works; preparation pauses in background and resumes on return |
| Network loss | Verified local playback continues; online-only streams interrupt with recovery controls |
| Backend unavailable | Useful error/retry; saved catalog, permitted local media and authentication survive |
| Records | Centered button opens configured folder in Drive/browser; missing URL/open failure handled |
| Settings | Light/Dark/System apply across screens and persist; playback is not remounted; Wi-Fi/storage controls persist |
| Text scaling | 200% text and small screens remain readable and scrollable |
| Offline cold start | Download a pinned route, terminate, disable internet, reopen and play every saved file |
| Expiry | Before 30 days saved playback works; at expiry reconnect/sync is required; failed sync does not renew |
| Refresh | Metadata-only edits do not download bytes again; removed/unpublished audio loses eligibility; successful unchanged sync renews 30 days |
| Unpin/shared files | Cancel route-only downloads; shared media remains for other pins; playback is stopped if its offline eligibility is removed |
| Partial download | Background/reconnect resumes where native resume data permits; force-kill/relaunch safely recovers; partial files are never ready |
| Storage/integrity | Corrupt, truncated or missing files are detected; insufficient space/budget produces useful recovery without deleting active/pinned media |
| Same-file transfer | Tap a pinned audio while downloading: wait for that transfer, not a duplicate stream |
| Offline speaker test | Speaker screen uses a ready pinned announcement when available |
| Logout/account change | No previous account catalog/lease is usable by another account; confirmed revocation signs out |
| Clock change | Significant backward clock changes require reauthorization; setting clock forward beyond expiry blocks offline playback |

Browser checks do not validate native output routing, OS interruptions or actual Drive app handoff.
