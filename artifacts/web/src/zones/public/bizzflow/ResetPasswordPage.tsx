import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthCtx } from "@/lib/auth";
import { BizzFlowSymbol, BizzFlowWordmark } from "./BizzFlowBrand";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Where a forgotten password is replaced.
 *
 * Public by design - the token in the link IS the authentication, the same way
 * an invitation works. It is single use, expires in an hour, and only its hash
 * is stored, so this page has to be reachable without a session.
 *
 * The link is checked BEFORE the form is drawn. Letting somebody choose and
 * confirm a password, then telling them the link died forty minutes ago, is a
 * worse minute than simply saying so up front.
 *
 * On success they are signed straight in. They have just proved they own the
 * inbox and typed a password twice; a login form now is friction with nothing
 * behind it.
 */
export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { signIn } = useAuthCtx();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [account, setAccount] = useState<{ email: string; firstName: string | null } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); setError("This link is missing its code."); return; }
    let cancelled = false;
    fetch("/api/auth/reset-password/" + encodeURIComponent(token))
      .then(async r => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) { setState("invalid"); setError(data.error || "This link is no longer valid."); return; }
        setAccount(data);
        setState("ready");
      })
      .catch(() => { if (!cancelled) { setState("invalid"); setError("Could not check this link. Please try again."); } });
    return () => { cancelled = true; };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 10) { setError("Choose a password of at least 10 characters."); return; }
    if (password !== confirm) { setError("Those two passwords don't match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
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

  const heading: React.CSSProperties = {
    fontSize: "clamp(32px,4.2vw,41px)", lineHeight: 1.1,
    letterSpacing: "-1.7px", fontWeight: 650, margin: "14px 0 0",
  };

  return (
    <div className="bf min-h-[100dvh] flex flex-col" style={{ background: "#fff" }}>
      <header className="header" style={{ width: "100%" }}>
        <a className="brand" href={basePath || "/"} aria-label="BizzFlowUK home">
          <BizzFlowSymbol />
          <BizzFlowWordmark />
        </a>
        <a className="button small dark" href={`${basePath}/sign-in`}>
          Back to sign in <span>↗</span>
        </a>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pt-[6vh] pb-20">
        <div className="w-full max-w-[420px]">
          <p className="eyebrow"><span className="mini-line" /> NEW PASSWORD</p>

          {state === "checking" && (
            <p style={{ marginTop: "20px", color: "var(--muted)", fontSize: "16px" }}>Checking your link…</p>
          )}

          {state === "invalid" && (
            <>
              <h1 style={heading}>
                That link has expired.<br /><span className="teal">Ask for a fresh one.</span>
              </h1>
              <p style={{ marginTop: "16px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.6 }}>{error}</p>
              <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "14px", lineHeight: 1.7 }}>
                Reset links work once and last an hour. Nothing has changed about your account.
              </p>
              <a href={`${basePath}/forgot-password`} className="button teal-bg" style={{ marginTop: "26px", width: "100%", justifyContent: "center" }}>
                Send me a new link <span>↗</span>
              </a>
            </>
          )}

          {state === "ready" && (
            <form onSubmit={submit}>
              <h1 style={heading}>
                {account?.firstName ? `Hello again, ${account.firstName}.` : "Choose a new password."}
              </h1>
              <p style={{ marginTop: "14px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.6 }}>
                Setting a new password for <strong style={{ color: "var(--ink)" }}>{account?.email}</strong>. Nobody
                else sees it — not us either.
              </p>

              {error && (
                <div role="alert" style={{
                  marginTop: "26px", padding: "13px 16px", borderRadius: "8px",
                  background: "#fbe9e7", color: "#8c2f22", fontSize: "14px", fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: "30px", display: "grid", gap: "18px" }}>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>New password</span>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="new-password" placeholder="At least 10 characters"
                    className="bf-input"
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Confirm password</span>
                  <input
                    type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    required autoComplete="new-password" placeholder="Type it again"
                    className="bf-input"
                  />
                </label>
              </div>

              {/* A long phrase beats eight characters of punctuation nobody can
                  recall on a van. Same advice the signup form gives. */}
              <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--muted)" }}>
                A short phrase you will remember works better than something clever.
              </p>

              <button type="submit" disabled={busy} className="button teal-bg" style={{ marginTop: "22px", width: "100%", justifyContent: "center" }}>
                {busy ? "Saving…" : <>Save and sign in <span>↗</span></>}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
