import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Returns true if the current user has a given permission key. */
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
      refetchOnWindowFocus: true,
      retry: false,
    },
  });
  const [, setLocation] = useLocation();

  /**
   * Session adoption: /auth/me returns the current sessionId alongside the
   * user object.  If this tab has no tab_session yet (it authenticated via
   * the shared cookie rather than through an explicit login), lock it in to
   * the returned session ID.  From this point on all requests from this tab
   * carry a Bearer token and are isolated from cookie changes made by other
   * tabs logging in or switching accounts.
   */
  useEffect(() => {
    if (!user) return;
    const raw = user as unknown as User & { sessionId?: string };
    if (raw.sessionId && !sessionStorage.getItem("tab_session")) {
      sessionStorage.setItem("tab_session", raw.sessionId);
    }
  }, [user]);

  /**
   * Cross-tab auth sync: listen on BroadcastChannel for login/logout events
   * posted by other tabs.  On receipt, invalidate the /auth/me query so
   * React Query re-fetches — each tab will use its own Bearer token, so
   * the result is always the correct user for *this* tab's session.
   */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    };
    return () => channel.close();
  }, [queryClient]);

  useEffect(() => {
    if (!isLoading && !isFetching && !user && window.location.pathname !== "/login") {
      setLocation("/login");
    }
  }, [user, isLoading, isFetching, setLocation]);

  /**
   * `user.permissions` returned by /api/auth/me is always the *effective*
   * permissions array (role defaults applied server-side), never null.
   */
  function hasPermission(permission: string): boolean {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return (user.permissions ?? []).includes(permission);
  }

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
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
