import React, { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import {
  isDemo,
  loginMobileDriver,
  logoutMobileDriver,
  refreshAuthSession,
  setAuthFailureHandler,
  setCurrentAuthSession,
} from "../services/api";
import { loadAuthSession, saveAuthSession, type MobileAuthSession } from "../services/auth-storage";

type AuthContextValue = {
  session: MobileAuthSession | null;
  loading: boolean;
  message: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearMessage: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<MobileAuthSession | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [message, setMessage] = useState<string | null>(null);

  const invalidate = useCallback(async (reason: string) => {
    setCurrentAuthSession(null);
    await saveAuthSession(null);
    setSession(null);
    setMessage(reason);
  }, []);

  useEffect(() => {
    setAuthFailureHandler((reason) => { void invalidate(reason); });
    if (isDemo) return () => setAuthFailureHandler(null);
    let cancelled = false;
    void (async () => {
      try {
        const saved = await loadAuthSession();
        setCurrentAuthSession(saved);
        if (!saved) return;
        const refreshed = await refreshAuthSession();
        if (!cancelled) setSession(refreshed);
      } catch (error) {
        if (!cancelled) await invalidate(error instanceof Error ? error.message : "Please sign in again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; setAuthFailureHandler(null); };
  }, [invalidate]);

  useEffect(() => {
    if (!session || isDemo) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshAuthSession().then(setSession).catch((error) => invalidate(error instanceof Error ? error.message : "Please sign in again."));
      }
    });
    return () => subscription.remove();
  }, [invalidate, session]);

  const signIn = useCallback(async (username: string, password: string) => {
    setMessage(null);
    const next = await loginMobileDriver(username, password);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await logoutMobileDriver();
    setSession(null);
    setMessage("You have been signed out.");
  }, []);

  return <AuthContext.Provider value={{ session, loading, message, signIn, signOut, clearMessage: () => setMessage(null) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}
