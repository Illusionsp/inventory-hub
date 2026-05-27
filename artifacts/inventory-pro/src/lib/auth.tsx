import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  /** True while the first auth check is still in flight (app should not render protected content yet). */
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Shared channel name used across all auth-aware components. */
export const AUTH_BROADCAST_CHANNEL = "raflos_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading, isFetching } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      staleTime: 60_000,
      gcTime: 5 * 60 * 1000,
      // Retry once on failure before treating the user as logged out.
      // This prevents a single transient network error from forcing logout.
      retry: 1,
      retryDelay: 1_000,
      refetchOnWindowFocus: true,
    },
  });
  const [, setLocation] = useLocation();

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
   * Without this, multiple tabs that loaded via cookie all share the same
   * session.  If any one of them logs out (destroying that shared session),
   * every other tab silently loses auth on its next request.
   *
   * /auth/fork calls session.regenerate() on the server, giving this tab a
   * unique session that cannot be disrupted by another tab's logout.
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
   * Cross-tab auth sync via BroadcastChannel.
   *
   * Only unisolated tabs (no Bearer token yet) need to react to other tabs'
   * login/logout events — they rely on the shared cookie so they must refresh
   * when that cookie changes.  Tabs that already have their own Bearer token
   * are fully isolated and should NOT re-fetch: doing so is unnecessary and
   * can cause a visible flash if the refetch briefly clears the user.
   */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    channel.onmessage = () => {
      if (!sessionStorage.getItem("tab_session")) {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
    };
    return () => channel.close();
  }, [queryClient]);

  /**
   * Redirect to /login only after:
   *   1. The first auth check has completed (isInitialized), AND
   *   2. No background refetch is running (isFetching), AND
   *   3. There is definitely no authenticated user.
   *
   * Gating on isInitialized prevents the redirect flash that would otherwise
   * occur on page load before the session cookie is verified.
   */
  useEffect(() => {
    if (!isInitialized) return;
    if (isFetching) return;
    if (!user && window.location.pathname !== "/login") {
      setLocation("/login");
    }
  }, [isInitialized, isFetching, user, setLocation]);

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
