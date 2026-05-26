import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CHANNEL = "inventory_pro_auth";

export function broadcastAuthChange() {
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage({ type: "AUTH_CHANGED" });
    channel.close();
  } catch {
    // BroadcastChannel not available in some embedded contexts
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // staleTime: 60s — prevents constant background refetches that flash data
  // to undefined and cause redirect loops. BroadcastChannel handles cross-tab
  // invalidation explicitly when needed.
  const { data: user, isLoading, isFetching } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    },
  });
  const [, setLocation] = useLocation();

  // Only redirect when we have a confirmed unauthenticated state (not mid-fetch).
  // Checking isFetching prevents the redirect during background re-validation.
  useEffect(() => {
    if (!isLoading && !isFetching && !user && window.location.pathname !== "/login") {
      setLocation("/login");
    }
  }, [user, isLoading, isFetching, setLocation]);

  // Cross-tab sync: when another tab logs in or out, re-validate auth here.
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.addEventListener("message", (e: MessageEvent) => {
        if (e.data?.type === "AUTH_CHANGED") {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }
      });
    } catch {
      // BroadcastChannel not available
    }

    return () => {
      channel?.close();
    };
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated: !!user,
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
