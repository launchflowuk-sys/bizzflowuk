import { Switch, Route, useParams, useLocation, Router as WouterRouter, Link as WouterLink } from "wouter";
import { useGetPublicSite, useListPublicServices, useGetPublicService, useListPublicAreas, useListPublicReviews, useListPublicCaseStudies, useListPublicFaqs, useListPublicBeforeAfter, useSubmitContact, useListPublicPriceItems } from "@workspace/api-client-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { initGoogleTag } from "./analytics";
import { SiteBaseCtx, SiteOriginCtx, useSiteBase, useSiteOrigin, PageSEO, JsonLd, CookieBanner, QuoteFormSection } from "./PublicSiteApp";
import { PriceCalculatorSection } from "./PriceCalculator";
import BeforeAfterGallery, { type BeforeAfterItem } from "./landing/BeforeAfterGallery";

// ─────────────────────────────────────────────────────────────────────────────
// LANDSCAPING & GROUNDWORKS SITE TEMPLATE (tenant.industry === 'landscaping')
//
// Built for KD Essex Landscaping & Groundworks. Deliberately NOT a re-skin of
// the rendering or construction templates: editorial typography, full-bleed
// photography and generous whitespace, because in this market every competitor
// looks like a 2015 trade site and looking like a design studio is the
// differentiator (see docs/plans/kd-essex-onboarding.md).
//
// The signature element is <BuildUpDiagram/> — a labelled cross-section of a
// correct sub-base build-up. Nobody in the local market publishes their depths;
// showing them is the whole positioning made visible.
//
// All business facts come from the tenant's DB rows (tenant, settings,
// services, areas, reviews, case studies, FAQs). Nothing about any specific
// business is hardcoded here beyond neutral fallback copy.
// ─────────────────────────────────────────────────────────────────────────────

// Palette — "Natural & Fresh" from the client's brand sheet, contrast-corrected.
// GREEN is the logo green and only clears 3:1, so it is limited to large text,
// icons and decorative use. GREEN_DEEP is a barely-perceptible darkening that
// clears 4.5:1 on white for buttons, links and small text. Never set body copy
// in GREEN on INK (4.42:1) — use OFF_WHITE or PALE there.
const GREEN = "#6B8E4E";       // logo green — large headlines, icons, accents on dark (3.75:1 on white)
const GREEN_DEEP = "#5D7B45";  // buttons, links, small accent text on white (4.79:1 — AA)
const INK = "#1E1F1D";         // dark panels, footer (16.55:1 with white)
const GREY = "#6B6F72";        // muted body text (5.07:1 on white)
const OFF_WHITE = "#F5F7F4";   // page background
const PALE = "#E2EAD9";        // section tints

// Services whose name or slug matches any of these read as groundworks; everything
// else reads as landscaping. This drives only the visual split on the homepage —
// order and content still come from the DB, so the emphasis between the two sides
// is changed by reordering services in the dashboard, not by editing this file.
const GROUNDWORKS_TERMS = [
  "groundwork", "drainage", "drain", "excavat", "dig", "dropped kerb", "kerb",
  "foundation", "footing", "muck", "sub-base", "subbase", "soakaway",
  "levelling", "leveling", "site clearance", "civils",
];

const isGroundworks = (s: any) => {
  const hay = `${s?.name || ""} ${s?.slug || ""}`.toLowerCase();
  return GROUNDWORKS_TERMS.some(t => hay.includes(t));
};

// ── primitives ───────────────────────────────────────────────────────────────

function Icon({ d, className = "w-6 h-6", color = GREEN_DEEP, strokeWidth = 1.6 }: { d: string; className?: string; color?: string; strokeWidth?: number }) {
  return <svg className={className} style={{ color }} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d}/></svg>;
}

const PinIcon = ({ color = GREEN_DEEP, className = "w-4 h-4" }: { color?: string; className?: string }) =>
  <Icon d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" className={className} color={color}/>;

const PhoneIcon = ({ color = "currentColor", className = "w-4 h-4" }: { color?: string; className?: string }) =>
  <Icon d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" className={className} color={color} strokeWidth={1.8}/>;

const ArrowIcon = ({ className = "w-4 h-4", color = "currentColor" }: { className?: string; color?: string }) =>
  <Icon d="M5 12h14M13 6l6 6-6 6" className={className} color={color} strokeWidth={2}/>;

const CheckIcon = ({ className = "w-5 h-5", color = GREEN_DEEP }: { className?: string; color?: string }) =>
  <Icon d="M20 6L9 17l-5-5" className={className} color={color} strokeWidth={2.2}/>;

function Star({ filled = true }: { filled?: boolean }) {
  return <svg className="w-4 h-4" style={{ color: filled ? GREEN : "#D6DBD1" }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.077 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>;
}

/** Section label — small, tracked, uppercase. Sets the editorial tone. */
/** A real heading for a labelled block, not a kicker floating above another heading. */
function SectionLabel({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return <h3 className="kd-display text-[11px] font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: onDark ? GREEN : GREEN_DEEP }}>{children}</h3>;
}

/**
 * Section heading. Display scale, and two-tone the same way the hero headline is:
 * a "|" in the text marks where the green half starts. A short rule sits above it
 * so a section opening is unmistakably a section opening rather than bold body text.
 */
function Heading({ children, onDark = false, className = "", rule = true }: { children: React.ReactNode; onDark?: boolean; className?: string; rule?: boolean }) {
  const raw = typeof children === "string" ? children : null;
  const [lead, accent] = raw && raw.includes("|") ? splitHeadline(raw) : [raw, ""];
  return (
    <>
      {rule && <span className="block h-[2px] w-9 mb-5" style={{ backgroundColor: onDark ? GREEN : GREEN_DEEP }}/>}
      <h2
        className={`kd-display text-[1.6rem] sm:text-[1.95rem] lg:text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.02em] max-w-3xl ${className}`}
        style={{ color: onDark ? "#FFFFFF" : INK, textWrap: "balance" } as React.CSSProperties}
      >
        {raw === null ? children : (
          <>
            {lead}
            {accent && <><br/><span style={{ color: onDark ? GREEN : GREEN_DEEP }}>{accent}</span></>}
          </>
        )}
      </h2>
    </>
  );
}

function Btn({ href, children, variant = "solid", className = "" }: { href: string; children: React.ReactNode; variant?: "solid" | "outline" | "ghost"; className?: string }) {
  const base = "kd-btn inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold min-h-[48px] transition-[transform,box-shadow,background-color,color] duration-200 ease-out will-change-transform";
  const styles = variant === "solid"
    ? { backgroundColor: GREEN_DEEP, color: "#FFFFFF" }
    : variant === "outline"
      ? { border: `1.5px solid ${GREEN_DEEP}`, color: GREEN_DEEP }
      : { border: "1.5px solid rgba(255,255,255,0.35)", color: "#FFFFFF" };
  return <a href={href} className={`${base} ${variant === "solid" ? "kd-btn-solid" : variant === "outline" ? "kd-btn-outline" : "kd-btn-ghost"} ${className}`} style={styles}>{children}</a>;
}

// ── the signature element ────────────────────────────────────────────────────

type BuildLayer = { label: string; depth: string; note: string; fill: string; height: number };

/**
 * Cross-section of a correct hard-landscaping build-up, with depths labelled.
 * This is the site's differentiator made visible: the local market competes on
 * finish photos, nobody publishes what goes underneath. Depths are neutral
 * industry defaults and should be replaced with the tenant's own published spec.
 */
const DEFAULT_LAYERS: BuildLayer[] = [
  { label: "Finish",            depth: "40–50mm", note: "Paving, natural stone or block",         fill: "#B9C4AC", height: 34 },
  { label: "Laying course",     depth: "30–40mm", note: "Sharp sand or full mortar bed",          fill: "#CBD2C1", height: 28 },
  { label: "Sub-base",          depth: "100–150mm", note: "MOT Type 1, compacted in layers",      fill: "#8E9A82", height: 56 },
  { label: "Geotextile membrane", depth: "—",     note: "Stops the sub-base sinking into subsoil", fill: "#5D7B45", height: 10 },
  { label: "Subgrade",          depth: "—",       note: "Excavated and compacted ground",          fill: "#4A4F45", height: 46 },
];

function BuildUpDiagram({ layers = DEFAULT_LAYERS, onDark = false }: { layers?: BuildLayer[]; onDark?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // The section builds itself once, when it first comes into view. Layers start
  // visible (animation-fill: backwards on an already-rendered element), so if the
  // observer never runs — SSR, an old browser, reduced motion — the diagram is
  // simply there, complete.
  useEffect(() => {
    const el = ref.current;
    if (!el || settled) return;
    if (typeof IntersectionObserver === "undefined") { setSettled(true); return; }

    // Geometry fallback: IntersectionObserver only reports on a page that is
    // actually compositing frames, so a diagram already on screen at mount can
    // otherwise sit un-animated indefinitely. getBoundingClientRect needs layout
    // but not paint, so this still resolves where the observer stays silent.
    const timer = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.85 && r.bottom > 0) setSettled(true);
    }, 120);

    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) { setSettled(true); io.disconnect(); } },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => { window.clearTimeout(timer); io.disconnect(); };
  }, [settled]);

  const textColor = onDark ? "#FFFFFF" : INK;
  const mutedColor = onDark ? "rgba(255,255,255,0.62)" : GREY;
  // Ground is built from the bottom up, so the last row in the stack moves first.
  const delayFor = (i: number) => (layers.length - 1 - i) * 90;

  return (
    <div ref={ref} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 items-center">
      <div>
        <p className="kd-display text-[10px] font-semibold uppercase tracking-[0.16em] mb-2.5" style={{ color: mutedColor }}>
          Fall to drainage — 1:80
        </p>
        <div className="kd-stack overflow-hidden rounded-[5px]" data-settled={settled ? "true" : "false"}>
          {layers.map((l, i) => (
            <div
              key={l.label}
              className="kd-layer"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{
                height: l.height * 1.35,
                backgroundColor: l.fill,
                ["--kd-delay" as string]: `${delayFor(i)}ms`,
                opacity: active !== null && active !== i ? 0.55 : 1,
                transition: "opacity 200ms ease-out",
              }}
            />
          ))}
        </div>
      </div>

      <ul className="kd-legend" data-settled={settled ? "true" : "false"}>
        {layers.map((l, i) => (
          <li
            key={l.label}
            className="kd-legend-row flex gap-4 py-4 border-b"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            style={{
              borderColor: onDark ? "rgba(255,255,255,0.12)" : "#E3E7DF",
              opacity: active !== null && active !== i ? 0.5 : 1,
              transition: "opacity 200ms ease-out",
              ["--kd-delay" as string]: `${delayFor(i) + 120}ms`,
            }}
          >
            <span className="mt-1.5 h-3.5 w-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: l.fill }} aria-hidden="true"/>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[15px] font-semibold" style={{ color: textColor }}>{l.label}</span>
                {l.depth !== "—" && (
                  <span className="kd-nums text-[13px] font-semibold" style={{ color: onDark ? GREEN : GREEN_DEEP }}>{l.depth}</span>
                )}
              </div>
              <p className="text-[13.5px] leading-relaxed mt-0.5" style={{ color: mutedColor }}>{l.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── chrome ───────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About Us" },
  { href: "/areas", label: "Areas We Cover" },
  { href: "/contact", label: "Contact" },
];

/**
 * Splits the hero headline into a dark line and a green line, per the client's mockup
 * ("LANDSCAPING &" in ink above "GROUNDWORKS" in green). An explicit "|" in the headline
 * marks the break; without one the last word is used, which is the common case for a
 * "<trade> & <trade>" headline. Tenants that want a single-colour headline just avoid "|"
 * and get a sensible split rather than a broken one.
 */
function splitHeadline(headline: string): [string, string] {
  if (headline.includes("|")) {
    const [a, ...rest] = headline.split("|");
    return [a.trim(), rest.join("|").trim()];
  }
  const words = headline.trim().split(/\s+/);
  if (words.length < 2) return [headline, ""];
  return [words.slice(0, -1).join(" "), words[words.length - 1]];
}

/** Trust row under the hero — template chrome, editable copy lives here rather than the DB. */
const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "M12 2l8 3.5v5.5c0 5-3.4 9.3-8 10.5-4.6-1.2-8-5.5-8-10.5V5.5L12 2z", title: "Quality workmanship", body: "Built to a written specification, with the depths stated." },
  { icon: "M3 18h18M5 18v-4h4l2-5h4l2 4h2v5M8 9V6h4", title: "Reliable & efficient", body: "Turn up when we say, and finish when we say." },
  { icon: "M12 21c5-1 8-5 8-10V5s-4 1-8 1-8-1-8-1v6c0 5 3 9 8 10zM12 8v9", title: "Considerate on site", body: "Cleared down daily, and mindful of your neighbours." },
  { icon: "M16 20v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6M20 20v-1a3 3 0 00-2.5-3M18 5.2a3 3 0 010 5.6", title: "Straight answers", body: "One person quoting, doing the work and picking up the phone." },
];

function FeatureStrip() {
  return (
    <section className="border-b" style={{ backgroundColor: OFF_WHITE, borderColor: "#E6EAE2" }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 grid gap-y-8 sm:grid-cols-2 lg:grid-cols-4 py-10">
        {FEATURES.map((f, i) => (
          <div key={f.title} className={`flex gap-4 lg:px-7 ${i > 0 ? "lg:border-l" : ""}`} style={{ borderColor: "#DDE3D6" }}>
            <Icon d={f.icon} className="w-8 h-8 flex-shrink-0" color={GREEN_DEEP} strokeWidth={1.4}/>
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: INK }}>{f.title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: GREY }}>{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Proudly serving …" band, flanked by rules — from the mockup. */
function ServingBand({ city }: { city?: string }) {
  if (!city) return null;
  return (
    <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-7 flex items-center gap-5">
      <span className="hidden sm:block h-px flex-1" style={{ backgroundColor: "#DDE3D6" }}/>
      <span className="flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-center" style={{ color: INK }}>
        <PinIcon color={GREEN_DEEP}/>Proudly serving {city} &amp; surrounding areas
      </span>
      <span className="hidden sm:block h-px flex-1" style={{ backgroundColor: "#DDE3D6" }}/>
    </div>
  );
}

/**
 * Star rating badge. Renders ONLY when the tenant has real published reviews — the mockup
 * showed a hardcoded "5 star rated · Google" badge, which would have been a fabricated review
 * claim on a business that currently has none (and fake reviews are unlawful in the UK under
 * the DMCC Act 2024). Driven by data, it appears by itself once genuine reviews exist.
 */
function RatingBadge({ reviews }: { reviews: any[] }) {
  if (!reviews || reviews.length === 0) return null;
  const rated = reviews.filter(r => typeof r.rating === "number");
  if (rated.length === 0) return null;
  const avg = rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
  const rounded = Math.round(avg * 10) / 10;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK }}>
        {rounded} out of 5
      </span>
      <span className="flex gap-0.5" aria-label={`Rated ${rounded} out of 5 from ${rated.length} reviews`}>
        {Array.from({ length: 5 }).map((_, i) => <Star key={i} filled={i < Math.round(avg)}/>)}
      </span>
      <span className="text-[13px]" style={{ color: GREY }}>
        {rated.length} review{rated.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function KDNav({ tenant, settings, tenantSlug }: { tenant: any; settings: any; tenantSlug: string }) {
  const siteBase = useSiteBase();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const logo = settings?.logoUrl || tenant?.logoUrl;
  const phone = settings?.phone || tenant?.phone;
  const { data: priceItems } = useListPublicPriceItems(tenantSlug || "");
  const links = ((priceItems as any[]) || []).length > 0
    ? [...NAV_LINKS.slice(0, 3), { href: "/calculator", label: "Cost Guide" }, ...NAV_LINKS.slice(3)]
    : NAV_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: "rgba(255,255,255,0.94)", borderColor: "#E6EAE2", backdropFilter: "blur(10px)" }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 flex items-center justify-between h-[92px] gap-6">
        <a href={siteBase || "/"} className="flex items-center flex-shrink-0" aria-label={tenant?.name || "Home"}>
          {logo
            ? <img src={logo} alt={tenant?.name || "Logo"} className="h-16 w-auto transition-transform duration-300 hover:scale-[1.03]" width={300} height={200}/>
            : <span className="text-lg font-semibold tracking-[-0.01em]" style={{ color: INK }}>{tenant?.name || ""}</span>}
        </a>

        <nav className="hidden lg:flex items-center gap-8">
          {links.map(l => {
            const active = l.href === "/" ? location === "/" : location.startsWith(l.href);
            return (
              <a
                key={l.href}
                href={`${siteBase}${l.href}`}
                aria-current={active ? "page" : undefined}
                className="group/nav relative text-[12.5px] font-semibold uppercase tracking-[0.08em] py-1.5 transition-colors duration-200 hover:!text-[#5D7B45]"
                style={{ color: active ? GREEN_DEEP : INK }}
              >
                {l.label}
                <span
                  className="absolute left-0 -bottom-0.5 h-[2px] origin-left transition-transform duration-300 ease-out"
                  style={{
                    backgroundColor: GREEN_DEEP,
                    width: "100%",
                    transform: active ? "scaleX(1)" : "scaleX(0)",
                  }}
                />
                {!active && <span className="absolute left-0 -bottom-0.5 h-[2px] w-full origin-left scale-x-0 transition-transform duration-300 ease-out group-hover/nav:scale-x-100" style={{ backgroundColor: GREEN_DEEP }}/>}
              </a>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-5 flex-shrink-0">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-[13.5px] font-semibold transition-opacity hover:opacity-70" style={{ color: INK }}>
              <PhoneIcon color={GREEN_DEEP}/>{phone}
            </a>
          )}
          <Btn href={`${siteBase}/quote`} variant="outline" className="!px-6 !py-2.5 !min-h-0 !rounded-none">
            Get a quote <ArrowIcon className="w-4 h-4"/>
          </Btn>
        </div>

        <button className="lg:hidden p-2 -mr-2" onClick={() => setOpen(v => !v)} aria-label="Toggle menu" aria-expanded={open}>
          <svg className="w-6 h-6" style={{ color: INK }} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" viewBox="0 0 24 24">
            {open ? <path d="M6 6l12 12M6 18L18 6"/> : <path d="M4 8h16M4 16h16"/>}
          </svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t bg-white px-5 sm:px-8 py-3" style={{ borderColor: "#E6EAE2" }}>
          {links.map(l => (
            <WouterLink key={l.href} href={l.href} className="block py-3 text-[15px] font-medium" style={{ color: INK }} onClick={() => setOpen(false)}>{l.label}</WouterLink>
          ))}
          <WouterLink href="/quote" className="block py-3 text-[15px] font-semibold" style={{ color: GREEN_DEEP }} onClick={() => setOpen(false)}>Get a quote</WouterLink>
          {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 py-3 text-[15px] font-medium" style={{ color: INK }}><PhoneIcon color={GREEN_DEEP}/>{phone}</a>}
        </div>
      )}
    </header>
  );
}

function KDMobileBar({ phone }: { phone?: string }) {
  const siteBase = useSiteBase();
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex md:hidden" style={{ boxShadow: "0 -2px 16px rgba(0,0,0,0.10)" }}>
      {phone && (
        <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold min-h-[56px]" style={{ backgroundColor: INK, color: "#FFFFFF" }}>
          <PhoneIcon color={GREEN}/>Call
        </a>
      )}
      <a href={`${siteBase}/quote`} className="flex-1 flex items-center justify-center py-4 text-sm font-semibold min-h-[56px]" style={{ backgroundColor: GREEN_DEEP, color: "#FFFFFF" }}>
        Get a free quote
      </a>
    </div>
  );
}

function KDFooter({ tenant, settings, tenantSlug }: { tenant: any; settings: any; tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: servicesData } = useListPublicServices(tenantSlug);
  const { data: areasData } = useListPublicAreas(tenantSlug);
  const services = ((servicesData as any[]) || []).slice(0, 7);
  const areas = ((areasData as any[]) || []).slice(0, 8);
  const phone = settings?.phone || tenant?.phone;
  const email = settings?.email || tenant?.email;
  const address = [settings?.address || tenant?.address, settings?.city || tenant?.city].filter(Boolean).join(", ");
  const socials = [
    ["facebookUrl", "Facebook"], ["instagramUrl", "Instagram"], ["twitterUrl", "X"],
    ["youtubeUrl", "YouTube"], ["tiktokUrl", "TikTok"],
  ].filter(([k]) => settings?.[k as string]) as [string, string][];

  return (
    <footer style={{ backgroundColor: INK }} className="pb-24 md:pb-0">
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-16 pb-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-6">
            {settings?.logoUrl
              ? (
                  // The mark is ink + green, which disappears on the dark footer. Prefer a
                  // reversed lockup by naming convention; if a tenant hasn't supplied one,
                  // fall back to the original knocked out to white.
                  <img
                    src={settings.logoUrl.replace(/\.webp$/, "-reversed.webp")}
                    alt={tenant?.name || "Logo"}
                    className="h-20 w-auto mb-6"
                    width={300}
                    height={200}
                    onError={e => {
                      const img = e.currentTarget;
                      if (img.dataset["fellBack"]) return;
                      img.dataset["fellBack"] = "1";
                      img.src = settings.logoUrl;
                      img.style.filter = "brightness(0) invert(1)";
                    }}
                  />
                )
              : <div className="text-xl font-semibold mb-6 text-white">{tenant?.name}</div>}
            {(settings?.aboutText || tenant?.description) && (
              <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                {(settings?.aboutText || tenant?.description || "").slice(0, 190)}
              </p>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5">
                {socials.map(([k, label]) => (
                  <a key={k} href={settings[k]} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium transition-opacity hover:opacity-70" style={{ color: GREEN }}>{label}</a>
                ))}
              </div>
            )}
          </div>

          {services.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: GREEN }}>Services</h3>
              <ul className="space-y-2.5">
                {services.map((s: any) => (
                  <li key={s.id}>
                    <a href={`${siteBase}/services/${s.slug}`} className="text-[13.5px] transition-colors duration-200 hover:text-white" style={{ color: "rgba(255,255,255,0.68)" }}>{s.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {areas.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: GREEN }}>Areas we cover</h3>
              <ul className="space-y-2.5">
                {areas.map((a: any) => (
                  <li key={a.id}>
                    <a href={`${siteBase}/areas/${a.slug}`} className="text-[13.5px] transition-colors duration-200 hover:text-white" style={{ color: "rgba(255,255,255,0.68)" }}>{a.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: GREEN }}>Get in touch</h3>
            <ul className="space-y-3">
              {phone && <li><a href={`tel:${phone}`} className="text-[13.5px] font-medium text-white">{phone}</a></li>}
              {email && <li><a href={`mailto:${email}`} className="text-[13.5px] break-all" style={{ color: "rgba(255,255,255,0.68)" }}>{email}</a></li>}
              {address && <li className="text-[13.5px] flex gap-2" style={{ color: "rgba(255,255,255,0.68)" }}><PinIcon color={GREEN} className="w-4 h-4 mt-0.5 flex-shrink-0"/>{address}</li>}
            </ul>
            <Btn href={`${siteBase}/quote`} className="mt-6 !px-6 !py-3">Get a quote</Btn>
          </div>
        </div>

        <div className="mt-14 pt-7 border-t flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <p className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            © {new Date().getFullYear()} {tenant?.name}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href={`${siteBase}/privacy`} className="text-[12.5px] transition-colors duration-200 hover:text-white" style={{ color: "rgba(255,255,255,0.45)" }}>Privacy</a>
            <a href={`${siteBase}/terms`} className="text-[12.5px] transition-colors duration-200 hover:text-white" style={{ color: "rgba(255,255,255,0.45)" }}>Terms</a>
            <a href="/" className="text-[12.5px] transition-colors duration-200 hover:text-white" style={{ color: "rgba(255,255,255,0.45)" }}>Powered by LaunchFlow</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Breadcrumb JSON-LD — one of the two schema types the SEO plan flagged as missing. */
function Breadcrumbs({ trail }: { trail: { name: string; url: string }[] }) {
  return (
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: trail.map((t, i) => ({
        "@type": "ListItem", position: i + 1, name: t.name, item: t.url,
      })),
    }}/>
  );
}

/** Inner-page header. Deliberately typographic rather than a photo banner. */
function PageHead({ title, intro }: { title: string; intro?: string }) {
  return (
    <section className="pt-12 pb-10 sm:pt-16 sm:pb-12" style={{ backgroundColor: OFF_WHITE }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
        <h1 className="kd-display text-[2rem] sm:text-[2.5rem] lg:text-[3rem] font-semibold leading-[1.08] tracking-[-0.025em] max-w-3xl" style={{ color: INK }}>{title}</h1>
        {intro && <p className="mt-6 text-lg leading-relaxed max-w-2xl" style={{ color: GREY }}>{intro}</p>}
      </div>
    </section>
  );
}

function Shell({ tenantSlug, children }: { tenantSlug: string; children: React.ReactNode }) {
  const { data } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (data as any) || {};
  const phone = settings?.phone || tenant?.phone;
  return (
    <div className="kd-site min-h-screen flex flex-col" style={{ backgroundColor: "#FFFFFF" }}>
      <KDNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <main className="flex-1">{children}</main>
      <KDFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <KDMobileBar phone={phone}/>
    </div>
  );
}

// ── shared sections ──────────────────────────────────────────────────────────

const TRUST_FALLBACK = ["Fully insured", "Free written quote", "No deposit required", "Site left clean daily"];

function TrustStrip({ settings }: { settings: any }) {
  const badges = ((settings?.trustBadges as string[]) || []).filter(Boolean);
  const items = badges.length > 0 ? badges : TRUST_FALLBACK;
  return (
    <div className="border-y" style={{ borderColor: "#E6EAE2", backgroundColor: OFF_WHITE }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-5 flex flex-wrap gap-x-8 gap-y-3 justify-center">
        {items.map(t => (
          <span key={t} className="flex items-center gap-2 text-[13px] font-medium" style={{ color: INK }}>
            <CheckIcon className="w-4 h-4" color={GREEN_DEEP}/>{t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ServiceCard({ service, tenantSlug }: { service: any; tenantSlug?: string }) {
  const siteBase = useSiteBase();
  return (
    <a href={`${siteBase}/services/${service.slug}`} className="group block">
      <div className="aspect-[4/3] overflow-hidden rounded-lg mb-4" style={{ backgroundColor: PALE }}>
        {service.heroImageUrl && (
          <img
            src={service.heroImageUrl}
            alt={service.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.06]"
          />
        )}
      </div>
      <h3 className="text-lg font-semibold tracking-[-0.01em] mb-1.5 transition-colors duration-200 group-hover:text-[#5D7B45]" style={{ color: INK }}>{service.name}</h3>
      {service.tagline && <p className="text-sm leading-relaxed mb-3" style={{ color: GREY }}>{service.tagline}</p>}
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: GREEN_DEEP }}>
        Read more <ArrowIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"/>
      </span>
    </a>
  );
}

function QuoteCTA({ tenantSlug, tenant, settings }: { tenantSlug: string; tenant: any; settings: any }) {
  const siteBase = useSiteBase();
  const phone = settings?.phone || tenant?.phone;
  return (
    <section className="py-14 sm:py-20" style={{ backgroundColor: INK }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 text-center">
        <Heading onDark className="max-w-3xl mx-auto">Tell us about the job and we'll put a written quote together.</Heading>
        <p className="mt-5 text-base leading-relaxed max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
          Send a few photos with your enquiry and we can often price smaller work without a visit.
        </p>
        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          <Btn href={`${siteBase}/quote`}>Get a free quote</Btn>
          {phone && <Btn href={`tel:${phone}`} variant="ghost">Call {phone}</Btn>}
        </div>
      </div>
    </section>
  );
}

// ── pages ────────────────────────────────────────────────────────────────────

function HomePage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings, featuredReviews, recentCaseStudies, featuredBeforeAfter, globalFaqs } = (siteData as any) || {};
  const { data: servicesData } = useListPublicServices(tenantSlug);
  const { data: areasData } = useListPublicAreas(tenantSlug);

  const services = ((servicesData as any[]) || []);
  const areas = ((areasData as any[]) || []);
  const reviews = ((featuredReviews as any[]) || []);
  const projects = ((recentCaseStudies as any[]) || []).slice(0, 3);
  const beforeAfter = ((featuredBeforeAfter as BeforeAfterItem[]) || []);
  const faqs = ((globalFaqs as any[]) || []).slice(0, 6);

  // Split for the homepage only — order comes from the DB (sortOrder), so the
  // emphasis between the two sides is a dashboard change, not a code change.
  const { landscaping, groundworks } = useMemo(() => ({
    landscaping: services.filter(s => !isGroundworks(s)),
    groundworks: services.filter(isGroundworks),
  }), [services]);
  const isSplit = landscaping.length > 0 && groundworks.length > 0;

  const phone = settings?.phone || tenant?.phone;
  const heroImage = settings?.heroImageUrl;
  // Three hero text slots mapped onto existing settings columns, so no schema change:
  // heroHeadline is the two-tone headline ("Landscaping &|Groundworks"), heroSubheadline is
  // the short tagline under it, and the paragraph comes from the tenant's description.
  const headline = settings?.heroHeadline || `Landscaping &|Groundworks`;
  const [headlineTop, headlineAccent] = splitHeadline(headline);
  const tagline = settings?.heroSubheadline || "";
  const sub = tenant?.description
    || "From the dig and the drainage to the finished garden — one contractor, start to finish.";

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO
        title={settings?.seoTitle || `${tenant?.name || "Landscaping & Groundworks"}${tenant?.city ? ` | ${tenant.city}` : ""}`}
        description={settings?.seoDescription || sub}
        image={heroImage}
        siteName={tenant?.name}
      />
      <Breadcrumbs trail={[{ name: "Home", url: `${origin}${siteBase}/` }]}/>

      {/* 01 — HERO. Split layout from the client's mockup: copy on white at the left,
          photography bleeding off the right, with the image feathered into the white rather
          than darkened under an overlay. On mobile the image sits above the copy. */}
      <section className="relative bg-white">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-stretch">
          {/* Image — first in the DOM on mobile, right-hand column on desktop */}
          {heroImage && (
            <div className="relative order-first lg:order-last h-[260px] sm:h-[380px] lg:h-auto lg:min-h-[620px]">
              <img
                src={heroImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover"
                fetchPriority="high"
              />
              {/* Feather into the white panel — horizontal on desktop, vertical on mobile */}
              <div className="absolute inset-0 lg:hidden" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 55%, rgba(255,255,255,0.95) 100%)" }}/>
              <div className="hidden lg:block absolute inset-y-0 left-0 w-2/5" style={{ background: "linear-gradient(to right, #FFFFFF 6%, rgba(255,255,255,0) 100%)" }}/>
            </div>
          )}

          {/* Copy */}
          <div className="kd-hero-in relative z-10 px-5 sm:px-8 lg:pl-[max(2rem,calc((100vw-1240px)/2))] lg:pr-14 py-12 sm:py-16 lg:py-20 flex flex-col justify-center">
            {tenant?.city && (
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] mb-6" style={{ color: INK }}>
                <PinIcon color={GREEN_DEEP}/>Based in {tenant.city}, UK
              </p>
            )}

            <h1 className="kd-display font-semibold uppercase leading-[0.94] tracking-[-0.025em] text-[2.2rem] sm:text-[2.8rem] lg:text-[3.25rem]">
              <span className="block" style={{ color: INK }}>{headlineTop}</span>
              {headlineAccent && <span className="block" style={{ color: GREEN }}>{headlineAccent}</span>}
            </h1>

            {settings?.heroSubheadline && (
              <p className="kd-display mt-5 text-[13px] sm:text-[14px] font-semibold uppercase tracking-[0.09em]" style={{ color: INK }}>
                {tagline}
              </p>
            )}
            <span className="block h-[3px] w-16 mt-6" style={{ backgroundColor: GREEN_DEEP }}/>

            <p className="mt-5 text-[15px] leading-[1.7] max-w-md" style={{ color: GREY }}>{sub}</p>

            <div className="mt-9 flex flex-wrap gap-3.5">
              <Btn href={`${siteBase}/services`} className="!rounded-none">
                Our services <ArrowIcon className="w-4 h-4"/>
              </Btn>
              <Btn href={`${siteBase}/projects`} variant="outline" className="!rounded-none">
                View our work <ArrowIcon className="w-4 h-4"/>
              </Btn>
            </div>

            {/* Real-review badge — renders itself only when there are genuine reviews. */}
            <div className="mt-9 empty:mt-0"><RatingBadge reviews={reviews}/></div>
          </div>
        </div>
      </section>

      <FeatureStrip/>
      <ServingBand city={tenant?.city}/>
      <TrustStrip settings={settings}/>

      {/* 02 — SERVICES, split into the two sides of the business */}
      {services.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-10">
              <Heading>Two halves of|the same job.</Heading>
              <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: GREY }}>
                Most gardens need work below ground before anything goes on top. Doing both means
                no gap between trades, and nobody to blame when the levels are wrong.
              </p>
            </div>

            {isSplit ? (
              <div className="grid gap-14 lg:grid-cols-2">
                {[["Landscaping", landscaping], ["Groundworks", groundworks]].map(([label, list]) => (
                  <div key={label as string}>
                    <div className="pb-5 mb-9 border-b-2" style={{ borderColor: INK }}>
                      <h3 className="kd-display text-[1.05rem] sm:text-[1.2rem] font-semibold uppercase tracking-[0.02em] leading-none" style={{ color: INK }}>
                        {label as string}
                      </h3>
                    </div>
                    <div className="grid gap-8 sm:grid-cols-2">
                      {(list as any[]).map(s => <ServiceCard key={s.id} service={s} tenantSlug={tenantSlug}/>)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {services.map(s => <ServiceCard key={s.id} service={s} tenantSlug={tenantSlug}/>)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 03 — BEFORE/AFTER */}
      {settings?.showBeforeAfter !== false && beforeAfter.length > 0 && (
        <section className="py-14 sm:py-20" style={{ backgroundColor: OFF_WHITE }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-9">
              <Heading>Drag to see|the difference.</Heading>
            </div>
            <BeforeAfterGallery items={beforeAfter} accent={GREEN_DEEP}/>
          </div>
        </section>
      )}

      {/* 04 — THE SIGNATURE BLOCK: what's underneath */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: INK }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mb-10">
            <Heading onDark>Anyone can lay a nice patio. It's the six inches below it that decide whether it's still flat in five years.</Heading>
            <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.66)" }}>
              Most quotes tell you the finish and stay quiet about the build-up. Here's ours, in
              full — so you've got something real to compare the other quotes against.
            </p>
          </div>
          <BuildUpDiagram onDark/>
          <div className="mt-12">
            <Btn href={`${siteBase}/quote`}>Get a written spec with your quote</Btn>
          </div>
        </div>
      </section>

      {/* 05 — PROJECTS */}
      {projects.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-9">
              <div className="max-w-xl">
                <Heading>Jobs we've|finished.</Heading>
              </div>
              <a href={`${siteBase}/projects`} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: GREEN_DEEP }}>
                All projects <ArrowIcon className="w-3.5 h-3.5"/>
              </a>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p: any) => (
                <a key={p.id} href={`${siteBase}/projects/${p.slug}`} className="group block">
                  <div className="aspect-[4/3] overflow-hidden rounded-lg mb-4" style={{ backgroundColor: PALE }}>
                    {p.heroImageUrl && <img src={p.heroImageUrl} alt={p.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"/>}
                  </div>
                  {p.location && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: GREEN_DEEP }}>{p.location}</p>}
                  <h3 className="text-lg font-semibold tracking-[-0.01em]" style={{ color: INK }}>{p.title}</h3>
                  {p.tagline && <p className="text-sm leading-relaxed mt-1.5" style={{ color: GREY }}>{p.tagline}</p>}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 06 — REVIEWS */}
      {settings?.showReviews !== false && reviews.length > 0 && (
        <section className="py-14 sm:py-20" style={{ backgroundColor: OFF_WHITE }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-9">
              <Heading>What customers|said.</Heading>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((r: any) => (
                <figure key={r.id} className="rounded-lg p-7 bg-white border" style={{ borderColor: "#E6EAE2" }}>
                  <div className="flex gap-0.5 mb-4" aria-label={`${r.rating} out of 5`}>
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} filled={i < (r.rating || 5)}/>)}
                  </div>
                  <blockquote className="text-[15px] leading-relaxed" style={{ color: INK }}>{r.content}</blockquote>
                  <figcaption className="mt-5 text-[13px] font-semibold" style={{ color: GREY }}>
                    {r.reviewerName}{r.location ? ` · ${r.location}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 07 — AREAS */}
      {areas.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8 grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <Heading>{`Covering ${tenant?.city || "Essex"}|and the surrounding towns.`}</Heading>
              <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: GREY }}>
                Ground conditions change street to street around here. We quote on what's actually
                under your garden, not a rate card.
              </p>
            </div>
            {/* Set as one flowing line of names rather than a cloud of pills: the towns
                are a list to read, and pill shapes at uneven widths just look scattered. */}
            <p className="lg:pt-2 text-[1rem] sm:text-[1.05rem] leading-[2] tracking-[-0.005em]">
              {areas.map((a: any, i: number) => (
                <span key={a.id}>
                  <a
                    href={`${siteBase}/areas/${a.slug}`}
                    className="kd-area transition-colors duration-200"
                    style={{ color: INK }}
                  >
                    {a.name}
                  </a>
                  {i < areas.length - 1 && (
                    <span aria-hidden="true" className="inline-block align-middle mx-3 h-[5px] w-[5px] rounded-[1px] rotate-45" style={{ backgroundColor: GREEN }}/>
                  )}
                </span>
              ))}
            </p>
          </div>
        </section>
      )}

      {/* 08 — FAQ */}
      {faqs.length > 0 && (
        <section className="py-14 sm:py-20" style={{ backgroundColor: OFF_WHITE }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-9">
              <Heading>Before|you ask.</Heading>
            </div>
            <div className="max-w-3xl divide-y" style={{ borderColor: "#E6EAE2" }}>
              {faqs.map((f: any) => (
                <details key={f.id} className="group py-6">
                  <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
                    <span className="text-[17px] font-medium leading-snug" style={{ color: INK }}>{f.question}</span>
                    <span className="mt-1 flex-shrink-0 transition-transform group-open:rotate-45" style={{ color: GREEN_DEEP }}>
                      <Icon d="M12 5v14M5 12h14" className="w-5 h-5" color={GREEN_DEEP} strokeWidth={1.8}/>
                    </span>
                  </summary>
                  <p className="mt-4 text-[15.5px] leading-relaxed max-w-2xl" style={{ color: GREY }}>{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <JsonLd data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f: any) => ({
              "@type": "Question", name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }}/>
        </section>
      )}

      <QuoteCTA tenantSlug={tenantSlug} tenant={tenant} settings={settings}/>
    </Shell>
  );
}

function ServicesPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const { data: servicesData } = useListPublicServices(tenantSlug);
  const services = ((servicesData as any[]) || []);
  const landscaping = services.filter(s => !isGroundworks(s));
  const groundworks = services.filter(isGroundworks);
  const isSplit = landscaping.length > 0 && groundworks.length > 0;

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO
        title={`Services | ${tenant?.name || ""}`}
        description={`Landscaping and groundworks services${tenant?.city ? ` in ${tenant.city} and across Essex` : ""}.`}
        siteName={tenant?.name}
      />
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Services", url: `${origin}${siteBase}/services` },
      ]}/>
      <PageHead title="Services" intro="Everything from the excavation and drainage through to the planting and the final sweep-up."/>

      <section className="py-16 sm:py-20">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          {isSplit ? (
            <div className="space-y-20">
              {[["Landscaping", landscaping], ["Groundworks", groundworks]].map(([label, list]) => (
                <div key={label as string}>
                  <div className="pb-5 mb-10 border-b-2" style={{ borderColor: INK }}>
                    <h2 className="kd-display text-[1.05rem] sm:text-[1.2rem] font-semibold uppercase tracking-[0.02em] leading-none" style={{ color: INK }}>
                      {label as string}
                    </h2>
                  </div>
                  <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-3">
                    {(list as any[]).map(s => <ServiceCard key={s.id} service={s} tenantSlug={tenantSlug}/>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(s => <ServiceCard key={s.id} service={s} tenantSlug={tenantSlug}/>)}
            </div>
          )}
        </div>
      </section>

      <QuoteCTA tenantSlug={tenantSlug} tenant={tenant} settings={settings}/>
    </Shell>
  );
}

function ServiceDetailPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const { data: service, isLoading } = useGetPublicService(tenantSlug, slug);
  const { data: servicesData } = useListPublicServices(tenantSlug);
  const s = service as any;
  const related = ((servicesData as any[]) || []).filter(x => x.slug !== slug).slice(0, 3);

  if (!isLoading && !s) {
    return (
      <Shell tenantSlug={tenantSlug}>
        <PageSEO title="Not found" description="" noindex siteName={tenant?.name}/>
        <PageHead title="We couldn't find that service." intro="It may have moved or been renamed."/>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-24"><Btn href={`${siteBase}/services`}>All services</Btn></div>
      </Shell>
    );
  }

  const benefits = ((s?.benefits as string[]) || []).filter(Boolean);
  const steps = ((s?.processSteps as { title: string; description: string }[]) || []).filter(Boolean);

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO
        title={s?.seoTitle || `${s?.name || "Service"}${tenant?.city ? ` in ${tenant.city}` : ""} | ${tenant?.name || ""}`}
        description={s?.seoDescription || s?.tagline || ""}
        image={s?.heroImageUrl}
        siteName={tenant?.name}
      />
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Services", url: `${origin}${siteBase}/services` },
        { name: s?.name || "Service", url: `${origin}${siteBase}/services/${slug}` },
      ]}/>
      {s && (
        <JsonLd data={{
          "@context": "https://schema.org", "@type": "Service",
          name: s.name, description: s.tagline || s.description || undefined,
          provider: { "@type": "HomeAndConstructionBusiness", name: tenant?.name },
          ...(s.heroImageUrl ? { image: { "@type": "ImageObject", url: `${origin}${s.heroImageUrl}`, caption: s.name } } : {}),
        }}/>
      )}

      <PageHead title={s?.name || ""} intro={s?.tagline || undefined}/>

      {s?.heroImageUrl && (
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 -mt-4 mb-16">
          <div className="aspect-[16/7] overflow-hidden rounded-xl" style={{ backgroundColor: PALE }}>
            <img src={s.heroImageUrl} alt={s.name} className="w-full h-full object-cover" fetchPriority="high"/>
          </div>
        </div>
      )}

      <section className="pb-20">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 grid gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            {(s?.content || s?.description) && (
              <div className="text-[17px] leading-[1.75] space-y-5 max-w-2xl" style={{ color: GREY }}>
                {String(s.content || s.description).split("\n").filter(Boolean).map((p: string, i: number) => <p key={i}>{p}</p>)}
              </div>
            )}

            {benefits.length > 0 && (
              <div className="mt-14">
                <SectionLabel>What's included</SectionLabel>
                <ul className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2 mt-2">
                  {benefits.map(b => (
                    <li key={b} className="flex gap-3 text-[15.5px] leading-snug" style={{ color: INK }}>
                      <CheckIcon className="w-4 h-4 mt-1 flex-shrink-0" color={GREEN_DEEP}/>{b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {steps.length > 0 && (
              <div className="mt-14">
                <SectionLabel>How we do it</SectionLabel>
                <ol className="mt-2 divide-y" style={{ borderColor: "#E6EAE2" }}>
                  {steps.map((st, i) => (
                    <li key={st.title} className="flex gap-6 py-6">
                      <span className="text-[13px] font-semibold tabular-nums pt-1 flex-shrink-0" style={{ color: GREEN_DEEP }}>{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <h3 className="text-[17px] font-semibold mb-1.5" style={{ color: INK }}>{st.title}</h3>
                        <p className="text-[15px] leading-relaxed" style={{ color: GREY }}>{st.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {isGroundworks(s || {}) === false && (
              <div className="mt-16 rounded-xl p-8 sm:p-10" style={{ backgroundColor: OFF_WHITE }}>
                <h3 className="text-2xl font-semibold tracking-[-0.02em] mb-8" style={{ color: INK }}>What goes in before the finish.</h3>
                <BuildUpDiagram/>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-xl p-8" style={{ backgroundColor: INK }}>
              <h3 className="text-xl font-semibold text-white tracking-[-0.01em]">Get a price for {s?.name?.toLowerCase() || "this work"}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                Send photos with your enquiry and we can often quote without visiting.
              </p>
              <Btn href={`${siteBase}/quote`} className="mt-6 w-full">Get a free quote</Btn>
              {(settings?.phone || tenant?.phone) && (
                <a href={`tel:${settings?.phone || tenant?.phone}`} className="mt-3 flex items-center justify-center gap-2 py-3 text-[14px] font-semibold rounded-full border w-full" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#FFFFFF" }}>
                  <PhoneIcon color={GREEN}/>{settings?.phone || tenant?.phone}
                </a>
              )}
            </div>

            {related.length > 0 && (
              <div className="mt-10">
                <SectionLabel>Related</SectionLabel>
                <ul className="space-y-1 mt-1">
                  {related.map(r => (
                    <li key={r.id}>
                      <a href={`${siteBase}/services/${r.slug}`} className="flex items-center justify-between gap-4 py-3.5 border-b text-[15px] font-medium group" style={{ borderColor: "#E6EAE2", color: INK }}>
                        {r.name}
                        <ArrowIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" color={GREEN_DEEP}/>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>

      <QuoteCTA tenantSlug={tenantSlug} tenant={tenant} settings={settings}/>
    </Shell>
  );
}

function ProjectsPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const { data: caseStudiesData } = useListPublicCaseStudies(tenantSlug);
  const projects = ((caseStudiesData as any[]) || []);

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`Projects | ${tenant?.name || ""}`} description="Recent landscaping and groundworks projects." siteName={tenant?.name}/>
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Projects", url: `${origin}${siteBase}/projects` },
      ]}/>
      <PageHead title="Projects" intro="Finished work, with what was actually involved."/>

      <section className="py-16 sm:py-20">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          {projects.length === 0 ? (
            <p className="text-[17px]" style={{ color: GREY }}>Project write-ups are on their way.</p>
          ) : (
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p: any) => (
                <a key={p.id} href={`${siteBase}/projects/${p.slug}`} className="group block">
                  <div className="aspect-[4/3] overflow-hidden rounded-lg mb-4" style={{ backgroundColor: PALE }}>
                    {p.heroImageUrl && <img src={p.heroImageUrl} alt={p.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"/>}
                  </div>
                  {p.location && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: GREEN_DEEP }}>{p.location}</p>}
                  <h2 className="text-lg font-semibold tracking-[-0.01em]" style={{ color: INK }}>{p.title}</h2>
                  {p.tagline && <p className="text-sm leading-relaxed mt-1.5" style={{ color: GREY }}>{p.tagline}</p>}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <QuoteCTA tenantSlug={tenantSlug} tenant={tenant} settings={settings}/>
    </Shell>
  );
}

function AreasPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const { data: areasData } = useListPublicAreas(tenantSlug);
  const areas = ((areasData as any[]) || []);

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`Areas we cover | ${tenant?.name || ""}`} description={`Landscaping and groundworks across ${tenant?.city || "Essex"} and the surrounding towns.`} siteName={tenant?.name}/>
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Areas", url: `${origin}${siteBase}/areas` },
      ]}/>
      <PageHead title="Areas we cover" intro="Ground conditions change town to town round here — which is why we quote on what's under your garden, not a rate card."/>

      <section className="py-16 sm:py-20">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          {areas.length === 0 ? (
            <p className="text-[17px]" style={{ color: GREY }}>Coverage details coming soon.</p>
          ) : (
            <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((a: any) => (
                <a key={a.id} href={`${siteBase}/areas/${a.slug}`} className="flex items-center justify-between gap-4 py-5 border-b group" style={{ borderColor: "#E6EAE2" }}>
                  <div>
                    <span className="text-[17px] font-medium" style={{ color: INK }}>{a.name}</span>
                    {a.county && <span className="text-[13px] ml-2" style={{ color: GREY }}>{a.county}</span>}
                  </div>
                  <ArrowIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" color={GREEN_DEEP}/>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <QuoteCTA tenantSlug={tenantSlug} tenant={tenant} settings={settings}/>
    </Shell>
  );
}

function AboutPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`About | ${tenant?.name || ""}`} description={settings?.aboutText?.slice(0, 155) || ""} siteName={tenant?.name}/>
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "About", url: `${origin}${siteBase}/about` },
      ]}/>
      <PageHead title={`About ${tenant?.name || "us"}`}/>

      <section className="pb-20">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 grid gap-14 lg:grid-cols-2 lg:gap-20 items-start">
          <div className="text-[17px] leading-[1.75] space-y-5" style={{ color: GREY }}>
            {(settings?.aboutText || tenant?.description || "").split("\n").filter(Boolean).map((p: string, i: number) => <p key={i}>{p}</p>)}
            <div className="pt-4"><Btn href={`${siteBase}/quote`}>Get a free quote</Btn></div>
          </div>
          {settings?.aboutImageUrl && (
            <div className="aspect-[4/5] overflow-hidden rounded-xl" style={{ backgroundColor: PALE }}>
              <img src={settings.aboutImageUrl} alt={tenant?.name || ""} loading="lazy" className="w-full h-full object-cover"/>
            </div>
          )}
        </div>
      </section>

      <section className="py-20 sm:py-24" style={{ backgroundColor: OFF_WHITE }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mb-9">
            <Heading>The bit you can't see once it's finished.</Heading>
          </div>
          <BuildUpDiagram/>
        </div>
      </section>

      <QuoteCTA tenantSlug={tenantSlug} tenant={tenant} settings={settings}/>
    </Shell>
  );
}

function QuotePage({ tenantSlug }: { tenantSlug: string }) {
  const origin = useSiteOrigin();
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant } = (siteData as any) || {};
  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`Get a free quote | ${tenant?.name || ""}`} description="Tell us about the job and we'll come back with a written quote." siteName={tenant?.name}/>
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Get a quote", url: `${origin}${siteBase}/quote` },
      ]}/>
      <PageHead title="Tell us about the job" intro="The more detail you give us, the closer the first number will be. Photos help most."/>
      <div className="pb-24">
        <QuoteFormSection tenantSlug={tenantSlug} accent={GREEN_DEEP} panel={INK}/>
      </div>
    </Shell>
  );
}

function CalculatorPage({ tenantSlug }: { tenantSlug: string }) {
  const origin = useSiteOrigin();
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant } = (siteData as any) || {};
  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`Cost guide | ${tenant?.name || ""}`} description="Get a ballpark figure before you pick up the phone." siteName={tenant?.name}/>
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Cost guide", url: `${origin}${siteBase}/calculator` },
      ]}/>
      <PageHead title="What it costs" intro="A ballpark before you pick up the phone. Everyone else makes you ring to find out."/>
      <div className="pb-24">
        <PriceCalculatorSection tenantSlug={tenantSlug} accent={GREEN_DEEP} panel={INK}/>
      </div>
    </Shell>
  );
}

function ContactPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const origin = useSiteOrigin();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const mutation = useSubmitContact();
  const [form, setForm] = useState({ senderName: "", senderEmail: "", senderPhone: "", message: "" });
  const [sent, setSent] = useState(false);
  const phone = settings?.phone || tenant?.phone;
  const email = settings?.email || tenant?.email;
  const address = [settings?.address || tenant?.address, settings?.city || tenant?.city].filter(Boolean).join(", ");
  const inputCls = "w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 transition";
  const inputStyle = { borderColor: "#DDE3D6", ["--tw-ring-color" as any]: GREEN_DEEP };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: { ...form, tenantSlug } } as any);
      setSent(true);
      window.scrollTo(0, 0);
    } catch { /* surfaced via mutation.isError below */ }
  };

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`Contact | ${tenant?.name || ""}`} description="Get in touch." siteName={tenant?.name}/>
      <Breadcrumbs trail={[
        { name: "Home", url: `${origin}${siteBase}/` },
        { name: "Contact", url: `${origin}${siteBase}/contact` },
      ]}/>
      <PageHead title="Get in touch"/>

      <section className="pb-24">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-20">
          <div>
            <ul className="space-y-6">
              {phone && (
                <li>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: GREEN_DEEP }}>Phone</p>
                  <a href={`tel:${phone}`} className="text-xl font-semibold" style={{ color: INK }}>{phone}</a>
                </li>
              )}
              {email && (
                <li>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: GREEN_DEEP }}>Email</p>
                  <a href={`mailto:${email}`} className="text-[16px] break-all" style={{ color: INK }}>{email}</a>
                </li>
              )}
              {address && (
                <li>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: GREEN_DEEP }}>Address</p>
                  <p className="text-[16px]" style={{ color: INK }}>{address}</p>
                </li>
              )}
            </ul>
            <div className="mt-10 rounded-xl p-7" style={{ backgroundColor: OFF_WHITE }}>
              <p className="text-[15px] leading-relaxed" style={{ color: GREY }}>
                Chasing a price? The quote form takes photos, which usually means a faster and more accurate number.
              </p>
              <Btn href={`${siteBase}/quote`} className="mt-5">Get a free quote</Btn>
            </div>
          </div>

          <div>
            {sent ? (
              <div className="rounded-xl p-9" style={{ backgroundColor: PALE }}>
                <CheckIcon className="w-8 h-8 mb-4" color={GREEN_DEEP}/>
                <h2 className="text-2xl font-semibold mb-3 tracking-[-0.02em]" style={{ color: INK }}>Message sent.</h2>
                <p className="text-[15.5px] leading-relaxed" style={{ color: GREY }}>Thanks — we'll come back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="kd-name" className="block text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: INK }}>Name</label>
                    <input id="kd-name" required className={inputCls} style={inputStyle} value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })}/>
                  </div>
                  <div>
                    <label htmlFor="kd-phone" className="block text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: INK }}>Phone</label>
                    <input id="kd-phone" type="tel" className={inputCls} style={inputStyle} value={form.senderPhone} onChange={e => setForm({ ...form, senderPhone: e.target.value })}/>
                  </div>
                </div>
                <div>
                  <label htmlFor="kd-email" className="block text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: INK }}>Email</label>
                  <input id="kd-email" type="email" required className={inputCls} style={inputStyle} value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.target.value })}/>
                </div>
                <div>
                  <label htmlFor="kd-message" className="block text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: INK }}>Message</label>
                  <textarea id="kd-message" required rows={6} className={inputCls} style={inputStyle} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}/>
                </div>
                {mutation.isError && (
                  <p className="text-[14px]" style={{ color: "#B3261E" }} role="alert">
                    That didn't send. Please try again, or call us directly.
                  </p>
                )}
                <button type="submit" disabled={mutation.isPending} className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold text-white min-h-[48px] disabled:opacity-60" style={{ backgroundColor: GREEN_DEEP }}>
                  {mutation.isPending ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}

function LegalPage({ tenantSlug, kind }: { tenantSlug: string; kind: "terms" | "privacy" }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const body = kind === "terms" ? settings?.termsContent : settings?.privacyContent;
  const title = kind === "terms" ? "Terms & conditions" : "Privacy policy";
  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title={`${title} | ${tenant?.name || ""}`} description={title} siteName={tenant?.name} noindex/>
      <PageHead title={title}/>
      <section className="pb-24">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          <div className="max-w-3xl text-[16px] leading-[1.8] space-y-5" style={{ color: GREY }}>
            {body
              ? String(body).split("\n").filter(Boolean).map((p: string, i: number) => <p key={i}>{p}</p>)
              : <p>This page is being prepared. Please contact us in the meantime.</p>}
          </div>
        </div>
      </section>
    </Shell>
  );
}

function NotFoundPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant } = (siteData as any) || {};
  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO title="Page not found" description="" siteName={tenant?.name} noindex/>
      <PageHead title="That page doesn't exist." intro="It may have moved, or the link might be out of date."/>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-24 flex flex-wrap gap-3">
        <Btn href={siteBase || "/"}>Back to home</Btn>
        <Btn href={`${siteBase}/services`} variant="outline">See services</Btn>
      </div>
    </Shell>
  );
}

function ScrollToTopOnNavigate() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

// ── app ──────────────────────────────────────────────────────────────────────

export default function LandscapingSiteApp({ forcedSlug, forcedBase, forcedOrigin, ssrPath }: { forcedSlug?: string; forcedBase?: string; forcedOrigin?: string; ssrPath?: string } = {}) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = forcedSlug || params.tenantSlug || "";
  const siteBase = forcedBase !== undefined ? forcedBase : `/site/${tenantSlug}`;

  const { data: rootSiteData } = useGetPublicSite(tenantSlug);
  const { settings: rootSettings, tenant: rootTenant } = (rootSiteData as any) || {};

  useEffect(() => {
    document.querySelectorAll("[data-default-seo]").forEach(el => el.remove());
  }, []);

  useEffect(() => {
    const initial = ((rootTenant?.name || tenantSlug || "T").charAt(0)).toUpperCase();
    const color = rootSettings?.primaryColor || GREEN_DEEP;
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    if (rootSettings?.faviconUrl) {
      link.type = "";
      link.href = rootSettings.faviconUrl;
    } else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="${color}"/><text x="50" y="68" font-family="Arial Black,Arial,sans-serif" font-size="52" font-weight="900" text-anchor="middle" fill="white">${initial}</text></svg>`;
      link.type = "image/svg+xml";
      link.href = "data:image/svg+xml," + encodeURIComponent(svg);
    }
    return () => {
      if (link) { link.type = "image/svg+xml"; link.href = "/favicon.svg"; }
    };
  }, [rootSettings?.faviconUrl, rootSettings?.primaryColor, rootTenant?.name, tenantSlug]);

  useEffect(() => {
    if (rootSettings?.googleAnalyticsId || rootSettings?.googleAdsConversionId) {
      initGoogleTag(rootSettings.googleAnalyticsId, rootSettings.googleAdsConversionId);
    }
  }, [rootSettings?.googleAnalyticsId, rootSettings?.googleAdsConversionId]);

  return (
    <SiteOriginCtx.Provider value={forcedOrigin ?? (typeof window !== "undefined" ? window.location.origin : "")}>
    <SiteBaseCtx.Provider value={siteBase}>
    <WouterRouter base={siteBase} ssrPath={ssrPath}>
      <ScrollToTopOnNavigate />
      <Switch>
        <Route path="/">{() => <HomePage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/services">{() => <ServicesPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/services/:slug">{(p: any) => <ServiceDetailPage tenantSlug={tenantSlug} slug={p.slug}/>}</Route>
        <Route path="/projects">{() => <ProjectsPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/areas">{() => <AreasPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/about">{() => <AboutPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/quote">{() => <QuotePage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/calculator">{() => <CalculatorPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/contact">{() => <ContactPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/terms">{() => <LegalPage tenantSlug={tenantSlug} kind="terms"/>}</Route>
        <Route path="/privacy">{() => <LegalPage tenantSlug={tenantSlug} kind="privacy"/>}</Route>
        <Route>{() => <NotFoundPage tenantSlug={tenantSlug}/>}</Route>
      </Switch>
      <CookieBanner siteBase={siteBase}/>
    </WouterRouter>
    </SiteBaseCtx.Provider>
    </SiteOriginCtx.Provider>
  );
}
