# Native pilot acceptance checks

Use a signed **preview APK** on the Android phones used by drivers and the actual bus media system. Repeat relevant checks on an iPhone if iOS will be released. Record phone model, OS version, build, and speaker model with each result.

These checks are pending; browser verification cannot establish their results.

| Scenario                         | Expected result                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install and first launch         | New Samanvi Driver app opens, has its own icon and storage, and loads the bundled demo without microphone permission                             |
| Demo cold start in airplane mode | With the preview build installed, demo recordings can be prepared from bundled assets without a network                                          |
| Service preparation              | With a real API URL, refresh common audio, choose a route, and download its stops; counts reflect successful saves                               |
| Offline restart                  | After successful service downloads, enable airplane mode, close the app, and reopen it; selected route and saved audio remain usable             |
| No speaker selected              | Default speaker check blocks normal announcement playback and explains how to connect                                                            |
| Bluetooth sound check            | Pair in system settings, select media output, return, verify the route name, and hear the test through the bus speakers                          |
| Speaker disconnect while playing | Playback stops/pauses promptly; the app reports a changed connection; it does not automatically restart after reconnection                       |
| Speaker disconnect while paused  | Reconnection and deliberate replay are required; a lock-screen control must not cause unintended phone playback                                  |
| Switch selected media device     | The app detects a changed output and interrupts the current announcement                                                                         |
| Phone test                       | Explicitly confirm a device test, check actual media volume/output, and verify the sample plays                                                  |
| Foreground/background            | Start audio, leave the app, and lock the screen; validate playback and available notification/lock-screen controls                               |
| Phone call or competing audio    | Observe interruption behavior, then verify deliberate resume/replay works without overlapping players                                            |
| Rapid play/stop/switch           | Repeated controls do not start stale audio after Stop or create overlapping players                                                              |
| Completion and replay            | Natural completion reaches the completed state; Replay starts from the beginning                                                                 |
| Screen awake                     | Enabled preference keeps the display awake only during playback; disabling it restores ordinary behavior                                         |
| Interrupted download             | Disable the network mid-download; a failure is shown and the previous saved route still plays                                                    |
| Incorrect size or checksum       | Test a deliberately invalid staging response; it is rejected before the new library is committed                                                 |
| Route update                     | Publish a new version, refresh routes, check route audio, and confirm the new ordered stops play offline                                         |
| Route removed                    | Refresh after unpublishing the selected route; the current selection clears and prompts a new choice                                             |
| Missing local file               | Remove one downloaded file in a test build; restart, verify it is not marked ready, and download it again                                        |
| Low storage                      | A download shows a useful error, and existing announcements remain available                                                                     |
| Large text and display scaling   | At 150% and 200% text, all controls remain reachable; Home quick actions stack, long route names wrap, and the mini-player does not trap content |
| Screen readers                   | TalkBack/VoiceOver announce current route, disabled audio, Help expansion, progress, output, and playback state; decorative icons are skipped    |
| Navigation and touch             | Check touch targets, keyboard/focus behavior, narrow screens, safe areas, physical Back navigation, and error visibility after scrolling         |
| Driver usability                 | While safely parked, prepare a route, play a stop, and recover from disconnected output; check readability on the actual phone outdoors          |

The Android MediaRouter and iOS AVAudioSession code is included and autolinked, but has not been compiled or executed on physical hardware here. Check Android wired and Bluetooth LE outputs explicitly; they may be classified as unknown/other and fail the default speaker guard.

Complete driver authentication and route assignment before a deployment that requires authenticated or restricted driver access. Records intentionally remains inactive in this pilot.
