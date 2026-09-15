import { useCallback, useEffect, useState } from "react";
import { getStoredToken } from "@/lib/auth";

/**
 * A small fetch layer for the trade modules — invoices, expenses, schedule,
 * certificates and automations.
 *
 * These routes are newer than the generated API client, and regenerating the
 * whole spec to add five screens would touch every existing hook in the
 * dashboard. This keeps the change additive: nothing already working is
 * regenerated, and these pages can move onto the generated client later without
 * their components changing.
 */

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const type = res.headers.get("content-type") || "";
  const payload = type.includes("json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    // Surface the server's own words — it explains what is blocking an issue or a
    // send far better than a status code does.
    const detail = payload?.problems?.join(" ") || payload?.error || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return payload as T;
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, body),
  /**
   * Fetch a binary response with the auth header on.
   *
   * A PDF endpoint cannot be a plain link: the token lives in localStorage and
   * a browser navigation sends no Authorization header, so the tab would get a
   * 401 instead of the document. This pulls the bytes properly and hands back
   * an object URL the caller can open or save.
   */
  blob: async (path: string): Promise<string> => {
    const token = getStoredToken();
    const res = await fetch(`/api${path}`, {
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || `Could not load the file (${res.status})`);
    }
    return URL.createObjectURL(await res.blob());
  },
  del: <T,>(path: string) => request<T>("DELETE", path),
};

/** Fetch-on-mount with a manual reload, which is all these screens need. */
export function useApi<T>(path: string | null, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    setError(null);
    api.get<T>(path)
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(e => { if (live) { setError(e.message); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { data, loading, error, reload };
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function money(v: unknown): string {
  const n = Number(v ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function dayMonth(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function timeOf(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** How many days until a date. Negative means it has passed. */
export function daysUntil(v: unknown): number | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  part_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/** Semantic colour by state — never the brand accent, so "needs you" reads as urgent. */
export const INVOICE_STATUS_TONE: Record<string, "good" | "warn" | "bad" | "muted"> = {
  draft: "muted",
  sent: "warn",
  part_paid: "warn",
  paid: "good",
  overdue: "bad",
  void: "muted",
};
