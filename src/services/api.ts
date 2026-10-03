import { z } from "zod";
import { bootstrapSchema, manifestSchema } from "../domain/catalog";

const configuredUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
export const isDemo = configuredUrl.length === 0;
export const apiBaseUrl = configuredUrl;

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  if (!configuredUrl)
    throw new Error("The announcement service has not been configured.");
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:")
    throw new Error("Configure an HTTPS API base URL.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `${configuredUrl}/mobile/announcements${path}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      if (response.status === 404)
        throw new Error(
          "This route is no longer published. Refresh your routes.",
        );
      throw new Error(
        `The announcement service is unavailable (${response.status}). Your saved audio is still available.`,
      );
    }
    const envelope = z
      .object({ success: z.literal(true), data: schema })
      .safeParse(await response.json());
    if (!envelope.success)
      throw new Error(
        "The announcement service returned an unsupported response. Your saved library has been kept.",
      );
    return envelope.data.data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "The connection timed out. Try again when your signal improves.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the announcement service. Check your internet connection.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchBootstrap = () => get("/bootstrap", bootstrapSchema);
export const fetchManifest = (id: string) =>
  get(`/routes/${encodeURIComponent(id)}/manifest`, manifestSchema);
