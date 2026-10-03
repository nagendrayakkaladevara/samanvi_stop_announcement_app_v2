import * as SQLite from "expo-sqlite";
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import {
  snapshotSchema,
  revisionOf,
  validateDownload,
  type AudioAsset,
  type DownloadedAudio,
  type LibrarySnapshot,
} from "../domain/catalog";
import { apiBaseUrl, isDemo } from "./api";

let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  database ??= (async () => {
    const value = await SQLite.openDatabaseAsync("samanvi-v2.db");
    await value.execAsync(
      "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
    );
    return value;
  })();
  return database;
}
const scope = isDemo ? "demo" : apiBaseUrl;
export async function readValue<T>(key: string): Promise<T | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ value: string }>(
    "SELECT value FROM app_state WHERE key = ?",
    `${scope}:${key}`,
  );
  return row ? (JSON.parse(row.value) as T) : null;
}
export async function writeValue(key: string, value: unknown): Promise<void> {
  await (
    await db()
  ).runAsync(
    "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    `${scope}:${key}`,
    JSON.stringify(value),
  );
}
export async function readSnapshot(): Promise<LibrarySnapshot | null> {
  const value = await readValue<unknown>("library");
  if (!value) return null;
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "The saved library could not be read. Use Refresh library to recover it.",
    );
  const snapshot = parsed.data;
  snapshot.files = Object.fromEntries(
    Object.entries(snapshot.files).filter(([, item]) => fileExists(item)),
  );
  return snapshot;
}
export const saveSnapshot = (snapshot: LibrarySnapshot) =>
  writeValue("library", snapshot);
export function fileExists(file: DownloadedAudio): boolean {
  try {
    const value = new File(file.uri);
    return value.exists && value.size === file.sizeBytes;
  } catch {
    return false;
  }
}

export async function saveAudio(
  audio: AudioAsset,
  bundledAsset?: number,
): Promise<DownloadedAudio> {
  const revision = revisionOf(audio);
  const key = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    revision,
  );
  const directory = new Directory(Paths.document, "announcements-v2");
  directory.create({ idempotent: true, intermediates: true });
  const extension: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
  };
  const destination = new File(
    directory,
    `${key}.${extension[audio.mimeType]}`,
  );
  const staging = new File(directory, `${key}-${Crypto.randomUUID()}.part`);
  // File.move changes the File object's URI. Cleanup must retain the original
  // temporary path so a successful move cannot delete the committed audio.
  const stagingUri = staging.uri;
  let task: ReturnType<typeof File.createDownloadTask> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (bundledAsset !== undefined) {
      const asset = await Asset.fromModule(bundledAsset).downloadAsync();
      if (!asset.localUri)
        throw new Error("The bundled audio could not be opened.");
      new File(asset.localUri).copy(staging);
    } else {
      const url = audio.downloadUrl ?? audio.blobUrl;
      if (!url || new URL(url).protocol !== "https:")
        throw new Error(`No secure download is available for ${audio.title}.`);
      const available = Paths.availableDiskSpace;
      if (available < Number(audio.sizeBytes) + 10 * 1024 * 1024)
        throw new Error("Not enough free space to save this announcement.");
      task = File.createDownloadTask(url, staging);
      timeout = setTimeout(() => {
        task?.cancel();
      }, 120_000);
      await task.downloadAsync();
    }
    let digest: string | undefined;
    if (audio.checksumSha256) {
      const hash = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        await staging.bytes(),
      );
      digest = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    }
    validateDownload(audio, staging.size, digest);
    // Different revisions use different names. Existing working versions stay untouched.
    if (destination.exists) {
      if (destination.size === staging.size) staging.delete();
      else {
        destination.delete();
        staging.move(destination);
      }
    } else staging.move(destination);
    return {
      uri: destination.uri,
      revision,
      sizeBytes: Number(audio.sizeBytes),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    task?.release();
    const unfinished = new File(stagingUri);
    if (unfinished.exists) unfinished.delete();
  }
}
