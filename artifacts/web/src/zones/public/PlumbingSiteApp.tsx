import { Switch, Route, useParams, useLocation, Router as WouterRouter, Link as WouterLink } from "wouter";
import { useGetPublicSite, useListPublicServices, useGetPublicService, useListPublicAreas, useGetPublicArea, useListPublicReviews, useBrowsePublicBlog, useGetPublicBlogPost } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { initGoogleTag } from "./analytics";
import { SiteBaseCtx, SiteOriginCtx, useSiteBase, PageSEO, JsonLd, CookieBanner, QuoteFormSection } from "./PublicSiteApp";
import { BlogIndexBody, BlogArticleBody } from "./blog/BlogSections";
import { usePlumbingMotion } from "./plumbingMotion";
import "./plumbing-motion.css";

// ─────────────────────────────────────────────────────────────────────────────
// PLUMBING & HEATING SITE TEMPLATE (tenant.industry === 'plumbing')
//
// Built from the approved BPS design. Navy/orange/blue, full-bleed team hero,
// warm trade tone — NOT a re-skin of the rendering or construction templates.
//
// Every business fact (name, phone, email, services, areas, reviews, hours)
// comes from the tenant's own DB rows. Nothing about any one client is
// hardcoded here — that is the rule that stopped one tenant's copy appearing
// on another tenant's site, and it applies to this template from day one.
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = "#102333";        // header, footer, emergency panel, hero base
const ORANGE = "#F0882D";      // primary quote buttons, warm accents
const BLUE = "#0892CF";        // brand accents, icons
const BLUE_CTRL = "#087EAE";   // focus + selected control states (AA on white)
const BLUE_BRIGHT = "#35BAF2"; // hero accent against the dark photograph
const TEXT = "#142434";        // headings and normal dark text
const BODY = "#667581";        // supporting copy on white
const PALE = "#EDF5F9";        // secondary panels
const PALE_2 = "#F0F6FA";      // quote page, service intro
const REVIEW_BG = "#F1F6F9";
const BORDER = "#DCE4E9";

// ── Icons ────────────────────────────────────────────────────────────────────

function Icon({ d, className = "w-8 h-8", color = BLUE, strokeWidth = 1.6 }: { d: string; className?: string; color?: string; strokeWidth?: number }) {
  return <svg className={className} style={{ color }} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d={d}/></svg>;
}

const ICON_PATHS: Record<string, string> = {
  "boiler-installation": "M6 3h12a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 7h6M9 11h6M9 21v-4M15 21v-4",
  "boiler-repair": "M6 3h12a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 21v-4M15 21v-4M9.5 8.5l5 5M14.5 8.5l-5 5",
  "boiler-servicing": "M12 8v4l2.5 2.5M6 3h12a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 21v-4M15 21v-4",
  "central-heating": "M7 4v16M11 4v16M15 4v16M4 7h14a2 2 0 012 2v6a2 2 0 01-2 2H4",
  "radiators": "M7 4v16M11 4v16M15 4v16M4 7h14a2 2 0 012 2v6a2 2 0 01-2 2H4",
  "bathrooms": "M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4v-3zM7 12V6a2 2 0 012-2h1a2 2 0 012 2M8 19l-1 2M16 19l1 2",
  "leaks-blockages": "M12 3s5 5.5 5 9a5 5 0 01-10 0c0-3.5 5-9 5-9z",
  "emergency-plumbing": "M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12L13 2z",
  "gas-safety-certificates": "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4",
  "commercial": "M3 21h18M6 21V5a1 1 0 011-1h6a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M9 8h.01M9 12h.01M9 16h.01",
  "power-flushing": "M12 3s5 5.5 5 9a5 5 0 01-10 0c0-3.5 5-9 5-9zM9 20h6",
  "unvented-cylinders": "M8 3h8v16a2 2 0 01-2 2h-4a2 2 0 01-2-2V3zM8 8h8M8 13h8",
};
const DEFAULT_ICON = "M14.7 6.3a4 4 0 00-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z";

function ServiceIcon({ slug, className = "w-9 h-9", color = BLUE }: { slug?: string; className?: string; color?: string }) {
  return <Icon d={ICON_PATHS[slug || ""] || DEFAULT_ICON} className={className} color={color}/>;
}

const PhoneIcon = ({ color = "currentColor", className = "w-4 h-4" }: { color?: string; className?: string }) => (
  <svg className={className} style={{ color }} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
);
const ShieldIcon = ({ color = BLUE }: { color?: string }) => <Icon d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" className="w-5 h-5" color={color}/>;
const ClockIcon = ({ color = BLUE }: { color?: string }) => <Icon d="M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z" className="w-5 h-5" color={color}/>;
const TagIcon = ({ color = BLUE }: { color?: string }) => <Icon d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7.2-7.2a2 2 0 01-.6-1.4V5a2 2 0 012-2h7a2 2 0 011.4.6l7.4 7.4a2 2 0 010 2.4zM7.5 7.5h.01" className="w-5 h-5" color={color}/>;
const BadgeIcon = ({ color = BLUE }: { color?: string }) => <Icon d="M12 15a4 4 0 100-8 4 4 0 000 8zM8.5 13.5L7 22l5-3 5 3-1.5-8.5" className="w-5 h-5" color={color}/>;
const ArrowUpRight = ({ className = "w-4 h-4" }: { className?: string }) => <Icon d="M7 17L17 7M7 7h10v10" className={className} color="currentColor" strokeWidth={2}/>;
const PinIcon = () => <Icon d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" className="w-4 h-4" color={BLUE}/>;
const Star = () => <svg className="w-4 h-4" style={{ color: ORANGE }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.077 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>;

// ── Shared chrome ────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/reviews", label: "Reviews" },
  { href: "/blog", label: "Guides" },
  { href: "/contact", label: "Contact" },
];

function telHref(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("0")) return `tel:+44${digits.slice(1)}`;
  return `tel:${digits}`;
}

/**
 * The surrounding <Router base={siteBase}> already resolves hrefs against the
 * base, so hrefs here stay plain. Prepending the base as well produced
 * /site/bps/site/bps/about and every link silently went nowhere.
 */
function Link({ href, children, className, ...rest }: any) {
  return <WouterLink href={href} className={className} {...rest}>{children}</WouterLink>;
}

/** Orange primary action. 48px tall so it agrees with the fields beside it. */
function QuoteButton({ children = "Get a free quote", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <Link href="/get-a-quote" className={`bps-quote inline-flex items-center gap-2 h-12 px-6 rounded-[14px] font-semibold text-[15px] text-white transition-colors ${className}`} style={{ background: ORANGE }}>
      {children}
      <span className="bps-quote-arrow inline-flex"><ArrowUpRight/></span>
    </Link>
  );
}

function Header({ tenant, settings, services, areas }: { tenant: any; settings: any; services?: any[]; areas?: any[] }) {
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState<null | "services" | "areas">(null);
  const [closing, setClosing] = useState(false);
  /**
   * Which drawer section is expanded, or none.
   *
   * One at a time, and all closed to begin with. Every service and every town
   * printed out in full made the drawer several screens deep, so the thing you
   * opened the menu for was below the fold on a list you had to scroll past.
   * Collapsed, the top level is short enough to read at a glance.
   */
  const [openGroup, setOpenGroup] = useState<null | "services" | "areas">(null);
  const [, navigate] = useLocation();
  const base = useSiteBase();
  const phone = settings?.phone;

  // Play the exit animation before unmounting, otherwise the drawer vanishes
  // instantly and all the care in the open animation is thrown away on close.
  function closeDrawer(then?: () => void) {
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); then?.(); }, 260);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeDrawer(); }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";   // no scrolling the page behind the drawer
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`bps-header sticky top-0 z-50 relative${open ? " is-menu-open" : ""}`}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 h-[86px] lg:h-[96px] flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {settings?.logoUrl
            ? <img src={settings.logoUrl} alt={tenant?.name || "Home"} className="h-[52px] lg:h-[62px] w-auto"/>
            : <span className="text-white font-bold text-[22px] tracking-[-0.02em]">{tenant?.name}</span>}
        </Link>

        {/* Desktop menu. Services and Areas open a panel listing every page we
            have, because a trade site's whole job is getting somebody to the
            page for their problem in their town — burying twelve services
            behind one "Services" link is how that fails. */}
        <nav className="hidden lg:flex items-center gap-7 h-full" aria-label="Main" onMouseLeave={() => setMega(null)}>
          <Link href="/" className="bps-pipe text-[15px] font-medium text-white/85 hover:text-white transition-colors">Home</Link>

          <div className="relative h-full flex items-center" onMouseEnter={() => setMega("services")}>
            <Link href="/services" className="bps-pipe text-[15px] font-medium text-white/85 hover:text-white transition-colors inline-flex items-center gap-1.5">
              Services
              <Icon d="M6 9l6 6 6-6" className="w-3.5 h-3.5" color="currentColor" strokeWidth={2.4}/>
            </Link>
          </div>

          {(areas || []).length > 0 && (
            <div className="relative h-full flex items-center" onMouseEnter={() => setMega("areas")}>
              <Link href="/services" className="bps-pipe text-[15px] font-medium text-white/85 hover:text-white transition-colors inline-flex items-center gap-1.5">
                Areas
                <Icon d="M6 9l6 6 6-6" className="w-3.5 h-3.5" color="currentColor" strokeWidth={2.4}/>
              </Link>
            </div>
          )}

          {NAV_LINKS.filter(l => !["/", "/services"].includes(l.href)).map(l => (
            <Link key={l.href} href={l.href} onMouseEnter={() => setMega(null)}
              className="bps-pipe text-[15px] font-medium text-white/85 hover:text-white transition-colors">{l.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {phone && (
            <a
              href={telHref(phone)}
              className="bps-phone-pill hidden md:inline-flex items-center"
              aria-label={`Call ${phone}`}
              title={`Call ${phone}`}
            >
              <span className="bps-phone-ic"><PhoneIcon color="#fff" className="w-[18px] h-[18px]"/></span>
              {/* Expands sideways on hover or focus. The header keeps its height
                  whatever the number's length, and a tap on a touch device still
                  dials because the whole thing is the link. */}
              <span className="bps-phone-num">{phone}</span>
            </a>
          )}
          <QuoteButton className="hidden sm:inline-flex"/>

          <button
            type="button"
            className={`bps-burger lg:hidden ${open ? "is-open" : ""}`}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => (open ? closeDrawer() : setOpen(true))}
          >
            <span/><span/><span/>
          </button>
        </div>
      </div>


      {/* Mega panel, desktop only. Rendered outside the nav so it can span the
          full width rather than being trapped in a menu item. */}
      {mega && (
        <div className="bps-mega hidden lg:block absolute left-0 right-0 top-full" onMouseLeave={() => setMega(null)} onMouseEnter={() => setMega(mega)}>
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 py-8">
            {mega === "services" && (
              <>
                <div className="flex items-baseline justify-between mb-5">
                  <p className="text-[11.5px] font-bold tracking-[0.12em] uppercase" style={{ color: BLUE_BRIGHT }}>Everything we do</p>
                  <Link href="/services" className="bps-pipe text-[13.5px] font-semibold text-white/70 hover:text-white">See all services</Link>
                </div>
                <div className="grid grid-cols-3 gap-x-8 gap-y-1">
                  {(services || []).map((s: any) => (
                    <Link key={s.slug} href={`/services/${s.slug}`} onClick={() => setMega(null)}
                      className="bps-mega-item group flex items-start gap-3 rounded-[14px] px-3 py-2.5">
                      <span className="bps-mega-icon shrink-0"><ServiceIcon slug={s.slug} className="w-5 h-5" color="#fff"/></span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-[14.5px] text-white truncate">{s.name}</span>
                        {s.tagline && <span className="block text-[12.5px] text-white/55 truncate">{s.tagline}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {mega === "areas" && (
              <>
                <div className="flex items-baseline justify-between mb-5">
                  <p className="text-[11.5px] font-bold tracking-[0.12em] uppercase" style={{ color: BLUE_BRIGHT }}>
                    {settings?.serviceBase ? `Based in ${settings.serviceBase}` : "Where we work"}
                  </p>
                  {settings?.phone && (
                    <a href={telHref(settings.phone)} className="bps-pipe text-[13.5px] font-semibold text-white/70 hover:text-white">
                      Not listed? Call {settings.phone}
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-x-8 gap-y-1">
                  {(areas || []).map((a: any) => (
                    <Link key={a.slug} href={`/areas/${a.slug}`} onClick={() => setMega(null)}
                      className="bps-mega-item group flex items-start gap-3 rounded-[14px] px-3 py-2.5">
                      <span className="bps-mega-icon shrink-0"><Icon d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" className="w-5 h-5" color="#fff"/></span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-[14.5px] text-white truncate">{a.name}</span>
                        <span className="block text-[12.5px] text-white/55 truncate">Plumbers in {a.name}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {open && (
        <div className={`bps-drawer-root lg:hidden ${closing ? "is-closing" : ""}`}>
          <button type="button" className="bps-drawer-scrim" aria-label="Close menu" onClick={() => closeDrawer()}/>

          <nav className="bps-drawer" aria-label="Mobile">
            <div className="bps-drawer-head">
              {settings?.logoUrl && <img src={settings.logoUrl} alt="" className="h-[46px] w-auto"/>}
              <button type="button" className="bps-drawer-x" aria-label="Close menu" onClick={() => closeDrawer()}>
                <Icon d="M18 6L6 18M6 6l12 12" className="w-5 h-5" color="#fff" strokeWidth={2.2}/>
              </button>
            </div>

            <div className="bps-drawer-links">
              {NAV_LINKS.map((l, i) => (
                <button
                  key={l.href}
                  type="button"
                  className="bps-drawer-link"
                  style={{ ["--i" as any]: i }}
                  onClick={() => closeDrawer(() => navigate(l.href))}
                >
                  <span>{l.label}</span>
                  <ArrowUpRight className="w-4 h-4"/>
                </button>
              ))}

              {/*
                Services and areas are rendered as peers of the links above —
                the same 58px row, the same hairline, the same stagger — that
                expand in place rather than as a second kind of list dumped
                underneath.
              */}
              {([
                { key: "services" as const, label: "Our services", href: "/services", items: services || [] },
                { key: "areas" as const, label: "Where we work", href: "/areas", items: areas || [] },
              ]).filter(g => g.items.length > 0).map((g, gi) => {
                const expanded = openGroup === g.key;
                return (
                  <div className="bps-drawer-group" key={g.key}>
                    <button
                      type="button"
                      className={`bps-drawer-link bps-drawer-toggle${expanded ? " is-open" : ""}`}
                      style={{ ["--i" as any]: NAV_LINKS.length + gi }}
                      aria-expanded={expanded}
                      onClick={() => setOpenGroup(expanded ? null : g.key)}
                    >
                      <span>{g.label}</span>
                      <span className="bps-drawer-chevron" aria-hidden="true">
                        <Icon d="M6 9l6 6 6-6" className="w-4 h-4" color="currentColor" strokeWidth={2.2}/>
                      </span>
                    </button>

                    {/* grid-template-rows 0fr→1fr animates to the content's own
                        height without measuring it in JavaScript. */}
                    <div className="bps-drawer-sublist" data-open={expanded}>
                      <div>
                        {g.items.map((it: any) => (
                          <button key={it.slug} type="button" className="bps-drawer-sub"
                            tabIndex={expanded ? 0 : -1}
                            onClick={() => closeDrawer(() => navigate(`${g.href}/${it.slug}`))}>
                            <span>{it.name}</span>
                            <ArrowUpRight className="w-4 h-4"/>
                          </button>
                        ))}
                        <button type="button" className="bps-drawer-sub bps-drawer-suball"
                          tabIndex={expanded ? 0 : -1}
                          onClick={() => closeDrawer(() => navigate(g.href))}>
                          <span>{g.key === "services" ? "All services" : "All areas"}</span>
                          <ArrowUpRight className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bps-drawer-foot" style={{ ["--i" as any]: NAV_LINKS.length + 2 }}>
              {phone && (
                <a href={telHref(phone)} className="bps-drawer-call">
                  <PhoneIcon color="#fff" className="w-5 h-5"/>
                  <span className="flex flex-col leading-tight text-left">
                    <span className="text-[11.5px] font-normal text-white/60">Need us now?</span>
                    <span className="text-[17px] font-bold">{phone}</span>
                  </span>
                </a>
              )}
              <button
                type="button"
                className="bps-drawer-quote"
                onClick={() => closeDrawer(() => navigate("/get-a-quote"))}
              >
                Get a free quote <ArrowUpRight/>
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function ScrollToTopOnNavigate() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

/**
 * Full browser-width background hero. One positioned image layer, a navy
 * gradient over it, live HTML text above — never text baked into the image,
 * which would be invisible to search engines and unreadable when zoomed.
 */
function Hero({ tenant, settings }: { tenant: any; settings: any }) {
  const phone = settings?.phone;
  const image = settings?.heroImageUrl;

  return (
    <section className="bps-hero relative isolate w-full overflow-hidden" style={{ background: NAVY }} aria-labelledby="home-heading">
      {image && <img className="bps-hero-photo absolute inset-0 -z-20 h-full w-full object-cover" style={{ objectPosition: "center right" }} src={image} alt="" fetchPriority="high" decoding="async"/>}
      <div className="bps-hero-shade absolute inset-0 -z-10" aria-hidden="true"/>

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 py-[72px] lg:py-[88px]">
        <div className="max-w-[670px]">
          <p className="bps-rise text-[12px] font-bold tracking-[0.14em] mb-4" style={{ color: "#D6EBF6", animationDelay: "50ms" }}>
            {(settings?.serviceBase ? `Your local plumbing & heating experts, ${settings.serviceBase}` : "Your local plumbing & heating experts").toUpperCase()}
          </p>

          <h1 id="home-heading" className="bps-rise font-bold text-white" style={{ fontSize: "clamp(42px,6.2vw,82px)", lineHeight: 1.06, letterSpacing: "-0.055em", animationDelay: "130ms" }}>
            {settings?.heroHeadline || <>Goodbye worries.<br/>Hello, <span className="bps-warm">warmth.</span></>}
          </h1>

          <p className="bps-rise mt-6 text-[17px] leading-[1.7] text-white/85 max-w-[560px]" style={{ animationDelay: "220ms" }}>
            {settings?.heroSubheadline || "From the first cold radiator to your dream bathroom. Expert plumbing and heating, from people close to home."}
          </p>

          <div className="bps-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "310ms" }}>
            <QuoteButton/>
            {phone && (
              <a href={telHref(phone)} className="bps-drop inline-flex items-center gap-3 h-12 px-5 rounded-[14px] border text-white font-semibold text-[15px]" style={{ borderColor: "rgba(255,255,255,.34)" }}>
                <PhoneIcon color="#fff"/>
                <span className="flex flex-col leading-tight text-left">
                  <span className="text-[11.5px] font-normal text-white/60">Need us now?</span>
                  <span>{phone}</span>
                </span>
              </a>
            )}
          </div>

          <p className="bps-rise mt-7 text-[13.5px] text-white/60" style={{ animationDelay: "400ms" }}>
            {settings?.heroSupportingLine || "Qualified hands. Honest advice."}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Trust strip ──────────────────────────────────────────────────────────────

function TrustStrip({ settings }: { settings: any }) {
  // Claims that carry regulatory weight stay tenant-owned, in settings.trustBadges.
  // A template must never assert "Gas Safe registered" about a business that has
  // not told us it is — so an empty list renders no strip rather than a default one.
  const ICONS = [<ShieldIcon/>, <ClockIcon/>, <TagIcon/>, <BadgeIcon/>];
  const badges: string[] = Array.isArray(settings?.trustBadges)
    ? (settings.trustBadges as any[]).map(b => (typeof b === "string" ? b : b?.label)).filter(Boolean)
    : [];

  if (!badges.length) return null;
  const items = badges.slice(0, 4).map((label, i) => ({ icon: ICONS[i % ICONS.length], label }));

  return (
    <section className="border-b" style={{ background: "#fff", borderColor: BORDER }}>
      <div className="bps-rad mx-auto max-w-[1400px] px-5 sm:px-8 py-6 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="shrink-0">{it.icon}</span>
            <span className="text-[14px] font-medium" style={{ color: TEXT }}>{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Services ─────────────────────────────────────────────────────────────────

function ServicesGrid({ services, heading, intro }: { services: any[]; heading?: string; intro?: string }) {
  if (!services?.length) return null;
  return (
    <section className="py-[76px]" style={{ background: "#fff" }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="section-heading max-w-[640px]">
          <h2 className="font-bold" style={{ color: TEXT, fontSize: "clamp(30px,3.6vw,42px)", letterSpacing: "-0.04em", lineHeight: 1.12 }}>
            {heading || "What we do"}
          </h2>
          {intro && <p className="mt-4 text-[16px] leading-[1.75]" style={{ color: BODY }}>{intro}</p>}
        </div>

        <div className="mt-11 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s: any, i: number) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              className="service-card group block rounded-[22px] p-6"
              style={{ ["--i" as any]: i % 3 }}
            >
              {/* Brand-coloured icon tile. A bare line icon on white was the thing
                  that made every card read the same at a glance. */}
              <span className="service-tile">
                <ServiceIcon slug={s.slug} className="w-7 h-7" color="#fff"/>
              </span>
              <h3 className="mt-5 font-bold text-[19px]" style={{ color: TEXT, letterSpacing: "-0.025em" }}>{s.name}</h3>
              {(s.tagline || s.description) && (
                <p className="mt-2 text-[14.5px] leading-[1.7]" style={{ color: BODY }}>{s.tagline || s.description}</p>
              )}
              <span className="service-more mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-bold">
                Find out more <ArrowUpRight className="w-3.5 h-3.5"/>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Tick list ────────────────────────────────────────────────────────────────

/**
 * The "what's included" checklist carried over from the original site.
 *
 * Each tick draws itself when the list scrolls into view, one after the next.
 * The stroke is animated with dasharray rather than a fade, so the mark is
 * actually drawn — a fading tick reads as a loading state, a drawn one reads as
 * something being confirmed, which is what a checklist is for.
 */
function BenefitsList({ items, heading }: { items?: string[] | null; heading?: string }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="py-[64px]" style={{ background: PALE_2 }}>
      <div className="mx-auto max-w-[900px] px-5 sm:px-8">
        {heading && (
          <h2 className="section-heading font-bold mb-8" style={{ color: TEXT, fontSize: "clamp(24px,2.8vw,32px)", letterSpacing: "-0.035em" }}>
            {heading}
          </h2>
        )}
        <ul className="tick-list grid sm:grid-cols-2 gap-x-8 gap-y-1">
          {items.map((t, i) => (
            <li key={i} className="tick-row" style={{ ["--i" as any]: i }}>
              <span className="tick-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path className="tick-path" d="M5 12.5l4.5 4.5L19 7.5"/>
                </svg>
              </span>
              <span className="tick-text">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProcessSteps({ steps }: { steps?: Array<{ title: string; description: string }> | null }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return (
    <section className="py-[70px]" style={{ background: "#fff" }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <h2 className="section-heading font-bold mb-10" style={{ color: TEXT, fontSize: "clamp(24px,2.8vw,32px)", letterSpacing: "-0.035em" }}>
          How it works
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <li key={i} className="step-card rounded-[20px] border p-6" style={{ borderColor: BORDER }}>
              <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 font-bold text-[17px]" style={{ color: TEXT, letterSpacing: "-0.02em" }}>{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.7]" style={{ color: BODY }}>{s.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Emergency panel ──────────────────────────────────────────────────────────

function EmergencyPanel({ settings }: { settings: any }) {
  const phone = settings?.phone;
  if (!phone) return null;
  return (
    <section className="py-[56px]" style={{ background: PALE }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="emergency rounded-[24px] px-7 py-9 sm:px-10 sm:py-11 flex flex-col lg:flex-row lg:items-center gap-7 lg:gap-10" style={{ background: NAVY }}>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white" style={{ fontSize: "clamp(26px,3vw,36px)", letterSpacing: "-0.035em", lineHeight: 1.15 }}>
              {settings?.emergencyHeadline || "Plumbing emergency? We're here."}
            </h2>
            <p className="mt-3 text-[15.5px] leading-[1.7] text-white/75 max-w-[560px]">
              {settings?.emergencyText || "Burst pipe, no heating, no hot water — call and speak to someone who can help. No form, no waiting."}
            </p>
          </div>
          <a href={telHref(phone)} className="bps-drop shrink-0 inline-flex items-center justify-center gap-3 h-14 px-7 rounded-[16px] font-bold text-[17px] text-white" style={{ background: ORANGE }}>
            <PhoneIcon color="#fff" className="w-5 h-5"/>{phone}
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Reviews ──────────────────────────────────────────────────────────────────

/**
 * What customers actually said.
 *
 * A swipeable rail on a phone and a grid on a desktop, from the same markup —
 * the rail is what a thumb expects, and six cards stacked vertically is a wall
 * of text nobody reaches the end of. The peeking next card is the affordance:
 * without it people do not know there is anything to swipe to.
 *
 * Pulled Google reviews say so and link back, because a review you can go and
 * verify is worth more than one you cannot.
 */
function Reviews({ reviews, heading, settings }: { reviews: any[]; heading?: string; settings?: any }) {
  if (!reviews?.length) return null;

  const rating = settings?.googleRating ? Number(settings.googleRating) : null;
  const total = settings?.googleReviewCount ? Number(settings.googleReviewCount) : null;
  const shown = reviews.slice(0, 9);

  return (
    <section className="py-[76px]" style={{ background: REVIEW_BG }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          {heading !== "" && (
            <h2 className="section-heading font-bold max-w-[640px]" style={{ color: TEXT, fontSize: "clamp(30px,3.6vw,42px)", letterSpacing: "-0.04em", lineHeight: 1.12 }}>
              {heading || "What our customers say"}
            </h2>
          )}

          {/* The headline figure is for the WHOLE Google profile, not the few
              reviews below it — so "4.9 from 213" is true even though five
              cards are shown. Google's API returns at most five. */}
          {rating !== null && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, n) => <Star key={n}/>)}
              </div>
              <p className="text-[14.5px] font-semibold" style={{ color: TEXT }}>
                {rating.toFixed(1)} on Google
                {total ? <span style={{ color: BODY, fontWeight: 500 }}> · {total} review{total === 1 ? "" : "s"}</span> : null}
              </p>
            </div>
          )}
        </div>

        {/* One list, two behaviours. Below sm it scrolls horizontally with snap
            points; from sm it becomes an ordinary grid and the scroll
            properties stop applying. */}
        <div className="review-rail mt-10">
          {shown.map((r: any, i: number) => (
            <article key={r.id ?? i} className="review-card rounded-[20px] border p-6" style={{ borderColor: BORDER, background: "#fff" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-0.5" aria-label={`${r.rating || 5} out of 5`}>
                  {Array.from({ length: r.rating || 5 }).map((_, n) => <Star key={n}/>)}
                </div>
                {r.platform === "Google" && (
                  <span className="text-[11px] font-bold tracking-[0.08em]" style={{ color: BODY }}>GOOGLE</span>
                )}
              </div>

              <p className="mt-4 text-[15px] leading-[1.75]" style={{ color: TEXT }}>{r.content}</p>

              <div className="mt-5 flex items-center gap-3">
                {r.photoUrl
                  ? <img src={r.photoUrl} alt="" loading="lazy" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  : <span className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold shrink-0"
                          style={{ background: PALE_2, color: BLUE_CTRL }}>
                      {(r.reviewerName || "?").trim().charAt(0).toUpperCase()}
                    </span>}
                <p className="text-[13.5px] font-semibold min-w-0" style={{ color: BODY }}>
                  <span className="block truncate">{r.reviewerName}</span>
                  {r.reviewerLocation && <span className="block text-[12.5px] font-normal truncate">{r.reviewerLocation}</span>}
                </p>
              </div>
            </article>
          ))}
        </div>

        {reviews.some((r: any) => r.platform === "Google" && r.platformUrl) && (
          <p className="mt-7 text-[14px]">
            <a
              href={reviews.find((r: any) => r.platform === "Google" && r.platformUrl)?.platformUrl}
              target="_blank" rel="noopener noreferrer"
              className="font-semibold" style={{ color: BLUE_CTRL }}
            >
              Read every review on Google ↗
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

// ── Areas ────────────────────────────────────────────────────────────────────

/**
 * Coverage is the section that wins local search for a trade business, so it gets
 * real estate and real content rather than a row of chips. Each area is a card
 * with its own copy and its own page; the chips version said nothing a customer
 * could act on and nothing Google could rank.
 */
function Areas({ areas, settings, services }: { areas: any[]; settings: any; services?: any[] }) {
  if (!areas?.length) return null;
  const base = settings?.serviceBase;
  const phone = settings?.phone;
  const serviceCount = services?.length ?? 0;

  return (
    <section className="py-[84px]" style={{ background: PALE_2 }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="section-heading max-w-[660px]">
          <p className="text-[12px] font-bold tracking-[0.14em] mb-3" style={{ color: BLUE_CTRL }}>
            {base ? `BASED IN ${String(base).toUpperCase()}` : "COVERAGE"}
          </p>
          <h2 className="font-bold" style={{ color: TEXT, fontSize: "clamp(30px,3.6vw,42px)", letterSpacing: "-0.04em", lineHeight: 1.12 }}>
            Where we work
          </h2>
          <p className="mt-4 text-[16px] leading-[1.75]" style={{ color: BODY }}>
            {settings?.serviceArea
              ? `We cover ${settings.serviceArea}. Every town below gets the same engineers, the same call-out, and the same standard of work — there is no "outer area" rate.`
              : "Every town below gets the same engineers, the same call-out and the same standard of work."}
          </p>
        </div>

        <div className="area-links mt-11 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {areas.map((a: any) => (
            <Link key={a.slug} href={`/areas/${a.slug}`} className="area-card block rounded-[22px] p-6">
              <span className="area-pin"><PinIcon/></span>
              <h3 className="mt-4 font-bold text-[19px]" style={{ color: TEXT, letterSpacing: "-0.025em" }}>{a.name}</h3>
              {a.county && <p className="mt-0.5 text-[13px] font-medium" style={{ color: BLUE_CTRL }}>{a.county}</p>}
              <p className="mt-3 text-[14.5px] leading-[1.7]" style={{ color: BODY }}>
                {a.description || (serviceCount
                  ? `All ${serviceCount} of our services are available in ${a.name}, including emergency call-outs.`
                  : `Plumbing and heating work across ${a.name}, including emergency call-outs.`)}
              </p>
              <span className="area-more mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-bold">
                Plumbers in {a.name} <ArrowUpRight className="w-3.5 h-3.5"/>
              </span>
            </Link>
          ))}
        </div>

        {phone && (
          <div className="area-note mt-9 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]" style={{ color: BODY }}>
            <span>Not sure if we reach you?</span>
            <a href={telHref(phone)} className="bps-pipe font-bold" style={{ color: BLUE_CTRL }}>Call {phone} and ask</a>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Area detail ──────────────────────────────────────────────────────────────

function AreaDetail({ tenant, settings, services, reviews, areas }: any) {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useGetPublicArea(tenant?.slug, slug);
  const area = data as any;
  const phone = settings?.phone;

  if (!area) return null;

  const hero = area.heroImageUrl || settings?.heroImageUrl;

  // Reviews left by customers in this town, where we have any. Real ones only —
  // the section simply does not appear otherwise.
  const local = (reviews || []).filter((r: any) =>
    r.reviewerLocation && String(r.reviewerLocation).toLowerCase().includes(String(area.name).toLowerCase()));

  const nearby = (areas || []).filter((a: any) => a.slug !== area.slug);

  return (
    <>
      <PageSEO
        title={area.seoTitle || `Plumbers in ${area.name} — ${tenant?.name}`}
        description={area.seoDescription || area.description || `Plumbing and heating in ${area.name}.`}
        image={hero}
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Plumber",
        name: tenant?.name,
        telephone: settings?.phone,
        areaServed: { "@type": "City", name: area.name },
      }}/>

      <section className="bps-inner-hero relative isolate overflow-hidden" style={{ background: NAVY }} aria-labelledby="area-heading">
        {hero && <img className="bps-hero-photo absolute inset-0 -z-20 h-full w-full object-cover" src={hero} alt="" fetchPriority="high" decoding="async"/>}
        <div className="bps-hero-shade absolute inset-0 -z-10" aria-hidden="true"/>

        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 py-[64px] lg:py-[92px]">
          <nav className="bps-rise flex items-center gap-2 text-[13px] text-white/60 mb-5" aria-label="Breadcrumb" style={{ animationDelay: "40ms" }}>
            <Link href="/" className="bps-pipe hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <span className="text-white/85">{area.name}</span>
          </nav>

          <div className="max-w-[680px]">
            <p className="bps-rise text-[12px] font-bold tracking-[0.14em] mb-3" style={{ color: BLUE_BRIGHT, animationDelay: "80ms" }}>
              {(area.county || "SERVICE AREA").toUpperCase()}
            </p>
            <h1 id="area-heading" className="bps-rise font-bold text-white" style={{ fontSize: "clamp(34px,5vw,58px)", lineHeight: 1.07, letterSpacing: "-0.045em", animationDelay: "130ms" }}>
              Plumbers in {area.name}
            </h1>
            {area.description && (
              <p className="bps-rise mt-5 text-[18px] leading-[1.65] text-white/85" style={{ animationDelay: "220ms" }}>
                {area.description}
              </p>
            )}
            <div className="bps-rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "310ms" }}>
              <QuoteButton>Get a free quote</QuoteButton>
              {phone && (
                <a href={telHref(phone)} className="bps-drop inline-flex items-center gap-3 h-12 px-5 rounded-[14px] border text-white font-semibold text-[15px]" style={{ borderColor: "rgba(255,255,255,.34)" }}>
                  <PhoneIcon color="#fff"/>
                  <span className="flex flex-col leading-tight text-left">
                    <span className="text-[11.5px] font-normal text-white/60">Need us now?</span>
                    <span>{phone}</span>
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <TrustStrip settings={settings}/>

      {area.content && (
        <section className="py-[72px]" style={{ background: "#fff" }}>
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-12">
            <div className="min-w-0">
              {String(area.content).split("\n\n").map((para: string, i: number) => (
                <p key={i} className="mb-5 text-[16.5px] leading-[1.85]" style={{ color: TEXT }}>{para}</p>
              ))}
            </div>

            <aside className="lg:sticky lg:top-[112px] h-fit">
              <div className="rounded-[22px] p-6" style={{ background: NAVY }}>
                <h2 className="font-bold text-white text-[20px]" style={{ letterSpacing: "-0.025em" }}>
                  Need someone in {area.name}?
                </h2>
                <p className="mt-2.5 text-[14.5px] leading-[1.7] text-white/70">
                  Tell us what is going on and we will come back with a written price.
                </p>
                <QuoteButton className="mt-5 w-full justify-center"/>
                {phone && (
                  <a href={telHref(phone)} className="bps-drop mt-3 flex items-center justify-center gap-2.5 h-12 rounded-[14px] border text-white font-semibold text-[15px]" style={{ borderColor: "rgba(255,255,255,.3)" }}>
                    <PhoneIcon color="#fff"/>{phone}
                  </a>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      <ServicesGrid services={services} heading={`What we do in ${area.name}`}
        intro={`Every one of our services is available in ${area.name}, including emergency call-outs.`}/>

      {local.length > 0 && <Reviews reviews={local} heading={`What ${area.name} customers say`} settings={settings}/>}

      {nearby.length > 0 && (
        <section className="py-[70px]" style={{ background: PALE_2 }}>
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
            <h2 className="section-heading font-bold" style={{ color: TEXT, fontSize: "clamp(24px,2.8vw,32px)", letterSpacing: "-0.035em" }}>
              We also cover
            </h2>
            <div className="area-links mt-7 flex flex-wrap gap-2.5">
              {nearby.map((a: any) => (
                <Link key={a.slug} href={`/areas/${a.slug}`}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-[12px] border bg-white text-[14.5px] font-medium transition-transform"
                  style={{ borderColor: BORDER, color: TEXT }}>
                  <PinIcon/>{a.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <EmergencyPanel settings={settings}/>
      <ClosingCta settings={settings}/>
    </>
  );
}

// ── Closing CTA ──────────────────────────────────────────────────────────────

function ClosingCta({ settings }: { settings: any }) {
  const phone = settings?.phone;
  return (
    <section className="quote-cta py-[80px]" style={{ background: BLUE }}>
      <div className="wrap mx-auto max-w-[1400px] px-5 sm:px-8">
        <h2 className="font-bold text-white max-w-[760px]" style={{ fontSize: "clamp(30px,4vw,48px)", letterSpacing: "-0.04em", lineHeight: 1.12 }}>
          {settings?.closingHeadline || "A warmer home is one conversation away."}
        </h2>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <QuoteButton/>
          {phone && <a href={telHref(phone)} className="bps-pipe text-white font-semibold text-[16px]">or call {phone}</a>}
        </div>
      </div>
    </section>
  );
}

/**
 * Floating WhatsApp button.
 *
 * Renders only when the tenant has a mobile number — a landline would open
 * WhatsApp to a chat that does not exist. UK numbers are normalised to the
 * international form WhatsApp requires.
 */
function WhatsAppFloat({ settings, tenant }: { settings: any; tenant: any }) {
  const raw = settings?.whatsappNumber || settings?.phone;
  if (!raw) return null;

  const digits = String(raw).replace(/[^\d+]/g, "");
  const intl = digits.startsWith("+") ? digits.slice(1)
    : digits.startsWith("0") ? `44${digits.slice(1)}`
    : digits;
  // A landline cannot receive WhatsApp. UK mobiles are 447xxxxxxxxx.
  if (!/^447\d{9}$/.test(intl)) return null;

  const text = encodeURIComponent(`Hi ${tenant?.name || ""}, I found you online and wanted to ask about`.trim());

  return (
    <a
      href={`https://wa.me/${intl}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bps-wa"
      aria-label="Message us on WhatsApp"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-7 h-7">
        <path d="M20.5 3.5A10 10 0 003.6 15.2L2.5 21.5l6.4-1.1A10 10 0 1020.5 3.5zM12 20a8 8 0 01-4-1.1l-.3-.2-3.1.5.6-3-.2-.3A8 8 0 1112 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5 0a6.5 6.5 0 01-1.9-1.2 7.3 7.3 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5.2-.4v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 00-.7.3A2.9 2.9 0 006 10a5 5 0 001.1 2.7 11.5 11.5 0 004.4 3.9 8.3 8.3 0 001.5.5 3.5 3.5 0 001.6.1 2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.2-1.2c-.1-.1-.2-.2-.4-.3z"/>
      </svg>
      <span className="bps-wa-label">WhatsApp us</span>
    </a>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function Footer({ tenant, settings, services }: { tenant: any; settings: any; services: any[] }) {
  return (
    <footer className="pt-[64px] pb-9" style={{ background: NAVY }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid md:grid-cols-3 gap-10 pb-10 border-b" style={{ borderColor: "rgba(255,255,255,.12)" }}>
          <div>
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt={tenant?.name} className="h-9 w-auto"/>
              : <span className="text-white font-bold text-[18px]">{tenant?.name}</span>}
            {settings?.aboutText && <p className="mt-5 text-[14px] leading-[1.75] text-white/60 max-w-[330px]">{settings.aboutText}</p>}
          </div>

          {services?.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-[14px] mb-4">Services</h3>
              <ul className="space-y-2.5">
                {services.slice(0, 7).map((s: any) => (
                  <li key={s.slug}><Link href={`/services/${s.slug}`} className="bps-pipe text-[14px] text-white/60 hover:text-white transition-colors">{s.name}</Link></li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-white font-semibold text-[14px] mb-4">Get in touch</h3>
            <ul className="space-y-2.5 text-[14px] text-white/60">
              {settings?.phone && <li><a href={telHref(settings.phone)} className="bps-pipe hover:text-white transition-colors">{settings.phone}</a></li>}
              {settings?.email && <li><a href={`mailto:${settings.email}`} className="bps-pipe hover:text-white transition-colors">{settings.email}</a></li>}
              {settings?.address && <li className="leading-[1.7]">{settings.address}</li>}
              {settings?.city && <li className="leading-[1.7]">{settings.city}</li>}
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-[12.5px] text-white/45">
          <span>© {new Date().getFullYear()} {tenant?.name}. All rights reserved.</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="bps-pipe hover:text-white/80 transition-colors">Privacy</Link>
            <Link href="/terms" className="bps-pipe hover:text-white/80 transition-colors">Terms</Link>
            <a href="https://launchflow.co.uk" className="bps-pipe hover:text-white/80 transition-colors">Powered by LaunchFlow</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────

function HomePage({ tenant, settings, services, areas, reviews }: any) {
  return (
    <>
      <PageSEO
        title={settings?.seoTitle || `${tenant?.name} — Plumbing & Heating`}
        description={settings?.seoDescription || settings?.aboutText}
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Plumber",
        name: tenant?.name,
        telephone: settings?.phone,
        email: settings?.email,
        areaServed: (areas || []).map((a: any) => a.name),
      }}/>
      <Hero tenant={tenant} settings={settings}/>
      <TrustStrip settings={settings}/>
      <ServicesGrid services={services} heading={settings?.servicesHeading} intro={settings?.servicesIntro}/>
      <EmergencyPanel settings={settings}/>
      <Reviews reviews={reviews} settings={settings}/>
      <Areas areas={areas} settings={settings} services={services}/>
      <ClosingCta settings={settings}/>
    </>
  );
}

function ServiceDetail({ tenant, settings, services, reviews, areas }: any) {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useGetPublicService(tenant?.slug, slug);
  const service = data as any;
  const phone = settings?.phone;

  if (!service) return null;

  const others = (services || []).filter((s: any) => s.slug !== service.slug).slice(0, 6);
  const hero = service.heroImageUrl || settings?.heroImageUrl;

  return (
    <>
      <PageSEO
        title={service.seoTitle || `${service.name} — ${tenant?.name}`}
        description={service.seoDescription || service.description || service.tagline || ""}
        image={hero}
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: service.name,
        description: service.description,
        provider: { "@type": "Plumber", name: tenant?.name, telephone: settings?.phone },
        areaServed: (areas || []).map((a: any) => a.name),
      }}/>

      {/* Full-bleed hero, the same shape as the homepage, so an inner page never
          feels like a different website. */}
      <section className="bps-inner-hero relative isolate overflow-hidden" style={{ background: NAVY }} aria-labelledby="svc-heading">
        {hero && <img className="bps-hero-photo absolute inset-0 -z-20 h-full w-full object-cover" src={hero} alt="" fetchPriority="high" decoding="async"/>}
        <div className="bps-hero-shade absolute inset-0 -z-10" aria-hidden="true"/>

        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 py-[64px] lg:py-[92px]">
          <nav className="bps-rise flex items-center gap-2 text-[13px] text-white/60 mb-5" aria-label="Breadcrumb" style={{ animationDelay: "40ms" }}>
            <Link href="/" className="bps-pipe hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/services" className="bps-pipe hover:text-white">Services</Link>
            <span aria-hidden="true">/</span>
            <span className="text-white/85">{service.name}</span>
          </nav>

          <div className="max-w-[660px]">
            <h1 id="svc-heading" className="bps-rise font-bold text-white" style={{ fontSize: "clamp(34px,5vw,62px)", lineHeight: 1.07, letterSpacing: "-0.045em", animationDelay: "120ms" }}>
              {service.name}
            </h1>
            {service.tagline && (
              <p className="bps-rise mt-5 text-[18px] leading-[1.65] text-white/85" style={{ animationDelay: "210ms" }}>
                {service.tagline}
              </p>
            )}
            <div className="bps-rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "300ms" }}>
              <QuoteButton>Get a free quote</QuoteButton>
              {phone && (
                <a href={telHref(phone)} className="bps-drop inline-flex items-center gap-3 h-12 px-5 rounded-[14px] border text-white font-semibold text-[15px]" style={{ borderColor: "rgba(255,255,255,.34)" }}>
                  <PhoneIcon color="#fff"/>
                  <span className="flex flex-col leading-tight text-left">
                    <span className="text-[11.5px] font-normal text-white/60">Need us now?</span>
                    <span>{phone}</span>
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <TrustStrip settings={settings}/>

      {/* Body beside a quote card that follows you down the page. The point of a
          service page is the enquiry, so the enquiry should never scroll away. */}
      <section className="py-[72px]" style={{ background: "#fff" }}>
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-12">
          <div className="min-w-0">
            {service.content
              ? String(service.content).split("\n\n").map((para: string, i: number) =>
                  para.startsWith("## ")
                    ? <h2 key={i} className="font-bold mt-11 mb-3 first:mt-0" style={{ color: TEXT, fontSize: "clamp(22px,2.6vw,29px)", letterSpacing: "-0.03em" }}>{para.slice(3)}</h2>
                    : <p key={i} className="mb-5 text-[16.5px] leading-[1.85]" style={{ color: TEXT }}>{para}</p>)
              : service.description && <p className="text-[16.5px] leading-[1.85]" style={{ color: TEXT }}>{service.description}</p>}

            {Array.isArray(service.benefits) && service.benefits.length > 0 && (
              <div className="mt-10">
                <h2 className="font-bold mb-6" style={{ color: TEXT, fontSize: "clamp(22px,2.6vw,29px)", letterSpacing: "-0.03em" }}>
                  What&rsquo;s included
                </h2>
                <ul className="tick-list grid sm:grid-cols-2 gap-x-8 gap-y-1">
                  {service.benefits.map((t: string, i: number) => (
                    <li key={i} className="tick-row" style={{ ["--i" as any]: i }}>
                      <span className="tick-box" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path className="tick-path" d="M5 12.5l4.5 4.5L19 7.5"/>
                        </svg>
                      </span>
                      <span className="tick-text">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-[112px] h-fit">
            <div className="rounded-[22px] p-6" style={{ background: NAVY }}>
              <h3 className="font-bold text-white text-[20px]" style={{ letterSpacing: "-0.025em" }}>
                Get a price for {service.name.toLowerCase()}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-[1.7] text-white/70">
                Tell us what you need and we&rsquo;ll come back with a written price. No obligation.
              </p>
              <QuoteButton className="mt-5 w-full justify-center"/>
              {phone && (
                <a href={telHref(phone)} className="bps-drop mt-3 flex items-center justify-center gap-2.5 h-12 rounded-[14px] border text-white font-semibold text-[15px]" style={{ borderColor: "rgba(255,255,255,.3)" }}>
                  <PhoneIcon color="#fff"/>{phone}
                </a>
              )}
              {Array.isArray(settings?.trustBadges) && settings.trustBadges.length > 0 && (
                <ul className="mt-6 pt-5 space-y-2.5 border-t" style={{ borderColor: "rgba(255,255,255,.14)" }}>
                  {(settings.trustBadges as string[]).slice(0, 4).map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-white/75">
                      <span className="mt-0.5 shrink-0"><Icon d="M5 12.5l4.5 4.5L19 7.5" className="w-4 h-4" color={BLUE_BRIGHT} strokeWidth={3}/></span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>

      <ProcessSteps steps={service.processSteps}/>
      <Reviews reviews={reviews} heading="What our customers say" settings={settings}/>
      <ServicesGrid services={others} heading="Other things we do" intro={settings?.serviceArea ? `We cover the lot, right across ${settings.serviceArea}.` : undefined}/>
      <Areas areas={areas} settings={settings} services={services}/>
      <EmergencyPanel settings={settings}/>
      <ClosingCta settings={settings}/>
    </>
  );
}

// ── Standard pages ───────────────────────────────────────────────────────────

/** Shared page opener so every inner page starts the same way. */
function PageHead({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <section className="py-[70px]" style={{ background: PALE_2 }}>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        {eyebrow && <p className="text-[12px] font-bold tracking-[0.14em] mb-3" style={{ color: BLUE_CTRL }}>{eyebrow.toUpperCase()}</p>}
        <h1 className="font-bold max-w-[820px]" style={{ color: TEXT, fontSize: "clamp(32px,4.4vw,52px)", letterSpacing: "-0.04em", lineHeight: 1.1 }}>{title}</h1>
        {intro && <p className="mt-5 text-[17px] leading-[1.75] max-w-[680px]" style={{ color: BODY }}>{intro}</p>}
      </div>
    </section>
  );
}

function AboutPage({ tenant, settings, services, areas }: any) {
  return (
    <>
      <PageSEO title={`About ${tenant?.name}`} description={settings?.aboutText || `About ${tenant?.name}.`}/>
      <PageHead eyebrow={settings?.serviceBase ? `Local to ${settings.serviceBase}` : undefined} title={`About ${tenant?.name}`} intro={settings?.aboutText}/>
      <TrustStrip settings={settings}/>
      {settings?.aboutImageUrl && (
        <section className="py-[56px]" style={{ background: "#fff" }}>
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
            <img src={settings.aboutImageUrl} alt={tenant?.name} className="w-full rounded-[22px]"/>
          </div>
        </section>
      )}
      <ServicesGrid services={services} heading="What we do"/>
      <Areas areas={areas} settings={settings} services={services}/>
      <EmergencyPanel settings={settings}/>
      <ClosingCta settings={settings}/>
    </>
  );
}

function ServicesPage({ tenant, settings, services }: any) {
  return (
    <>
      <PageSEO title={`Services — ${tenant?.name}`} description={`Plumbing and heating services from ${tenant?.name}.`}/>
      <PageHead
        eyebrow="Services"
        title="What we do"
        intro={settings?.serviceArea ? `Boilers, heating, bathrooms and emergencies across ${settings.serviceArea}.` : undefined}
      />
      <ServicesGrid services={services}/>
      <EmergencyPanel settings={settings}/>
      <ClosingCta settings={settings}/>
    </>
  );
}

function ReviewsPage({ tenant, settings, reviews }: any) {
  return (
    <>
      <PageSEO title={`Reviews — ${tenant?.name}`} description={`What customers say about ${tenant?.name}.`}/>
      <PageHead eyebrow="Reviews" title="What our customers say"/>
      {reviews?.length
        ? <Reviews reviews={reviews} heading="" settings={settings}/>
        : (
          // No invented testimonials. An empty state that tells the truth beats
          // filler that would also put false rating schema on the page.
          <section className="py-[70px]" style={{ background: "#fff" }}>
            <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
              <p className="text-[16px] leading-[1.8]" style={{ color: BODY }}>
                We're collecting reviews from recent customers and will publish them here as they come in.
                {settings?.phone ? " In the meantime, call and ask us for references — we're happy to give them." : ""}
              </p>
            </div>
          </section>
        )}
      <ClosingCta settings={settings}/>
    </>
  );
}

function ContactPage({ tenantSlug, tenant, settings }: any) {
  const phone = settings?.phone;
  // An email is long and a phone number is short, so they cannot share a type
  // size without one of them looking wrong or overflowing its box.
  const rows = [
    phone && {
      label: "Phone", value: phone, href: telHref(phone), size: "clamp(24px,2.6vw,30px)",
      note: "Fastest way to reach us, and you get a person.",
      icon: <PhoneIcon color="#fff" className="w-5 h-5"/>,
    },
    settings?.email && {
      label: "Email", value: settings.email, href: `mailto:${settings.email}`, size: "clamp(16px,1.6vw,19px)",
      note: "We read every one and reply the same day.",
      icon: <Icon d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-5 h-5" color="#fff"/>,
    },
    (settings?.serviceArea || settings?.address || settings?.city) && {
      label: "Where we work", value: settings.serviceArea || settings.address || settings.city,
      size: "clamp(18px,1.9vw,22px)",
      note: settings?.serviceBase ? `Based in ${settings.serviceBase}.` : undefined,
      icon: <Icon d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" className="w-5 h-5" color="#fff"/>,
    },
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string; size: string; note?: string; icon: React.ReactNode }>;

  return (
    <>
      <PageSEO title={`Contact — ${tenant?.name}`} description={`Get in touch with ${tenant?.name}.`}/>
      <PageHead eyebrow="Contact" title="Get in touch" intro="Tell us what's going on and we'll come back to you. If it's urgent, call — you'll get a person, not a form."/>

      {rows.length > 0 && (
        <section className="py-[56px]" style={{ background: "#fff" }}>
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rows.map(r => {
              const card = (
                <>
                  <span className="contact-icon">{r.icon}</span>
                  <p className="mt-5 text-[11.5px] font-bold tracking-[0.1em] uppercase" style={{ color: BLUE_CTRL }}>{r.label}</p>
                  {/* break-words, not truncate: an email address is the thing
                      somebody came for, so it wraps rather than being cut off. */}
                  <p className="mt-1.5 font-bold leading-[1.25] break-words" style={{ color: TEXT, fontSize: r.size }}>
                    {r.value}
                  </p>
                  {r.note && <p className="mt-2 text-[13.5px]" style={{ color: BODY }}>{r.note}</p>}
                </>
              );
              return r.href
                ? <a key={r.label} href={r.href} className="contact-card block rounded-[22px] border p-7" style={{ borderColor: BORDER }}>{card}</a>
                : <div key={r.label} className="contact-card rounded-[22px] border p-7" style={{ borderColor: BORDER }}>{card}</div>;
            })}
          </div>
        </section>
      )}

      <QuoteFormSection tenantSlug={tenantSlug} accent={BLUE_CTRL} panel={NAVY}/>
      <EmergencyPanel settings={settings}/>
    </>
  );
}

function LegalPage({ tenant, title, body }: { tenant: any; title: string; body?: string }) {
  return (
    <>
      <PageSEO title={`${title} — ${tenant?.name}`} description={`${title} for ${tenant?.name}.`} noindex/>
      <PageHead title={title}/>
      <section className="py-[56px]" style={{ background: "#fff" }}>
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 text-[15.5px] leading-[1.8] whitespace-pre-line" style={{ color: TEXT }}>
          {body || "This page is being prepared."}
        </div>
      </section>
    </>
  );
}

// ── Blog wrappers ────────────────────────────────────────────────────────────
// BlogIndexBody/BlogArticleBody take already-fetched data, so the fetching lives
// here rather than being pushed into the shared blog module — which keeps that
// module identical for all four templates.

function BlogIndexPage({ tenantSlug, tenant, settings }: any) {
  const base = useSiteBase();
  const { data: posts, isLoading } = useBrowsePublicBlog(tenantSlug);
  return <BlogIndexBody posts={posts as any[]} siteBase={base} tenant={tenant} settings={settings} isLoading={isLoading}/>;
}

function BlogArticlePage({ tenantSlug, tenant, settings, services }: any) {
  const base = useSiteBase();
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useGetPublicBlogPost(tenantSlug, slug);
  const { data: posts } = useBrowsePublicBlog(tenantSlug);
  return <BlogArticleBody post={post} posts={posts as any[]} siteBase={base} tenant={tenant} settings={settings} services={services} isLoading={isLoading}/>;
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function PlumbingSiteApp(props: { forcedSlug?: string; forcedBase?: string; forcedOrigin?: string; ssrPath?: string } = {}) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = props.forcedSlug || params.tenantSlug || "";
  // Slug routing on the platform domain is /site/<slug>; a custom domain passes
  // forcedBase="" so the same template serves both without a second code path.
  const base = props.forcedBase ?? (params.tenantSlug ? `/site/${params.tenantSlug}` : "");

  const { data: site } = useGetPublicSite(tenantSlug);
  const { data: services } = useListPublicServices(tenantSlug);
  const { data: areas } = useListPublicAreas(tenantSlug);
  const { data: reviews } = useListPublicReviews(tenantSlug);

  const tenant = (site as any)?.tenant;
  const settings = (site as any)?.settings;

  // Re-scan once the tenant content has arrived, otherwise the observer finds no cards.
  usePlumbingMotion((services?.length ?? 0) + (areas?.length ?? 0) + (reviews?.length ?? 0));

  useEffect(() => {
    if (settings?.googleAnalyticsId) initGoogleTag(settings.googleAnalyticsId);
  }, [settings?.googleAnalyticsId]);

  if (!tenant) return null;

  const shared = { tenant, settings, services: services || [], areas: areas || [], reviews: reviews || [] };

  return (
    <SiteOriginCtx.Provider value={props.forcedOrigin || ""}>
      <SiteBaseCtx.Provider value={base}>
        <WouterRouter base={base} ssrPath={props.ssrPath}>
          <ScrollToTopOnNavigate />
          <div className="min-h-screen flex flex-col" style={{ background: "#fff", color: TEXT, fontFamily: "Arial, Helvetica, system-ui, sans-serif" }}>
            <Header tenant={tenant} settings={settings} services={shared.services} areas={shared.areas}/>
            <main className="flex-1">
              <Switch>
                <Route path="/"><HomePage {...shared}/></Route>
                <Route path="/services"><ServicesPage {...shared}/></Route>
                <Route path="/services/:slug"><ServiceDetail {...shared}/></Route>
                <Route path="/reviews"><ReviewsPage {...shared}/></Route>
                <Route path="/about"><AboutPage {...shared}/></Route>
                <Route path="/areas/:slug"><AreaDetail {...shared}/></Route>
                <Route path="/privacy"><LegalPage tenant={tenant} title="Privacy Policy" body={settings?.privacyContent}/></Route>
                <Route path="/terms"><LegalPage tenant={tenant} title="Terms & Conditions" body={settings?.termsContent}/></Route>
                <Route path="/get-a-quote"><QuoteFormSection tenantSlug={tenantSlug} accent={BLUE_CTRL} panel={NAVY}/></Route>
                <Route path="/contact"><ContactPage tenantSlug={tenantSlug} tenant={tenant} settings={settings}/></Route>
                <Route path="/blog"><BlogIndexPage tenantSlug={tenantSlug} tenant={tenant} settings={settings}/></Route>
                <Route path="/blog/:slug"><BlogArticlePage tenantSlug={tenantSlug} tenant={tenant} settings={settings} services={shared.services}/></Route>
                <Route><HomePage {...shared}/></Route>
              </Switch>
            </main>
            <Footer tenant={tenant} settings={settings} services={shared.services}/>
            <WhatsAppFloat settings={settings} tenant={tenant}/>
            <CookieBanner siteBase={base}/>
          </div>
        </WouterRouter>
      </SiteBaseCtx.Provider>
    </SiteOriginCtx.Provider>
  );
}
