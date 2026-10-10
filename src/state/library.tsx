import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { z } from "zod";
import { bootstrapSchema, routeAnnouncementsSchema, readableError, type AudioAsset, type Bootstrap, type QuickAnnouncement, type RouteAnnouncements, type RouteSummary } from "../domain/catalog";
import { advanceLease, eligibleAudio, leaseValid, mediaKey, newLease, SYNC_FRESH_MS, type OfflineLease } from "../domain/offline";
import { DownloadManager } from "../domain/download-manager";
import { resolveAudioSource, type ResolvedAudio } from "../domain/audio-source";
import { fetchAudio, fetchBootstrap, fetchQuickAnnouncements, fetchRouteAnnouncements, MobileApiError, syncAnnouncements, updatePinnedRoute } from "../services/api";
import { createOfflineStorage } from "../services/offline-storage";
import { readLease, writeLease } from "../services/offline-lease";
import { defaultPreferences, readPreferences, savePreferences, type Preferences } from "../services/preferences";
import { useAuth } from "./auth";

const cacheSchema = z.object({ version: z.literal(1), revision: z.string().regex(/^[a-f0-9]{64}$/), dirty: z.boolean().default(false),
  snapshot: z.object({ catalog: bootstrapSchema, pinnedRoutes: z.array(routeAnnouncementsSchema).max(3) }) });
type CatalogCache = z.infer<typeof cacheSchema>;
type Readiness = { ready: number; total: number; label: string; complete: boolean; error?: string };
type LibraryContextValue = {
  catalog: Bootstrap | null; loading: boolean; busy: string | null; error: string | null; online: boolean;
  preferences: Preferences; refresh: (force?: boolean) => Promise<void>;
  refreshQuickAnnouncements: (force?: boolean) => Promise<QuickAnnouncement[]>;
  togglePin: (route: RouteSummary) => Promise<void>; pinBusy: boolean;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
  clearError: () => void; loadRoute: (id: string, force?: boolean) => Promise<RouteAnnouncements>;
  readiness: (id: string) => Readiness; retryDownloads: () => void;
  offlineSupported: boolean; offlineValid: boolean; offlineUntil: number | null; lastSync: number | null; storageBytes: number;
  isDownloaded: (audio: AudioAsset) => boolean; resolveAudio: (audio: AudioAsset) => Promise<ResolvedAudio>;
  localAllowed: (audio: AudioAsset) => boolean; releaseAudio: (key: string | null) => void;
  testAudio: AudioAsset | null;
};
const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [cache, setCache] = useState<CatalogCache | null>(null);
  const cacheRef = useRef(cache);
  const [lease, setLease] = useState<OfflineLease | null>(null);
  const leaseRef = useRef(lease);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const pinLocked = useRef(false);
  const mounted = useRef(true);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const preferencesRef = useRef(defaultPreferences);
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const syncFlight = useRef<Promise<void> | null>(null);
  const lastAttempt = useRef(0);
  const quickFlight = useRef<Promise<QuickAnnouncement[]> | null>(null);
  const quickAt = useRef(0);
  const routeCache = useRef(new Map<string, { data: RouteAnnouncements; at: number }>());
  const routeFlights = useRef(new Map<string, Promise<RouteAnnouncements>>());
  const [downloadsRevision, setDownloadsRevision] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active" || AppState.currentState == null);
  const storage = useMemo(() => createOfflineStorage(userId), [userId]);
  const manager = useMemo(() => new DownloadManager(storage, () => {
    setDownloadsRevision((value) => value + 1);
  }), [storage]);
  const network = Network.useNetworkState();
  const online = network.isInternetReachable !== false && network.isConnected !== false;
  const onlineRef = useRef(online);
  useEffect(() => { onlineRef.current = online; }, [online]);
  const offlineValid = storage.supported && leaseValid(lease) && lease?.revision === cache?.revision;
  const downloadsAllowed = online && foreground && offlineValid && (!preferences.wifiOnly || network.type === Network.NetworkStateType.WIFI);

  const acceptCache = useCallback((next: CatalogCache) => { cacheRef.current = next; setCache(next); }, []);
  const acceptLease = useCallback((next: OfflineLease | null) => { leaseRef.current = next; setLease(next); }, []);

  const refresh = useCallback(async (force = true) => {
    if (!mounted.current) return;
    if (syncFlight.current) return syncFlight.current;
    if (pinLocked.current) return;
    if (!force && (Date.now() - lastAttempt.current < 60_000 ||
      (cacheRef.current && cacheRef.current.revision === leaseRef.current?.revision && leaseValid(leaseRef.current) &&
        Date.now() - leaseRef.current.receivedAt < SYNC_FRESH_MS && !cacheRef.current.dirty))) return;
    if (!onlineRef.current) { if (force) setError("You are offline. Downloaded pinned audio stays available until its sync expiry."); return; }
    lastAttempt.current = Date.now();
    setBusy("Syncing pinned routes"); setError(null);
    const operation = (async () => {
      let committing = false;
      try {
        const current = cacheRef.current;
        const response = await syncAnnouncements(current?.dirty ? undefined : current?.revision);
        if (!mounted.current) return;
        const next = response.unchanged ? current : {
          version: 1 as const, revision: response.revision, dirty: false,
          snapshot: { catalog: response.catalog, pinnedRoutes: response.pinnedRoutes },
        };
        if (!next || next.revision !== response.revision) throw new Error("Saved catalog is unavailable. Please refresh again.");
        const authorization = newLease(response.revision, response.serverTime, response.offlineUntil);
        committing = true;
        // Revoke old authorization before committing the new catalog. A failed disk
        // write cannot leave an older removed route authorized after restart.
        await writeLease(userId, null);
        if (!mounted.current) return;
        // Apply the authenticated response in one render, so a routine unchanged
        // sync does not interrupt a playing local file.
        acceptCache(next); acceptLease(authorization); routeCache.current.clear(); quickAt.current = Date.now();
        await storage.writeSnapshot(next);
        if (!mounted.current) return;
        await writeLease(userId, authorization);
        if (!mounted.current) { await writeLease(userId, null); return; }
        acceptLease(authorization);
      } catch (failure) {
        if (mounted.current) {
          if (committing) acceptLease(null);
          if (!cacheRef.current && failure instanceof MobileApiError && failure.status === 404) {
            // An APK installed before the backend release still has its online library.
            try {
              const catalog = await fetchBootstrap();
              if (mounted.current) {
                acceptCache({ version: 1, revision: "0".repeat(64), dirty: true, snapshot: { catalog, pinnedRoutes: [] } });
                acceptLease(null);
                setError("Offline sync is not available on the server yet. Online playback is available.");
              }
            } catch (fallbackError) { if (mounted.current) setError(readableError(fallbackError)); }
          } else setError(readableError(failure));
        }
      }
      finally { if (mounted.current) setBusy(null); }
    })();
    syncFlight.current = operation;
    try { await operation; } finally { if (syncFlight.current === operation) syncFlight.current = null; }
  }, [acceptCache, acceptLease, storage, userId]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const [saved, authorization, prefs] = await Promise.all([storage.readSnapshot(), readLease(userId), readPreferences()]);
        await manager.initialize();
        if (!mounted.current) return;
        const parsed = cacheSchema.safeParse(saved);
        if (parsed.success) acceptCache(parsed.data);
        acceptLease(authorization);
        preferencesRef.current = prefs; setPreferences(prefs);
      } catch (failure) { if (mounted.current) setError(readableError(failure)); }
      finally { if (mounted.current) { setLoading(false); void refresh(false); } }
    })();
    return () => { mounted.current = false; void manager.dispose(); };
  }, [acceptCache, acceptLease, manager, refresh, storage, userId]);

  // High-water checkpoints prevent a normal clock rollback from extending a lease.
  useEffect(() => {
    const checkpoint = () => {
      if (!leaseRef.current || syncFlight.current || pinLocked.current) return;
      const next = advanceLease(leaseRef.current); acceptLease(next);
      // iOS can lock SecureStore while audio continues in the background. Keep
      // the already-issued in-memory expiry and retry the checkpoint on unlock.
      void writeLease(userId, next).catch(() => undefined);
    };
    const timer = setInterval(checkpoint, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active"); checkpoint();
      if (state === "active" && !loading) void refresh(false);
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [acceptLease, loading, refresh, userId]);

  useEffect(() => {
    if (loading || !online || !foreground) return;
    const timer = setTimeout(() => { void refresh(false); }, Math.max(2_000, 60_000 - (Date.now() - lastAttempt.current)));
    return () => clearTimeout(timer);
  }, [loading, online, foreground, refresh]);

  useEffect(() => {
    if (!loading) manager.configure(cache?.snapshot ?? null, downloadsAllowed, preferences.storageMB * 1024 * 1024);
  }, [cache, downloadsAllowed, loading, manager, preferences.storageMB]);

  const refreshQuickAnnouncements = useCallback(async (force = false) => {
    if (!onlineRef.current) throw new Error("Quick announcements require an internet connection.");
    if (!force && cacheRef.current && Date.now() - quickAt.current < SYNC_FRESH_MS) return cacheRef.current.snapshot.catalog.quickAnnouncements;
    if (quickFlight.current) return quickFlight.current;
    const operation = (async () => {
      const { quickAnnouncements } = await fetchQuickAnnouncements();
      if (mounted.current && cacheRef.current) {
        acceptCache({ ...cacheRef.current, snapshot: { ...cacheRef.current.snapshot, catalog: { ...cacheRef.current.snapshot.catalog, quickAnnouncements } } });
        quickAt.current = Date.now();
      }
      return quickAnnouncements;
    })();
    quickFlight.current = operation;
    try { return await operation; } finally { quickFlight.current = null; }
  }, [acceptCache]);

  const loadRoute = useCallback(async (id: string, force = false) => {
    if (force) await refresh(true);
    const pinned = cacheRef.current?.snapshot.pinnedRoutes.find((item) => item.route.id === id);
    if (pinned) return pinned;
    const previous = routeCache.current.get(id);
    if (!force && previous && Date.now() - previous.at < SYNC_FRESH_MS) return previous.data;
    if (!onlineRef.current) throw new Error("Only downloaded pinned routes are available offline.");
    const existing = routeFlights.current.get(id);
    if (existing) return existing;
    const operation = fetchRouteAnnouncements(id).then((data) => {
      if (mounted.current) routeCache.current.set(id, { data, at: Date.now() });
      return data;
    }).finally(() => { routeFlights.current.delete(id); });
    routeFlights.current.set(id, operation);
    return operation;
  }, [refresh]);

  const togglePin = useCallback(async (route: RouteSummary) => {
    if (pinLocked.current) return;
    pinLocked.current = true; setPinBusy(true); setError(null);
    let failure: unknown;
    try {
      if (!onlineRef.current) throw new Error("Connect to the internet to change pinned routes.");
      await syncFlight.current;
      const result = await updatePinnedRoute(route.id, !route.isPinned);
      if (!mounted.current) return;
      const current = cacheRef.current;
      if (current) {
        const ids = new Set(result.routes.map((item) => item.id));
        const next = { ...current, dirty: true, snapshot: { ...current.snapshot,
          catalog: { ...current.snapshot.catalog, routes: current.snapshot.catalog.routes.map((item) => ({ ...item, isPinned: ids.has(item.id) })) },
          pinnedRoutes: current.snapshot.pinnedRoutes.filter((item) => ids.has(item.route.id)),
        } };
        acceptCache(next);
        // A newly added pin has no authorized playlist yet. Persist removal of old
        // playlists immediately, but recover incomplete pin snapshots via full sync.
        const priorLease = leaseRef.current;
        await writeLease(userId, null);
        try {
          await storage.writeSnapshot(next);
          if (mounted.current) await writeLease(userId, priorLease);
        } catch (error) { acceptLease(null); throw error; }
      }
    } catch (error) { failure = error; }
    finally { pinLocked.current = false; if (mounted.current) setPinBusy(false); }
    await refresh(true);
    if (failure && mounted.current) setError(readableError(failure));
  }, [acceptCache, acceptLease, refresh, storage, userId]);

  const setPreference = useCallback(async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    preferenceQueue.current = preferenceQueue.current.then(async () => {
      const next = { ...preferencesRef.current, [key]: value };
      try { await savePreferences(next); preferencesRef.current = next; setPreferences(next); manager.retry(); }
      catch (failure) { setError(readableError(failure)); }
    });
    await preferenceQueue.current;
  }, [manager]);

  const localAllowed = useCallback((audio: AudioAsset) => storage.supported && leaseValid(leaseRef.current) &&
    leaseRef.current?.revision === cacheRef.current?.revision && eligibleAudio(cacheRef.current?.snapshot ?? null, audio), [storage]);
  const resolveAudio = useCallback(async (audio: AudioAsset): Promise<ResolvedAudio> => {
    return resolveAudioSource(audio, { localAllowed, online: () => onlineRef.current, leaseValid: () => leaseValid(leaseRef.current),
      localUri: (key) => storage.localUri(key, true), hold: (key) => manager.hold(key), release: (key) => manager.release(key),
      invalidate: (key) => manager.invalidate(key), fetchAudio, prepare: (key) => manager.canPrepare(key) ? manager.prepare(key) : undefined });
  }, [localAllowed, manager, storage]);

  const isDownloaded = (audio: AudioAsset) => offlineValid && eligibleAudio(cache?.snapshot ?? null, audio) && manager.statuses.get(mediaKey(audio) ?? "")?.state === "ready";
  const readiness = (id: string): Readiness => {
    if (!storage.supported) return { ready: 0, total: 0, label: "Downloads available in the mobile app", complete: false };
    const playlist = cache?.snapshot.pinnedRoutes.find((item) => item.route.id === id);
    const items = playlist?.announcements ?? [];
    const ready = items.filter(isDownloaded).length;
    const failed = items.map((item) => manager.statuses.get(mediaKey(item) ?? "")).find((item) => item?.state === "failed");
    const complete = offlineValid && items.length > 0 && ready === items.length;
    const active = items.map((item) => manager.statuses.get(mediaKey(item) ?? "")).find((item) => item?.state === "downloading");
    const label = !offlineValid ? "Refresh to enable offline audio" : !playlist ? "Sync to prepare this route" : !items.length ? "No audio to download" : complete ? "Ready offline" : failed ? "Needs attention" : !online ? "Waiting for connection" : preferences.wifiOnly && network.type !== Network.NetworkStateType.WIFI ? "Waiting for Wi-Fi" : active ? `Downloading · ${Math.round(active.progress * 100)}%` : "Preparing downloads";
    return { ready, total: items.length, complete, label, error: failed?.error };
  };
  // Include progress updates in this provider's render without putting media in React state.
  void downloadsRevision;
  return <LibraryContext.Provider value={{ catalog: cache?.snapshot.catalog ?? null, loading, busy, error, online, preferences,
    refresh, refreshQuickAnnouncements, togglePin, pinBusy, setPreference, clearError: () => setError(null), loadRoute,
    readiness, retryDownloads: () => manager.retry(), offlineSupported: storage.supported, offlineValid,
    offlineUntil: lease?.offlineUntil ?? null, lastSync: lease?.serverTime ?? null, storageBytes: storage.usedBytes(),
    isDownloaded, resolveAudio, localAllowed, releaseAudio: (key) => { if (key) manager.release(key); },
    testAudio: cache?.snapshot.pinnedRoutes.flatMap((item) => item.announcements).find(isDownloaded) ??
      cache?.snapshot.catalog.quickAnnouncements.flatMap((item) => item.type === "MULTIPLE" ? item.audios : item.audio ? [item.audio] : [])[0] ?? null,
  }}>{children}</LibraryContext.Provider>;
}
export function useLibrary() { const value = useContext(LibraryContext); if (!value) throw new Error("useLibrary must be inside LibraryProvider"); return value; }
export function useLibraryAudio() {
  const { catalog } = useLibrary();
  return catalog?.quickAnnouncements.flatMap((item) => item.type === "MULTIPLE" ? item.audios : item.audio ? [item.audio] : []) ?? [];
}
