import { z } from "zod";

const httpsUrl = z
  .string()
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Audio URLs must use HTTPS",
  );
const id = z.string().min(1).max(150);
const timestamp = z.string().datetime({ offset: true });

export const audioSchema = z.object({
  id,
  title: z.string().min(1),
  description: z.string().nullable(),
  category: z.enum(["stop_announcement", "common_audio", "welcome_note"]),
  originalFileName: z.string(),
  mimeType: z.enum([
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
  ]),
  sizeBytes: z
    .string()
    .regex(/^\d+$/)
    .refine(
      (value) => Number(value) > 0 && Number(value) <= 50 * 1024 * 1024,
      "Audio must be between 1 byte and 50 MiB",
    ),
  durationMs: z.number().nonnegative().nullable(),
  checksumSha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .nullable(),
  status: z.literal("ready"),
  blobUrl: httpsUrl.nullable(),
  downloadUrl: httpsUrl.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const routeSchema = z.object({
  id,
  routeCode: z.string(),
  name: z.string(),
  origin: z.string(),
  destination: z.string(),
  version: z.number().int().positive(),
  updatedAt: timestamp,
  _count: z.object({ audios: z.number().int().nonnegative() }),
});

export const bootstrapSchema = z.object({
  welcomeAudio: audioSchema.nullable(),
  commonAudios: z.array(audioSchema),
  routes: z.array(routeSchema),
});

export const manifestSchema = routeSchema.omit({ _count: true }).extend({
  description: z.string().nullable().optional(),
  audios: z.array(
    z.object({
      position: z.number().int().nonnegative(),
      stopLabel: z.string().nullable(),
      audio: audioSchema,
    }),
  ),
});

export type AudioAsset = z.infer<typeof audioSchema>;
export type RouteSummary = z.infer<typeof routeSchema>;
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type RouteManifest = z.infer<typeof manifestSchema>;
export type DownloadedAudio = {
  uri: string;
  revision: string;
  sizeBytes: number;
};
export type LibrarySnapshot = {
  schemaVersion: 1;
  source: "demo" | "api";
  bootstrap: Bootstrap;
  manifests: Record<string, RouteManifest>;
  files: Record<string, DownloadedAudio>;
  selectedRouteId: string | null;
  lastSyncedAt: string;
};

export const snapshotSchema: z.ZodType<LibrarySnapshot> = z.object({
  schemaVersion: z.literal(1),
  source: z.enum(["demo", "api"]),
  bootstrap: bootstrapSchema,
  manifests: z.record(z.string(), manifestSchema),
  files: z.record(
    z.string(),
    z.object({
      uri: z.string(),
      revision: z.string(),
      sizeBytes: z.number().nonnegative(),
    }),
  ),
  selectedRouteId: z.string().nullable(),
  lastSyncedAt: timestamp,
});

export function revisionOf(audio: AudioAsset): string {
  return `${audio.id}:${audio.checksumSha256?.toLowerCase() ?? audio.updatedAt}:${audio.sizeBytes}`;
}

export function allAudio(snapshot: LibrarySnapshot): AudioAsset[] {
  const items = [...snapshot.bootstrap.commonAudios];
  if (snapshot.bootstrap.welcomeAudio)
    items.push(snapshot.bootstrap.welcomeAudio);
  for (const manifest of Object.values(snapshot.manifests)) {
    items.push(...manifest.audios.map((item) => item.audio));
  }
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function isReady(
  snapshot: Pick<LibrarySnapshot, "files"> | null,
  audio: AudioAsset,
): boolean {
  return snapshot?.files[audio.id]?.revision === revisionOf(audio);
}

export function validateDownload(
  audio: AudioAsset,
  actualBytes: number,
  checksum?: string,
): void {
  if (actualBytes !== Number(audio.sizeBytes))
    throw new Error(`Incomplete download: ${audio.title}. Please try again.`);
  if (
    audio.checksumSha256 &&
    checksum?.toLowerCase() !== audio.checksumSha256.toLowerCase()
  ) {
    throw new Error(
      `File verification failed: ${audio.title}. The previous download has been kept.`,
    );
  }
}

export function withSelectedRoute(
  snapshot: LibrarySnapshot,
  routeId: string,
): LibrarySnapshot {
  if (!snapshot.bootstrap.routes.some((route) => route.id === routeId))
    throw new Error("This route is no longer available. Refresh your routes.");
  return { ...snapshot, selectedRouteId: routeId };
}

export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function readableError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
