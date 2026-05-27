import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  /** True while the first auth check is still in flight (app should not render protected content yet). */
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isFetching } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      staleTime: 60_000,
      gcTime: 5 * 60 * 1000,
      // Never retry auth failures (401) — the session is gone, redirect immediately.
      // Retry once for any other error (network blip, 5xx) so a transient hiccup
      // does not force a logout.
      retry: (failureCount, error) =>
        (error as any)?.status === 401 ? false : failureCount < 1,
      retryDelay: 1_000,
      refetchOnWindowFocus: true,
    },
  });
  const [location, setLocation] = useLocation();

  /**
   * isInitialized becomes true after the very first /auth/me response lands
   * (success or error).  We gate the redirect-to-login on this flag so the
   * app never flashes the login page before session data has been checked.
   * Once true it never reverts, even when background refetches run.
   */
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (!isLoading) setIsInitialized(true);
  }, [isLoading]);

  /**
   * Session fork: when this tab has no Bearer token (loaded via the shared
   * cookie), call /auth/fork to get a brand-new independent session ID.
   *
   * /auth/fork writes a fresh session directly to the store (does NOT call
   * session.regenerate(), which would destroy the shared cookie session and
   * cause other unforked tabs to see 401s).  Each tab ends up with its own
   * isolated Bearer session that cannot be disrupted by another tab's logout.
   */
  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem("tab_session")) return; // already isolated

    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    fetch(`${base}/api/auth/fork`, { method: "POST", credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { sessionId?: string } | null) => {
        const fallback = (user as unknown as User & { sessionId?: string }).sessionId;
        const id = data?.sessionId ?? fallback;
        if (id) sessionStorage.setItem("tab_session", id);
      })
      .catch(() => {
        // Fallback: use the sessionId echoed by /auth/me
        const raw = user as unknown as User & { sessionId?: string };
        if (raw.sessionId) sessionStorage.setItem("tab_session", raw.sessionId);
      });
  }, [user]);

  /**
   * Redirect to /login only after:
   *   1. The first auth check has completed (isInitialized), AND
   *   2. No background refetch is running (isFetching), AND
   *   3. There is definitely no authenticated user.
   *
   * Uses Wouter's `location` (relative to the router's base) rather than
   * window.location.pathname so the check works correctly regardless of
   * what base URL the app is mounted at.
   *
   * Gating on isInitialized prevents the redirect flash that would otherwise
   * occur on page load before the session cookie is verified.
   */
  useEffect(() => {
    if (!isInitialized) return;
    if (isFetching) return;
    if (!user && location !== "/login") {
      setLocation("/login");
    }
  }, [isInitialized, isFetching, user, location, setLocation]);

  function hasPermission(permission: string): boolean {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return (user.permissions ?? []).includes(permission);
  }

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        // Expose isLoading as true until initial auth check completes so
        // consumers can show a loading state before showing protected content.
        isLoading: !isInitialized,
        isAuthenticated: !!user,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
