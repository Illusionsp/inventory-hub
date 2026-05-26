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

  // Only redirect when we have a confirmed unauthenticated state (not mid-fetch).
  // Checking isFetching prevents the redirect during background re-validation.
  useEffect(() => {
    if (!isLoading && !isFetching && !user && window.location.pathname !== "/login") {
      setLocation("/login");
    }
  }, [user, isLoading, isFetching, setLocation]);

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
