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
