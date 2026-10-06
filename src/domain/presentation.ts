import { type AudioAsset } from "./catalog";

export function audioFormat(audio: Pick<AudioAsset, "mimeType">): string {
  const formats: Record<string, string> = {
    "audio/mpeg": "MP3",
    "audio/mp4": "M4A",
    "audio/aac": "AAC",
    "audio/wav": "WAV",
    "audio/x-wav": "WAV",
    "audio/ogg": "OGG",
  };
  return formats[audio.mimeType ?? ""] ?? "Audio";
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
