import { Switch, Route, useParams, useLocation, Router as WouterRouter, Link as WouterLink } from "wouter";
import { useGetPublicSite, useListPublicServices, useGetPublicService, useListPublicAreas, useListPublicReviews, useListPublicCaseStudies, useListPublicFaqs, useListPublicBeforeAfter, useSubmitContact, useListPublicPriceItems } from "@workspace/api-client-react";
import { useState, useEffect, useMemo } from "react";
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
  "foundation", "footing", "muck", "sub-base", "subbase", "retaining", "soakaway",
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
function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: onDark ? GREEN : GREEN_DEEP }}>{children}</p>;
}

function Heading({ children, onDark = false, className = "" }: { children: React.ReactNode; onDark?: boolean; className?: string }) {
  return <h2 className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold leading-[1.1] tracking-[-0.02em] ${className}`} style={{ color: onDark ? "#FFFFFF" : INK }}>{children}</h2>;
}

function Btn({ href, children, variant = "solid", className = "" }: { href: string; children: React.ReactNode; variant?: "solid" | "outline" | "ghost"; className?: string }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-200 min-h-[48px]";
  const styles = variant === "solid"
    ? { backgroundColor: GREEN_DEEP, color: "#FFFFFF" }
    : variant === "outline"
      ? { border: `1.5px solid ${INK}`, color: INK }
      : { border: "1.5px solid rgba(255,255,255,0.35)", color: "#FFFFFF" };
  return <a href={href} className={`${base} hover:opacity-85 ${className}`} style={styles}>{children}</a>;
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
  const total = layers.reduce((sum, l) => sum + l.height, 0);
  const textColor = onDark ? "#FFFFFF" : INK;
  const mutedColor = onDark ? "rgba(255,255,255,0.62)" : GREY;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 items-center">
      {/* The section itself */}
      <div className="relative">
        <svg viewBox={`0 0 320 ${total + 24}`} className="w-full h-auto" role="img" aria-label="Cross-section of a hard landscaping build-up showing each layer and its depth">
          <defs>
            <clipPath id="kd-section-clip">
              <rect x="0" y="10" width="320" height={total} rx="4"/>
            </clipPath>
          </defs>
          <g clipPath="url(#kd-section-clip)">
            {layers.reduce<{ y: number; nodes: React.ReactNode[] }>((acc, l, i) => {
              const dim = active !== null && active !== i;
              acc.nodes.push(
                <g key={l.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                  <rect
                    x="0" y={acc.y} width="320" height={l.height}
                    fill={l.fill}
                    opacity={dim ? 0.4 : 1}
                    style={{ transition: "opacity 200ms" }}
                  />
                  {/* texture for the granular layers */}
                  {(i === 2 || i === 4) && Array.from({ length: 26 }).map((_, d) => (
                    <circle
                      key={d}
                      cx={((d * 61) % 312) + 4}
                      cy={acc.y + 6 + ((d * 23) % Math.max(1, l.height - 12))}
                      r={i === 2 ? 2.4 : 1.5}
                      fill="#FFFFFF"
                      opacity={dim ? 0.05 : 0.16}
                    />
                  ))}
                </g>
              );
              acc.y += l.height;
              return acc;
            }, { y: 10, nodes: [] }).nodes}
          </g>
          {/* fall indicator across the finish layer */}
          <path d="M8 8 L312 14" stroke={onDark ? "#FFFFFF" : INK} strokeWidth="1.25" strokeDasharray="4 4" opacity="0.55" fill="none"/>
          <text x="8" y="6" fontSize="8" fill={onDark ? "#FFFFFF" : INK} opacity="0.75" fontFamily="ui-sans-serif, system-ui, sans-serif">Fall to drainage — 1:80</text>
        </svg>
      </div>

      {/* Labels */}
      <ul className="space-y-0">
        {layers.map((l, i) => (
          <li
            key={l.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="flex gap-4 py-4 border-b transition-colors"
            style={{ borderColor: onDark ? "rgba(255,255,255,0.12)" : "#E3E7DF", opacity: active !== null && active !== i ? 0.5 : 1 }}
          >
            <span className="mt-1.5 h-3.5 w-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: l.fill }} aria-hidden="true"/>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[15px] font-semibold" style={{ color: textColor }}>{l.label}</span>
                {l.depth !== "—" && (
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: onDark ? GREEN : GREEN_DEEP }}>{l.depth}</span>
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
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/areas", label: "Areas" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function KDNav({ tenant, settings, tenantSlug }: { tenant: any; settings: any; tenantSlug: string }) {
  const siteBase = useSiteBase();
  const [open, setOpen] = useState(false);
  const logo = settings?.logoUrl || tenant?.logoUrl;
  const phone = settings?.phone || tenant?.phone;
  const { data: priceItems } = useListPublicPriceItems(tenantSlug || "");
  const links = ((priceItems as any[]) || []).length > 0
    ? [...NAV_LINKS.slice(0, 3), { href: "/calculator", label: "Cost Guide" }, ...NAV_LINKS.slice(3)]
    : NAV_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: "rgba(255,255,255,0.94)", borderColor: "#E6EAE2", backdropFilter: "blur(10px)" }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 flex items-center justify-between h-[76px] gap-6">
        <a href={siteBase || "/"} className="flex items-center flex-shrink-0" aria-label={tenant?.name || "Home"}>
          {logo
            ? <img src={logo} alt={tenant?.name || "Logo"} className="h-10 w-auto" width={200} height={80}/>
            : <span className="text-lg font-semibold tracking-[-0.01em]" style={{ color: INK }}>{tenant?.name || ""}</span>}
        </a>

        <nav className="hidden lg:flex items-center gap-9">
          {links.map(l => (
            <a key={l.href} href={`${siteBase}${l.href}`} className="text-[13.5px] font-medium transition-opacity hover:opacity-60" style={{ color: INK }}>{l.label}</a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-6 flex-shrink-0">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-[13.5px] font-semibold transition-opacity hover:opacity-70" style={{ color: INK }}>
              <PhoneIcon color={GREEN_DEEP}/>{phone}
            </a>
          )}
          <Btn href={`${siteBase}/quote`} className="!px-6 !py-2.5 !min-h-0">Get a quote</Btn>
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
              ? <img src={settings.logoUrl} alt={tenant?.name || "Logo"} className="h-10 w-auto mb-5" width={200} height={80}/>
              : <div className="text-lg font-semibold mb-5 text-white">{tenant?.name}</div>}
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
                    <a href={`${siteBase}/services/${s.slug}`} className="text-[13.5px] transition-opacity hover:opacity-100" style={{ color: "rgba(255,255,255,0.68)" }}>{s.name}</a>
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
                    <a href={`${siteBase}/areas/${a.slug}`} className="text-[13.5px] transition-opacity hover:opacity-100" style={{ color: "rgba(255,255,255,0.68)" }}>{a.name}</a>
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
            <a href={`${siteBase}/privacy`} className="text-[12.5px] transition-opacity hover:opacity-100" style={{ color: "rgba(255,255,255,0.45)" }}>Privacy</a>
            <a href={`${siteBase}/terms`} className="text-[12.5px] transition-opacity hover:opacity-100" style={{ color: "rgba(255,255,255,0.45)" }}>Terms</a>
            <a href="/" className="text-[12.5px] transition-opacity hover:opacity-100" style={{ color: "rgba(255,255,255,0.45)" }}>Powered by LaunchFlow</a>
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
function PageHead({ crumb, title, intro }: { crumb?: string; title: string; intro?: string }) {
  return (
    <section className="pt-16 pb-12 sm:pt-24 sm:pb-16" style={{ backgroundColor: OFF_WHITE }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
        {crumb && <Eyebrow>{crumb}</Eyebrow>}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-[-0.028em] max-w-4xl" style={{ color: INK }}>{title}</h1>
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFFFFF" }}>
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
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <h3 className="text-lg font-semibold tracking-[-0.01em] mb-1.5" style={{ color: INK }}>{service.name}</h3>
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
    <section className="py-20 sm:py-28" style={{ backgroundColor: INK }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 text-center">
        <Eyebrow onDark>Next step</Eyebrow>
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
  const headline = settings?.heroHeadline || `Landscaping & groundworks${tenant?.city ? ` in ${tenant.city}` : ""}`;
  const sub = settings?.heroSubheadline || "From the dig and the drainage to the finished garden — one contractor, start to finish.";

  return (
    <Shell tenantSlug={tenantSlug}>
      <PageSEO
        title={settings?.seoTitle || `${tenant?.name || "Landscaping & Groundworks"}${tenant?.city ? ` | ${tenant.city}` : ""}`}
        description={settings?.seoDescription || sub}
        image={heroImage}
        siteName={tenant?.name}
      />
      <Breadcrumbs trail={[{ name: "Home", url: `${origin}${siteBase}/` }]}/>

      {/* 01 — HERO. Full-bleed photography; the work is the product. */}
      <section className="relative" style={{ backgroundColor: INK }}>
        {heroImage && (
          <>
            <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high"/>
            <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(30,31,29,0.92) 0%, rgba(30,31,29,0.74) 46%, rgba(30,31,29,0.34) 100%)" }}/>
          </>
        )}
        <div className="relative max-w-[1240px] mx-auto px-5 sm:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <Eyebrow onDark>{tenant?.city ? `${tenant.city} & Essex` : "Essex"}</Eyebrow>
            <h1 className="text-4xl sm:text-5xl lg:text-[4.25rem] font-semibold leading-[1.03] tracking-[-0.03em] text-white">{headline}</h1>
            <p className="mt-7 text-lg sm:text-xl leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.78)" }}>{sub}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Btn href={`${siteBase}/quote`}>{settings?.ctaText || "Get a free quote"}</Btn>
              <Btn href={`${siteBase}/projects`} variant="ghost">See our work</Btn>
            </div>
          </div>
        </div>
      </section>

      <TrustStrip settings={settings}/>

      {/* 02 — SERVICES, split into the two sides of the business */}
      {services.length > 0 && (
        <section className="py-20 sm:py-28">
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-14">
              <Eyebrow>What we do</Eyebrow>
              <Heading>Two halves of the same job.</Heading>
              <p className="mt-5 text-[17px] leading-relaxed" style={{ color: GREY }}>
                Most gardens need work below ground before anything goes on top. Doing both means
                no gap between trades, and nobody to blame when the levels are wrong.
              </p>
            </div>

            {isSplit ? (
              <div className="grid gap-14 lg:grid-cols-2">
                {[["Landscaping", landscaping], ["Groundworks", groundworks]].map(([label, list]) => (
                  <div key={label as string}>
                    <div className="flex items-center gap-3 pb-5 mb-8 border-b" style={{ borderColor: "#E6EAE2" }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GREEN_DEEP }}/>
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: INK }}>{label as string}</h3>
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
        <section className="py-20 sm:py-28" style={{ backgroundColor: OFF_WHITE }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-12">
              <Eyebrow>Before & after</Eyebrow>
              <Heading>Drag to see the difference.</Heading>
            </div>
            <BeforeAfterGallery items={beforeAfter} accent={GREEN_DEEP}/>
          </div>
        </section>
      )}

      {/* 04 — THE SIGNATURE BLOCK: what's underneath */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: INK }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mb-14">
            <Eyebrow onDark>What's underneath</Eyebrow>
            <Heading onDark>Anyone can lay a nice patio. It's the six inches below it that decide whether it's still flat in five years.</Heading>
            <p className="mt-6 text-[17px] leading-relaxed" style={{ color: "rgba(255,255,255,0.66)" }}>
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
        <section className="py-20 sm:py-28">
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
              <div className="max-w-xl">
                <Eyebrow>Recent work</Eyebrow>
                <Heading>Jobs we've finished.</Heading>
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
        <section className="py-20 sm:py-28" style={{ backgroundColor: OFF_WHITE }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-12">
              <Eyebrow>Reviews</Eyebrow>
              <Heading>What customers said.</Heading>
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
        <section className="py-20 sm:py-28">
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8 grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <Eyebrow>Where we work</Eyebrow>
              <Heading>Covering {tenant?.city || "Essex"} and the surrounding towns.</Heading>
              <p className="mt-5 text-[17px] leading-relaxed" style={{ color: GREY }}>
                Ground conditions change street to street around here. We quote on what's actually
                under your garden, not a rate card.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 lg:pt-3">
              {areas.map((a: any) => (
                <a key={a.id} href={`${siteBase}/areas/${a.slug}`} className="inline-flex items-center rounded-full px-4 py-2 text-[13.5px] font-medium border transition-colors hover:bg-white" style={{ borderColor: "#DDE3D6", color: INK, backgroundColor: OFF_WHITE }}>
                  {a.name}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 08 — FAQ */}
      {faqs.length > 0 && (
        <section className="py-20 sm:py-28" style={{ backgroundColor: OFF_WHITE }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-12">
              <Eyebrow>Questions</Eyebrow>
              <Heading>Before you ask.</Heading>
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
      <PageHead crumb="What we do" title="Services" intro="Everything from the excavation and drainage through to the planting and the final sweep-up."/>

      <section className="py-16 sm:py-20">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8">
          {isSplit ? (
            <div className="space-y-20">
              {[["Landscaping", landscaping], ["Groundworks", groundworks]].map(([label, list]) => (
                <div key={label as string}>
                  <div className="flex items-center gap-3 pb-5 mb-10 border-b" style={{ borderColor: "#E6EAE2" }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GREEN_DEEP }}/>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: INK }}>{label as string}</h2>
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

      <PageHead crumb="Service" title={s?.name || ""} intro={s?.tagline || undefined}/>

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
                <Eyebrow>What's included</Eyebrow>
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
                <Eyebrow>How we do it</Eyebrow>
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
                <Eyebrow>The build-up</Eyebrow>
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
                <Eyebrow>Related</Eyebrow>
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
      <PageHead crumb="Portfolio" title="Projects" intro="Finished work, with what was actually involved."/>

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
      <PageHead crumb="Coverage" title="Areas we cover" intro="Ground conditions change town to town round here — which is why we quote on what's under your garden, not a rate card."/>

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
      <PageHead crumb="About" title={`About ${tenant?.name || "us"}`}/>

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
          <div className="max-w-2xl mb-12">
            <Eyebrow>Our standard</Eyebrow>
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
      <PageHead crumb="Free quote" title="Tell us about the job" intro="The more detail you give us, the closer the first number will be. Photos help most."/>
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
      <PageHead crumb="Pricing" title="What it costs" intro="A ballpark before you pick up the phone. Everyone else makes you ring to find out."/>
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
      <PageHead crumb="Contact" title="Get in touch"/>

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
