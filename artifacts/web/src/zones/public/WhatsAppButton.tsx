import { useLocation } from "wouter";
import { whatsappHref, whatsappSubject } from "./whatsapp";
import "./whatsapp.css";

/**
 * The WhatsApp buttons every public template shares.
 *
 * Three of the four templates had no WhatsApp button at all — the feature
 * existed for one tenant out of four, because the plumbing template owned a
 * private copy of the logic and nothing else could reach it.
 *
 * Both buttons here carry the same context-aware message: what the visitor is
 * actually looking at, in words. A trade reading "I saw Boiler Installation on
 * your website" on their phone knows what the job is before they reply; "I
 * would like to ask about" — which is what the old message literally said,
 * ending mid-sentence — tells them nothing.
 *
 * The green is WhatsApp's own #25D366 in every template rather than the
 * tenant's brand colour. It is a button people recognise before they read it,
 * and recolouring it to match a site costs more in recognition than it gains
 * in tidiness.
 */

function WhatsAppGlyph({ className = "wa-glyph" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.5 3.5A10 10 0 003.6 15.2L2.5 21.5l6.4-1.1A10 10 0 1020.5 3.5zM12 20a8 8 0 01-4-1.1l-.3-.2-3.1.5.6-3-.2-.3A8 8 0 1112 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5 0a6.5 6.5 0 01-1.9-1.2 7.3 7.3 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5.2-.4v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 00-.7.3A2.9 2.9 0 006 10a5 5 0 001.1 2.7 11.5 11.5 0 004.4 3.9 8.3 8.3 0 001.5.5 3.5 3.5 0 001.6.1 2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.2-1.2c-.1-.1-.2-.2-.4-.3z" />
    </svg>
  );
}

/**
 * The floating bubble, bottom right.
 *
 * Renders nothing at all when the tenant's number cannot receive WhatsApp — a
 * landline would open a chat that does not exist, and a button that leads
 * nowhere is worse than no button.
 */
export function WhatsAppFloat({ settings, tenant, services, areas }: {
  settings: any;
  tenant: any;
  services?: any[];
  areas?: any[];
}) {
  const [location] = useLocation();
  const href = whatsappHref(settings, tenant, whatsappSubject(location, services, areas));
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="wa-float"
      aria-label="Message us on WhatsApp"
    >
      <WhatsAppGlyph />
      <span className="wa-float-label">WhatsApp us</span>
    </a>
  );
}

/**
 * An inline button for the body of a page — a service page, an area page, a
 * contact section.
 *
 * The floating bubble is a permanent fixture people stop seeing. This one sits
 * where the visitor has just finished reading about the exact job they want,
 * which is the moment they are most likely to ask about it.
 *
 * `context` can be passed explicitly when the page knows better than the URL
 * does; otherwise it is derived from the route like the float's.
 */
export function WhatsAppInline({ settings, tenant, services, areas, label, block = false, className = "" }: {
  settings: any;
  tenant: any;
  services?: any[];
  areas?: any[];
  label?: string;
  /** Full width, for stacking under a form or in a narrow column. */
  block?: boolean;
  className?: string;
}) {
  const [location] = useLocation();
  const href = whatsappHref(settings, tenant, whatsappSubject(location, services, areas));
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`wa-inline${block ? " wa-inline-block" : ""}${className ? ` ${className}` : ""}`}
    >
      <WhatsAppGlyph className="wa-glyph-sm" />
      <span>{label || "Ask on WhatsApp"}</span>
    </a>
  );
}
