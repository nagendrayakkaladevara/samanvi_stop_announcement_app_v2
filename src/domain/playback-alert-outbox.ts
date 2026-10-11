import { z } from "zod";

const schema = z.object({ eventId: z.string().uuid(), audioId: z.string(), playCount: z.number().int().min(4), playedAt: z.iso.datetime() });
export type PlaybackAlertEvent = z.infer<typeof schema>;
type Storage = { read: () => Promise<unknown[]>; write: (id: string, event: PlaybackAlertEvent) => Promise<void>; remove: (id: string) => Promise<void> };

export class PlaybackAlertOutbox {
  private flight: Promise<void> | null = null;
  constructor(private storage: Storage, private send: (event: PlaybackAlertEvent) => Promise<void>, private authorized: () => boolean) {}
  async enqueue(event: PlaybackAlertEvent) { await this.storage.write(event.eventId, event); }
  flush() {
    if (this.flight) return this.flight;
    const operation = (async () => {
      for (const raw of await this.storage.read()) {
        if (!this.authorized()) return;
        const event = schema.parse(raw);
        await this.send(event);
        await this.storage.remove(event.eventId);
      }
    })().finally(() => { if (this.flight === operation) this.flight = null; });
    this.flight = operation;
    return operation;
  }
}
