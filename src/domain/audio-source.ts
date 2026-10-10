import type { AudioAsset } from "./catalog";
import { mediaKey } from "./offline";

export type ResolvedAudio = { uri: string; local: boolean; key: string | null; audio: AudioAsset };
type Dependencies = {
  localAllowed: (audio: AudioAsset) => boolean;
  online: () => boolean;
  leaseValid: () => boolean;
  localUri: (key: string) => Promise<string | null>;
  hold: (key: string) => void;
  release: (key: string) => void;
  invalidate: (key: string) => void;
  fetchAudio: (id: string) => Promise<AudioAsset>;
  prepare?: (key: string) => Promise<void> | undefined;
};

export async function resolveAudioSource(audio: AudioAsset, deps: Dependencies): Promise<ResolvedAudio> {
  const key = mediaKey(audio);
  if (key && deps.localAllowed(audio)) {
    deps.hold(key);
    let adopted = false;
    try {
      let uri: string | null = null;
      try { uri = await deps.localUri(key); } catch { /* Corrupt/missing files are replaced by the queue. */ }
      if (!uri) {
        deps.invalidate(key);
        if (deps.online() && deps.prepare) {
          const preparation = deps.prepare(key);
          if (preparation) { await preparation; uri = await deps.localUri(key); }
        }
      }
      // Sync/unpin can finish while local verification is in progress.
      if (uri && deps.localAllowed(audio)) { adopted = true; return { uri, key, local: true, audio }; }
    } finally { if (!adopted) deps.release(key); }
  }
  if (!deps.online()) throw new Error(deps.leaseValid()
    ? "This audio is not ready offline. Connect and finish downloading your pinned route."
    : "Offline access has expired or your clock changed. Connect and refresh to renew 30 days of access.");
  const latest = await deps.fetchAudio(audio.id);
  return { uri: latest.audioUrl, local: false, key: null, audio: { ...latest, title: audio.title } };
}
