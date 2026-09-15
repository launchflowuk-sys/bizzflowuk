import { createContext, useContext, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "lf_token";
// Active business, held PER DEVICE. It used to live on the user row, so switching business on one
// device changed it everywhere that account was signed in.
const TENANT_KEY = "lf_active_tenant";
export function getActiveTenantId(): string | null { return localStorage.getItem(TENANT_KEY); }
export function setActiveTenantId(id: number | string): void { localStorage.setItem(TENANT_KEY, String(id)); }
export function clearActiveTenantId(): void { localStorage.removeItem(TENANT_KEY); }
export function getStoredToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function storeToken(t: string): void { localStorage.setItem(TOKEN_KEY, t); }
export function clearStoredToken(): void { localStorage.removeItem(TOKEN_KEY); }

/**
 * Support sessions.
 *
 * Starting one swaps the active token for a short-lived, tenant-scoped one and
 * PARKS the real one. Leaving puts it back. Keeping the original rather than
 * re-authenticating is what makes coming out instant — and it means a support
 * session that expires does not log the platform admin out of their own
 * account, which would be a miserable way to find out the hour was up.
 */
const SUPPORT_RETURN_KEY = "lf_support_return";

export function beginSupportSession(supportToken: string): void {
  const own = getStoredToken();
  if (own) localStorage.setItem(SUPPORT_RETURN_KEY, own);
  storeToken(supportToken);
  // The support token carries its own tenant. A stale per-device selection
  // would be sent as X-Tenant-Id and ignored, but clearing it keeps the
  // switcher honest about where you actually are.
  clearActiveTenantId();
}

export function inSupportSession(): boolean {
  return !!localStorage.getItem(SUPPORT_RETURN_KEY);
}

/** Puts the real account back. Returns false if there was nothing parked. */
export function endSupportSession(): boolean {
  const own = localStorage.getItem(SUPPORT_RETURN_KEY);
  localStorage.removeItem(SUPPORT_RETURN_KEY);
  clearActiveTenantId();
  if (!own) return false;
  storeToken(own);
  return true;
}

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
    // A fresh sign-in starts on the account's own default business, not whatever the previous
    // user of this browser had selected.
    clearActiveTenantId();
    setIsSignedIn(true);
    qc.invalidateQueries();
  }, [qc]);

  const signOut = useCallback(() => {
    /**
     * Signing out of a support session means leaving THEIRS, not yours.
     *
     * Pressing Sign out while inside a client's workspace is the obvious way
     * to try to get out of it — more obvious, for most people, than the Leave
     * button on the banner. Treating it as a real sign-out would throw away
     * the platform admin's own session as collateral for wanting to stop
     * looking at somebody else's screens.
     */
    if (endSupportSession()) {
      qc.clear();
      window.location.href = "/admin/tenants";
      return;
    }

    clearStoredToken();
    clearActiveTenantId();
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
