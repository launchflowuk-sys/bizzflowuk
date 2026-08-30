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

// gtag.js only recognises a command when it is pushed as the `arguments` object — array-like but
// NOT an Array. Pushing a real array (which `(...args) => dataLayer.push(args)` does) is accepted
// by dataLayer and then silently ignored by the tag, so every consent, config and conversion call
// no-ops with no console error. This must stay a plain function pushing `arguments`, exactly as
// Google's documented snippet does. Cost of getting this wrong: £84 of clicks and zero recorded
// conversions on AMO Rendering, Aug 2026.
const pushCommand = function () {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
} as unknown as (...args: unknown[]) => void;

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

  window.gtag = pushCommand;

  let stored: string | null = null;
  try { stored = window.localStorage.getItem(CONSENT_KEY); } catch { /* ignore */ }
  pushCommand("consent", "default", {
    ...consentParamsFor(stored),
    // Without storage, the click id has to survive in the URL or the conversion can never be
    // joined back to the ad that paid for it. Redaction is what keeps that GDPR-safe.
    url_passthrough: true,
    ads_data_redaction: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(script);

  pushCommand("js", new Date());
  if (gaId) pushCommand("config", gaId);
  if (adsId) pushCommand("config", adsId);
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
