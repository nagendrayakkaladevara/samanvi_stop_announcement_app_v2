# Native validation scenarios

Run on an Android/iOS build using the real backend and bus audio hardware.

| Scenario | Expected |
| --- | --- |
| Fresh install/sign-in | Backend-authenticated Home; no media preparation/download flow |
| Welcome Note | Multiple available files; chosen file streams |
| Dinner/Toilet | Each button plays its configured common audio directly |
| Pins | Zero-state button; pin 1–3 routes; fourth blocked; unpin and replace; restart restores server pins |
| Two drivers | Separate pinned routes per authenticated account |
| Concurrent pin requests | Backend rejects attempts exceeding three |
| Route entry | Route metadata and ordered positive sequence labels match admin configuration |
| Streaming controls | Pause/resume/replay/stop work; active row and mini-player match playback |
| Speaker guard | Default preference requires verified output; explicit phone test still works |
| Bluetooth disconnect/call | Playback interrupts and recovery controls are accurate |
| Screen lock/background | Streaming/lockscreen controls work while connected |
| Network loss | Playback stops; new audio cannot play; reconnect offers retry |
| Backend unavailable | Useful error and retry; no restored catalog or local media fallback |
| Records | Centered button opens configured folder in Drive/browser; missing URL/open failure handled |
| Settings | Existing preferences, speaker/help and sign-out work |
| Text scaling | 200% text and small screens remain readable and scrollable |

Browser checks do not validate native output routing, OS interruptions or actual Drive app handoff.
