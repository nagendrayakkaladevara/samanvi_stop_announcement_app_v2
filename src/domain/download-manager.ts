import type { OfflineSnapshot } from "./catalog";
import { pinnedMedia } from "./offline";
import type { OfflineStorage } from "../services/offline-storage.types";

export type DownloadStatus = { state: "queued" | "downloading" | "ready" | "failed"; progress: number; error?: string };

/** One sequential queue per signed-in driver. React lifecycle and native IO are adapters. */
export class DownloadManager {
  readonly statuses = new Map<string, DownloadStatus>();
  private desired = pinnedMedia(null);
  private holds = new Map<string, number>();
  private attempts = new Map<string, number>();
  private running: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private activeKey: string | null = null;
  private enabled = false;
  private disposed = false;
  private budget = 250 * 1024 * 1024;
  private waiters = new Set<{ key: string; resolve: () => void; reject: (error: Error) => void }>();
  constructor(readonly storage: OfflineStorage, private onChange: () => void) {}
  private changed() {
    for (const waiter of this.waiters) {
      const status = this.statuses.get(waiter.key);
      if (status?.state === "ready") { this.waiters.delete(waiter); waiter.resolve(); }
      else if (this.disposed || !this.enabled || !this.desired.has(waiter.key) || (status?.state === "failed" && (this.attempts.get(waiter.key) ?? 0) >= 3)) {
        this.waiters.delete(waiter);
        waiter.reject(new Error(status?.error ?? "Download paused. Check your connection and download preferences."));
      }
    }
    if (!this.disposed) this.onChange();
  }
  canPrepare(key: string) { return this.enabled && this.desired.has(key) && !this.disposed; }
  async prepare(key: string) {
    if (this.statuses.get(key)?.state === "ready") return;
    if (!this.canPrepare(key)) throw new Error("Connect to finish downloading this pinned route.");
    const audio = this.desired.get(key)!;
    this.desired = new Map([[key, audio], ...this.desired]);
    const operation = new Promise<void>((resolve, reject) => { this.waiters.add({ key, resolve, reject }); });
    this.kick(); this.changed();
    return operation;
  }

  async initialize() {
    for (const item of await this.storage.media()) {
      if (await this.storage.localUri(item.key, true)) this.statuses.set(item.key, { state: "ready", progress: 1 });
    }
    this.changed();
  }
  configure(snapshot: OfflineSnapshot | null, enabled: boolean, budget: number) {
    this.desired = pinnedMedia(snapshot); this.enabled = enabled && this.storage.supported; this.budget = budget;
    if (!this.enabled || (this.activeKey && !this.desired.has(this.activeKey))) this.controller?.abort();
    for (const key of this.desired.keys()) if (!this.statuses.has(key)) this.statuses.set(key, { state: "queued", progress: 0 });
    this.kick(); this.changed();
  }
  hold(key: string) { this.holds.set(key, (this.holds.get(key) ?? 0) + 1); }
  release(key: string) {
    const count = this.holds.get(key) ?? 0;
    if (count <= 1) this.holds.delete(key); else this.holds.set(key, count - 1);
  }
  retry() {
    this.attempts.clear();
    for (const [key, status] of this.statuses) if (status.state === "failed") this.statuses.set(key, { state: "queued", progress: 0 });
    this.changed(); this.kick();
  }
  invalidate(key: string) { this.statuses.delete(key); this.attempts.delete(key); this.changed(); this.kick(); }
  private kick() {
    if (this.running || this.disposed || !this.enabled) return;
    this.running = this.run().catch((error) => {
      for (const key of this.desired.keys()) if (this.statuses.get(key)?.state !== "ready") {
        this.attempts.set(key, 3);
        this.statuses.set(key, { state: "failed", progress: 0, error: error instanceof Error ? error.message : "Download failed" });
      }
    }).finally(() => {
      this.running = null; this.activeKey = null; this.controller = null; this.changed();
      if (this.enabled && !this.disposed && [...this.desired.keys()].some((key) =>
        this.statuses.get(key)?.state !== "ready" && (this.attempts.get(key) ?? 0) < 3)) this.kick();
    });
  }
  private async run() {
    await this.storage.prune(new Set([...this.desired.keys(), ...this.holds.keys()]));
    for (const key of this.statuses.keys()) if (!this.desired.has(key) && !this.holds.has(key)) this.statuses.delete(key);
    while (this.enabled && !this.disposed) {
      const total = [...this.desired.values()].reduce((sum, audio) => sum + (audio.sizeBytes ?? 0), 0);
      if (total > this.budget) throw new Error("Pinned audio exceeds your download limit. Increase it in Settings or unpin a route.");
      const next = [...this.desired.entries()].find(([key]) => this.statuses.get(key)?.state !== "ready" && (this.attempts.get(key) ?? 0) < 3);
      if (!next) break;
      const [key, audio] = next;
      this.activeKey = key;
      const controller = new AbortController(); this.controller = controller;
      const attempt = (this.attempts.get(key) ?? 0) + 1;
      if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1) + Math.random() * 500));
      if (controller.signal.aborted || this.disposed) break;
      this.attempts.set(key, attempt);
      this.statuses.set(key, { state: "downloading", progress: 0 }); this.changed();
      try {
        const item = await this.storage.download(audio, controller.signal, (progress) => {
          if (!this.disposed) { this.statuses.set(key, { state: "downloading", progress }); this.changed(); }
        });
        if (item) this.statuses.set(key, { state: "ready", progress: 1 });
        else { this.attempts.delete(key); this.statuses.set(key, { state: "queued", progress: 0 }); }
      } catch (failure) {
        this.statuses.set(key, { state: "failed", progress: 0, error: failure instanceof Error ? failure.message : "Download failed" });
      }
      this.changed();
      // Unpinning cancels current work; clean it up before selecting another file.
      if (!this.desired.has(key)) {
        await this.storage.prune(new Set([...this.desired.keys(), ...this.holds.keys()]));
        this.statuses.delete(key);
      }
    }
  }
  async dispose() { this.disposed = true; this.enabled = false; this.controller?.abort(); this.changed(); await this.running; }
}
