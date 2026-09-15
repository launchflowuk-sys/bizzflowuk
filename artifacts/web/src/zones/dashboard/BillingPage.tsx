import { useState } from "react";
import { api, useApi, shortDate } from "./tradeApi";

/**
 * Billing — the £99 subscription and the free week.
 *
 * Deliberately plain. This is the screen where somebody decides whether to keep
 * paying, so it says what they get, what it costs, when they will be charged,
 * and how to stop — without any of it being hard to find. A subscription that
 * is awkward to leave is one people resent paying for.
 *
 * Both buttons hand off to Stripe: Checkout for starting, the billing portal
 * for changing a card, seeing invoices or cancelling. Rebuilding those screens
 * would mean owning SCA, dunning and card updates to control some styling.
 */

type BillingStatus = {
  plan: string | null;
  status: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  websiteDeliveredAt: string | null;
  subscribed: boolean;
  priceMonthlyGbp: number;
  configured: boolean;
  /** 'managed' means we invoice them directly — there is no Checkout to open. */
  billingMode?: "self_serve" | "managed";
  /** What a negotiated arrangement covers, in plain words. */
  billingNote?: string | null;
};

const INCLUDED = [
  "Your website, built for you, with hosting",
  "Customers, quotes and invoices",
  "Card payments through your own Stripe or Square",
  "Projects, scheduling and your calendar",
  "Cash flow and expenses",
  "Gas Safe certificates that renew themselves",
  "Automations that chase what you would forget",
  "A customer portal, and Flo to answer questions",
];

export default function BillingPage() {
  const { data, loading, error, reload } = useApi<BillingStatus>("/billing/status");
  const [busy, setBusy] = useState<null | "checkout" | "portal">(null);
  const [message, setMessage] = useState<string | null>(null);

  async function go(kind: "checkout" | "portal") {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await api.post<{ url: string }>(`/billing/${kind}`);
      if (!res?.url) throw new Error("Stripe did not return a link.");
      // Stripe hosts both pages, so this leaves the app entirely.
      window.location.assign(res.url);
    } catch (err: any) {
      setMessage(err?.message || "Could not open Stripe just now. Please try again.");
      setBusy(null);
    }
  }

  const managed = data?.billingMode === "managed";
  const trialing = !managed && (data?.status === "trialing" || (!data?.subscribed && data?.plan === "trial"));
  const active = !managed && data?.status === "active";
  const pastDue = !managed && (data?.status === "past_due" || data?.status === "unpaid");

  return (
    <div className="px-5 sm:px-10 pb-16 max-w-[900px]">
      <div className="ws-heading" style={{ display: "block" }}>
        <p className="ws-eyebrow">Your business / Workspace</p>
        <h1>Your subscription.</h1>
        <p className="ws-sub">
          {managed
            ? `£${data?.priceMonthlyGbp} a month, billed directly by us.`
            : `£${data?.priceMonthlyGbp ?? 99} a month, everything included. Cancel whenever you like.`}
        </p>
      </div>

      {loading && <section className="ws-panel"><p style={{ color: "var(--ws-muted)" }}>Loading…</p></section>}
      {error && <section className="ws-panel" style={{ borderColor: "#e5b4ad", background: "#fbe9e7" }}>
        <p style={{ color: "#8c2f22" }}>{error}</p>
      </section>}

      {message && (
        <div className="ws-panel mb-4" role="alert" style={{ borderColor: "#e5b4ad", background: "#fbe9e7" }}>
          <p style={{ color: "#8c2f22" }}>{message}</p>
        </div>
      )}

      {/*
        A managed account reports `configured: false` because there is no
        Checkout for it to open — that is the arrangement working, not a fault,
        so the "not switched on yet" notice must not fire for them.
      */}
      {data && !data.configured && !managed && (
        <section className="ws-panel mb-4" style={{ borderColor: "#e5cf9b", background: "#faf0d8" }}>
          <p style={{ color: "#896723", fontWeight: 600 }}>Billing is not switched on yet.</p>
          <p style={{ color: "#896723", marginTop: "4px", fontSize: "14px" }}>
            Nothing is wrong with your account — we have not finished connecting payments at our end.
            You can keep using everything in the meantime.
          </p>
        </section>
      )}

      {/*
        Billed directly by us — a negotiated arrangement, not the shelf price.
        This screen still has to tell them the truth: what they pay, what it
        covers, and who to talk to. What it must NOT do is offer a subscribe
        button, which would charge a second time somebody already paying.
      */}
      {data && managed && (
        <section className="ws-panel">
          <div className="ws-panel-top">
            <h2>Your account is billed directly</h2>
            <span className="ws-pill" data-tone="active">Managed</span>
          </div>

          <p style={{ fontSize: "15.5px", lineHeight: 1.7 }}>
            You are on an agreed arrangement with us rather than the standard online plan,
            so there is nothing to set up or pay for on this screen. We invoice you directly
            for <strong>£{data.priceMonthlyGbp} a month</strong>.
          </p>

          {data.billingNote && (
            <p style={{ fontSize: "15px", lineHeight: 1.7, marginTop: "14px", color: "var(--ws-muted)" }}>
              {data.billingNote}
            </p>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: "10px" }}>
            {INCLUDED.map(line => (
              <li key={line} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "14.5px" }}>
                <span aria-hidden="true" style={{ color: "var(--brand)", fontWeight: 700 }}>✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <p style={{ marginTop: "22px", paddingTop: "22px", borderTop: "1px solid var(--ws-line)", fontSize: "13.5px", color: "var(--ws-muted)" }}>
            Anything about your billing — a change, a question, an invoice you need — just ask us directly.
          </p>
        </section>
      )}

      {data && !managed && (
        <section className="ws-panel">
          <div className="ws-panel-top">
            <h2>
              {active ? "You're subscribed"
                : pastDue ? "There's a problem with your payment"
                : trialing ? "You're on your free week"
                : "Start your subscription"}
            </h2>
            <span className="ws-pill" data-tone={active ? "active" : pastDue ? "danger" : "pending"}>
              {active ? "Active" : pastDue ? "Needs attention" : trialing ? "Free trial" : "Not started"}
            </span>
          </div>

          {trialing && data.trialDaysLeft !== null && (
            <p style={{ fontSize: "15.5px", lineHeight: 1.7 }}>
              You have <strong>{data.trialDaysLeft} day{data.trialDaysLeft === 1 ? "" : "s"}</strong> left.
              {data.trialEndsAt ? ` Your first payment would be on ${shortDate(data.trialEndsAt)}.` : ""}
              {" "}Nothing is taken before then, and you can walk away without paying anything.
            </p>
          )}

          {active && (
            <p style={{ fontSize: "15.5px", lineHeight: 1.7 }}>
              £{data.priceMonthlyGbp} a month. Change your card, download invoices or cancel any time
              through the billing portal below.
            </p>
          )}

          {pastDue && (
            <p style={{ fontSize: "15.5px", lineHeight: 1.7 }}>
              Your last payment did not go through. Update your card in the portal and it will retry —
              nothing has been switched off.
            </p>
          )}

          {!active && !trialing && !pastDue && (
            <p style={{ fontSize: "15.5px", lineHeight: 1.7 }}>
              Seven days free, then £{data.priceMonthlyGbp} a month. No card is charged during the trial.
            </p>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: "10px" }}>
            {INCLUDED.map(line => (
              <li key={line} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "14.5px" }}>
                <span aria-hidden="true" style={{ color: "var(--brand)", fontWeight: 700 }}>✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "26px", paddingTop: "22px", borderTop: "1px solid var(--ws-line)" }}>
            {data.subscribed ? (
              <button type="button" className="ws-btn" disabled={busy !== null || !data.configured} onClick={() => go("portal")}>
                {busy === "portal" ? "Opening…" : <>Manage billing <span aria-hidden="true">↗</span></>}
              </button>
            ) : (
              <button type="button" className="ws-btn" disabled={busy !== null || !data.configured} onClick={() => go("checkout")}>
                {busy === "checkout" ? "Opening…" : <>Start my subscription <span aria-hidden="true">↗</span></>}
              </button>
            )}
            <button type="button" className="ws-panel-link" onClick={reload}>Refresh</button>
          </div>

          <p style={{ marginTop: "16px", fontSize: "12.5px", color: "var(--ws-muted)" }}>
            Payments are handled by Stripe. We never see or store your card details.
          </p>
        </section>
      )}
    </div>
  );
}
