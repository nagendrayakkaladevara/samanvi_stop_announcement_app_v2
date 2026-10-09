import { z } from "zod";

const id = z.string().min(1).max(150);
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "A secure HTTPS URL is required");
export const audioSchema = z.object({
  id,
  title: z.string().min(1),
  audioUrl: httpsUrl,
  mimeType: z.string().optional(),
  durationMs: z.number().nonnegative().nullable().optional(),
});
export const routeSchema = z.object({
  id,
  routeId: z.string().min(1),
  startLocation: z.string().min(1),
  endLocation: z.string().min(1),
  via: z.string(),
  busType: z.enum(["AC", "Non-AC"]),
  isPinned: z.boolean(),
});
export const quickAnnouncementSchema = z.discriminatedUnion("type", [
  z.object({ id, name: z.string(), type: z.literal("MULTIPLE"), audios: z.array(audioSchema) }),
  z.object({ id, name: z.string(), type: z.literal("SINGLE"), audioUrl: httpsUrl.nullable(), audio: audioSchema.nullable() }),
]);
export const quickAnnouncementsSchema = z.object({ quickAnnouncements: z.array(quickAnnouncementSchema) });
export type QuickAnnouncement = z.infer<typeof quickAnnouncementSchema>;

export function quickAnnouncementSummary(announcement: QuickAnnouncement | undefined) {
  if (!announcement) return { available: false, detail: "Not configured" };
  if (announcement.type === "MULTIPLE") {
    return { available: announcement.audios.length > 0, detail: announcement.audios.length ? `${announcement.audios.length} welcome notes` : "Not configured" };
  }
  return { available: !!announcement.audio, detail: announcement.audio?.title ?? "Not configured" };
}
export const configSchema = z.object({
  recordsDriveUrl: httpsUrl.refine((value) => {
    const url = new URL(value);
    return url.hostname === "drive.google.com" && !url.username && !url.password;
  }, "A Google Drive URL is required").nullable(),
});
export const bootstrapSchema = configSchema.extend({
  routes: z.array(routeSchema),
  quickAnnouncements: z.array(quickAnnouncementSchema),
  maxPinnedRoutes: z.literal(3),
});
export const routeAnnouncementsSchema = z.object({
  routeId: z.string(),
  route: routeSchema,
  announcements: z.array(audioSchema.extend({ sequence: z.number().int().positive() })).refine(
    (items) => items.every((item, index) => index === 0 || items[index - 1].sequence < item.sequence),
    "Announcements must have unique ascending sequence values",
  ),
});
export const pinnedRoutesSchema = z.object({ routes: z.array(routeSchema).max(3), maxPinnedRoutes: z.literal(3) });
export type AudioAsset = z.infer<typeof audioSchema>;
export type RouteSummary = z.infer<typeof routeSchema>;
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type RouteAnnouncements = z.infer<typeof routeAnnouncementsSchema>;

export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
export function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
