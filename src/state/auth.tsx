import React, { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import {
  loginMobileDriver,
  logoutMobileDriver,
  setAuthFailureHandler,
  setCurrentAuthSession,
  getCurrentAuthSession,
} from "../services/api";
import { loadAuthSession, saveAuthSession, type MobileAuthSession } from "../services/auth-storage";
import { writeLease } from "../services/offline-lease";

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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const invalidate = useCallback(async (reason: string) => {
    const previous = getCurrentAuthSession();
    setCurrentAuthSession(null);
    setSession(null);
    setMessage(reason);
    await Promise.all([saveAuthSession(null), previous ? writeLease(previous.user.id, null) : Promise.resolve()]);
  }, []);

  useEffect(() => {
    setAuthFailureHandler((reason) => { void invalidate(reason).catch(() => setMessage(reason)); });
    let cancelled = false;
    void (async () => {
      try {
        const saved = await loadAuthSession();
        if (cancelled) return;
        setCurrentAuthSession(saved);
        if (!saved) return;
        // Restore immediately. Online requests refresh when needed; downloaded
        // playback has its own server-issued, 30-day offline lease.
        if (!cancelled) setSession(saved);
      } catch (error) {
        if (!cancelled) await invalidate(error instanceof Error ? error.message : "Please sign in again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; setAuthFailureHandler(null); };
  }, [invalidate]);

  const signIn = useCallback(async (username: string, password: string) => {
    setMessage(null);
    const next = await loginMobileDriver(username, password);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    const userId = session?.user.id;
    setSession(null);
    try {
      await Promise.all([logoutMobileDriver(), userId ? writeLease(userId, null) : Promise.resolve()]);
    }
    catch { /* Local sign-out still succeeds when the service is unreachable. */ }
    finally {
      setMessage("You have been signed out.");
    }
  }, [session]);

  return <AuthContext.Provider value={{ session, loading, message, signIn, signOut, clearMessage: () => setMessage(null) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}
