import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthCtx } from "@/lib/auth";

/**
 * Where an invited person sets their own password.
 *
 * Public by design — the invite token IS the authentication. It is single-use and expires, and
 * only its hash is stored server-side, so this page can be reached without a session.
 *
 * On success the user is signed straight in rather than bounced to the login form: they have just
 * proved ownership of the invite and chosen a password, so asking them to type it again is
 * friction with no security benefit.
 */
export default function AcceptInvitePage() {
  const [, setLocation] = useLocation();
  const { signIn } = useAuthCtx();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [invitee, setInvitee] = useState<{ email: string; firstName: string | null } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); setError("This link is missing its invitation code."); return; }
    let cancelled = false;
    fetch("/api/auth/invite/" + encodeURIComponent(token))
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) { setState("invalid"); setError(data.error || "This invitation is no longer valid."); return; }
        setInvitee(data);
        setState("ready");
      })
      .catch(() => { if (!cancelled) { setState("invalid"); setError("Could not check this invitation. Please try again."); } });
    return () => { cancelled = true; };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 10) { setError("Choose a password of at least 10 characters."); return; }
    if (password !== confirm) { setError("Those two passwords don't match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not set your password."); return; }
      signIn(data.token);
      setLocation("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1F8CFF]";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0A121C] px-5 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F8CFF] flex items-center justify-center font-bold text-white text-sm">L</div>
          <span className="text-white font-bold text-xl tracking-tight">BizzFlow</span>
        </div>

        {state === "checking" && <p className="text-slate-400 text-sm">Checking your invitation…</p>}

        {state === "invalid" && (
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-white">This invitation can&apos;t be used</h1>
            <p className="text-sm text-slate-400">{error}</p>
            <p className="text-sm text-slate-400">
              Invitations work once and expire after seven days. Ask whoever invited you to send a new one.
            </p>
          </div>
        )}

        {state === "ready" && (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">
                {invitee?.firstName ? "Welcome, " + invitee.firstName : "Set your password"}
              </h1>
              <p className="text-sm text-slate-400">
                Choose a password for <span className="text-slate-200">{invitee?.email}</span>. Nobody else has seen it
                — not even the person who invited you.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="pw" className="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
                <input id="pw" type="password" autoComplete="new-password" required className={inputCls}
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" />
              </div>
              <div>
                <label htmlFor="pw2" className="block text-xs font-medium text-slate-400 mb-1.5">Confirm password</label>
                <input id="pw2" type="password" autoComplete="new-password" required className={inputCls}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button type="submit" disabled={busy}
              className="w-full h-11 rounded-lg bg-[#1F8CFF] text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {busy ? "Setting your password…" : "Set password and sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
