import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthCtx } from "@/lib/auth";
import { BizzFlowSymbol, BizzFlowWordmark } from "./BizzFlowBrand";
import { useDocumentMeta } from "./useBizzFlowChrome";
import "./bizzflow.css";
import "./bizzflow-overrides.css";

/**
 * Create your workspace.
 *
 * The API has existed for a while; there was no form, and no link to one from
 * anywhere. The homepage sold the demo six ways and never once offered a way to
 * become a customer.
 *
 * Deliberately short. Everything asked for here is needed to create the account
 * and nothing else: the business, who you are, and a password. Trade and phone
 * are optional because a half-filled form that gets abandoned is worth less than
 * a signed-up business we can ring.
 */

type Industry = { key: string; label: string };

/** Field-level errors come back keyed by field name from the API. */
type FieldErrors = Record<string, string>;

export default function SignUpPage() {
  const { signIn } = useAuthCtx();
  const [, setLocation] = useLocation();

  const [industries, setIndustries] = useState<Industry[]>([]);
  const [form, setForm] = useState({
    businessName: "", industry: "", firstName: "", lastName: "",
    email: "", phone: "", password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useDocumentMeta(
    "Start free — BizzFlowUK",
    "Seven days free. Your website built in the first week. £99 a month after that.",
  );

  useEffect(() => {
    let live = true;
    fetch("/api/signup/industries")
      .then(r => (r.ok ? r.json() : []))
      .then(list => { if (live && Array.isArray(list)) setIndustries(list); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    // Clear the message for the field being corrected, so an old error does not
    // sit under a box somebody has just fixed.
    setErrors(prev => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    setErrors({});

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.fields && typeof data.fields === "object") setErrors(data.fields);
        setFormError(data.error || "We could not create the account. Please try again.");
        return;
      }

      // The API signs the new owner in, so there is no second login step — being
      // asked to sign in immediately after creating an account is a step that
      // exists only for the developer's convenience.
      signIn(data.token);
      setLocation("/dashboard");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>{label}</span>
      <input
        className="bf-input"
        value={form[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
        style={errors[key] ? { borderColor: "#8c2f22" } : undefined}
        {...props}
      />
      {errors[key] && (
        <span id={`${key}-error`} style={{ display: "block", marginTop: "7px", fontSize: "13px", color: "#8c2f22" }}>
          {errors[key]}
        </span>
      )}
    </label>
  );

  return (
    <div className="bf min-h-[100dvh] flex flex-col" style={{ background: "#fff" }}>
      {/* `width: 100%` — `.header` carries `margin: auto`, and an auto inline
          margin on a flex item shrinks it to its content instead of letting it
          stretch. Without this the wordmark and the link bunch up in the middle. */}
      <header className="header" style={{ width: "100%" }}>
        <Link href="/" className="brand" aria-label="BizzFlowUK home">
          <BizzFlowSymbol />
          <BizzFlowWordmark />
        </Link>
        <Link href="/sign-in" className="text-link">Already have an account?</Link>
      </header>

      <main className="wrap flex-1" style={{ paddingTop: "5vh", paddingBottom: "80px" }}>
        {/* The column count lives in CSS, not here: an inline style beats a
            media query no matter how specific the selector, so setting
            grid-template-columns inline left this stuck at one column. */}
        <div className="signup-grid">
          {/* What they're getting, so the form is not asking for details in a
              vacuum. */}
          <div>
            <p className="eyebrow"><span className="mini-line" /> SEVEN DAYS FREE</p>
            <h1 style={{ fontSize: "clamp(32px,4.2vw,43px)", lineHeight: 1.1, letterSpacing: "-1.7px", fontWeight: 650, margin: "14px 0 0" }}>
              Start today.<br /><span className="teal">Your site is up this week.</span>
            </h1>
            <p style={{ marginTop: "16px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.7, maxWidth: "44ch" }}>
              You get the whole toolkit the moment you sign up. We build your website around your trade while you use it
              — usually within two days.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "grid", gap: "14px" }}>
              {[
                "Customers, quotes, invoices and card payments",
                "Projects, scheduling and cash flow",
                "Gas Safe certificates that renew themselves",
                "A website built for you, included",
              ].map(line => (
                <li key={line} style={{ display: "flex", gap: "11px", alignItems: "flex-start", fontSize: "15.5px" }}>
                  <span className="check" aria-hidden="true">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p style={{ marginTop: "28px", fontSize: "14px", color: "var(--muted)" }}>
              £99 a month after the trial. No card needed to start. Cancel any time.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {formError && (
              <div role="alert" style={{
                marginBottom: "22px", padding: "13px 16px", borderRadius: "8px",
                background: "#fbe9e7", color: "#8c2f22", fontSize: "14px", fontWeight: 500,
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: "grid", gap: "18px" }}>
              {field("businessName", "Business name", { required: true, autoComplete: "organization", placeholder: "e.g. BPS Plumbing & Heating" })}

              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Your trade</span>
                <select className="bf-input" value={form.industry} onChange={set("industry")}>
                  <option value="">Choose your trade</option>
                  {industries.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
              </label>

              <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "1fr 1fr" }}>
                {field("firstName", "First name", { required: true, autoComplete: "given-name" })}
                {field("lastName", "Last name", { autoComplete: "family-name" })}
              </div>

              {field("email", "Email address", { required: true, type: "email", autoComplete: "email", placeholder: "you@yourbusiness.co.uk" })}
              {field("phone", "Mobile (optional)", { type: "tel", autoComplete: "tel", placeholder: "07…" })}
              {field("password", "Password", {
                required: true, type: "password", autoComplete: "new-password",
                minLength: 10, placeholder: "At least 10 characters",
              })}
            </div>

            <button type="submit" disabled={busy} className="button teal-bg" style={{ marginTop: "26px", width: "100%", justifyContent: "center" }}>
              {busy ? "Creating your workspace…" : <>Create my workspace <span>↗</span></>}
            </button>

            <p style={{ marginTop: "18px", fontSize: "13.5px", color: "var(--muted)", lineHeight: 1.6 }}>
              A long phrase beats a short password — it is easier to remember on a van and harder to guess.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
