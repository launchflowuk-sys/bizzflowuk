import { useState } from "react";
import { BizzFlowSymbol, BizzFlowWordmark } from "./BizzFlowBrand";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Asking for a way back in.
 *
 * Wears the marketing site's own chrome rather than the dark admin styling,
 * for the same reason the login form does: somebody locked out is already
 * having a bad minute, and landing on what looks like a different product is
 * not the moment to make them wonder whether they are in the right place.
 *
 * The success message is shown whether or not the address matched an account,
 * and says so plainly. Anything else turns this form into a way of finding out
 * who uses the platform - a trade's email plus "they use BizzFlowUK" is the
 * raw material for a convincing phishing email.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not send that. Try again."); return; }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
          <p className="eyebrow"><span className="mini-line" /> FORGOTTEN PASSWORD</p>

          {sent ? (
            <>
              <h1 style={{ fontSize: "clamp(32px,4.2vw,41px)", lineHeight: 1.1, letterSpacing: "-1.7px", fontWeight: 650, margin: "14px 0 0" }}>
                Check your email.<br /><span className="teal">The link lasts an hour.</span>
              </h1>
              <p style={{ marginTop: "16px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.6 }}>
                If <strong style={{ color: "var(--ink)" }}>{email}</strong> has an account, a link to set a new
                password is on its way. It works once.
              </p>
              <p style={{ marginTop: "14px", color: "var(--muted)", fontSize: "14px", lineHeight: 1.7 }}>
                Nothing arrived? Check the spam folder, and make sure that is the address you signed up with.
              </p>
              <a href={`${basePath}/sign-in`} className="button teal-bg" style={{ marginTop: "26px", width: "100%", justifyContent: "center" }}>
                Back to sign in <span>↗</span>
              </a>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 style={{ fontSize: "clamp(32px,4.2vw,41px)", lineHeight: 1.1, letterSpacing: "-1.7px", fontWeight: 650, margin: "14px 0 0" }}>
                It happens.<br /><span className="teal">Let's get you back in.</span>
              </h1>
              <p style={{ marginTop: "14px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.6 }}>
                Tell us the email address you sign in with and we will send a link to set a new password.
              </p>

              {error && (
                <div role="alert" style={{
                  marginTop: "26px", padding: "13px 16px", borderRadius: "8px",
                  background: "#fbe9e7", color: "#8c2f22", fontSize: "14px", fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <label style={{ display: "block", marginTop: "30px" }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Email address</span>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="you@yourbusiness.co.uk"
                  className="bf-input"
                />
              </label>

              <button type="submit" disabled={busy} className="button teal-bg" style={{ marginTop: "26px", width: "100%", justifyContent: "center" }}>
                {busy ? "Sending…" : <>Send the link <span>↗</span></>}
              </button>

              <p style={{ marginTop: "26px", fontSize: "14px", color: "var(--muted)" }}>
                Remembered it? <a href={`${basePath}/sign-in`} className="teal" style={{ fontWeight: 600 }}>Sign in</a>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
