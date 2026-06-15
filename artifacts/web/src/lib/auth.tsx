import { createContext, useContext, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "lf_token";
export function getStoredToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function storeToken(t: string): void { localStorage.setItem(TOKEN_KEY, t); }
export function clearStoredToken(): void { localStorage.removeItem(TOKEN_KEY); }

export interface AuthCtx {
  isSignedIn: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthCtx>({ isSignedIn: false, signIn: () => {}, signOut: () => {} });
export function useAuthCtx() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(() => !!getStoredToken());
  const qc = useQueryClient();

  const signIn = useCallback((token: string) => {
    storeToken(token);
    setIsSignedIn(true);
    qc.invalidateQueries();
  }, [qc]);

  const signOut = useCallback(() => {
    clearStoredToken();
    setIsSignedIn(false);
    qc.clear();
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/sign-in";
  }, [qc]);

  return (
    <AuthContext.Provider value={{ isSignedIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
