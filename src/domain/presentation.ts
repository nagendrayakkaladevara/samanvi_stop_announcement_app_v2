import { isReady, type AudioAsset, type LibrarySnapshot } from "./catalog";

export function routeDownloadState(
  snapshot: LibrarySnapshot | null,
  id: string,
) {
  const route = snapshot?.bootstrap.routes.find((item) => item.id === id);
  const manifest = snapshot?.manifests[id];
  const total = manifest?.audios.length ?? route?._count.audios ?? 0;
  const saved =
    manifest?.audios.filter((item) => isReady(snapshot, item.audio)).length ??
    0;
  return {
    total,
    saved,
    ready: !!manifest && total > 0 && saved === total,
    needsUpdate: !!route && !!manifest && route.version !== manifest.version,
  };
}

export function audioFormat(audio: Pick<AudioAsset, "mimeType">): string {
  return {
    "audio/mpeg": "MP3",
    "audio/mp4": "M4A",
    "audio/aac": "AAC",
    "audio/wav": "WAV",
    "audio/x-wav": "WAV",
    "audio/ogg": "OGG",
  }[audio.mimeType];
}

export type PlaybackPhase =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "stopped"
  | "finished"
  | "interrupted"
  | "error";

export function playbackPresentation(phase: PlaybackPhase, playing: boolean) {
  if (phase === "error")
    return { label: "Playback unavailable", action: "Retry", restart: true };
  if (phase === "interrupted")
    return { label: "Connection interrupted", action: "Replay", restart: true };
  if (phase === "finished")
    return { label: "Announcement complete", action: "Replay", restart: true };
  if (phase === "stopped")
    return { label: "Stopped", action: "Play again", restart: true };
  if (phase === "loading")
    return { label: "Preparing audio…", action: "Loading", restart: false };
  if (playing)
    return { label: "Playing announcement", action: "Pause", restart: false };
  return { label: "Paused", action: "Resume", restart: false };
}
