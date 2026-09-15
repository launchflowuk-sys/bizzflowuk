import { useEffect, useState } from "react";
import { api, useApi, shortDate } from "./tradeApi";
import Spinner from "./Spinner";

/**
 * Linking the business to its accounting package.
 *
 * Brandon's reason for staying on his current app: "it links to Xero my
 * accounting software." A trade who has to retype every invoice into their
 * accounts at the weekend will keep using whatever already does it for them.
 *
 * A provider whose app registration is missing shows as "not available yet"
 * rather than offering a Connect button that dead-ends on somebody else's
 * error page. A control that looks live and is not is the failure mode this
 * platform keeps meeting.
 */

type Provider = { key: string; label: string; description: string; configured: boolean };
type Connection = {
  provider: string; status: string; organisationName: string | null;
  connectedAt: string; lastSyncAt: string | null; lastError: string | null;
};

export default function AccountingPanel() {
  const { data, loading, reload } = useApi<{ providers: Provider[]; connection: Connection | null }>("/accounting");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  /**
   * The OAuth callback bounces back here with the outcome on the query string,
   * because the provider redirects a browser and cannot return JSON to us.
   */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const outcome = p.get("accounting");
    if (!outcome) return;
    setNote(outcome === "connected"
      ? { ok: true, text: `Connected to ${p.get("provider") ?? "your accounting package"}.` }
      : { ok: false, text: p.get("reason") || "That did not connect." });
    // Cleared so a refresh does not replay the message.
    window.history.replaceState({}, "", window.location.pathname);
    reload();
  }, []);

  /**
   * Only blank the panel on the FIRST load.
   *
   * `useApi` sets loading on every refetch, so the old `if (loading)` tore the
   * whole panel down each time an action finished — the button you had just
   * pressed, mid-"Sending…", was replaced by the word "Loading…" and then
   * redrawn. That read as a flicker and left you unsure the press had landed.
   * With data in hand we keep the panel on screen and let the buttons show
   * their own state.
   */
  if (loading && !data) return <p className="text-sm text-slate-400">Loading…</p>;

  const providers = data?.providers ?? [];
  const conn = data?.connection ?? null;
  const live = conn && conn.status !== "disconnected";

  async function connect(key: string) {
    setBusy(key); setNote(null);
    try {
      const r = await api.post<{ url: string }>(`/accounting/connect/${key}`);
      window.location.href = r.url;
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "Could not start the connection." });
      setBusy(null);
    }
  }

  async function disconnect(key: string) {
    if (!confirm("Unlink this? Invoices already sent stay in your accounts; new ones stop going across.")) return;
    setBusy(key); setNote(null);
    try { await api.del(`/accounting/${key}`); reload(); }
    catch (e: any) { setNote({ ok: false, text: e?.message || "Could not unlink." }); }
    finally { setBusy(null); }
  }

  async function catchUp() {
    setBusy("catch-up"); setNote(null);
    try {
      const r = await api.post<{ sent: number; attempted: number; problems: string[] }>("/accounting/sync-pending");
      setNote({
        ok: r.sent > 0 || r.attempted === 0,
        text: r.attempted === 0
          ? "Everything is already across."
          : `${r.sent} of ${r.attempted} sent.${r.problems.length ? ` ${r.problems.join(" ")}` : ""}`,
      });
      reload();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "Could not catch up." });
    } finally { setBusy(null); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-900">Accounting</h2>
        <p className="text-xs text-slate-500 mt-1">
          Invoices go across as you send them, as drafts for you to approve — we never mark
          anything as issued in your accounts.
        </p>
      </div>

      {busy === "catch-up" && !note && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Spinner className="h-3.5 w-3.5" />
          Sending your invoices to Xero. This can take a few seconds.
        </p>
      )}

      {note && <p className={`text-xs ${note.ok ? "text-green-700" : "text-red-600"}`}>{note.text}</p>}

      {live && conn && (
        <div className={`rounded-lg border p-3.5 ${conn.status === "needs_reauth" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-sm font-semibold text-slate-900">
            {providers.find(p => p.key === conn.provider)?.label ?? conn.provider}
            {conn.organisationName ? ` — ${conn.organisationName}` : ""}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {conn.status === "needs_reauth"
              ? "Needs reconnecting."
              : conn.lastSyncAt
                ? `Last sent ${shortDate(conn.lastSyncAt)}.`
                : "Nothing sent across yet."}
          </p>
          {conn.lastError && <p className="text-xs text-amber-800 mt-1">{conn.lastError}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {conn.status === "needs_reauth" && (
              <button type="button" onClick={() => connect(conn.provider)} disabled={!!busy}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3.5 text-xs font-semibold text-white disabled:opacity-50">
                {busy && <Spinner className="mr-2" />}
                Reconnect
              </button>
            )}
            <button type="button" onClick={catchUp} disabled={!!busy}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-60">
              {busy === "catch-up" && <Spinner className="mr-2" />}
              {busy === "catch-up" ? "Sending to Xero…" : "Send anything outstanding"}
            </button>
            <button type="button" onClick={() => disconnect(conn.provider)} disabled={!!busy}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50">
              Unlink
            </button>
          </div>
        </div>
      )}

      {!live && (
        <div className="space-y-2">
          {providers.map(p => (
            <div key={p.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                {!p.configured && (
                  <p className="text-xs text-amber-700 mt-1">
                    Not available yet — this needs setting up at our end first. Ask us and we will sort it.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => connect(p.key)}
                disabled={!p.configured || !!busy}
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[var(--brand)] px-4 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy === p.key && <Spinner className="mr-2" />}
                {busy === p.key ? "Opening Xero…" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
