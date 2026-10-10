import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { z } from "zod";
import { audioSchema, bootstrapSchema, configSchema, pinnedRoutesSchema, quickAnnouncementsSchema, routeAnnouncementsSchema, syncResponseSchema } from "../domain/catalog";
import {
  getInstallationId,
  saveAuthSession,
  type MobileAuthSession,
} from "./auth-storage";

const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
export const apiBaseUrl = configuredUrl;

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  driverId: z.string().nullable(),
});
const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
  accessTokenExpiresIn: z.union([z.string(), z.number()]).optional(),
  user: userSchema,
}).passthrough();

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

let currentSession: MobileAuthSession | null = null;
let refreshPromise: Promise<MobileAuthSession> | null = null;
let authFailureHandler: ((message: string) => void) | null = null;
let sessionEpoch = 0;

export function setCurrentAuthSession(session: MobileAuthSession | null) {
  sessionEpoch++;
  refreshPromise = null;
  currentSession = session;
}
export const getCurrentAuthSession = () => currentSession;

function withExpiry(session: z.infer<typeof sessionSchema>): MobileAuthSession {
  const ttl = session.accessTokenExpiresIn;
  const match = typeof ttl === "string" ? /^(\d+)\s*([smhd])$/.exec(ttl) : null;
  const seconds = typeof ttl === "number" ? ttl : match ? Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 0) : 0;
  return { ...session, accessTokenExpiresAt: seconds ? Date.now() + seconds * 1000 : undefined };
}

export function setAuthFailureHandler(handler: ((message: string) => void) | null) {
  authFailureHandler = handler;
}

function ensureConfigured() {
  if (!configuredUrl) throw new Error("The announcement service has not been configured.");
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:") throw new Error("Configure an HTTPS API base URL.");
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  ensureConfigured();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${configuredUrl}${path}`, { ...init, cache: "no-store", signal: controller.signal });
    // Keep the deadline active through the entire JSON body, not just headers.
    // A dropped signal halfway through a sync must not leave it pending forever.
    const body = await response.text();
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The connection timed out. Try again when your signal improves.");
    if (error instanceof TypeError) throw new Error("Cannot reach the announcement service. Check your internet connection.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseError(response: Response): Promise<MobileApiError> {
  let body: { message?: string; code?: string } = {};
  try { body = await response.json() as typeof body; } catch { /* no response body */ }
  return new MobileApiError(body.message ?? `Request failed (${response.status}).`, response.status, body.code);
}

async function performRefresh(): Promise<MobileAuthSession> {
  const epoch = sessionEpoch;
  const session = currentSession;
  if (!session) throw new MobileApiError("Please sign in to continue.", 401, "MOBILE_AUTH_REQUIRED");
  const installationId = await getInstallationId();
  if (epoch !== sessionEpoch) throw new Error("The signed-in account changed.");
  const response = await rawRequest("/mobile/auth/refresh", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken, installationId }),
  });
  if (epoch !== sessionEpoch) throw new Error("The signed-in account changed.");
  if (!response.ok) throw await parseError(response);
  const parsed = z.object({ success: z.literal(true), data: sessionSchema }).parse(await response.json());
  if (epoch !== sessionEpoch) throw new Error("The signed-in account changed.");
  const next = withExpiry(parsed.data);
  currentSession = next;
  await saveAuthSession(next);
  if (epoch !== sessionEpoch) throw new Error("The signed-in account changed.");
  return next;
}

export async function refreshAuthSession(): Promise<MobileAuthSession> {
  if (!refreshPromise) {
    const operation = performRefresh().finally(() => { if (refreshPromise === operation) refreshPromise = null; });
    refreshPromise = operation;
  }
  return refreshPromise;
}

async function authenticatedRequest(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const epoch = sessionEpoch;
  if (!currentSession) throw new MobileApiError("Please sign in to continue.", 401, "MOBILE_AUTH_REQUIRED");
  if (retry && currentSession.accessTokenExpiresAt && currentSession.accessTokenExpiresAt < Date.now() + 30_000) {
    try { await refreshAuthSession(); }
    catch (error) {
      if (epoch === sessionEpoch && error instanceof MobileApiError && [401, 403].includes(error.status ?? 0)) authFailureHandler?.(error.message);
      throw error;
    }
  }
  if (epoch !== sessionEpoch || !currentSession) throw new Error("The signed-in account changed.");
  const response = await rawRequest(path, {
    ...init,
    headers: { Accept: "application/json", ...init.headers, Authorization: `Bearer ${currentSession.accessToken}` },
  });
  if (epoch !== sessionEpoch) throw new Error("The signed-in account changed.");
  if (response.status === 401 && retry) {
    try {
      await refreshAuthSession();
      if (epoch !== sessionEpoch) throw new Error("The signed-in account changed.");
      return authenticatedRequest(path, init, false);
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Your session is no longer valid.";
      if (epoch === sessionEpoch && error instanceof MobileApiError && (error.status === 401 || error.status === 403)) authFailureHandler?.(failure);
      throw error;
    }
  }
  if (!response.ok) {
    const error = await parseError(response);
    if (epoch === sessionEpoch && (response.status === 401 || response.status === 403)) authFailureHandler?.(error.message);
    throw error;
  }
  return response;
}

export async function loginMobileDriver(username: string, password: string): Promise<MobileAuthSession> {
  const installationId = await getInstallationId();
  const platform = Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : undefined;
  const response = await rawRequest("/mobile/auth/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      device: {
        installationId,
        platform,
        deviceName: [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || Device.deviceName || undefined,
        osVersion: Device.osVersion ?? String(Platform.Version),
        appVersion: Application.nativeApplicationVersion ?? undefined,
      },
    }),
  });
  if (!response.ok) throw await parseError(response);
  const parsed = z.object({ success: z.literal(true), data: sessionSchema }).parse(await response.json());
  const next = withExpiry(parsed.data);
  setCurrentAuthSession(next);
  await saveAuthSession(next);
  return next;
}

export async function logoutMobileDriver(): Promise<void> {
  const previous = currentSession;
  setCurrentAuthSession(null);
  await saveAuthSession(null);
  if (previous) await rawRequest("/mobile/auth/logout", {
    method: "POST", headers: { Authorization: `Bearer ${previous.accessToken}` },
  });
}

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await authenticatedRequest(`/mobile/announcements${path}`);
  const envelope = z.object({ success: z.literal(true), data: schema }).safeParse(await response.json());
  if (!envelope.success) throw new Error("The announcement service returned an unsupported response. Please try again or contact your administrator.");
  return envelope.data.data;
}

export const fetchBootstrap = () => get("/bootstrap", bootstrapSchema);
export const fetchQuickAnnouncements = () => get("/quick-announcements", quickAnnouncementsSchema);
export const fetchRouteAnnouncements = (id: string) => get(`/routes/${encodeURIComponent(id)}/announcements`, routeAnnouncementsSchema);
export const fetchAudio = (id: string) => get(`/audios/${encodeURIComponent(id)}`, audioSchema);
export const fetchConfig = () => get("/config", configSchema);
export async function syncAnnouncements(revision?: string) {
  const response = await authenticatedRequest("/mobile/announcements/sync", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision }),
  });
  const envelope = z.object({ success: z.literal(true), data: syncResponseSchema }).safeParse(await response.json());
  if (!envelope.success) throw new Error("The announcement service returned an incomplete sync. Your previous downloads are still saved. Please refresh again.");
  return envelope.data.data;
}
export async function updatePinnedRoute(id: string, pinned: boolean) {
  const response = await authenticatedRequest(`/mobile/users/me/pinned-routes/${encodeURIComponent(id)}`, { method: pinned ? "POST" : "DELETE" });
  return z.object({ success: z.literal(true), data: pinnedRoutesSchema }).parse(await response.json()).data;
}
