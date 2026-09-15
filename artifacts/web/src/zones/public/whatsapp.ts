/**
 * WhatsApp enquiries, shared by every public template.
 *
 * All four templates need the same three things and none of them should own a
 * private copy: the number normalisation (a landline cannot receive WhatsApp,
 * so the button must not be offered at all), the page-to-subject mapping, and
 * the sentence itself. When the plumbing template had its own copy, the other
 * three simply had no WhatsApp button — the feature existed for exactly one
 * tenant out of four.
 *
 * What is NOT here is any markup. Each template's buttons look like that
 * template; only the link and the words are common.
 */

/**
 * A tenant's phone number in the international form WhatsApp requires, or null
 * when it cannot receive WhatsApp at all.
 *
 * A landline would open WhatsApp to a chat that does not exist, so the button
 * is not offered rather than offered and broken. UK mobiles are 447xxxxxxxxx.
 */
export function whatsappNumber(settings: any): string | null {
  const raw = settings?.whatsappNumber || settings?.phone;
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, "");
  const intl = digits.startsWith("+") ? digits.slice(1)
    : digits.startsWith("0") ? `44${digits.slice(1)}`
    : digits;
  return /^447\d{9}$/.test(intl) ? intl : null;
}

/**
 * What the visitor is actually looking at, in words.
 *
 * The message used to end "...wanted to ask about" with nothing after it,
 * because nothing ever told it the subject. The customer then has to type the
 * thing the page already knew, and the trade receives an enquiry that could be
 * about anything.
 *
 * Naming the page in plain words rather than pasting its URL is deliberate:
 * "Boiler Installation" is what the tradesperson needs to read at a glance on
 * a phone, and a pasted link reads like spam.
 */
export type WhatsAppContext =
  | { kind: "service"; name: string }
  | { kind: "area"; name: string }
  | { kind: "quote" }
  | null;

/**
 * Turn a URL slug into something a person would read.
 *
 * The lists are not always to hand: some templates fetch services inside the
 * page component rather than the shell, and threading that data up just to
 * name a link would be a lot of plumbing for one sentence. A slug already
 * contains the name — "boiler-installation" is "Boiler Installation" — so it
 * is used when the list is missing. The list still wins when present, because
 * it carries the real capitalisation the owner typed.
 */
function humanise(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function whatsappSubject(path: string, services?: any[], areas?: any[]): WhatsAppContext {
  const after = (prefix: string) => path.startsWith(prefix) ? path.slice(prefix.length).split(/[?#]/)[0] : null;

  const serviceSlug = after("/services/");
  if (serviceSlug) {
    const match = (services || []).find((s: any) => s.slug === serviceSlug);
    return { kind: "service", name: match?.name || humanise(serviceSlug) };
  }

  const areaSlug = after("/areas/");
  if (areaSlug) {
    const match = (areas || []).find((a: any) => a.slug === areaSlug);
    return { kind: "area", name: match?.name || humanise(areaSlug) };
  }

  // The several names the templates use for the same page.
  if (/^\/(get-a-quote|quote|free-quote)/.test(path)) return { kind: "quote" };
  return null;
}

/**
 * The full pre-filled message. Always a complete sentence, context or not.
 *
 * Each context gets its own sentence rather than one template with a slot,
 * because a slot produces things nobody would say: an area dropped into the
 * service sentence reads "I saw work in Romford on your website".
 */
export function whatsappMessage(businessName: string | undefined, context: WhatsAppContext): string {
  const who = businessName ? `Hi ${businessName}` : "Hello";
  if (context?.kind === "service") return `${who}, I saw ${context.name} on your website and I'd like to ask about it.`;
  if (context?.kind === "area") return `${who}, I'm in ${context.name} and I'd like to ask about some work.`;
  if (context?.kind === "quote") return `${who}, I'd like to get a quote please.`;
  return `${who}, I found you online and I'd like to ask about some work.`;
}

/** A wa.me link carrying the message, or null when WhatsApp is not available. */
export function whatsappHref(settings: any, tenant: any, context: WhatsAppContext): string | null {
  const intl = whatsappNumber(settings);
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(whatsappMessage(tenant?.name, context))}`;
}
