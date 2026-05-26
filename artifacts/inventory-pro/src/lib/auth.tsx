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
    // BroadcastChannel not available (e.g. some embedded contexts)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user && window.location.pathname !== "/login") {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  useEffect(() => {
    const invalidateMe = () => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    };

    // Cross-tab: when another tab logs in or out, refresh auth state here
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.addEventListener("message", (e: MessageEvent) => {
        if (e.data?.type === "AUTH_CHANGED") {
          invalidateMe();
        }
      });
    } catch {
      // BroadcastChannel not available
    }

    // Same-tab: when this tab regains focus, re-validate the session
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        invalidateMe();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      channel?.close();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
