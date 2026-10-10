import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { mediaKey } from "../domain/offline";
import type { OfflineStorage, StoredMedia } from "./offline-storage.types";

const extensions: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg" };
async function sha256(file: File) {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createOfflineStorage(userId: string): OfflineStorage {
  const directory = new Directory(Paths.document, "announcements-v1", encodeURIComponent(userId));
  const verified = new Set<string>();
  const index = new Map<string, StoredMedia>();
  let loaded = false;
  let writes = Promise.resolve();
  function ensure() { directory.create({ intermediates: true, idempotent: true }); }
  async function read(name: string): Promise<unknown> {
    ensure();
    const file = new File(directory, name);
    try { return file.exists ? JSON.parse(await file.text()) : null; } catch { return null; }
  }
  async function write(name: string, value: unknown) {
    // Serialize replacements; a process crash leaves either the old or new JSON.
    const text = JSON.stringify(value);
    const next = writes.catch(() => undefined).then(async () => {
      ensure();
      const temp = new File(directory, `${name}.tmp`);
      temp.write(text);
      await temp.move(new File(directory, name), { overwrite: true });
    });
    writes = next;
    return next;
  }
  async function load() {
    if (loaded) return;
    const saved = await read("media.json");
    if (Array.isArray(saved)) for (const item of saved) {
      if (!item || typeof item.key !== "string" || !/^[a-f0-9]{64}$/.test(item.key) ||
        typeof item.fileName !== "string" || !new RegExp(`^${item.key}\\.[a-z0-9]+$`).test(item.fileName) ||
        !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256 ?? "")) continue;
      const file = new File(directory, item.fileName);
      if (file.exists && file.size === item.sizeBytes) index.set(item.key, item);
    }
    loaded = true;
  }
  const saveIndex = () => write("media.json", [...index.values()]);
  return {
    supported: true,
    readSnapshot: () => read("catalog.json"),
    writeSnapshot: (value) => write("catalog.json", value),
    async media() { await load(); return [...index.values()]; },
    async localUri(key, verify = false) {
      await load();
      const entry = index.get(key);
      if (!entry) return null;
      const file = new File(directory, entry.fileName);
      if (!file.exists || file.size !== entry.sizeBytes || (verify && !verified.has(key) && await sha256(file) !== entry.sha256)) {
        index.delete(key); verified.delete(key); await saveIndex(); return null;
      }
      if (verify) verified.add(key);
      return file.uri;
    },
    async download(audio, signal, progress) {
      await load();
      const key = mediaKey(audio);
      if (!key || !audio.sizeBytes) throw new Error("Audio is missing download metadata. Refresh your routes.");
      if (signal.aborted) return null;
      if (Paths.availableDiskSpace < audio.sizeBytes + 20 * 1024 * 1024) throw new Error("Not enough phone storage. Free some space and retry.");
      const part = new File(directory, `${key}.part`);
      const pauseFile = new File(directory, `${key}.resume.json`);
      const saved = await read(pauseFile.name) as DownloadPauseState | null;
      if (signal.aborted) return null;
      const canResume = saved?.url === audio.audioUrl && saved.fileUri === part.uri && !saved.isDirectory && saved.resumeData;
      if (!canResume && part.exists) part.delete();
      let lastProgress = Date.now();
      const options = { sessionType: "foreground" as const, onProgress: ({ bytesWritten }: { bytesWritten: number }) => {
        lastProgress = Date.now(); progress(Math.min(0.99, bytesWritten / audio.sizeBytes!));
      } };
      const task = canResume ? DownloadTask.fromSavable(saved!, options) : File.createDownloadTask(audio.audioUrl, part, options);
      let pausing: Promise<void> | null = null;
      let stalled = false;
      const pause = () => {
        if (task.state === "active" && !pausing) pausing = task.pauseAsync().catch(() => { task.cancel(); });
      };
      signal.addEventListener("abort", pause);
      const timeout = setInterval(() => { if (Date.now() - lastProgress > 45_000) { stalled = true; pause(); } }, 5_000);
      try {
        const output = await (canResume ? task.resumeAsync() : task.downloadAsync());
        if (pausing) await pausing;
        if (!output) {
          if (task.state === "paused") await write(pauseFile.name, task.savable());
          if (stalled) throw new Error("Download paused after a slow connection. Retry when your signal improves.");
          return null;
        }
        if (output.size !== audio.sizeBytes) throw new Error("Incomplete audio download. Please retry.");
        const digest = await sha256(output);
        if (audio.checksumSha256 && audio.checksumSha256.toLowerCase() !== digest) throw new Error("Audio verification failed. Please refresh and retry.");
        const fileName = `${key}.${extensions[audio.mimeType ?? ""] ?? "mp3"}`;
        await output.move(new File(directory, fileName), { overwrite: true });
        const entry = { key, fileName, sizeBytes: audio.sizeBytes, sha256: digest };
        index.set(key, entry); verified.add(key);
        await saveIndex();
        if (pauseFile.exists) pauseFile.delete();
        return entry;
      } catch (error) {
        // Invalid resume state or failed verification must not poison later retries.
        if (!stalled) {
          if (part.exists) part.delete();
          if (pauseFile.exists) pauseFile.delete();
        }
        if (signal.aborted) return null;
        throw error;
      } finally {
        clearInterval(timeout); signal.removeEventListener("abort", pause); task.release();
      }
    },
    async prune(keep) {
      await load();
      for (const item of directory.list()) {
        const match = /^([a-f0-9]{64})\./.exec(item.name);
        if (match && !keep.has(match[1])) { item.delete(); index.delete(match[1]); verified.delete(match[1]); }
      }
      await saveIndex();
    },
    usedBytes() { return [...index.values()].reduce((total, item) => total + item.sizeBytes, 0); },
  };
}
