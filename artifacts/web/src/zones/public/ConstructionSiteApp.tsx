import { Switch, Route, useParams, Router as WouterRouter, Link as WouterLink } from "wouter";
import { useGetPublicSite, useListPublicServices, useGetPublicService, useListPublicAreas, useListPublicReviews, useSubmitContact } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { initGoogleTag } from "./analytics";
import { SiteBaseCtx, SiteOriginCtx, useSiteBase, PageSEO, JsonLd, CookieBanner, QuoteFormSection } from "./PublicSiteApp";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCTION SITE TEMPLATE (tenant.industry === 'construction')
//
// Bespoke design built from the AMO Services mockups — NOT a re-skin of the
// rendering template. Light/white core, lime-green brand accents, dark
// green-tinted charcoal panels, line-icon service cards. All content comes
// from the tenant's DB rows (tenant, settings, services, areas, reviews);
// no business facts are hardcoded here beyond neutral fallback copy.
// ─────────────────────────────────────────────────────────────────────────────

const GREEN = "#7DB93F";       // brand green (sampled from logo) — icons, decorative, on-dark accents
const GREEN_MID = "#6BA332";   // large headline accent words on white (≥3:1)
const GREEN_DEEP = "#4F7A26";  // buttons + small accent text on white (≥4.5:1)
const INK = "#161B12";         // dark panels / footer (green-tinted charcoal)
const TEXT = "#232B20";
const MUTED = "#5C6657";
const LIGHT = "#F5F8F1";

// ── Icons (inline stroke SVGs, keyed by service slug) ────────────────────────

function Icon({ d, className = "w-8 h-8", color = GREEN_DEEP, strokeWidth = 1.6 }: { d: string; className?: string; color?: string; strokeWidth?: number }) {
  return <svg className={className} style={{ color }} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d}/></svg>;
}

const ICON_PATHS: Record<string, string> = {
  "new-builds": "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01",
  "commercial": "M3 21h18M6 21V5a1 1 0 011-1h6a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M9 8h.01M9 12h.01M9 16h.01M17 13h.01M17 17h.01",
  "home-renovations": "M3 21h18M4 21V10l8-6 8 6v11M14.5 21v-4.5a1 1 0 00-1-1h-3a1 1 0 00-1 1V21M2 10l10-7.5L22 10",
  "loft-conversions": "M3 21h18M4 21V11L12 4l8 7v10M9 11h6v4H9zM12 4v3",
  "electrical-services": "M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12L13 2z",
  "kitchens": "M3 10h18M3 10v9a1 1 0 001 1h16a1 1 0 001-1v-9M3 10V6a1 1 0 011-1h16a1 1 0 011 1v4M8 14h.01M8 5V3M16 5V3",
  "bricklaying": "M3 8h18M3 12h18M3 16h18M3 8v12h18V8M7.5 8v4M12 12v4M16.5 8v4M7.5 16v4M16.5 16v4M3 8l2-4h14l2 4",
};
const DEFAULT_ICON = "M11.42 15.17L17.25 21A2.65 2.65 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085";

function ServiceIcon({ slug, className = "w-9 h-9", color = GREEN_DEEP }: { slug?: string; className?: string; color?: string }) {
  return <Icon d={ICON_PATHS[slug || ""] || DEFAULT_ICON} className={className} color={color}/>;
}

const PinIcon = () => <Icon d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" className="w-4 h-4" color={GREEN_DEEP}/>;
const PhoneIcon = ({ color = "currentColor" }: { color?: string }) => <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
const CheckCircle = ({ className = "w-5 h-5", color = GREEN }: { className?: string; color?: string }) => <svg className={className} style={{ color }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/></svg>;
const Star = () => <svg className="w-4 h-4" style={{ color: GREEN }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.077 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>;

// ── Shared chrome ────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/services", label: "Our Services" },
  { href: "/contact", label: "Contact Us" },
];

function CNav({ tenant, settings }: { tenant: any; settings: any }) {
  const siteBase = useSiteBase();
  const [open, setOpen] = useState(false);
  const logo = settings?.logoUrl || tenant?.logoUrl;
  const phone = settings?.phone || tenant?.phone;
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20 gap-4">
        <a href={siteBase || "/"} className="flex items-center flex-shrink-0">
          {logo
            ? <img src={logo} alt={tenant?.name || "Logo"} className="h-12 w-auto" width={214} height={120}/>
            : <span className="text-xl font-extrabold" style={{ color: TEXT }}>{tenant?.name || ""}</span>}
        </a>
        <nav className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={`${siteBase}${l.href}`} className="text-sm font-semibold transition-colors hover:opacity-70" style={{ color: TEXT }}>{l.label}</a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-5 flex-shrink-0">
          {(tenant?.address || tenant?.city) && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: MUTED }}><PinIcon/>{tenant?.address || tenant?.city}</span>
          )}
          <a href={`${siteBase}/quote`} className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN_DEEP }}>Get A Quote</a>
        </div>
        <button className="lg:hidden p-2" onClick={() => setOpen(v => !v)} aria-label="Toggle menu" aria-expanded={open}>
          <svg className="w-6 h-6" style={{ color: TEXT }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24">
            {open ? <path d="M6 6l12 12M6 18L18 6"/> : <path d="M4 7h16M4 12h16M4 17h16"/>}
          </svg>
        </button>
      </div>
      {open && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 sm:px-6 py-4 space-y-1">
          {NAV_LINKS.map(l => (
            <WouterLink key={l.href} href={l.href} className="block py-2.5 text-sm font-semibold" style={{ color: TEXT }} onClick={() => setOpen(false)}>{l.label}</WouterLink>
          ))}
          <WouterLink href="/quote" className="block py-2.5 text-sm font-bold" style={{ color: GREEN_DEEP }} onClick={() => setOpen(false)}>Get A Quote</WouterLink>
          {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 py-2.5 text-sm font-semibold" style={{ color: TEXT }}><PhoneIcon color={GREEN_DEEP}/>{phone}</a>}
        </div>
      )}
    </header>
  );
}

function CMobileBar({ phone }: { phone?: string }) {
  const siteBase = useSiteBase();
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      {phone && (
        <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold" style={{ backgroundColor: INK, color: "white" }}><PhoneIcon color={GREEN}/>Call Us</a>
      )}
      <a href={`${siteBase}/quote`} className="flex-1 flex items-center justify-center py-4 text-sm font-bold text-white" style={{ backgroundColor: GREEN_DEEP }}>Get A Free Quote</a>
    </div>
  );
}

function CFooter({ tenant, settings, tenantSlug }: { tenant: any; settings: any; tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: services } = useListPublicServices(tenantSlug);
  const phone = settings?.phone || tenant?.phone;
  const email = settings?.email || tenant?.email;
  return (
    <footer style={{ backgroundColor: INK }} className="text-slate-300 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-4">
          <p className="text-lg font-extrabold text-white">{tenant?.name || ""}</p>
          <p className="text-sm leading-relaxed text-slate-400">{tenant?.description || settings?.aboutText || ""}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Links</p>
          <div className="space-y-2.5">
            {[...NAV_LINKS, { href: "/quote", label: "Request A Quote" }].map(l => (
              <a key={l.href} href={`${siteBase}${l.href}`} className="block text-sm text-slate-400 hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-white uppercase tracking-wider mb-4">Our Services</p>
          <div className="space-y-2.5">
            {((services as any[]) || []).map(s => (
              <a key={s.slug} href={`${siteBase}/services/${s.slug}`} className="block text-sm text-slate-400 hover:text-white transition-colors">{s.name}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-white uppercase tracking-wider mb-4">Get In Touch</p>
          <div className="space-y-3 text-sm">
            {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"><PhoneIcon color={GREEN}/>{phone}</a>}
            {email && <a href={`mailto:${email}`} className="block text-slate-400 hover:text-white transition-colors break-all">{email}</a>}
            {(tenant?.address || tenant?.city) && <p className="text-slate-400">{tenant?.address || tenant?.city}</p>}
            <a href={`${siteBase}/quote`} className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-bold text-white mt-2 transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN_DEEP }}>Get A Free Quote</a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {tenant?.name || ""}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href={`${siteBase}/terms`} className="hover:text-slate-300 transition-colors">Terms</a>
            <a href={`${siteBase}/privacy`} className="hover:text-slate-300 transition-colors">Privacy</a>
            <span>Powered by LaunchFlow</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Interior-page shell: nav + compact dark hero band + content + footer. */
function CShell({ tenantSlug, title, crumb, subtitle, children }: { tenantSlug: string; title: string; crumb?: string; subtitle?: string; children: React.ReactNode }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <div className="bg-white">
      <CNav tenant={tenant} settings={settings}/>
      <section style={{ backgroundColor: INK }} className="relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: GREEN }}/>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>
            <a href={siteBase || "/"} className="hover:underline">Home</a> <span className="text-slate-500">/</span> {crumb || title}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white max-w-3xl">{title}</h1>
          {subtitle && <p className="mt-4 text-slate-300 max-w-2xl leading-relaxed">{subtitle}</p>}
        </div>
      </section>
      {children}
      <CFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <CMobileBar phone={settings?.phone || tenant?.phone}/>
    </div>
  );
}

// ── Home page ────────────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  { icon: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Quality", sub: "Workmanship" },
  { icon: "M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z", label: "Local &", sub: "Reliable" },
  { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4", label: "Fully Insured &", sub: "Experienced" },
  { icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6", label: "Complete Building", sub: "Solutions" },
];

const FACT_ITEMS = [
  { icon: "M8 2v3M16 2v3M3.5 9h17M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z", label: "Established 2011", sub: "Companies House registered" },
  { icon: "M3 21h18M6 21V5a1 1 0 011-1h6a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M9 8h.01M9 12h.01M9 16h.01", label: "Residential & Commercial", sub: "Projects of every size" },
  { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", label: "Fully Insured", sub: "For your peace of mind" },
  { icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 15l2 2 4-4", label: "Free Quotes", sub: "No-obligation pricing" },
];

const PROCESS = [
  { n: 1, title: "Tell Us About Your Project", body: "Send the details through the quote form — or call us — and describe what you want to build or improve." },
  { n: 2, title: "Site Visit & Survey", body: "We visit the property, assess the site and talk through options, timescales and practicalities." },
  { n: 3, title: "Detailed Written Quote", body: "You receive a clear, itemised quotation for the works — no vague estimates." },
  { n: 4, title: "Build, Finish & Handover", body: "One team manages the job from first fix to final handover, keeping you informed throughout." },
];

function HomePage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings, featuredServices, featuredReviews } = (siteData as any) || {};
  const { data: areas } = useListPublicAreas(tenantSlug);
  const phone = settings?.phone || tenant?.phone;
  const services = (featuredServices as any[]) || [];
  const reviews = (featuredReviews as any[]) || [];
  const areaNames = ((areas as any[]) || []).map(a => a.name);

  return (
    <div className="bg-white">
      <PageSEO
        title={settings?.seoTitle || `${tenant?.name || "Construction Services"} | Construction Company`}
        description={settings?.seoDescription || tenant?.description || ""}
        siteName={tenant?.name}
        image={settings?.heroImageUrl || settings?.logoUrl}/>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "GeneralContractor",
        name: tenant?.name || "",
        telephone: phone || undefined,
        address: tenant?.address ? { "@type": "PostalAddress", addressLocality: tenant?.city || undefined, addressRegion: "Essex", streetAddress: tenant.address } : undefined,
        url: tenant?.website || undefined,
        foundingDate: "2011",
      }}/>
      <CNav tenant={tenant} settings={settings}/>

      {/* Hero — white left, house photo right (image carries its own white fade) */}
      <section className="relative overflow-hidden bg-white">
        {settings?.heroImageUrl && (
          <>
            <img src={settings.heroImageUrl} alt="" aria-hidden="true" fetchPriority="high"
              className="absolute inset-y-0 right-0 h-full w-full lg:w-[68%] object-cover object-right opacity-25 lg:opacity-100"/>
            {/* White fade so the text side stays clean and the image seam blends — the hero
                photo is full-bleed (no baked-in gradient), so this overlay does the blending. */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/10 lg:via-white/45 lg:to-transparent"/>
          </>
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-40 sm:pb-44 lg:pt-24 lg:pb-52">
          <div className="max-w-xl">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-5" style={{ color: GREEN_DEEP }}>Construction &amp; Building Services</p>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold leading-[1.05] tracking-tight" style={{ color: TEXT }}>
              Building Better <span style={{ color: GREEN_MID }}>Spaces.</span><br/>
              Delivering <span style={{ color: GREEN_MID }}>Lasting Value.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-md" style={{ color: MUTED }}>
              {settings?.heroSubheadline || tenant?.description || ""}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href={`${siteBase}/quote`} className="inline-flex items-center rounded-lg px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN_DEEP }}>Get A Free Quote</a>
              {phone && (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-2 rounded-lg border px-6 py-3.5 text-sm font-bold transition-colors hover:bg-slate-50" style={{ borderColor: "#D6DECB", color: TEXT }}>
                  <PhoneIcon color={GREEN_DEEP}/>{phone}
                </a>
              )}
            </div>
          </div>
        </div>
        {/* Trust bar */}
        <div className="absolute bottom-6 inset-x-0 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="rounded-2xl px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5 lg:divide-x lg:divide-white/10 shadow-xl" style={{ backgroundColor: "rgba(22,27,18,0.94)" }}>
              {TRUST_ITEMS.map(t => (
                <div key={t.label} className="flex items-center gap-3 lg:justify-center">
                  <Icon d={t.icon} className="w-8 h-8 flex-shrink-0" color={GREEN}/>
                  <p className="text-sm font-semibold text-white leading-snug">{t.label}<br/>{t.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Real-facts strip (no invented stats) */}
      <section className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {FACT_ITEMS.map(f => (
            <div key={f.label} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: LIGHT }}>
                <Icon d={f.icon} className="w-6 h-6" color={GREEN_DEEP}/>
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: TEXT }}>{f.label}</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section style={{ backgroundColor: LIGHT }} className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-3" style={{ color: GREEN_DEEP }}>Our Construction Services</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: TEXT }}>
              Construction Services Built Around <span style={{ color: GREEN_MID }}>Your Project</span>
            </h2>
            <p className="mt-4 leading-relaxed" style={{ color: MUTED }}>
              From residential homes to commercial developments, {tenant?.name || "we"} deliver complete building and electrical solutions across {areaNames.length ? areaNames.slice(0, 3).join(", ") : "the local area"} and the surrounding areas.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {services.map(s => (
                <a key={s.slug} href={`${siteBase}/services/${s.slug}`} className="group rounded-2xl bg-white border border-transparent hover:border-[#7DB93F] p-6 transition-all hover:shadow-md">
                  <ServiceIcon slug={s.slug}/>
                  <h3 className="mt-4 font-bold" style={{ color: TEXT }}>{s.name}</h3>
                  <div className="w-8 h-0.5 my-3 rounded" style={{ backgroundColor: GREEN }}/>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{s.tagline || s.description}</p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-bold group-hover:gap-2 transition-all" style={{ color: GREEN_DEEP }}>Learn more →</span>
                </a>
              ))}
              <a href={`${siteBase}/quote`} className="rounded-2xl p-6 flex flex-col justify-center text-white transition-opacity hover:opacity-95" style={{ backgroundColor: GREEN_DEEP }}>
                <h3 className="font-bold text-lg">Not sure where to start?</h3>
                <p className="text-sm mt-2 text-white/85 leading-relaxed">Tell us about the project and we'll come back with a free, no-obligation quote.</p>
                <span className="inline-flex items-center gap-1 mt-4 text-sm font-bold">Get A Free Quote →</span>
              </a>
            </div>
            <div className="lg:col-span-2 relative rounded-2xl overflow-hidden min-h-[420px] lg:self-stretch">
              <img src="/amo-services/amo-services-new-builds-uk.webp" alt={`${tenant?.name || "Construction"} site in progress`} loading="lazy" className="absolute inset-0 w-full h-full object-cover"/>
              <div className="absolute top-5 right-5 rounded-2xl p-5 w-48 shadow-xl" style={{ backgroundColor: "rgba(22,27,18,0.94)" }}>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}><PinIcon/> Serving</p>
                <div className="space-y-2.5">
                  {(areaNames.length ? areaNames : ["Grays", "Thurrock", "Essex", "London"]).map(a => (
                    <p key={a} className="flex items-center gap-2 text-sm font-semibold text-white"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GREEN }}/>{a}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why choose us / about */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="grid grid-cols-2 gap-4">
            <img src="/amo-services/amo-services-team-portrait-1600x1200.webp" alt={`The ${tenant?.name || ""} team`} loading="lazy" className="rounded-2xl w-full h-64 object-cover col-span-2"/>
            <img src="/amo-services/amo-services-craftsmanship-detail-1200x1200.webp" alt="Detail of finished work" loading="lazy" className="rounded-2xl w-full h-44 object-cover"/>
            <img src="/amo-services/amo-services-client-consultation-1600x1067.webp" alt="Discussing plans with a client" loading="lazy" className="rounded-2xl w-full h-44 object-cover"/>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-3" style={{ color: GREEN_DEEP }}>Why Choose {tenant?.name || "Us"}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: TEXT }}>
              One Team, From First Visit To <span style={{ color: GREEN_MID }}>Final Handover</span>
            </h2>
            <p className="mt-5 leading-relaxed" style={{ color: MUTED }}>{settings?.aboutText || tenant?.description || ""}</p>
            <div className="mt-7 space-y-3.5">
              {[
                "Established in 2011 — a construction company, not a middleman",
                "Residential, commercial and institutional projects",
                "Building and electrical work under one roof",
                "Fully insured, with clear written quotations",
                "Free, no-obligation quotes on every project",
              ].map(p => (
                <div key={p} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" color={GREEN_DEEP}/>
                  <p className="text-sm font-medium" style={{ color: TEXT }}>{p}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href={`${siteBase}/about`} className="inline-flex items-center rounded-lg px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN_DEEP }}>More About Us</a>
              <a href={`${siteBase}/contact`} className="inline-flex items-center rounded-lg border px-6 py-3 text-sm font-bold transition-colors hover:bg-slate-50" style={{ borderColor: "#D6DECB", color: TEXT }}>Contact Us</a>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section style={{ backgroundColor: INK }} className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-3" style={{ color: GREEN }}>How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">From Idea To <span style={{ color: GREEN }}>Finished Build</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PROCESS.map(s => (
              <div key={s.n} className="text-center sm:text-left">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold mx-auto sm:mx-0" style={{ backgroundColor: GREEN, color: INK }}>{s.n}</div>
                <h3 className="mt-4 font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews (only if the tenant has published ones — nothing invented) */}
      {reviews.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-3" style={{ color: GREEN_DEEP }}>Customer Reviews</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: TEXT }}>What Our Customers Say</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.slice(0, 6).map((r: any) => (
                <div key={r.id} className="rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ backgroundColor: LIGHT }}>
                  <div className="flex gap-1 mb-3">{Array.from({ length: r.rating || 5 }).map((_, i) => <Star key={i}/>)}</div>
                  <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{r.content || r.text}</p>
                  <p className="mt-4 text-sm font-bold" style={{ color: TEXT }}>{r.customerName || r.name}</p>
                  {r.location && <p className="text-xs" style={{ color: MUTED }}>{r.location}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ backgroundColor: GREEN_DEEP }} className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
          <div>
            <h2 className="text-3xl font-extrabold text-white">Ready To Start Your Project?</h2>
            <p className="mt-2 text-white/85">Get a free, no-obligation quote — tell us what you're planning and we'll take it from there.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={`${siteBase}/quote`} className="inline-flex items-center rounded-lg bg-white px-7 py-3.5 text-sm font-bold transition-colors hover:bg-slate-100" style={{ color: GREEN_DEEP }}>Get A Free Quote</a>
            {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10"><PhoneIcon/>{phone}</a>}
          </div>
        </div>
      </section>

      <CFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <CMobileBar phone={phone}/>
    </div>
  );
}

// ── Services pages ───────────────────────────────────────────────────────────

function ServicesPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant } = (siteData as any) || {};
  const { data: services } = useListPublicServices(tenantSlug);
  const list = (services as any[]) || [];
  return (
    <CShell tenantSlug={tenantSlug} title="Our Construction Services" crumb="Our Services"
      subtitle={`Everything ${tenant?.name || "we"} take${tenant?.name ? "s" : ""} on — from complete new builds to kitchens, lofts and electrical work.`}>
      <PageSEO title={`Our Services | ${tenant?.name || ""}`} description={tenant?.description || ""}/>
      <section className="py-16" style={{ backgroundColor: LIGHT }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map(s => (
            <a key={s.slug} href={`${siteBase}/services/${s.slug}`} className="group rounded-2xl overflow-hidden bg-white border border-transparent hover:border-[#7DB93F] transition-all hover:shadow-lg flex flex-col">
              {s.heroImageUrl && (
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={s.heroImageUrl} alt={s.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3">
                  <ServiceIcon slug={s.slug} className="w-7 h-7"/>
                  <h2 className="font-bold" style={{ color: TEXT }}>{s.name}</h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed flex-1" style={{ color: MUTED }}>{s.description || s.tagline}</p>
                <span className="inline-flex items-center gap-1 mt-4 text-sm font-bold group-hover:gap-2 transition-all" style={{ color: GREEN_DEEP }}>View service →</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </CShell>
  );
}

function ServiceDetailPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const { data: service } = useGetPublicService(tenantSlug, slug);
  const { data: services } = useListPublicServices(tenantSlug);
  const s = service as any;
  const others = ((services as any[]) || []).filter(o => o.slug !== slug);
  const phone = settings?.phone || tenant?.phone;
  if (!s) return <CShell tenantSlug={tenantSlug} title="Service" crumb="Our Services"><div className="py-24 text-center" style={{ color: MUTED }}>Loading…</div></CShell>;
  return (
    <CShell tenantSlug={tenantSlug} title={s.name} crumb="Our Services" subtitle={s.tagline || undefined}>
      <PageSEO title={s.seoTitle || `${s.name} | ${tenant?.name || ""}`} description={s.seoDescription || s.description || ""}/>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: s.name, description: s.description || undefined, provider: { "@type": "GeneralContractor", name: tenant?.name || "" } }}/>
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {s.heroImageUrl && <img src={s.heroImageUrl} alt={s.name} className="rounded-2xl w-full aspect-[16/9] object-cover"/>}
            <div className="space-y-4 leading-relaxed" style={{ color: MUTED }}>
              {(s.content || s.description || "").split(/\n\n+/).map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
            {Array.isArray(s.benefits) && s.benefits.length > 0 && (
              <div className="rounded-2xl p-7" style={{ backgroundColor: LIGHT }}>
                <h2 className="font-bold mb-4" style={{ color: TEXT }}>What's Included</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {s.benefits.map((b: string) => (
                    <div key={b} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" color={GREEN_DEEP}/>
                      <p className="text-sm font-medium" style={{ color: TEXT }}>{b}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(s.processSteps) && s.processSteps.length > 0 && (
              <div>
                <h2 className="font-bold text-xl mb-6" style={{ color: TEXT }}>How We Approach {s.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {s.processSteps.map((step: { title: string; description: string }, i: number) => (
                    <div key={i} className="rounded-2xl border border-slate-100 p-6" style={{ backgroundColor: LIGHT }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold mb-3" style={{ backgroundColor: GREEN, color: INK }}>{i + 1}</div>
                      <h3 className="font-bold text-sm" style={{ color: TEXT }}>{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: MUTED }}>{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="space-y-6">
            <div className="rounded-2xl p-7 text-white" style={{ backgroundColor: INK }}>
              <h2 className="font-bold text-lg">Get A Free Quote</h2>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">Tell us about your {s.name.toLowerCase()} project and we'll come back with a clear, written quotation.</p>
              <a href={`${siteBase}/quote`} className="mt-5 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-bold transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN, color: INK }}>Request A Quote</a>
              {phone && <a href={`tel:${phone}`} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"><PhoneIcon color={GREEN}/>{phone}</a>}
            </div>
            {others.length > 0 && (
              <div className="rounded-2xl border border-slate-200 p-7">
                <h2 className="font-bold mb-3" style={{ color: TEXT }}>Other Services</h2>
                {others.map(o => (
                  <a key={o.slug} href={`${siteBase}/services/${o.slug}`} className="block text-sm py-2.5 border-b border-slate-100 last:border-0 font-medium transition-colors hover:opacity-70" style={{ color: MUTED }}>{o.name}</a>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </CShell>
  );
}

// ── About / Contact / Quote / Legal ──────────────────────────────────────────

function AboutPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <CShell tenantSlug={tenantSlug} title={`About ${tenant?.name || "Us"}`} crumb="About Us"
      subtitle="Who we are, how we work, and why customers keep coming back.">
      <PageSEO title={`About Us | ${tenant?.name || ""}`} description={settings?.aboutText || tenant?.description || ""}/>
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-14">
          <img src="/amo-services/amo-services-team-hero-1920x960.webp" alt={`The ${tenant?.name || ""} team on site`} className="rounded-2xl w-full aspect-[2/1] object-cover"/>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-3" style={{ color: GREEN_DEEP }}>Our Story</p>
              <h2 className="text-3xl font-extrabold leading-tight" style={{ color: TEXT }}>Building And Improving Properties <span style={{ color: GREEN_MID }}>Since 2011</span></h2>
              <p className="mt-5 leading-relaxed" style={{ color: MUTED }}>{settings?.aboutText || tenant?.description || ""}</p>
              <div className="mt-7 space-y-3.5">
                {[
                  "A single team responsible for the whole job",
                  "Clear written quotations before any work starts",
                  "Building and electrical trades under one roof",
                  "Fully insured on every project",
                ].map(p => (
                  <div key={p} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" color={GREEN_DEEP}/>
                    <p className="text-sm font-medium" style={{ color: TEXT }}>{p}</p>
                  </div>
                ))}
              </div>
              <a href={`${siteBase}/quote`} className="mt-8 inline-flex items-center rounded-lg px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN_DEEP }}>Get A Free Quote</a>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img src="/amo-services/amo-services-client-consultation-1600x1067.webp" alt="Consulting with a client over drawings" loading="lazy" className="rounded-2xl w-full h-52 object-cover"/>
              <img src="/amo-services/amo-services-craftsmanship-detail-1200x1200.webp" alt="Close-up of quality workmanship" loading="lazy" className="rounded-2xl w-full h-52 object-cover"/>
              <img src="/amo-services/amo-services-completed-project-banner-1920x800.webp" alt="A completed project" loading="lazy" className="rounded-2xl w-full h-40 object-cover col-span-2"/>
            </div>
          </div>
        </div>
      </section>
    </CShell>
  );
}

function ContactPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const mutation = useSubmitContact();
  const [form, setForm] = useState({ senderName: "", senderEmail: "", senderPhone: "", message: "" });
  const [sent, setSent] = useState(false);
  const phone = settings?.phone || tenant?.phone;
  const email = settings?.email || tenant?.email;
  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F7A26] focus:border-[#4F7A26] transition";
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: { ...form, tenantSlug } } as any);
      setSent(true);
    } catch {}
  };
  return (
    <CShell tenantSlug={tenantSlug} title={`Contact ${tenant?.name || "Us"}`} crumb="Contact Us"
      subtitle="Questions about a project, a quote or anything else — get in touch and we'll come back to you.">
      <PageSEO title={`Contact Us | ${tenant?.name || ""}`} description={`Get in touch with ${tenant?.name || "us"} to discuss your project.`}/>
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="rounded-2xl p-7 text-white space-y-5" style={{ backgroundColor: INK }}>
              <h2 className="text-xl font-bold">Contact Details</h2>
              {phone && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GREEN }}>Phone</p>
                  <a href={`tel:${phone}`} className="text-lg font-bold hover:underline">{phone}</a>
                </div>
              )}
              {email && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GREEN }}>Email</p>
                  <a href={`mailto:${email}`} className="hover:underline break-all">{email}</a>
                </div>
              )}
              {(tenant?.address || tenant?.city) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GREEN }}>Location</p>
                  <p className="text-slate-300">{tenant?.address || tenant?.city}</p>
                </div>
              )}
              <div className="pt-2">
                <a href={`${siteBase}/quote`} className="inline-flex items-center rounded-lg px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN, color: INK }}>Request A Detailed Quote</a>
              </div>
            </div>
            <img src="/amo-services/amo-services-client-consultation-1600x1067.webp" alt="Talking through project plans" loading="lazy" className="rounded-2xl w-full aspect-[3/2] object-cover"/>
          </div>
          <div>
            {sent ? (
              <div className="rounded-2xl border border-slate-200 p-10 text-center space-y-4">
                <CheckCircle className="w-14 h-14 mx-auto" color={GREEN_DEEP}/>
                <h2 className="text-2xl font-bold" style={{ color: TEXT }}>Message Sent</h2>
                <p style={{ color: MUTED }}>Thanks — we'll get back to you as soon as we can.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 p-7 space-y-4 shadow-sm">
                <h2 className="text-xl font-bold" style={{ color: TEXT }}>Send A Message</h2>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Name *</label><input required className={inputCls} value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })}/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Email *</label><input required type="email" className={inputCls} value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.target.value })}/></div>
                  <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Phone</label><input className={inputCls} value={form.senderPhone} onChange={e => setForm({ ...form, senderPhone: e.target.value })}/></div>
                </div>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Message *</label><textarea required rows={5} className={inputCls} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}/></div>
                <button type="submit" disabled={mutation.isPending} className="w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: GREEN_DEEP }}>
                  {mutation.isPending ? "Sending…" : "Send Message"}
                </button>
                {mutation.isError && <p className="text-sm text-red-600 text-center">Something went wrong — please try again or call us.</p>}
              </form>
            )}
          </div>
        </div>
      </section>
    </CShell>
  );
}

function QuotePage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant } = (siteData as any) || {};
  return (
    <CShell tenantSlug={tenantSlug} title="Request A Free Quote" crumb="Get A Quote"
      subtitle={`Tell us about your project and ${tenant?.name || "our team"} will come back with a clear, written quotation.`}>
      <PageSEO title={`Request A Free Quote | ${tenant?.name || ""}`} description={`Request a free quote from ${tenant?.name || "us"} — new builds, renovations, lofts, kitchens, electrical and more.`}/>
      <QuoteFormSection tenantSlug={tenantSlug} accent={GREEN_DEEP} panel={INK}/>
    </CShell>
  );
}

function LegalPage({ tenantSlug, kind }: { tenantSlug: string; kind: "terms" | "privacy" }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const title = kind === "terms" ? "Terms & Conditions" : "Privacy Policy";
  const content = kind === "terms" ? settings?.termsContent : settings?.privacyContent;
  return (
    <CShell tenantSlug={tenantSlug} title={title} crumb={title}>
      <PageSEO title={`${title} | ${tenant?.name || ""}`} description={`${title} for ${tenant?.name || "this business"}.`}/>
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 leading-relaxed space-y-4" style={{ color: MUTED }}>
          {content
            ? content.split(/\n\n+/).map((p: string, i: number) => <p key={i}>{p}</p>)
            : <p>Please contact {tenant?.name || "us"} for a copy of our {title.toLowerCase()}.</p>}
        </div>
      </section>
    </CShell>
  );
}

function NotFoundPage({ tenantSlug }: { tenantSlug: string }) {
  const siteBase = useSiteBase();
  return (
    <CShell tenantSlug={tenantSlug} title="Page Not Found" crumb="404">
      <section className="py-24 bg-white text-center space-y-5">
        <p style={{ color: MUTED }}>That page doesn't exist — but the rest of the site does.</p>
        <a href={siteBase || "/"} className="inline-flex items-center rounded-lg px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: GREEN_DEEP }}>Back To Home</a>
      </section>
    </CShell>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function ConstructionSiteApp({ forcedSlug, forcedBase, forcedOrigin, ssrPath }: { forcedSlug?: string; forcedBase?: string; forcedOrigin?: string; ssrPath?: string } = {}) {
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
    const color = rootSettings?.primaryColor || GREEN;
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
      <Switch>
        <Route path="/">{() => <HomePage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/services">{() => <ServicesPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/services/:slug">{(p: any) => <ServiceDetailPage tenantSlug={tenantSlug} slug={p.slug}/>}</Route>
        <Route path="/about">{() => <AboutPage tenantSlug={tenantSlug}/>}</Route>
        <Route path="/quote">{() => <QuotePage tenantSlug={tenantSlug}/>}</Route>
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
