import { useGetPublicSite, useListPublicReviews } from "@workspace/api-client-react";
import { PageSEO, Spinner } from "./PublicSiteApp";
import BeforeAfterGallery, { type BeforeAfterItem } from "./landing/BeforeAfterGallery";
import FaqAccordion from "./landing/FaqAccordion";
import QuoteForm from "./landing/QuoteForm";
import WhatsInvolved from "./landing/WhatsInvolved";
import {
  AREAS_COVERED, DEFAULT_FAQS, GUARANTEE_POINTS, SERVICE_BLURBS,
  readServiceVariant, type FaqItem,
} from "./landing/content";
import { INK, MUTED, TEXT } from "./landing/theme";

/**
 * Paid-traffic landing page.
 *
 * Deliberately different from the marketing site rather than a copy of it. A visitor arriving from
 * an ad has already told us what they want by clicking, so the page answers one question — "can
 * these people render my house, and what will it cost" — and gives exactly two ways to act: ring
 * now, or leave details.
 *
 * The first version of this page was a form and four reassurances, on the theory that a landing
 * page should remove everything that isn't the conversion. That's the right theory for a £30
 * purchase and the wrong one here. Rendering is a five-figure decision about the front of somebody's
 * home, and nobody commits to that off a page that tells them nothing about who's turning up. The
 * page now earns the enquiry instead of just asking for it: what the work involves, what the
 * guarantee covers, what other people said, and the questions everybody asks before they ring.
 *
 * Still no navigation. Every link out is a way to leave without enquiring, so the only outbound
 * links remain the phone number and the legally-required policy links in the footer. The form
 * appears twice — once in the first screenful, once at the foot — because a visitor who reads the
 * whole page shouldn't have to scroll back up to act on it.
 *
 * Sections that depend on tenant content (before/after work, reviews, published services, FAQs)
 * return null when that content doesn't exist yet rather than rendering an empty frame. An empty
 * gallery reads as a broken page; an absent one reads as a shorter page.
 *
 * Kept out of the sitemap and marked noindex: it targets the same terms as the home page, and two
 * pages competing for one query weakens both.
 */

interface Promise_ { icon: string; title: string; body: string }

const PROMISES: readonly Promise_[] = [
  { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "15-year guarantee", body: "Written cover on every silicone render we install." },
  { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", title: "Free home survey", body: "We measure up in person — no guessing, no obligation." },
  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", title: "Quote within 24 hours", body: "A written price the day after we visit, not next week." },
  { icon: "M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z", title: "Local to Essex", body: "Based in Grays. We work across Thurrock and south Essex." },
];

const HERO_TICKS: readonly string[] = [
  "Free, no-obligation home survey",
  "Written quote within 24 hours of visiting",
  "15-year guarantee on silicone render",
  "Fully insured, based in Grays",
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

function PhoneIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.5 5.5l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
    </svg>
  );
}

export default function LandingPage({ tenantSlug, variantKey }: { tenantSlug: string; variantKey?: string }) {
  const { data, isLoading } = useGetPublicSite(tenantSlug);
  const { data: reviewData } = useListPublicReviews(tenantSlug);

  if (isLoading) return <Spinner />;
  const site = (data as any) ?? {};
  const { tenant, settings } = site;
  if (!tenant) return <div className="p-8 text-center text-slate-500">Site not found</div>;

  const accent: string = settings?.primaryColor || tenant?.primaryColor || "#EA580C";
  const phone: string | undefined = settings?.phone || tenant?.phone || undefined;
  const name: string = tenant?.name || "Us";

  const variant = readServiceVariant(variantKey);
  const reviews = ((reviewData as any[]) || []).filter(r => r.content).slice(0, 3);
  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviews.length) * 10) / 10
    : undefined;

  const beforeAfter: BeforeAfterItem[] = (site.featuredBeforeAfter as BeforeAfterItem[]) ?? [];

  // The operator's own FAQs win when they exist; ours fill the gap until they do.
  const tenantFaqs: FaqItem[] = ((site.globalFaqs as any[]) ?? [])
    .filter(f => f?.question && f?.answer)
    .map(f => ({ question: f.question, answer: f.answer }));
  const faqs: FaqItem[] = tenantFaqs.length > 0 ? tenantFaqs : [...DEFAULT_FAQS];

  const publishedServices = ((site.featuredServices as any[]) ?? []).filter(s => s?.name);
  const services = publishedServices.length > 0
    ? publishedServices.map(s => ({
        name: s.name as string,
        body: (s.heroContent as string) || (s.seoDescription as string) || "",
        best: "",
      }))
    : [...SERVICE_BLURBS];

  const formProps = {
    tenantSlug,
    accent,
    conversionId: settings?.googleAdsConversionId,
    conversionLabel: settings?.googleAdsConversionLabel,
    presetService: variant.service,
  };

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
              <PhoneIcon className="w-4 h-4" />
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
              {HERO_TICKS.map(line => (
                <li key={line} className="flex gap-2.5 text-sm font-medium" style={{ color: TEXT }}>
                  <Tick />{line}
                </li>
              ))}
            </ul>

            {avg && reviews.length > 0 && (
              <div className="mt-7 flex items-center gap-3">
                <Stars rating={Math.round(avg)} />
                <span className="text-sm font-semibold" style={{ color: INK }}>{avg} out of 5</span>
                <span className="text-sm" style={{ color: MUTED }}>
                  from {reviews.length === 1 ? "a local homeowner" : `${reviews.length} local homeowners`}
                </span>
              </div>
            )}
          </div>

          <div>
            <QuoteForm {...formProps} idPrefix="lp-hero" />
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

      <BeforeAfterGallery items={beforeAfter} accent={accent} />

      <WhatsInvolved accent={accent} />

      {/* What we fit, and which wall each system suits. */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>What we fit</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
          Not every wall wants the same system. Here's the honest difference between them — we'll
          tell you which one yours needs when we survey it.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map(s => (
            <article key={s.name} className="rounded-2xl border border-slate-200 p-6">
              <h3 className="text-base font-bold" style={{ color: INK }}>{s.name}</h3>
              {s.body && <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT }}>{s.body}</p>}
              {s.best && (
                <p className="mt-3 border-t border-slate-100 pt-3 text-sm font-semibold" style={{ color: accent }}>
                  {s.best}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* The guarantee, spelled out. It's the strongest claim on the page and was the least explained. */}
      <section className="border-y border-slate-200" style={{ backgroundColor: "#F6F8FB" }}>
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>What you get in writing</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
            Anyone can say fifteen years on the phone. Here's what that actually means when we hand
            the job back.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {GUARANTEE_POINTS.map(point => (
              <div key={point.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1A` }}>
                  <svg className="h-5 w-5" fill="none" stroke={accent} strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5-2v6a9 9 0 01-7 8.8A9 9 0 015 16V6l7-3 7 3z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold" style={{ color: INK }}>{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT }}>{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>What local homeowners say</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
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
        </section>
      )}

      <section className="border-y border-slate-200" style={{ backgroundColor: "#F6F8FB" }}>
        <div className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>How it works</h2>
          <ol className="mt-7 space-y-6">
            {[
              ["We talk", "Tell us about your property and what you're after. Two minutes on the phone or the form on this page."],
              ["We visit", "A free survey at a time that suits you. We measure up properly, look at what's behind the existing finish, and explain your options."],
              ["You get a written price", "A clear, fixed quote within 24 hours of the visit. No obligation to go ahead, and nobody will chase you."],
              ["We book you in", "A start date, a realistic finish date, and the same team on site from beginning to end."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: accent }}>{i + 1}</span>
                <div>
                  <h3 className="text-base font-bold" style={{ color: INK }}>{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <FaqAccordion items={faqs} accent={accent} />

      <section className="border-t border-slate-200 px-5 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-lg font-extrabold tracking-tight" style={{ color: INK }}>Where we work</h2>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {AREAS_COVERED.map(area => (
              <li key={area} className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium" style={{ color: TEXT }}>
                {area}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm" style={{ color: MUTED }}>
            Not on the list? Ring us — if we cover you we'll say so, and if we don't we'll tell you
            that too.
          </p>
        </div>
      </section>

      {/* Second ask, for the visitor who read the lot. */}
      <section className="border-t border-slate-200" style={{ backgroundColor: "#F6F8FB" }}>
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight" style={{ color: INK }}>
              Find out what your house would cost
            </h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: MUTED }}>
              A free survey, a fixed written price within 24 hours, and no obligation at the end of
              it. Fill the form in and we'll ring you back, or call now if you'd rather talk.
            </p>
            {phone && (
              <a href={`tel:${phone}`}
                 className="mt-6 inline-flex items-center gap-2.5 rounded-xl border-2 px-5 py-3.5 text-base font-bold"
                 style={{ borderColor: accent, color: accent }}>
                <PhoneIcon className="h-5 w-5" />
                {phone}
              </a>
            )}
          </div>
          <div>
            <QuoteForm
              {...formProps}
              idPrefix="lp-foot"
              heading="Request your free quote"
              subheading="Takes under a minute. We'll call you back within 24 hours."
            />
          </div>
        </div>
      </section>

      {/* Sticky call bar: phones only, and only where it can't cover the form's submit button. */}
      {phone && (
        <>
          <div className="h-20 md:hidden" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <a href={`tel:${phone}`}
               className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white"
               style={{ backgroundColor: accent }}>
              <PhoneIcon className="h-5 w-5" />
              Call {phone}
            </a>
          </div>
        </>
      )}

      <footer className="border-t border-slate-200 px-5 py-8">
        <div className="mx-auto max-w-5xl text-xs" style={{ color: MUTED }}>
          <div className="font-semibold" style={{ color: INK }}>{name}</div>
          {settings?.address && <div className="mt-1">{settings.address}</div>}
          <div className="mt-1">Serving Grays, Thurrock, Basildon and south Essex.</div>
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
