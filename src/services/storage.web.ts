/** Browser UI preview adapter. Native builds use SQLite + persistent document files. */
import { Asset } from "expo-asset";
import {
  snapshotSchema,
  revisionOf,
  validateDownload,
  type AudioAsset,
  type DownloadedAudio,
  type LibrarySnapshot,
} from "../domain/catalog";
import { apiBaseUrl, isDemo } from "./api";

const prefix = `samanvi-v2:${isDemo ? "demo" : apiBaseUrl}:`;
export async function readValue<T>(key: string): Promise<T | null> {
  const value = localStorage.getItem(prefix + key);
  return value ? (JSON.parse(value) as T) : null;
}
export async function writeValue(key: string, value: unknown): Promise<void> {
  localStorage.setItem(prefix + key, JSON.stringify(value));
}
export async function readSnapshot(): Promise<LibrarySnapshot | null> {
  const value = await readValue<unknown>("library");
  if (!value) return null;
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "The saved preview library could not be read. Refresh to recover it.",
    );
  // Object URLs only live for this browser document; repopulate from HTTP cache.
  return { ...parsed.data, files: {} };
}
export const saveSnapshot = (snapshot: LibrarySnapshot) =>
  writeValue("library", snapshot);
export function fileExists(file: DownloadedAudio): boolean {
  return file.uri.startsWith("blob:");
}
export async function saveAudio(
  audio: AudioAsset,
  bundledAsset?: number,
): Promise<DownloadedAudio> {
  const source =
    bundledAsset !== undefined
      ? Asset.fromModule(bundledAsset).uri
      : (audio.downloadUrl ?? audio.blobUrl);
  if (!source) throw new Error("Audio is unavailable.");
  const response = await fetch(source, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Unable to download ${audio.title}.`);
  const blob = await response.blob();
  let digest: string | undefined;
  if (audio.checksumSha256)
    digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
  validateDownload(audio, blob.size, digest);
  return {
    uri: URL.createObjectURL(blob),
    revision: revisionOf(audio),
    sizeBytes: blob.size,
  };
}
