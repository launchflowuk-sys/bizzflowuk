// Settings-driven GA4 + Google Ads loader, Consent Mode v2, and conversion firing for the
// public marketing site. Loading is gated on the tenant actually having an ID configured, and
// Consent Mode's "default" command is always pushed before the tag script itself is requested
// so nothing can beacon out ahead of the visitor's cookie-banner choice.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const CONSENT_KEY = "bizzflow_cookie_consent";
let loadedTagId: string | null = null;

function pushDataLayer(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function consentParamsFor(choice: string | null) {
  const granted = choice === "accepted";
  const state = granted ? "granted" : "denied";
  return {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  };
}

/** Loads gtag.js for the tenant's GA4/Ads IDs (no-op if neither is configured, or already loaded). */
export function initGoogleTag(gaId?: string | null, adsId?: string | null) {
  const tagId = gaId || adsId;
  if (!tagId || loadedTagId === tagId) return;
  loadedTagId = tagId;

  window.gtag = pushDataLayer;

  let stored: string | null = null;
  try { stored = window.localStorage.getItem(CONSENT_KEY); } catch { /* ignore */ }
  pushDataLayer("consent", "default", consentParamsFor(stored));

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(script);

  pushDataLayer("js", new Date());
  if (gaId) pushDataLayer("config", gaId);
  if (adsId) pushDataLayer("config", adsId);
}

/** Called when the visitor makes or changes a cookie-banner choice. */
export function updateConsent(choice: "accepted" | "rejected") {
  if (!window.gtag) return;
  window.gtag("consent", "update", consentParamsFor(choice));
}

/** Fires a Google Ads conversion for a completed quote request (no-op if not configured). */
export function fireQuoteRequestConversion(adsId?: string | null, label?: string | null) {
  if (!window.gtag || !adsId || !label) return;
  window.gtag("event", "conversion", { send_to: `${adsId}/${label}` });
}
