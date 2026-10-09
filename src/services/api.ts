import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { z } from "zod";
import { audioSchema, bootstrapSchema, configSchema, pinnedRoutesSchema, quickAnnouncementsSchema, routeAnnouncementsSchema } from "../domain/catalog";
import {
  getInstallationId,
  loadAuthSession,
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

export function setCurrentAuthSession(session: MobileAuthSession | null) {
  currentSession = session;
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
    return await fetch(`${configuredUrl}${path}`, { ...init, cache: "no-store", signal: controller.signal });
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
  currentSession ??= await loadAuthSession();
  if (!currentSession) throw new MobileApiError("Please sign in to continue.", 401, "MOBILE_AUTH_REQUIRED");
  const response = await rawRequest("/mobile/auth/refresh", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: currentSession.refreshToken, installationId: await getInstallationId() }),
  });
  if (!response.ok) throw await parseError(response);
  const parsed = z.object({ success: z.literal(true), data: sessionSchema }).parse(await response.json());
  currentSession = parsed.data;
  await saveAuthSession(currentSession);
  return currentSession;
}

export async function refreshAuthSession(): Promise<MobileAuthSession> {
  refreshPromise ??= performRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function authenticatedRequest(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  currentSession ??= await loadAuthSession();
  if (!currentSession) throw new MobileApiError("Please sign in to continue.", 401, "MOBILE_AUTH_REQUIRED");
  const response = await rawRequest(path, {
    ...init,
    headers: { Accept: "application/json", ...init.headers, Authorization: `Bearer ${currentSession.accessToken}` },
  });
  if (response.status === 401 && retry) {
    try {
      await refreshAuthSession();
      return authenticatedRequest(path, init, false);
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Your session is no longer valid.";
      if (error instanceof MobileApiError && (error.status === 401 || error.status === 403)) authFailureHandler?.(failure);
      throw error;
    }
  }
  if (!response.ok) {
    const error = await parseError(response);
    if (response.status === 401) authFailureHandler?.(error.message);
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
  currentSession = parsed.data;
  await saveAuthSession(currentSession);
  return currentSession;
}

export async function logoutMobileDriver(): Promise<void> {
  try {
    if (currentSession) await authenticatedRequest("/mobile/auth/logout", { method: "POST" }, false);
  } finally {
    currentSession = null;
    await saveAuthSession(null);
  }
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
export async function updatePinnedRoute(id: string, pinned: boolean) {
  const response = await authenticatedRequest(`/mobile/users/me/pinned-routes/${encodeURIComponent(id)}`, { method: pinned ? "POST" : "DELETE" });
  return z.object({ success: z.literal(true), data: pinnedRoutesSchema }).parse(await response.json()).data;
}
