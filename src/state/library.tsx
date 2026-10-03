import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import * as Network from "expo-network";
import {
  demoAssets,
  demoAudio,
  demoBootstrap,
  demoManifest,
} from "../data/demo";
import {
  allAudio,
  isReady,
  readableError,
  withSelectedRoute,
  type AudioAsset,
  type LibrarySnapshot,
} from "../domain/catalog";
import { fetchBootstrap, fetchManifest, isDemo } from "../services/api";
import {
  fileExists,
  readSnapshot,
  readValue,
  saveAudio,
  saveSnapshot,
  writeValue,
} from "../services/storage";

type Preferences = {
  keepAwake: boolean;
  requireSpeaker: boolean;
  entered: boolean;
};
const defaults: Preferences = {
  keepAwake: true,
  requireSpeaker: true,
  entered: false,
};
type LibraryContextValue = {
  snapshot: LibrarySnapshot | null;
  loading: boolean;
  busy: string | null;
  error: string | null;
  online: boolean;
  preferences: Preferences;
  refresh: () => Promise<void>;
  downloadRoute: (id: string) => Promise<void>;
  selectRoute: (id: string) => Promise<boolean>;
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => Promise<void>;
  clearError: () => void;
};
const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const current = useRef<LibrarySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(defaults);
  const preferencesRef = useRef(defaults);
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const locked = useRef(false);
  const network = Network.useNetworkState();
  const online =
    network.isInternetReachable !== false && network.isConnected !== false;

  const commit = useCallback(async (next: LibrarySnapshot) => {
    await saveSnapshot(next);
    current.current = next;
    setSnapshot(next);
  }, []);

  const ensureAudio = useCallback(
    async (
      audios: AudioAsset[],
      files: LibrarySnapshot["files"],
      demo = false,
    ) => {
      const result = { ...files };
      // Sequential downloads bound memory when optional SHA-256 validation reads a file.
      for (let index = 0; index < audios.length; index++) {
        const audio = audios[index];
        if (isReady({ files: result }, audio) && fileExists(result[audio.id]))
          continue;
        setBusy(`Saving audio ${index + 1} of ${audios.length}`);
        result[audio.id] = await saveAudio(
          audio,
          demo ? demoAssets[audio.id] : undefined,
        );
      }
      return result;
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy("Refreshing library");
    setError(null);
    try {
      if (isDemo) {
        const files = await ensureAudio(
          demoAudio,
          current.current?.files ?? {},
          true,
        );
        await commit({
          schemaVersion: 1,
          source: "demo",
          bootstrap: demoBootstrap,
          manifests: { [demoManifest.id]: demoManifest },
          files,
          selectedRouteId: current.current?.selectedRouteId ?? demoManifest.id,
          lastSyncedAt: new Date().toISOString(),
        });
      } else {
        const bootstrap = await fetchBootstrap();
        const common = [
          ...bootstrap.commonAudios,
          ...(bootstrap.welcomeAudio ? [bootstrap.welcomeAudio] : []),
        ];
        const files = await ensureAudio(common, current.current?.files ?? {});
        const published = new Set(bootstrap.routes.map((route) => route.id));
        const manifests = Object.fromEntries(
          Object.entries(current.current?.manifests ?? {}).filter(([id]) =>
            published.has(id),
          ),
        );
        const previousId = current.current?.selectedRouteId;
        await commit({
          schemaVersion: 1,
          source: "api",
          bootstrap,
          manifests,
          files,
          selectedRouteId:
            previousId && published.has(previousId) ? previousId : null,
          lastSyncedAt: new Date().toISOString(),
        });
      }
    } catch (failure) {
      setError(readableError(failure));
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }, [commit, ensureAudio]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [saved, prefs] = await Promise.all([
          readSnapshot(),
          readValue<Preferences>("preferences"),
        ]);
        if (cancelled) return;
        current.current = saved;
        setSnapshot(saved);
        if (prefs) {
          preferencesRef.current = { ...defaults, ...prefs };
          setPreferences(preferencesRef.current);
        }
        // Downloads can continue on Home with visible progress.
        setLoading(false);
        if (isDemo || !saved) await refresh();
      } catch (failure) {
        if (!cancelled) setError(readableError(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const downloadRoute = useCallback(
    async (id: string) => {
      if (locked.current) return;
      if (isDemo) {
        await refresh();
        return;
      }
      locked.current = true;
      setBusy("Getting route announcements");
      setError(null);
      try {
        const manifest = await fetchManifest(id);
        const previous = current.current;
        if (!previous)
          throw new Error("Refresh your routes before downloading audio.");
        const files = await ensureAudio(
          manifest.audios.map((item) => item.audio),
          previous.files,
        );
        await commit({
          ...previous,
          files,
          manifests: { ...previous.manifests, [id]: manifest },
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (failure) {
        setError(readableError(failure));
      } finally {
        locked.current = false;
        setBusy(null);
      }
    },
    [commit, ensureAudio, refresh],
  );

  const selectRoute = useCallback(
    async (id: string) => {
      if (!current.current || locked.current) return false;
      locked.current = true;
      setError(null);
      try {
        await commit(withSelectedRoute(current.current, id));
        return true;
      } catch (failure) {
        setError(readableError(failure));
        return false;
      } finally {
        locked.current = false;
      }
    },
    [commit],
  );
  const setPreference = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      // Serialize writes so quick changes to different switches cannot overwrite
      // each other with an older preference snapshot.
      preferenceQueue.current = preferenceQueue.current.then(async () => {
        const next = { ...preferencesRef.current, [key]: value };
        try {
          await writeValue("preferences", next);
          preferencesRef.current = next;
          setPreferences(next);
        } catch (failure) {
          setError(readableError(failure));
        }
      });
      await preferenceQueue.current;
    },
    [],
  );

  return (
    <LibraryContext.Provider
      value={{
        snapshot,
        loading,
        busy,
        error,
        online,
        preferences,
        refresh,
        downloadRoute,
        selectRoute,
        setPreference,
        clearError: () => setError(null),
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary must be inside LibraryProvider");
  return context;
}
export function useLibraryAudio() {
  const { snapshot } = useLibrary();
  return snapshot ? allAudio(snapshot) : [];
}
