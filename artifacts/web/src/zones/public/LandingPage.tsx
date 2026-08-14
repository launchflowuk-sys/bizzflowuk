import { useState } from "react";
import { useGetPublicSite, useListPublicReviews, useSubmitQuoteRequest } from "@workspace/api-client-react";
import { PageSEO, Spinner } from "./PublicSiteApp";
import { fireQuoteRequestConversion } from "./analytics";

/**
 * Paid-traffic landing page.
 *
 * Deliberately different from the marketing site rather than a copy of it. A visitor who arrived
 * from an ad has already told us what they want by clicking, so this page answers one question —
 * "can these people render my house, and what will it cost" — and gives exactly two ways to act:
 * ring now, or leave details.
 *
 * What's missing is the design:
 *  - No navigation. Every link out is a way to leave without enquiring; the only outbound links
 *    are the phone number and the legally-required policy links in the footer.
 *  - The form sits in the first screenful on desktop and one thumb-scroll away on mobile, with a
 *    sticky call bar underneath it on phones (most paid local-service traffic is mobile, and
 *    plenty of people would rather talk than type).
 *  - Trust before detail: guarantee, free survey, no-obligation, and real reviews sit above the
 *    long-form reassurance, because that's the order the doubts actually arrive in.
 *
 * Kept out of the sitemap and marked noindex: it targets the same terms as the home page, and
 * two pages competing for one query weakens both.
 */

const INK = "#0A121C";
const TEXT = "#26323F";
const MUTED = "#64717F";

type Promise_ = { icon: string; title: string; body: string };

const PROMISES: Promise_[] = [
  { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "15-year guarantee", body: "Written cover on every silicone render we install." },
  { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", title: "Free home survey", body: "We measure up in person — no guessing, no obligation." },
  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", title: "Quote within 24 hours", body: "A written price the day after we visit, not next week." },
  { icon: "M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z", title: "Local to Essex", body: "Based in Grays. We work across Thurrock and south Essex." },
];

function Tick() {
  return (
    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="#16A34A" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} className="w-4 h-4" viewBox="0 0 20 20" fill={n <= rating ? "#F5A623" : "#D6DCE3"} aria-hidden="true">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      ))}
    </div>
  );
}

const SERVICES = [
  "Silicone Render", "Monocouche Render", "K Rend", "External Wall Insulation",
  "Render Repairs", "Pebble Dash Removal", "Not sure — please advise",
];

/**
 * Message match for paid search.
 *
 * One landing page serving seven ad groups would show "Rendering across Grays" to somebody who
 * searched "pebble dash removal" — a mismatch the visitor feels immediately, and one Google
 * scores against you through landing-page relevance, which feeds Quality Score and therefore the
 * price of every click.
 *
 * The key is a path segment (/free-quote/k-rend), not a query string. The public site is server
 * rendered and its HTML is render-cached by path — a ?query variant would serve whichever HTML
 * was cached first and then rewrite the headline during hydration, which is both a mismatch and
 * a visible flash on the largest element of the page. As a path it is part of routing and of the
 * cache key, so server and client agree on the first paint.
 *
 * An unknown or absent key falls back to the generic wording, so a mistyped ad URL degrades
 * quietly instead of breaking.
 */
const SERVICE_VARIANTS: Record<string, { h1: string; intro: string; service: string }> = {
  silicone: {
    h1: "Silicone render across Grays & south Essex — free quote within 24 hours",
    intro: "Self-cleaning, weatherproof silicone render fitted by a local team and backed by a written 15-year guarantee. We survey your property free, then send a fixed written price.",
    service: "Silicone Render",
  },
  monocouche: {
    h1: "Monocouche render across Grays & south Essex — free quote within 24 hours",
    intro: "Through-coloured monocouche render, so chips and scratches stay invisible. Single-coat, durable and low-maintenance — surveyed free, priced in writing.",
    service: "Monocouche Render",
  },
  "k-rend": {
    h1: "K Rend specialists in Grays & south Essex — free quote within 24 hours",
    intro: "Textured, hard-wearing K Rend installed by a local team. Free survey, a fixed written price within 24 hours, and a guarantee in writing.",
    service: "K Rend",
  },
  ewi: {
    h1: "External wall insulation in Grays & south Essex — free quote within 24 hours",
    intro: "Cut your heating bills and improve your EPC rating with external wall insulation, finished in render. Free survey, fixed written price, no obligation.",
    service: "External Wall Insulation",
  },
  "pebble-dash": {
    h1: "Pebbledash removal across Grays & south Essex — free quote within 24 hours",
    intro: "Remove dated pebbledash and replace it with a smooth, modern render finish. Removal, prep and finish handled end to end, priced in writing after a free survey.",
    service: "Pebble Dash Removal",
  },
  repairs: {
    h1: "Render repairs across Grays & south Essex — free quote within 24 hours",
    intro: "Cracked or failing render repaired and colour-matched before water gets behind it. Fast local response, free survey, fixed written price.",
    service: "Render Repairs",
  },
};

function readServiceVariant(key?: string): { h1?: string; intro?: string; service?: string } {
  return (key && SERVICE_VARIANTS[key]) || {};
}

/**
 * Four fields, and only three of them required.
 *
 * The site's main quote form asks for eight answers up front, which suits an organic visitor who
 * arrived ready to research. Paid traffic hasn't made that commitment yet — everything on that
 * longer form can be asked on the phone call this is trying to start.
 *
 * Email is required rather than optional: without it the customer gets no acknowledgement, and an
 * enquiry that vanishes into silence is exactly the complaint this whole batch of work exists to
 * fix. A confirmation landing in their inbox is also what stops them ringing the next renderer.
 */
function ShortQuoteForm({ tenantSlug, accent, conversionId, conversionLabel, presetService }: {
  tenantSlug: string; accent: string; conversionId?: string; conversionLabel?: string; presetService?: string;
}) {
  const mutation = useSubmitQuoteRequest();
  const [form, setForm] = useState({ name: "", phone: "", email: "", postcode: "", service: presetService ?? "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    try {
      // tenantSlug travels inside `data` — the /quote-request alias reads it from the body and
      // 400s without it.
      await mutation.mutateAsync({
        data: {
          tenantSlug,
          firstName: firstName || form.name.trim(),
          lastName: rest.join(" "),
          phone: form.phone.trim(),
          email: form.email.trim(),
          postcode: form.postcode.trim().toUpperCase(),
          serviceInterest: form.service || undefined,
          source: "Google",
          notes: "Submitted from the paid-search landing page.",
        },
      } as any);
      fireQuoteRequestConversion(conversionId, conversionLabel);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please call us instead — we'd rather not lose you.");
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-center">
        <svg className="mx-auto h-11 w-11 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="mt-3 text-lg font-extrabold text-emerald-900">Thanks — we've got your details</h2>
        <p className="mt-1.5 text-sm text-emerald-800">
          We'll call you within 24 hours to arrange your free survey. If it's urgent, ring us now
          and we'll pick up.
        </p>
      </div>
    );
  }

  const label = "block text-xs font-bold uppercase tracking-wide mb-1.5";
  const input = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base min-h-12 outline-none focus:ring-2 focus:border-transparent";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-lg font-extrabold tracking-tight" style={{ color: INK }}>Get your free quote</h2>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>A few details and we'll call you back.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="lp-name" className={label} style={{ color: MUTED }}>Your name *</label>
          <input id="lp-name" required autoComplete="name" className={input} style={{ ["--tw-ring-color" as any]: accent }}
                 value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="lp-phone" className={label} style={{ color: MUTED }}>Phone number *</label>
          <input id="lp-phone" required type="tel" inputMode="tel" autoComplete="tel" className={input} style={{ ["--tw-ring-color" as any]: accent }}
                 value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="lp-email" className={label} style={{ color: MUTED }}>Email address *</label>
          <input id="lp-email" required type="email" inputMode="email" autoComplete="email" className={input} style={{ ["--tw-ring-color" as any]: accent }}
                 value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="lp-postcode" className={label} style={{ color: MUTED }}>Property postcode *</label>
          <input id="lp-postcode" required autoComplete="postal-code" placeholder="e.g. RM17 6XX" className={input} style={{ ["--tw-ring-color" as any]: accent }}
                 value={form.postcode} onChange={e => setForm({ ...form, postcode: e.target.value })} />
        </div>
        <div>
          <label htmlFor="lp-service" className={label} style={{ color: MUTED }}>What do you need? <span className="font-medium normal-case tracking-normal">(optional)</span></label>
          <select id="lp-service" className={input} style={{ ["--tw-ring-color" as any]: accent }}
                  value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
            <option value="">Select if you know…</option>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      <button type="submit" disabled={mutation.isPending}
              className="mt-5 w-full rounded-xl px-5 py-4 text-base font-bold text-white min-h-12 disabled:opacity-60"
              style={{ backgroundColor: accent }}>
        {mutation.isPending ? "Sending…" : "Get my free quote"}
      </button>
      <p className="mt-3 text-center text-xs" style={{ color: MUTED }}>
        No obligation. We'll never pass your details to anyone else.
      </p>
    </form>
  );
}

export default function LandingPage({ tenantSlug, variantKey }: { tenantSlug: string; variantKey?: string }) {
  const { data, isLoading } = useGetPublicSite(tenantSlug);
  const { data: reviewData } = useListPublicReviews(tenantSlug);

  if (isLoading) return <Spinner />;
  const { tenant, settings } = (data as any) ?? {};
  if (!tenant) return <div className="p-8 text-center text-slate-500">Site not found</div>;

  const accent = settings?.primaryColor || tenant?.primaryColor || "#EA580C";
  const phone: string | undefined = settings?.phone || tenant?.phone || undefined;
  const name = tenant?.name || "Us";

  const variant = readServiceVariant(variantKey);
  const reviews = ((reviewData as any[]) || []).filter(r => r.content).slice(0, 3);
  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviews.length) * 10) / 10
    : undefined;

  return (
    <div className="min-h-screen bg-white" style={{ color: TEXT }}>
      <PageSEO
        title={variant.h1 ? `${variant.h1.split(" — ")[0]} | ${name}` : `Rendering in Grays & Essex — free quote in 24 hours | ${name}`}
        description="Silicone render, K Rend and external wall insulation across Grays, Thurrock and south Essex. Free no-obligation survey, written quote within 24 hours, 15-year guarantee."
        noindex
      />

      {/* Header carries the phone number and nothing else — no route out of the page. */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt={name} className="h-9 w-auto" />
              : <span className="text-lg font-extrabold tracking-tight truncate" style={{ color: INK }}>{name}</span>}
          </div>
          {phone && (
            <a href={`tel:${phone}`}
               className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white min-h-11"
               style={{ backgroundColor: accent }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.5 5.5l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"/></svg>
              <span className="hidden sm:inline">{phone}</span>
              <span className="sm:hidden">Call</span>
            </a>
          )}
        </div>
      </header>

      {/* Hero: the promise, the proof, and the form — all reachable without hunting. */}
      <section className="border-b border-slate-200" style={{ backgroundColor: "#F6F8FB" }}>
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 lg:grid-cols-2 lg:py-14">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
              {variant.h1 ?? "Rendering across Grays & south Essex — free quote within 24 hours"}
            </h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: MUTED }}>
              {variant.intro ?? "Silicone render, K Rend and external wall insulation, fitted by a local team and backed by a written 15-year guarantee. We survey your property free, then send a fixed written price — no pressure, no obligation."}
            </p>

            <ul className="mt-6 space-y-2.5">
              {["Free, no-obligation home survey",
                "Written quote within 24 hours of visiting",
                "15-year guarantee on silicone render",
                "Fully insured, based in Grays"].map(line => (
                <li key={line} className="flex gap-2.5 text-sm font-medium" style={{ color: TEXT }}>
                  <Tick />{line}
                </li>
              ))}
            </ul>

            {avg && reviews.length > 0 && (
              <div className="mt-7 flex items-center gap-3">
                <Stars rating={Math.round(avg)} />
                <span className="text-sm font-semibold" style={{ color: INK }}>
                  {avg} out of 5
                </span>
                <span className="text-sm" style={{ color: MUTED }}>
                  from {reviews.length === 1 ? "a local homeowner" : `${reviews.length} local homeowners`}
                </span>
              </div>
            )}
          </div>

          <div>
            <ShortQuoteForm
              tenantSlug={tenantSlug}
              accent={accent}
              conversionId={settings?.googleAdsConversionId}
              conversionLabel={settings?.googleAdsConversionLabel}
              presetService={variant.service}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map(p => (
            <div key={p.title}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1A` }}>
                <svg className="h-5 w-5" fill="none" stroke={accent} strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                </svg>
              </div>
              <h2 className="text-sm font-bold" style={{ color: INK }}>{p.title}</h2>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="border-y border-slate-200" style={{ backgroundColor: "#F6F8FB" }}>
          <div className="mx-auto max-w-5xl px-5 py-12">
            <h2 className="text-xl font-extrabold tracking-tight" style={{ color: INK }}>What local homeowners say</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {reviews.map((r: any) => (
                <figure key={r.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <Stars rating={r.rating || 5} />
                  <blockquote className="mt-3 text-sm leading-relaxed" style={{ color: TEXT }}>"{r.content}"</blockquote>
                  <figcaption className="mt-4 border-t border-slate-100 pt-3 text-sm font-semibold" style={{ color: INK }}>
                    {r.reviewerName}
                    {r.reviewerLocation && <span className="block text-xs font-normal" style={{ color: MUTED }}>{r.reviewerLocation}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-xl font-extrabold tracking-tight" style={{ color: INK }}>How it works</h2>
        <ol className="mt-6 space-y-5">
          {[
            ["We talk", "Tell us about your property and what you're after. Two minutes on the phone or the form above."],
            ["We visit", "A free survey at a time that suits you. We measure up properly and explain your options."],
            ["You get a written price", "A clear, fixed quote within 24 hours of the visit. No obligation to go ahead."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: accent }}>{i + 1}</span>
              <div>
                <h3 className="text-sm font-bold" style={{ color: INK }}>{title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Sticky call bar: phones only, and only where it can't cover the form's submit button. */}
      {phone && (
        <>
          <div className="h-20 md:hidden" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <a href={`tel:${phone}`}
               className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white"
               style={{ backgroundColor: accent }}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.5 5.5l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"/></svg>
              Call {phone}
            </a>
          </div>
        </>
      )}

      <footer className="border-t border-slate-200 px-5 py-8">
        <div className="mx-auto max-w-5xl text-xs" style={{ color: MUTED }}>
          <div className="font-semibold" style={{ color: INK }}>{name}</div>
          {settings?.address && <div className="mt-1">{settings.address}</div>}
          {phone && <div className="mt-1"><a href={`tel:${phone}`} className="font-semibold" style={{ color: accent }}>{phone}</a></div>}
          <div className="mt-3 flex gap-4">
            <a href="privacy" className="underline">Privacy</a>
            <a href="terms" className="underline">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
