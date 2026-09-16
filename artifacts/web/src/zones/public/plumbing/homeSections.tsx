import { useMemo, useState } from "react";
import { useSubmitQuoteRequest } from "@workspace/api-client-react";
import { useSiteBase } from "../PublicSiteApp";

/**
 * The plumbing homepage, rebuilt around the two jobs that pay: a new boiler,
 * and a boiler that has stopped.
 *
 * WHY IT IS ITS OWN FILE. PlumbingSiteApp.tsx is already 1,600 lines and runs
 * every page of the site. These are the homepage sections and nothing else
 * renders them, so they sit apart rather than pushing that file past two
 * thousand.
 *
 * NOTHING HERE IS ABOUT ONE CLIENT. This template serves any plumbing tenant,
 * and a `slug === "bps"` branch in shared UI is exactly how this codebase leaked
 * one tenant's copy onto another's site once already. Every string falls back to
 * a sensible default and every list comes from the database — the two headline
 * services are matched out of the tenant's own service list, the rating is
 * computed from their own reviews, and a tenant with none of that still gets a
 * page that holds together.
 */

export const NAVY = "#102333";
export const ORANGE = "#F0882D";
export const BLUE = "#0892CF";
export const BLUE_DEEP = "#087EAE";
export const PALE = "#EDF5F9";
export const PALE_2 = "#F1F6F9";
export const BORDER = "#DCE4E9";

export function telHref(phone?: string | null): string {
  return `tel:${String(phone ?? "").replace(/[^\d+]/g, "")}`;
}

function SiteLink({ href, className, children, ...rest }: any) {
  const base = useSiteBase();
  const to = href?.startsWith("/") ? `${base}${href}` : href;
  return <a href={to} className={className} {...rest}>{children}</a>;
}

/* ── small pieces ─────────────────────────────────────────────────────────── */

function Tick({ color = ORANGE }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 mt-[3px]">
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Stars({ value = 5, size = 13 }: { value?: number; size?: number }) {
  return (
    <span className="inline-flex gap-[2px]" aria-label={`${value} out of 5`}>
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < Math.round(value) ? ORANGE : "#D7DEE4"} aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </span>
  );
}

/* ── 1. utility bar ───────────────────────────────────────────────────────── */

export function UtilityBar({ settings }: { settings: any }) {
  const area = settings?.serviceArea || settings?.serviceBase;
  return (
    <div className="bps-util hidden md:block border-b" style={{ background: "#F7FAFC", borderColor: BORDER }}>
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8 py-[9px] text-[12.5px]">
        <span style={{ color: "#5B7082" }}>
          {area ? `Your local boiler specialists in ${area}` : "Your local boiler and heating specialists"}
        </span>
        <SiteLink href="/quote" className="bps-util-link inline-flex items-center gap-1.5 font-semibold" style={{ color: NAVY }}>
          No heating or hot water? Let&rsquo;s get it sorted <Arrow className="bps-util-arrow"/>
        </SiteLink>
      </div>
    </div>
  );
}

/* ── 2. hero ──────────────────────────────────────────────────────────────── */

export function BoilerHero({ tenant, settings, reviews, services }: any) {
  const phone = settings?.phone;
  const image = settings?.heroImageUrl;
  const rated = ratingOf(reviews);

  const headline = settings?.heroHeadline;
  const warranty = settings?.heroBadge;

  return (
    <section className="bps-hero relative isolate w-full overflow-hidden" style={{ background: NAVY }} aria-labelledby="home-heading">
      {image && (
        <img
          className="bps-hero-photo absolute inset-0 -z-20 h-full w-full object-cover"
          style={{ objectPosition: "center right" }}
          src={image} alt="" fetchPriority="high" decoding="async"
        />
      )}
      <div className="bps-hero-shade absolute inset-0 -z-10" aria-hidden="true"/>

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 pt-[58px] pb-[132px] lg:pt-[76px] lg:pb-[150px]">
        <div className="max-w-[620px]">
          <p className="bps-rise flex items-center gap-3 text-[11.5px] font-bold tracking-[0.16em] mb-5" style={{ color: ORANGE, animationDelay: "40ms" }}>
            <span className="h-[2px] w-[22px] rounded-full" style={{ background: ORANGE }}/>
            {(settings?.heroEyebrow || "Boiler installations & repairs").toUpperCase()}
          </p>

          <h1 id="home-heading" className="bps-rise font-bold text-white" style={{ fontSize: "clamp(40px,5.6vw,72px)", lineHeight: 1.03, letterSpacing: "-0.05em", animationDelay: "120ms" }}>
            {headline || <>A warm home.<br/>A boiler you<br/>can <span className="bps-warm">rely on.</span></>}
          </h1>

          <p className="bps-rise mt-6 text-[16.5px] leading-[1.75] text-white/80 max-w-[470px]" style={{ animationDelay: "210ms" }}>
            {settings?.heroSubheadline || "A new boiler, or the one you have back on its feet. Straightforward advice and expert fitting from your local Gas Safe registered team."}
          </p>

          <div className="bps-rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "290ms" }}>
            <SiteLink href="/quote" className="bps-cta inline-flex items-center gap-3 h-[52px] px-6 rounded-[14px] font-bold text-[15.5px] text-white" style={{ background: ORANGE }}>
              Get my free quote <Arrow className="bps-cta-arrow"/>
            </SiteLink>
            {phone && (
              <a href={telHref(phone)} className="bps-ghost inline-flex flex-col leading-tight rounded-[14px] px-5 py-2.5 text-white">
                <span className="text-[11.5px] text-white/55">Boiler broken?</span>
                <span className="font-bold text-[15.5px]">Call {phone}</span>
              </a>
            )}
          </div>

          {rated && (
            <div className="bps-rise mt-8 flex items-center gap-3" style={{ animationDelay: "370ms" }}>
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-white text-[14px] font-bold" style={{ color: "#4285F4" }}>G</span>
              <Stars value={rated.average}/>
              <span className="text-[13px] text-white/75">
                <strong className="text-white">{rated.average.toFixed(1)}/5</strong> from {rated.count} Google {rated.count === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>
      </div>

      {warranty && (
        <div className="bps-badge absolute right-6 bottom-[150px] hidden lg:flex items-center gap-3 rounded-[14px] px-5 py-3.5" style={{ background: "rgba(16,35,51,.82)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(6px)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6l7-3z" stroke={ORANGE} strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          <span className="flex flex-col leading-tight">
            <strong className="text-white text-[14px]">{warranty}</strong>
            <span className="text-[11.5px] text-white/60">On new boiler installations</span>
          </span>
        </div>
      )}
    </section>
  );
}

/** The star rating, computed from the tenant's own reviews rather than claimed. */
function ratingOf(reviews: any[] | undefined) {
  const list = (reviews ?? []).filter(r => Number(r?.rating) > 0);
  if (!list.length) return null;
  const average = list.reduce((sum, r) => sum + Number(r.rating), 0) / list.length;
  return { average, count: list.length };
}

/* ── 3. the quote card that overlaps the hero ─────────────────────────────── */

export function HeroQuoteCard({ tenantSlug, settings, services }: { tenantSlug: string; settings: any; services: any[] }) {
  const mutation = useSubmitQuoteRequest();
  const [intent, setIntent] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", postcode: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const choices = useMemo(() => headlineServices(services), [services]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      setError("Your name, and a phone number or email so we can come back to you.");
      return;
    }
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    try {
      await mutation.mutateAsync({
        tenantSlug,
        data: {
          firstName,
          lastName: rest.join(" "),
          phone: form.phone.trim(),
          email: form.email.trim(),
          postcode: form.postcode.trim(),
          serviceInterest: intent || undefined,
          notes: intent ? `Enquiry from the homepage: ${intent}` : "Enquiry from the homepage",
        },
      } as any);
      setDone(true);
    } catch {
      setError("That did not send. Please try again, or give us a call.");
    }
  }

  const field = "h-[46px] w-full rounded-[11px] border px-3.5 text-[15px] outline-none transition focus:border-[#087EAE] focus:ring-2 focus:ring-[#087EAE]/20";

  return (
    <div className="relative z-10 mx-auto -mt-[100px] max-w-[1160px] px-5 sm:px-8">
      <div className="bps-quotecard rounded-[18px] bg-white p-6 sm:p-8" style={{ border: `1px solid ${BORDER}` }}>
        {done ? (
          <div className="py-6 text-center">
            <p className="text-[12px] font-bold tracking-[0.14em]" style={{ color: ORANGE }}>THANK YOU</p>
            <h2 className="mt-3 font-bold" style={{ fontSize: "clamp(24px,3vw,32px)", color: NAVY, letterSpacing: "-0.03em" }}>
              We have got that.
            </h2>
            <p className="mt-2 text-[15px]" style={{ color: "#5B7082" }}>
              We will come back to you shortly. If it is urgent, {settings?.phone ? <a href={telHref(settings.phone)} className="font-semibold" style={{ color: BLUE_DEEP }}>call {settings.phone}</a> : "give us a call"}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11.5px] font-bold tracking-[0.15em]" style={{ color: ORANGE }}>LET&rsquo;S GET IT SORTED</p>
                <h2 className="mt-2 font-bold" style={{ fontSize: "clamp(21px,2.4vw,27px)", color: NAVY, letterSpacing: "-0.03em" }}>
                  {settings?.quoteCardHeading || "Your warmer home starts here."}
                </h2>
              </div>
              <p className="flex items-center gap-2 text-[13px]" style={{ color: "#5B7082" }}>
                <Tick color={BLUE}/> Free quote. No obligation.
              </p>
            </div>

            {choices.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="text-[13px] font-semibold" style={{ color: "#5B7082" }}>I&rsquo;m looking for&hellip;</span>
                {choices.map(c => (
                  <button
                    key={c.label} type="button"
                    onClick={() => setIntent(intent === c.label ? "" : c.label)}
                    aria-pressed={intent === c.label}
                    className="bps-chip inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[13.5px] font-semibold transition"
                    style={intent === c.label
                      ? { borderColor: ORANGE, background: "#FFF4E9", color: "#9A5412" }
                      : { borderColor: BORDER, background: "#fff", color: "#3C5262" }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              <label className="block lg:col-span-1">
                <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: "#3C5262" }}>Your name</span>
                <input className={field} style={{ borderColor: BORDER }} placeholder="e.g. Alex Smith" autoComplete="name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
              </label>
              <label className="block lg:col-span-1">
                <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: "#3C5262" }}>Phone number</span>
                <input className={field} style={{ borderColor: BORDER }} placeholder="Your contact number" inputMode="tel" autoComplete="tel"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/>
              </label>
              <label className="block lg:col-span-1">
                <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: "#3C5262" }}>Email address</span>
                <input className={field} style={{ borderColor: BORDER }} placeholder="you@example.com" type="email" autoComplete="email"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
              </label>
              <label className="block lg:col-span-1">
                <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: "#3C5262" }}>Postcode</span>
                <input className={field} style={{ borderColor: BORDER }} placeholder="e.g. RM17 6XX" autoComplete="postal-code"
                  value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))}/>
              </label>
              <div className="flex items-end lg:col-span-1">
                <button type="submit" disabled={mutation.isPending}
                  className="bps-cta inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[11px] font-bold text-[15px] text-white disabled:opacity-60"
                  style={{ background: ORANGE }}>
                  {mutation.isPending ? "Sending…" : <>Request boiler help <Arrow className="bps-cta-arrow"/></>}
                </button>
              </div>
            </div>

            {error && <p className="mt-3 text-[13.5px] font-medium text-red-600">{error}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: "#7B8C99" }}>
              <span>We&rsquo;ll use your details to respond to your enquiry.</span>
              {settings?.phone && (
                <a href={telHref(settings.phone)} className="font-semibold" style={{ color: BLUE_DEEP }}>Need help now? Call us</a>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── 4. the two that pay ──────────────────────────────────────────────────── */

const INSTALL_WORDS = ["install", "new boiler", "replacement", "fitting"];
const REPAIR_WORDS = ["repair", "breakdown", "fault", "emergency", "no heating"];

function matches(service: any, words: string[]): boolean {
  const hay = `${service?.name ?? ""} ${service?.slug ?? ""} ${service?.tagline ?? ""}`.toLowerCase();
  return words.some(w => hay.includes(w));
}

/** The two the quote card offers as choices, taken from the tenant's own list. */
function headlineServices(services: any[]): Array<{ label: string }> {
  const install = (services ?? []).find(s => matches(s, INSTALL_WORDS));
  const repair = (services ?? []).find(s => matches(s, REPAIR_WORDS));
  const out = [
    { label: install ? "A new boiler" : "" },
    { label: repair ? "A boiler repair" : "" },
  ].filter(c => c.label);
  return out.length ? out : (services ?? []).slice(0, 2).map(s => ({ label: s.name }));
}

export function TwoPathCards({ services, settings }: { services: any[]; settings: any }) {
  const install = (services ?? []).find(s => matches(s, INSTALL_WORDS));
  const repair = (services ?? []).find(s => matches(s, REPAIR_WORDS));
  // Nothing to show rather than an invented pair: a tenant whose services do
  // not include these gets the grid below and no empty promises.
  if (!install && !repair) return null;

  const installPoints = (install?.benefits ?? []).slice(0, 3);
  const repairPoints = (repair?.benefits ?? []).slice(0, 3);

  return (
    <section className="py-[86px]" style={{ background: "#fff" }}>
      <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
        <div className="bps-reveal flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-3 text-[11.5px] font-bold tracking-[0.16em]" style={{ color: ORANGE }}>
              <span className="h-[2px] w-[22px] rounded-full" style={{ background: ORANGE }}/>
              {(settings?.servicesEyebrow || "Whatever your boiler needs").toUpperCase()}
            </p>
            <h2 className="mt-4 font-bold" style={{ fontSize: "clamp(30px,3.9vw,44px)", lineHeight: 1.1, letterSpacing: "-0.04em", color: NAVY }}>
              {settings?.servicesHeading || <>New start.<br/>Or back to its best.</>}
            </h2>
          </div>
          <p className="max-w-[330px] text-[14.5px] leading-[1.7]" style={{ color: "#5B7082" }}>
            {settings?.servicesIntro || "Replacing an old boiler or getting the heating back on? We'll help you make the right call for your home."}
          </p>
        </div>

        <div className="mt-11 grid gap-6 lg:grid-cols-2">
          {install && (
            <PathCard
              service={install} points={installPoints} tone="light"
              badge={settings?.heroBadge ? `${settings.heroBadge}*` : "Boiler installation"}
              title={install.tagline || "Better heating. For the long run."}
              body={install.description}
              cta="Get my installation quote"
            />
          )}
          {repair && (
            <PathCard
              service={repair} points={repairPoints} tone="dark"
              badge="Emergency call-outs"
              title={repair.tagline || "No heating? Let's put that right."}
              body={repair.description}
              cta="Get help with my boiler"
            />
          )}
        </div>

        {settings?.heroBadge && (
          <p className="mt-5 text-[11.5px] leading-relaxed" style={{ color: "#8A9AA6" }}>
            *Your quote will confirm the cover, terms and servicing requirements for your chosen boiler.
          </p>
        )}
      </div>
    </section>
  );
}

function PathCard({ service, points, tone, badge, title, body, cta }: any) {
  const dark = tone === "dark";
  return (
    <SiteLink
      href={`/services/${service.slug}`}
      className="bps-path group flex flex-col overflow-hidden rounded-[18px]"
      style={dark
        ? { background: NAVY }
        : { background: "#fff", border: `1px solid ${BORDER}` }}
    >
      <span className="relative block h-[210px] overflow-hidden" style={{ background: dark ? "#0B1B29" : PALE }}>
        {service.heroImageUrl && (
          <img src={service.heroImageUrl} alt="" loading="lazy" decoding="async"
            className="bps-path-img h-full w-full object-cover"/>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[9px] px-3 py-1.5 text-[11px] font-bold tracking-[0.08em]"
          style={dark
            ? { background: "rgba(8,146,207,.92)", color: "#fff" }
            : { background: "rgba(255,255,255,.94)", color: "#9A5412" }}>
          {String(badge).toUpperCase()}
        </span>
      </span>

      <span className="flex flex-1 flex-col p-7">
        <strong className="font-bold" style={{ fontSize: "clamp(21px,2.3vw,26px)", lineHeight: 1.18, letterSpacing: "-0.032em", color: dark ? "#fff" : NAVY }}>
          {title}
        </strong>
        {body && (
          <span className="mt-3 block text-[14.5px] leading-[1.7]" style={{ color: dark ? "rgba(255,255,255,.72)" : "#5B7082" }}>
            {body}
          </span>
        )}

        {points.length > 0 && (
          <span className="mt-5 flex flex-col gap-2.5">
            {points.map((p: string) => (
              <span key={p} className="flex gap-2.5 text-[14px]" style={{ color: dark ? "rgba(255,255,255,.82)" : "#3C5262" }}>
                <Tick color={dark ? BLUE : ORANGE}/> {p}
              </span>
            ))}
          </span>
        )}

        <span className="mt-auto pt-7 inline-flex items-center gap-2 text-[14.5px] font-bold" style={{ color: dark ? ORANGE : NAVY }}>
          {cta} <Arrow className="bps-path-arrow"/>
        </span>
      </span>
    </SiteLink>
  );
}

/* ── 5. the rest of the work ──────────────────────────────────────────────── */

const GROUPS = [
  { key: "heating", title: "Heating & comfort", sub: "Keep every room feeling right.", words: ["heat", "radiator", "boiler", "thermostat", "underfloor", "power flush"] },
  { key: "water", title: "Plumbing & water", sub: "From little fixes to fresh starts.", words: ["plumb", "bathroom", "toilet", "leak", "tap", "drain", "shower", "water", "blockage"] },
  { key: "gas", title: "Gas & safety", sub: "Care where it matters most.", words: ["gas", "safety", "certificate", "landlord", "cooker", "hob", "fire"] },
];

export function ServiceGroups({ services, settings }: { services: any[]; settings: any }) {
  const rest = (services ?? []).filter(s => !matches(s, INSTALL_WORDS) && !matches(s, REPAIR_WORDS));
  if (!rest.length) return null;

  // Each service lands in the first group it matches, so nothing is listed
  // twice; anything unmatched joins the largest group rather than vanishing.
  const buckets: Record<string, any[]> = { heating: [], water: [], gas: [], other: [] };
  for (const s of rest) {
    const group = GROUPS.find(g => matches(s, g.words));
    buckets[group?.key ?? "other"].push(s);
  }
  if (buckets.other.length) {
    const biggest = GROUPS.map(g => g.key).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    buckets[biggest].push(...buckets.other);
  }

  const shown = GROUPS.filter(g => buckets[g.key].length);

  return (
    <section className="py-[86px]" style={{ background: PALE_2 }}>
      <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
        <div className="bps-reveal flex flex-wrap items-end justify-between gap-5">
          <h2 className="font-bold" style={{ fontSize: "clamp(26px,3.2vw,36px)", letterSpacing: "-0.035em", color: NAVY }}>
            {settings?.otherServicesHeading || "The rest of your home? Covered."}
          </h2>
          <p className="text-[14px]" style={{ color: BLUE_DEEP }}>One team. All the essentials.</p>
        </div>

        <div className="mt-9 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((g, i) => (
            <div key={g.key} className="bps-reveal bps-group flex flex-col rounded-[18px] bg-white p-7"
              style={{ border: `1px solid ${BORDER}`, animationDelay: `${i * 90}ms` }}>
              <div className="flex items-start gap-3.5">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[13px]" style={{ background: PALE }}>
                  <GroupIcon which={g.key}/>
                </span>
                <span>
                  <strong className="block text-[19px] font-bold leading-tight" style={{ color: NAVY, letterSpacing: "-0.025em" }}>{g.title}</strong>
                  <span className="mt-1 block text-[13.5px]" style={{ color: "#6C808F" }}>{g.sub}</span>
                </span>
              </div>

              <ul className="mt-6 flex flex-col">
                {buckets[g.key].map((s: any) => (
                  <li key={s.slug}>
                    <SiteLink href={`/services/${s.slug}`}
                      className="bps-grouplink flex items-center justify-between gap-3 border-t py-[15px] text-[15.5px] font-semibold"
                      style={{ borderColor: "#EBF1F5", color: NAVY }}>
                      <span>{s.name}</span>
                      <Arrow className="bps-grouplink-arrow shrink-0"/>
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bps-reveal mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-white px-7 py-6" style={{ border: `1px solid ${BORDER}` }}>
          <span>
            <strong className="block text-[16.5px] font-bold" style={{ color: NAVY }}>Not sure what you need?</strong>
            <span className="mt-1 block text-[14px]" style={{ color: "#6C808F" }}>Tell us what&rsquo;s happening. We&rsquo;ll help you find the next step.</span>
          </span>
          <SiteLink href="/contact" className="bps-textlink inline-flex items-center gap-2 text-[14.5px] font-bold" style={{ color: NAVY }}>
            Let&rsquo;s talk it through <Arrow className="bps-textlink-arrow"/>
          </SiteLink>
        </div>
      </div>
    </section>
  );
}

function GroupIcon({ which }: { which: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as any;
  if (which === "water") {
    return <svg {...common}><path d="M12 3s6 6.4 6 10.4A6 6 0 016 13.4C6 9.4 12 3 12 3z" stroke={BLUE} strokeWidth="1.7" strokeLinejoin="round"/></svg>;
  }
  if (which === "gas") {
    return <svg {...common}><path d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6l7-3z" stroke={ORANGE} strokeWidth="1.7" strokeLinejoin="round"/><path d="M9.2 12.2l2 2 3.6-3.8" stroke={ORANGE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  }
  return <svg {...common}><path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.6 6.6L5.2 5.2M18.8 18.8l-1.4-1.4M6.6 17.4l-1.4 1.4M18.8 5.2l-1.4 1.4" stroke={BLUE} strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="12" r="3.4" stroke={BLUE} strokeWidth="1.7"/></svg>;
}

/* ── 6. how it goes ───────────────────────────────────────────────────────── */

const DEFAULT_STEPS = [
  { title: "Tell us what you need", description: "Send a few details or give us a call. We'll discuss your boiler, your home and how soon you need help." },
  { title: "Know where you stand", description: "Get clear advice and an agreed price. For a new boiler, we'll survey your home and put the quote in writing." },
  { title: "Leave it with us", description: "We complete the work, check everything is running properly, and make sure you're happy with the controls." },
];

export function ProcessRow({ settings }: { settings: any }) {
  const steps = (settings?.processSteps?.length ? settings.processSteps : DEFAULT_STEPS).slice(0, 3);
  return (
    <section className="py-[80px]" style={{ background: "#fff" }}>
      <div className="mx-auto grid max-w-[1160px] gap-10 px-5 sm:px-8 lg:grid-cols-[300px_1fr]">
        <div className="bps-reveal">
          <p className="flex items-center gap-3 text-[11.5px] font-bold tracking-[0.16em]" style={{ color: ORANGE }}>
            <span className="h-[2px] w-[22px] rounded-full" style={{ background: ORANGE }}/>
            NO COMPLICATED PROCESS
          </p>
          <h2 className="mt-4 font-bold" style={{ fontSize: "clamp(26px,3.1vw,34px)", lineHeight: 1.12, letterSpacing: "-0.035em", color: NAVY }}>
            From first call<br/>to feeling warm.
          </h2>
          <SiteLink href="/quote" className="bps-textlink mt-5 inline-flex items-center gap-2 text-[14.5px] font-bold" style={{ color: ORANGE }}>
            Let&rsquo;s get started <Arrow className="bps-textlink-arrow"/>
          </SiteLink>
        </div>

        <ol className="grid gap-8 sm:grid-cols-3">
          {steps.map((s: any, i: number) => (
            <li key={s.title} className="bps-reveal border-t pt-5" style={{ borderColor: BORDER, animationDelay: `${i * 110}ms` }}>
              <span className="block text-[30px] font-bold leading-none" style={{ color: "#CBD8E1", letterSpacing: "-0.04em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong className="mt-4 block text-[16.5px] font-bold" style={{ color: NAVY }}>{s.title}</strong>
              <span className="mt-2.5 block text-[14px] leading-[1.75]" style={{ color: "#6C808F" }}>{s.description}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── 7. questions ─────────────────────────────────────────────────────────── */

export function HomeFaqs({ faqs, settings }: { faqs: any[]; settings: any }) {
  const list = (faqs ?? []).slice(0, 5);
  const [open, setOpen] = useState<number | null>(0);
  if (!list.length) return null;

  return (
    <section className="py-[82px]" style={{ background: PALE_2 }}>
      <div className="mx-auto grid max-w-[1160px] gap-10 px-5 sm:px-8 lg:grid-cols-[320px_1fr]">
        <div className="bps-reveal">
          <p className="flex items-center gap-3 text-[11.5px] font-bold tracking-[0.16em]" style={{ color: ORANGE }}>
            <span className="h-[2px] w-[22px] rounded-full" style={{ background: ORANGE }}/>
            A LITTLE MORE REASSURANCE
          </p>
          <h2 className="mt-4 font-bold" style={{ fontSize: "clamp(26px,3.1vw,34px)", lineHeight: 1.12, letterSpacing: "-0.035em", color: NAVY }}>
            Good questions.<br/>Straight answers.
          </h2>
          <p className="mt-4 text-[14.5px] leading-[1.7]" style={{ color: "#6C808F" }}>
            Not sure what your boiler needs? We&rsquo;re happy to talk it through.
          </p>
          {settings?.phone && (
            <a href={telHref(settings.phone)} className="bps-textlink mt-4 inline-flex items-center gap-2 text-[15.5px] font-bold" style={{ color: ORANGE }}>
              {settings.phone}
            </a>
          )}
        </div>

        <div className="bps-reveal">
          {list.map((f: any, i: number) => (
            <div key={f.id ?? i} className="border-b" style={{ borderColor: "#DFE8EE" }}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
                className="bps-faq flex w-full items-center justify-between gap-5 py-[19px] text-left text-[15.5px] font-semibold" style={{ color: NAVY }}>
                {f.question}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  className="shrink-0 transition-transform duration-300" style={{ transform: open === i ? "rotate(180deg)" : "none" }}>
                  <path d="M6 9l6 6 6-6" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="bps-faq-body grid transition-all duration-300" style={{ gridTemplateRows: open === i ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <p className="pb-5 pr-8 text-[14.5px] leading-[1.8]" style={{ color: "#6C808F" }}>{f.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 8. closing ───────────────────────────────────────────────────────────── */

export function WarmthCta({ settings, areas }: { settings: any; areas: any[] }) {
  const phone = settings?.phone;
  return (
    <section className="py-[76px]" style={{ background: NAVY }}>
      <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
        <div className="bps-reveal flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="text-[11.5px] font-bold tracking-[0.16em]" style={{ color: ORANGE }}>LOCAL EXPERTISE. LASTING WARMTH.</p>
            <h2 className="mt-4 font-bold text-white" style={{ fontSize: "clamp(30px,4vw,46px)", lineHeight: 1.08, letterSpacing: "-0.045em" }}>
              Let&rsquo;s bring<br/>the <span className="bps-warm">warmth back.</span>
            </h2>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.7] text-white/70">
              New boiler or an unexpected breakdown. Your local team is one conversation away.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4">
            <SiteLink href="/quote" className="bps-cta inline-flex items-center gap-3 h-[52px] px-6 rounded-[14px] font-bold text-[15.5px] text-white" style={{ background: ORANGE }}>
              Get my free quote <Arrow className="bps-cta-arrow"/>
            </SiteLink>
            {phone && (
              <a href={telHref(phone)} className="bps-textlink inline-flex items-center gap-2.5 text-[19px] font-bold text-white">
                {phone}
              </a>
            )}
          </div>
        </div>

        {areas?.length > 0 && (
          <div className="bps-reveal mt-12 flex flex-wrap items-center gap-x-7 gap-y-2 border-t pt-6 text-[13px]" style={{ borderColor: "rgba(255,255,255,.13)" }}>
            <span className="font-bold tracking-[0.1em] text-white/45">PROUDLY LOCAL</span>
            {areas.slice(0, 8).map((a: any) => (
              <SiteLink key={a.slug} href={`/areas/${a.slug}`} className="bps-arealink text-white/65">{a.name}</SiteLink>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
