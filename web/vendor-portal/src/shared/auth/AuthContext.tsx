import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTH_UNAUTHORIZED_EVENT, setTokenRefreshHandler } from '@/shared/api/http';
import { refreshAccessToken } from '@/features/auth/api/authApi';
import { clearSession, loadSession, saveSession, type AuthSession } from './session';

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSession) => void;
  updateSession: (patch: Partial<AuthSession>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => loadSession());

  const setSession = useCallback((next: AuthSession) => {
    saveSession(next);
    setSessionState(next);
  }, []);

  const updateSession = useCallback((patch: Partial<AuthSession>) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      let changed = false;
      for (const key of Object.keys(patch) as (keyof AuthSession)[]) {
        if (patch[key] !== undefined && patch[key] !== prev[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, ...patch };
      saveSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  useEffect(() => {
    setTokenRefreshHandler(async () => {
      const current = loadSession();
      if (!current?.refreshToken) {
        logout();
        return null;
      }
      try {
        const data = await refreshAccessToken(current.refreshToken);
        const next: AuthSession = {
          ...current,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? current.refreshToken,
          expiresIn: data.expiresIn,
          userId: data.userId,
          roles: data.roles ?? current.roles,
        };
        saveSession(next);
        setSessionState(next);
        return next.accessToken;
      } catch {
        logout();
        return null;
      }
    });
    return () => setTokenRefreshHandler(null);
  }, [logout]);

  useEffect(() => {
    function onUnauthorized() {
      logout();
    }
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout]);

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session?.accessToken),
      setSession,
      updateSession,
      logout,
    }),
    [session, setSession, updateSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
