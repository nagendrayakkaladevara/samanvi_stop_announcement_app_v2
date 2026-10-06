import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { readableError, type Bootstrap, type RouteSummary } from "../domain/catalog";
import { fetchBootstrap, updatePinnedRoute } from "../services/api";
import { defaultPreferences, readPreferences, savePreferences, type Preferences } from "../services/preferences";

type LibraryContextValue = {
  catalog: Bootstrap | null;
  loading: boolean;
  busy: string | null;
  error: string | null;
  online: boolean;
  preferences: Preferences;
  refresh: () => Promise<void>;
  togglePin: (route: RouteSummary) => Promise<void>;
  pinBusy: boolean;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
  clearError: () => void;
};
const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: PropsWithChildren) {
  const [catalog, setCatalog] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const preferencesRef = useRef(defaultPreferences);
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const request = useRef(0);
  const pinLocked = useRef(false);
  const network = Network.useNetworkState();
  const online = network.isInternetReachable !== false && network.isConnected !== false;

  const refresh = useCallback(async () => {
    const version = ++request.current;
    setBusy("Loading announcements");
    setError(null);
    try {
      if (!online) throw new Error("Connect to the internet to load announcements.");
      const next = await fetchBootstrap();
      if (version === request.current) setCatalog(next);
    } catch (failure) {
      if (version === request.current) { setCatalog(null); setError(readableError(failure)); }
    } finally {
      if (version === request.current) { setBusy(null); setLoading(false); }
    }
  }, [online]);

  useEffect(() => {
    let cancelled = false;
    void readPreferences().then((value) => {
      if (!cancelled) { preferencesRef.current = value; setPreferences(value); }
    }).catch((failure) => { if (!cancelled) setError(readableError(failure)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refresh(); });
    const invalidate = () => { request.current++; };
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
    return () => { cancelled = true; invalidate(); subscription.remove(); };
  }, [refresh]);

  const togglePin = useCallback(async (route: RouteSummary) => {
    if (pinLocked.current) return;
    pinLocked.current = true;
    setPinBusy(true);
    setError(null);
    // Invalidate any earlier bootstrap response so it cannot overwrite this mutation.
    request.current++;
    setBusy(null);
    try {
      if (!online) throw new Error("Connect to the internet to change pinned routes.");
      const result = await updatePinnedRoute(route.id, !route.isPinned);
      request.current++;
      setBusy(null);
      setLoading(false);
      const ids = new Set(result.routes.map((item) => item.id));
      setCatalog((current) => current ? { ...current, routes: current.routes.map((item) => ({ ...item, isPinned: ids.has(item.id) })) } : null);
    } catch (failure) {
      // Reconcile server state after a limit conflict or an uncertain network response.
      await refresh();
      setError(readableError(failure));
    } finally { pinLocked.current = false; setPinBusy(false); }
  }, [online, refresh]);

  const setPreference = useCallback(async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    preferenceQueue.current = preferenceQueue.current.then(async () => {
      const next = { ...preferencesRef.current, [key]: value };
      try { await savePreferences(next); preferencesRef.current = next; setPreferences(next); }
      catch (failure) { setError(readableError(failure)); }
    });
    await preferenceQueue.current;
  }, []);

  return <LibraryContext.Provider value={{ catalog: online ? catalog : null, loading, busy, error, online, preferences, refresh, togglePin, pinBusy, setPreference, clearError: () => setError(null) }}>{children}</LibraryContext.Provider>;
}
export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary must be inside LibraryProvider");
  return context;
}
export function useLibraryAudio() {
  const { catalog } = useLibrary();
  return catalog?.quickAnnouncements.flatMap((item) => item.type === "MULTIPLE" ? item.audios : item.audio ? [item.audio] : []) ?? [];
}
