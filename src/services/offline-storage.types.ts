import type { AudioAsset } from "../domain/catalog";

export type StoredMedia = { key: string; sizeBytes: number; sha256: string; fileName: string };
export interface OfflineStorage {
  supported: boolean;
  readSnapshot(): Promise<unknown>;
  writeSnapshot(snapshot: unknown): Promise<void>;
  media(): Promise<StoredMedia[]>;
  localUri(key: string, verify?: boolean): Promise<string | null>;
  download(audio: AudioAsset, signal: AbortSignal, progress: (fraction: number) => void): Promise<StoredMedia | null>;
  prune(keep: Set<string>): Promise<void>;
  usedBytes(): number;
}
