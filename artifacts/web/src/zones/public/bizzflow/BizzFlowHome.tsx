import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthCtx } from "@/lib/auth";
import { BizzFlowSymbol, BizzFlowWordmark } from "./BizzFlowBrand";
import { useScrollMeter, useScrollReveals, useSmoothAnchors } from "./useBizzFlowChrome";
import BizzFlowSeo from "./BizzFlowSeo";
import "./bizzflow.css";
import "./bizzflow-overrides.css";

/**
 * The BizzFlowUK marketing homepage.
 *
 * A direct port of the handoff's reference/index.html. Class names and element
 * relationships are preserved exactly, because the stylesheet leans on direct
 * children, `:first-child`, `nth-of-type` and sibling order in a lot of places —
 * an extra wrapping <div> breaks the layout without changing a single class.
 * Where a wrapper would have been convenient, this uses a fragment instead.
 *
 * The three interactive bits from reference/site.js — the mobile menu, the
 * workflow step selector and the industry selector — are React state here
 * rather than DOM mutation. Their copy is reproduced verbatim from site.js.
 *
 * Links: hrefs stay plain. The app's <Router base={basePath}> already resolves
 * them, and prepending the base here as well produces /base/base/demo and sends
 * every link nowhere. That exact bug has already cost this project a day.
 */

/** The four workflow steps. Copy verbatim from reference/site.js. */
const JOURNEY = [
  {
    number: "01",
    heading: "Win the work",
    summary: "Your website brings the enquiry straight into your customer pipeline.",
    label: "Website → Customer",
    detailLabel: "01 / WEBSITE TO CUSTOMER",
    detail:
      "An enquiry arrives with the customer's details and the work they need. Your next conversation starts with the full picture.",
    view: "customers",
  },
  {
    number: "02",
    heading: "Make a plan",
    summary: "Prepare the quote and move the approved work into your schedule.",
    label: "Quote → Schedule",
    detailLabel: "02 / QUOTE TO SCHEDULE",
    detail:
      "Build a clear quote from the job details. Once approved, the work has a place in your schedule and your team knows what is coming.",
    view: "quotes",
  },
  {
    number: "03",
    heading: "Get it done",
    summary: "Keep the team, job details and customer updates in one place.",
    label: "Team → Completed job",
    detailLabel: "03 / TEAM TO COMPLETED JOB",
    detail:
      "See the assigned team, location and status together. Keep the customer and job details close as the work progresses.",
    view: "jobs",
  },
  {
    number: "04",
    heading: "Close the loop",
    summary: "Raise the invoice and keep a clear record of the work and payment.",
    label: "Invoice → Business overview",
    detailLabel: "04 / INVOICE TO BUSINESS OVERVIEW",
    detail:
      "The completed job stays connected to its invoice, helping you see what is paid and what still needs a follow-up.",
    view: "invoices",
  },
] as const;

/**
 * The industries, matched to what actually exists.
 *
 * The reference listed Engineering and Paving. Neither has a site template and
 * neither has a client — they were promises with nothing behind them. Rendering
 * was missing entirely despite being a live client with its own template. This
 * list is the four templates the platform ships, plus a catch-all.
 */
const INDUSTRIES = [
  {
    name: "Rendering & external walls",
    title: "Quote the wall, not the guesswork.",
    description:
      "Keep surveys, render and insulation quotes, job photographs and invoices attached to each property as the work moves.",
  },
  {
    name: "Construction",
    title: "From site survey to final handover.",
    description:
      "Keep enquiries, project quotes, site schedules and customer records connected as each build moves forward.",
  },
  {
    name: "Landscaping & groundworks",
    title: "From the first idea to the final planting.",
    description:
      "Connect garden enquiries, site visits, design quotes and seasonal work without losing the customer details.",
  },
  {
    name: "Plumbing & heating",
    title: "Keep the work flowing, and the certificates current.",
    description:
      "Enquiries, installation quotes, appointments and job records in one place - with Gas Safe certificates issued, stored and renewed on time.",
  },
  {
    name: "Other trades",
    title: "Your expertise. A more organised business.",
    description:
      "Bring your website, customer records, quotes, workload and invoices together around the way your business works.",
  },
] as const;

/**
 * What somebody deciding whether to pay actually wants to know.
 *
 * The reference's five questions were all about the demo. Useful, but nobody
 * has ever asked "does your demo take payments?" before asking what it costs
 * and who builds the website.
 */
const FAQS = [
  {
    q: "What does it cost?",
    a: "£99 a month, everything included — your website, the whole toolkit, hosting and support. No setup fee, no per-user charge, no separate website bill. The first seven days are free.",
  },
  {
    q: "Who builds my website?",
    a: "We do, during your free trial. You sign up, tell us about the business, and we build your site inside the first week — usually within two days. You use the toolkit straight away while that happens.",
  },
  {
    q: "What if I don't like it?",
    a: "Cancel in the trial and you pay nothing. Cancel later and you stop at the end of that month. Your data is yours — ask and we export it.",
  },
  {
    q: "Is this just a website builder?",
    a: "No. The website is your front door. Behind it you get customers, quotes, invoices, card payments, projects, a schedule, cash flow, expenses, Gas Safe certificates and a customer portal — all connected, so an enquiry becomes a quote becomes a job becomes a paid invoice without retyping anything.",
  },
  {
    q: "Which businesses is it built for?",
    a: "UK trades: rendering, construction, landscaping, groundworks, plumbing and heating. Independent owners and small teams. If your trade is not on that list, the toolkit still fits — ask us about the website.",
  },
  {
    q: "Can I take card payments?",
    a: "Yes. Send a payment link with a quote or invoice and the customer pays by card. Connect your own Square or Stripe account, so the money goes straight to you and we never sit in the middle of it.",
  },
  {
    q: "Can I use it on site as well as in the office?",
    a: "Yes. It works on a phone, a tablet and a desktop — the same workspace wherever you are.",
  },
] as const;

/**
 * Every capability, opened with the situation it exists for.
 *
 * "Properties - per-property history" makes nobody picture anything. "The
 * letting agent rings asking what you did at number 12" makes them picture it
 * exactly, and that is the difference between a feature list and a reason to
 * buy.
 *
 * Each `when` is a real job a UK trade actually has, and each maps to a screen
 * that exists in the dashboard today - nothing here is a promise.
 */
const CAPABILITIES = [
  {
    when: "It is 11pm and someone searches “boiler repair Grays”.",
    title: "A website that answers the phone when you cannot",
    body: "Built for your trade, your work and your area — not a template with your logo dropped in. When they fill the form it does not land in an inbox you will forget: the enquiry arrives in your pipeline with their details and the job they need, waiting for you at seven the next morning.",
    tag: "Website · Services · Areas · FAQs · Blog · Gallery",
  },
  {
    when: "You have measured up and they want a price tonight, not Sunday.",
    title: "Quotes you can send from the van",
    body: "Build it from the job you already logged, add your line items, send it. They open it on their phone and accept it there. The moment they do, the work has a place in your schedule and nobody retypes a thing.",
    tag: "Quotes · Schedule · Projects",
  },
  {
    when: "The job is finished and you are stood in their hallway.",
    title: "Take the money before you leave",
    body: "Send a payment link by text and they pay by card while you pack up. It goes through your own Stripe or Square, so the money lands in your account and we are never in the middle of it. No card machine, no waiting thirty days, no chasing.",
    tag: "Payment links · Invoices",
  },
  {
    when: "That quote you sent nine days ago. The one you meant to ring about.",
    title: "The chasing happens whether you remember or not",
    body: "Unpaid invoices get chased at three days, seven days and fourteen. Quotes nobody answered get a nudge rather than a shrug. It is the admin you would do if the day ever had room in it, done at the right moment every time.",
    tag: "Automations · Emails",
  },
  {
    when: "Forty-odd CP12s, every one expiring on a different day.",
    title: "Certificates that renew themselves",
    body: "Issue the certificate on site and it is stored against the property. Six weeks before it runs out, next year's job is already in your pipeline with the customer attached — so the renewal is booked before the landlord has thought to ask, and you are not the one who let it lapse.",
    tag: "Certificates · Properties",
  },
  {
    when: "The letting agent rings: “what did you actually do at number 12?”",
    title: "Every address remembers its own history",
    body: "Every visit, every certificate, every invoice and every photograph held against the property rather than scattered across jobs. You answer in seconds instead of scrolling back through a year of paperwork, and the agent stops asking twice.",
    tag: "Properties · Files",
  },
  {
    when: "Your van is parked outside the same house for six hours.",
    title: "A QR code on the door that books work",
    body: "Someone walking past scans it and the enquiry is in your pipeline before they have reached the end of the road. The same code goes on your leaflets, your invoices and your business cards, so the van that is already advertising you starts actually bringing work in.",
    tag: "QR booking · Leads",
  },
  {
    when: "The VAT bill is due and you are guessing at the number.",
    title: "Know what is actually left",
    body: "What came in, what went out, and what is genuinely yours this month. Materials, fuel and tools logged against the job that used them, so you can see which work made money and which quietly did not — before you price the next one the same way.",
    tag: "Cash flow · Expenses · Invoices",
  },
  {
    when: "“Have you sent the certificate?” “Where is my invoice?”",
    title: "Customers who can look it up themselves",
    body: "They log in and see their quote, their job, their invoice and their paperwork. Every one of those questions is a phone call you were going to take while under a floor, and now it is not.",
    tag: "Customer portal",
  },
  {
    when: "Forty-eight five-star reviews on Google. None of them on your website.",
    title: "Your reputation, on your own site",
    body: "Your Google reviews are pulled onto your website and refreshed every day, with the real rating and the real total. You never retype one, and you never have to ask us to update them — the ones your customers wrote are simply there.",
    tag: "Reviews",
  },
  {
    when: "Two jobs booked, one Michael, and a customer expecting someone at nine.",
    title: "Who is where, and what is next",
    body: "The week laid out with the team against it, on a phone that works in a van with one bar of signal. Assign the job, and whoever is doing it can see the address, the customer and what the work actually is without ringing you to ask.",
    tag: "Schedule · Team · Projects",
  },
  {
    when: "You are quoting a full render and they cannot picture the finish.",
    title: "Show them before they commit",
    body: "The visualiser turns a photograph of their property into a preview of the finished work, so the conversation stops being about imagination and starts being about which colour. People sign off faster on work they have already seen.",
    tag: "Visualiser · Gallery · Case studies",
  },
] as const;

/** Independent bar heights, as in the reference. Not an image. */
const CHART_BARS = ["36%", "49%", "41%", "67%", "53%", "79%", "72%", "96%"] as const;

/**
 * The decorative hero dashboard.
 *
 * Real markup, not a screenshot — the handoff is explicit about that, and the
 * bars animate their own heights. It is labelled "PLATFORM PREVIEW" and is
 * deliberately non-interactive; the working demo is a separate CTA.
 */
function HeroDashboard() {
  return (
    <div className="dashboard">
      <div className="dash-top">
        <span className="tiny-brand">
          bizzflow<span>UK</span>
        </span>
        <span className="demo-label">PLATFORM PREVIEW</span>
        <span className="avatar">JT</span>
      </div>
      <div className="dash-content">
        <aside className="dash-side">
          <span className="side-icon selected">▦</span>
          <span className="side-icon">♧</span>
          <span className="side-icon">▤</span>
          <span className="side-icon">▣</span>
          <span className="side-icon">£</span>
          <span className="side-icon bottom">⚙</span>
        </aside>
        <div className="dash-main">
          <div className="dash-heading">
            <div>
              <p className="muted">MONDAY, 14 SEPTEMBER</p>
              <h3>
                Let's get to work, James <span className="wave">✳</span>
              </h3>
            </div>
            <span className="sample-label">Sample business</span>
          </div>
          <div className="kpis">
            <div>
              <span>Revenue this month</span>
              <strong>£24,850</strong>
              <small>↗ 18% vs last month</small>
            </div>
            <div>
              <span>Active jobs</span>
              <strong>
                12 <i>↗</i>
              </strong>
              <small>4 on site today</small>
            </div>
            <div>
              <span>Quotes to follow up</span>
              <strong>08</strong>
              <small>£16,400 in the pipeline</small>
            </div>
          </div>
          <div className="dash-two">
            <div className="revenue">
              <div className="panel-heading">
                Business performance <span>This month⌄</span>
              </div>
              <div className="chart" aria-label="Illustrative weekly revenue chart">
                <div className="chart-lines">
                  <span>£8k</span>
                  <span>£4k</span>
                  <span>£0</span>
                </div>
                <div className="bars">
                  {CHART_BARS.map((h, i) => (
                    <i key={i} style={{ ["--h" as string]: h } as React.CSSProperties} />
                  ))}
                </div>
              </div>
              <div className="chart-labels">
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Week 4</span>
              </div>
            </div>
            <div className="today">
              <div className="panel-heading">Today's schedule</div>
              <div className="appointment">
                <b>09:00</b>
                <span>
                  <strong>Kitchen renovation</strong>
                  <small>Thompson residence</small>
                </span>
              </div>
              <div className="appointment">
                <b>11:30</b>
                <span>
                  <strong>Site survey</strong>
                  <small>Oakfield development</small>
                </span>
              </div>
              <div className="appointment">
                <b>14:00</b>
                <span>
                  <strong>Boiler installation</strong>
                  <small>42 Maple Avenue</small>
                </span>
              </div>
            </div>
          </div>
          <div className="jobs-preview">
            <div className="panel-heading">
              Your jobs, moving forward <span>View all ↗</span>
            </div>
            <div>
              <span className="job-symbol">▧</span>
              <span>
                <strong>Oakfield garden transformation</strong>
                <small>Sarah Mitchell · Landscaping</small>
              </span>
              <span className="status">In progress</span>
              <strong>£4,250</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ShowcaseSite = {
  name: string; slug: string; industry: string | null; blurb: string | null;
  logoUrl: string | null; primaryColor: string | null; url: string; external: boolean;
};

/**
 * The businesses already running on BizzFlowUK.
 *
 * Real clients with real, clickable sites — read from the API, not written into
 * this file. The page shipped with a fictional landscaping company in this slot
 * while four real ones were live, which is both a wasted proof point and a
 * claim the product could not back up.
 *
 * Renders nothing at all if the list comes back empty. An empty "our clients"
 * section is worse than no section.
 */
function ClientShowcase() {
  const [sites, setSites] = useState<ShowcaseSite[] | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  /**
   * The previews are LIVE SITES in frames, so they are not mounted until the
   * section has been scrolled to. Loading four whole websites above the fold
   * would wreck the page for the majority of visitors who never reach here.
   */
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/showcase")
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (alive) setSites(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setSites([]); });
    return () => { alive = false; };
  }, []);

  /**
   * Attach the observer AFTER the sites arrive.
   *
   * An observer set up on mount has nothing to watch — the section is not in
   * the DOM until `sites` is non-empty, so it would never fire and the
   * previews would stay blank forever. That exact mistake left an earlier
   * version of this section invisible at full height.
   */
  useEffect(() => {
    if (!sites?.length || live) return;
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") { setLive(true); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setLive(true); io.disconnect(); }
    }, { rootMargin: "300px" });
    io.observe(node);
    return () => io.disconnect();
  }, [sites, live]);

  /**
   * Nudge the row along on its own so it reads as alive.
   *
   * Real scrolling rather than a duplicated marquee: duplicating the track
   * would double the number of live sites being loaded. Stops on hover, on
   * touch, and for anyone who has asked for reduced motion.
   */
  useEffect(() => {
    if (!live || !sites?.length) return;
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    track.addEventListener("pointerenter", pause);
    track.addEventListener("pointerleave", resume);
    track.addEventListener("touchstart", pause, { passive: true });

    const timer = window.setInterval(() => {
      if (paused) return;
      const card = track.querySelector<HTMLElement>(".client-card");
      if (!card) return;
      const step = card.offsetWidth + 24;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step, behavior: "smooth" });
    }, 4500);

    return () => {
      window.clearInterval(timer);
      track.removeEventListener("pointerenter", pause);
      track.removeEventListener("pointerleave", resume);
      track.removeEventListener("touchstart", pause);
    };
  }, [live, sites]);

  if (!sites?.length) return null;

  return (
    <section id="built-on-bizzflow" className="clients-section" ref={sectionRef}>
      <div className="wrap">
        <div className="clients-head">
          <p className="eyebrow"><span className="mini-line" /> ALREADY RUNNING ON BIZZFLOWUK</p>
          {/*
            NO COUNT IN THE HEADING.

            It used to open "Four real businesses." Naming the number tells a
            visitor exactly how small the platform is today, and it dates the
            page the moment a fifth one signs - somebody has to remember to
            come back and edit a number in a heading.

            Nothing replaces it. "And growing" was the obvious substitute and
            it is worse: a business that is established does not announce that
            it is growing, only a startup does. The proof is the sites
            themselves, sitting underneath.
          */}
          <h2>
            Real businesses.<br />
            <span className="muted-heading">These are their actual websites, live right now.</span>
          </h2>
          <p className="clients-intro">
            Not mock-ups and not case studies. Every screen below is the real site, loading as you
            look at it. Click any of them and you are on the live business.
          </p>
        </div>

        <div className="clients-track" ref={trackRef}>
          {sites.map(site => (
            <a
              key={site.slug}
              className="client-card"
              href={site.url}
              {...(site.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              style={{ ["--client" as any]: site.primaryColor || "var(--teal)" }}
            >
              {/* Browser chrome, so a scaled-down website reads as a website
                  rather than as a broken bit of the page. */}
              <span className="client-chrome" aria-hidden="true">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span className="client-url">{site.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
              </span>

              <span className="client-frame">
                {live ? (
                  <iframe
                    src={site.url}
                    title={`${site.name} website`}
                    loading="lazy"
                    // The frame is a picture, not something to interact with:
                    // no pointer events, and nothing inside it can navigate the
                    // parent or run anything it should not.
                    sandbox="allow-scripts allow-same-origin"
                    tabIndex={-1}
                    scrolling="no"
                  />
                ) : (
                  <span className="client-skeleton" aria-hidden="true" />
                )}
              </span>

              <span className="client-foot">
                <span className="client-logo">
                  {site.logoUrl
                    ? <img src={site.logoUrl} alt="" loading="lazy" decoding="async" />
                    : <span className="client-initial" aria-hidden="true">{site.name.charAt(0)}</span>}
                </span>
                <span className="client-meta">
                  <strong>{site.name}</strong>
                  {site.industry && <span className="client-trade">{site.industry}</span>}
                </span>
                <span className="client-visit">Visit&nbsp;<span aria-hidden="true">&#8599;</span></span>
              </span>
            </a>
          ))}
        </div>

        <p className="clients-hint">Drag to see the rest &mdash; or click one to open it.</p>
      </div>
    </section>
  );
}

/**
 * "See the demo" now opens the REAL dashboard, signed in to a seeded demo
 * business, rather than the mock-up that used to live at /demo.
 *
 * A mock shows a prospect a drawing of the product; this shows them the product.
 * The mock route is kept for anyone holding an old link.
 */
function useDemoLogin() {
  const { signIn } = useAuthCtx();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);

  return {
    busy,
    open: async () => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch("/api/public/demo-login", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) throw new Error();
        signIn(data.token);
        setLocation("/dashboard");
      } catch {
        // If the demo workspace is down, the mock is still better than nothing.
        setLocation("/demo");
      } finally {
        setBusy(false);
      }
    },
  };
}

export default function BizzFlowHome() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useScrollMeter();
  const revealClass = useScrollReveals(rootRef);

  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState(0);
  const demo = useDemoLogin();

  useSmoothAnchors();
  /*
   * The title and description live in BizzFlowSeo now, not in a
   * useDocumentMeta call.
   *
   * There were three of them fighting: index.html's fallback tags, this hook
   * writing document.title imperatively in an effect, and the rendered head
   * tags. The hook ran last and won, so whatever the page declared was
   * overwritten a frame later by "Built for the way you work" - a slogan, where
   * a search result needs to say what the thing is. One owner now.
   */

  const journey = JOURNEY[step];
  const trade = INDUSTRIES[industry];
  const closeMenu = () => setMenuOpen(false);

  /**
   * While the full-screen menu is open, the page behind it must not scroll —
   * otherwise a swipe on the sheet drags the homepage underneath and the user
   * closes the menu to find themselves somewhere else entirely. Escape closes
   * it, because a full-screen overlay with no keyboard exit is a trap.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className={`bf ${revealClass}`.trim()} ref={rootRef}>
      {/* Title, canonical, share card and structured data. Passed the same
          FAQS the page renders so the marked-up answers can never drift from
          the visible ones. */}
      <BizzFlowSeo faqs={FAQS} />

      <div className="scroll-meter" aria-hidden="true" ref={meterRef} />

      <header className="header">
        <Link href="/" className="brand" aria-label="BizzFlowUK home">
          <BizzFlowSymbol />
          <BizzFlowWordmark />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#platform">The platform</a>
          <a href="#industries">Who it's for</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>
        {/* No inline layout here: an inline style beats every media query, which
            is precisely what stopped the phone rules from ever applying. */}
        <div className="header-actions">
          <button type="button" onClick={demo.open} className="text-link demo-link" style={{ whiteSpace: "nowrap", background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit" }}>
            {demo.busy ? "Opening…" : "See the demo"}
          </button>
          <Link href="/signup" className="button small dark">
            Start free <span>↗</span>
          </Link>
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="bf-mobile-menu"
          onClick={() => setMenuOpen(true)}
        >
          <span className="menu-bars" aria-hidden="true"><i /><i /></span>
        </button>
      </header>

      {/*
        The full-screen menu. Always mounted so it can transition both ways;
        `visibility: hidden` when closed keeps its links out of the tab order.
      */}
      <div id="bf-mobile-menu" className={`mobile-menu${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <div className="mobile-menu-top stagger">
          <Link href="/" className="brand" onClick={closeMenu} aria-label="BizzFlowUK home">
            <BizzFlowSymbol />
            <BizzFlowWordmark />
          </Link>
          <button type="button" className="menu-close" onClick={closeMenu} aria-label="Close menu">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav className="stagger" aria-label="Mobile navigation">
          <a href="#platform" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>The platform <i aria-hidden="true">↗</i></a>
          <a href="#industries" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>Who it&rsquo;s for <i aria-hidden="true">↗</i></a>
          <a href="#how-it-works" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>How it works <i aria-hidden="true">↗</i></a>
          <a href="#pricing" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>Pricing <i aria-hidden="true">↗</i></a>
        </nav>

        <div className="mobile-menu-cta stagger">
          <button
            type="button"
            className="button ghost"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => { closeMenu(); demo.open(); }}
          >
            {demo.busy ? "Opening…" : "See the demo"} <span aria-hidden="true">↗</span>
          </button>
          <Link href="/signup" className="button teal-bg" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
            Start free for 7 days <span aria-hidden="true">↗</span>
          </Link>
          <p className="mobile-menu-note">No card needed. Your website built inside the trial.</p>
        </div>
      </div>

      <main>
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="mini-line" /> BUILT FOR BRITISH BUSINESS
            </p>
            <h1>
              Great at your trade.<br />
              Now great at<br />
              <span className="teal">running it.</span>
            </h1>
            <p className="intro">
              The website that wins the work. The tools that get it done. Bring your whole business together with
              BizzFlowUK.
            </p>
            <div className="hero-actions">
              <Link href="/signup" className="button teal-bg">
                Start free for 7 days <span>↗</span>
              </Link>
              <button type="button" onClick={demo.open} className="text-link" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit" }}>
                <span className="play">▶</span> {demo.busy ? "Opening…" : "See it in action"}
              </button>
            </div>
            <div className="hero-note">
              <span className="check">✓</span> Your website. Your business tools. One place.
            </div>
          </div>
          <div className="hero-product">
            <div className="product-orbit" aria-hidden="true" />
            <HeroDashboard />
            <div className="floating-notice notice-top">
              <span className="notice-icon">✓</span>
              <div>
                <strong>Quote accepted</strong>
                <small>Another job. Ready to go.</small>
              </div>
              <span>↗</span>
            </div>
            <div className="floating-notice notice-bottom">
              <span className="notice-icon">↗</span>
              <div>
                <strong>From first click to paid invoice.</strong>
                <small>That's a better way to work.</small>
              </div>
            </div>
            <div className="product-caption">
              <span className="caption-line" /> LESS ADMIN. MORE MOMENTUM.
            </div>
          </div>
        </section>

        {/* ── Trades band ─────────────────────────────────────────────────── */}
        <section className="trade-strip">
          <div className="wrap">
            <p>
              FOR THE BUSINESSES<br />
              <strong>THAT BUILD BRITAIN.</strong>
            </p>
            <div>
              <span>▦ &nbsp; Rendering</span>
              <span>⌂ &nbsp; Construction</span>
              <span>♧ &nbsp; Landscaping</span>
              <span>▣ &nbsp; Groundworks</span>
              <span>£ &nbsp; Plumbing & heating</span>
            </div>
          </div>
        </section>

        {/* ── Real client sites ───────────────────────────── */}
        {/*
          Straight after the hero, before a single feature is described.

          Somebody landing on a platform they have never heard of is asking one
          question before any other: is anyone actually using this. Four live
          sites they can click into answers it in a way no amount of copy about
          quotes and invoices can, and answering it first makes everything
          below more believable.

          Deliberately NOT wrapped in `.reveal`. The reveal observer is set up
          once on mount, and this list arrives from an API afterwards, so its
          elements were never observed and sat at opacity 0 permanently - a
          full-height invisible section between the hero and the features. The
          most important proof on the page cannot depend on an animation
          firing.
        */}
        <ClientShowcase />

        {/* ── Connected platform ──────────────────────────────────────────── */}
        <section id="platform" className="platform wrap section">
          <div className="section-head reveal">
            <div>
              <p className="eyebrow">01 / ONE CONNECTED PLATFORM</p>
              <h2>
                A proper website.<br />
                <span className="muted-heading">And everything behind it.</span>
              </h2>
            </div>
            <p>
              Stop piecing your working day together.<br />
              Give every part of your business a home.
            </p>
          </div>
          <div className="feature-grid">
            {/* Points at the real client sites further down the page, not at a
                mock-up. There is no reason to invent a fictional business when
                four real ones are live on the platform. */}
            <a href="#built-on-bizzflow" className="feature-card website-card reveal">
              <div className="card-top">
                <span className="feature-icon">↗</span>
                <span className="round-arrow">↗</span>
              </div>
              <h3>Your best first impression.</h3>
              <p>
                A professional website that showcases your work and turns interest into enquiries — built for you, in
                your first week.
              </p>
              <div className="mini-browser">
                <div className="browser-bar">
                  <i />
                  <i />
                  <i />
                  <span>BUILT ON BIZZFLOWUK</span>
                </div>
                <div className="mini-website">
                  <span>REAL BUSINESSES. REAL SITES.</span>
                  <b>
                    See the websites<br />
                    we've already built.
                  </b>
                  <span className="mini-cta">Have a look ↓</span>
                </div>
              </div>
              <span className="feature-tag">YOUR WEBSITE</span>
            </a>
            <Link href="/demo" className="feature-card operations-card reveal">
              <div className="card-top">
                <span className="feature-icon">▦</span>
                <span className="round-arrow">↗</span>
              </div>
              <h3>Your business. In flow.</h3>
              <p>Customers, quotes, jobs and invoices — connected from the first hello to the final payment.</p>
              <div className="flow-pills">
                <span>
                  New enquiry <b>✓</b>
                </span>
                <i>↘</i>
                <span>
                  Quote accepted <b>✓</b>
                </span>
                <i>↘</i>
                <span>
                  Job scheduled <b>✓</b>
                </span>
                <i>↘</i>
                <span className="flow-final">
                  Invoice paid <b>✓</b>
                </span>
              </div>
              <span className="feature-tag">YOUR BUSINESS TOOLKIT</span>
            </Link>
          </div>
          {/* These four name what the dashboard actually contains, in the words
              the dashboard itself uses. The previous set sold "Jobs &
              scheduling" — there is no Jobs menu, they are Projects — and never
              mentioned certificates, automations or card payments, which are the
              three things nothing else in this price bracket does. */}
          <div className="tool-row reveal">
            <div>
              <span>♧</span>
              <h3>Customers & quotes</h3>
              <p>
                Enquiries land from your site.<br />
                Price them, send them, track them.
              </p>
            </div>
            <div>
              <span>£</span>
              <h3>Invoices & card payments</h3>
              <p>
                Send a payment link and get paid<br />
                by card. Cash flow you can see.
              </p>
            </div>
            <div>
              <span>▣</span>
              <h3>Projects & schedule</h3>
              <p>
                Who's where, what's next,<br />
                and what needs you today.
              </p>
            </div>
            <div>
              <span>✓</span>
              <h3>Gas Safe certificates</h3>
              <p>
                Issue a CP12, store it, and let<br />
                the renewal chase itself.
              </p>
            </div>
          </div>
        </section>

        {/* ── What it does that nobody mentions ───────────────────────────── */}
        <section className="platform wrap section" style={{ paddingTop: 0 }}>
          <div className="section-head reveal">
            <div>
              <p className="eyebrow">02 / THE BITS THAT DO THE CHASING</p>
              <h2>
                It keeps working<br />
                <span className="muted-heading">when you've put the phone down.</span>
              </h2>
            </div>
            <p>
              Not a list of screens.<br />
              Things that happen without you.
            </p>
          </div>
          <div className="tool-row reveal">
            <div>
              <span>↗</span>
              <h3>Chases unpaid invoices</h3>
              <p>
                Three, seven and fourteen days<br />
                past due. You never have to ask twice.
              </p>
            </div>
            <div>
              <span>▦</span>
              <h3>Raises certificate renewals</h3>
              <p>
                Six weeks before a CP12 runs out,<br />
                next year's job is in your pipeline.
              </p>
            </div>
            <div>
              <span>▤</span>
              <h3>Follows up quiet quotes</h3>
              <p>
                A quote nobody answered gets<br />
                a nudge, not a shrug.
              </p>
            </div>
            <div>
              <span>♧</span>
              <h3>Customer portal</h3>
              <p>
                Your customer can see their job,<br />
                their quote and their invoice.
              </p>
            </div>
          </div>
        </section>

        {/* ── Flo ─────────────────────────────────────────────────────────── */}
        {/*
          The assistant was missing from this page entirely, which made the
          product look like every other jobs app. It is the one thing here that
          nobody else in this market has, so it gets its own section rather than
          a bullet in a list.

          The four headings are questions a real owner asks, not features. What
          it can actually see — leads, quotes, invoices, projects, certificates,
          properties, files — matches the snapshot the assistant is given, and
          the note about never inventing a figure is a rule in its prompt, not
          a claim invented for the page.
        */}
        <section id="flo" className="platform wrap section" style={{ paddingTop: 0 }}>
          <div className="section-head reveal">
            <div>
              <p className="eyebrow">03 / ASK FLO</p>
              <h2>
                Ask your business a question.<br />
                <span className="muted-heading">Get the real answer.</span>
              </h2>
            </div>
            <p>
              Flo can see your jobs, quotes, invoices<br />
              and certificates. Only yours.
            </p>
          </div>
          <div className="tool-row reveal">
            <div>
              <span>?</span>
              <h3>&ldquo;Who owes me money?&rdquo;</h3>
              <p>
                The invoices actually overdue,<br />
                with names and amounts.
              </p>
            </div>
            <div>
              <span>◷</span>
              <h3>&ldquo;Which quotes went quiet?&rdquo;</h3>
              <p>
                The ones nobody answered, oldest<br />
                first, while they are still worth chasing.
              </p>
            </div>
            <div>
              <span>▦</span>
              <h3>&ldquo;Whose CP12 is due?&rdquo;</h3>
              <p>
                The certificates running out, before<br />
                the customer rings to ask.
              </p>
            </div>
            <div>
              <span>£</span>
              <h3>&ldquo;How did last month go?&rdquo;</h3>
              <p>
                What came in and what went out,<br />
                off your own records.
              </p>
            </div>
          </div>
          <p className="reveal" style={{ marginTop: "30px", fontSize: "14px", lineHeight: 1.75, color: "var(--muted)", maxWidth: "58ch" }}>
            It reads your business and changes nothing. It never invents a figure &mdash; if it
            cannot see something it says so, which is worth a great deal more than a confident
            wrong answer.
          </p>
        </section>

        {/* ── Everything it does ─────────────────────────────── */}
        {/*
          The page named four capabilities out of thirty-two, so it read as a
          website with a quote button on it. This is the honest version: every
          real capability, each opened with the situation it exists for.

          A trade reading "Properties - per-property history" pictures nothing.
          A trade reading "the letting agent rings asking what you did at
          number 12" pictures it exactly. That is the difference between a
          feature list and a reason to buy.

          Every scenario is a job a UK trade actually has, and every capability
          is a screen that exists in the dashboard today. Nothing aspirational.
        */}
        <section id="everything" className="platform wrap section" style={{ paddingTop: 0 }}>
          <div className="bf-caps">
            {/*
              Sticky, so the promise stays on screen the whole way down. The
              list is long on purpose - the length IS the argument - and a
              heading that scrolls away leaves the reader with capability after
              capability and no reminder of what they add up to.
            */}
            <aside className="bf-caps-aside">
              <p className="eyebrow">04 / EVERYTHING IT DOES</p>
              <h2>
                Not a jobs app<br />
                <span className="muted-heading">with a website bolted on.</span>
              </h2>
              <p className="bf-caps-intro">
                Every one of these is a screen in your workspace on day one. No add-ons,
                no per-user charge, no upgrade tier. All of it is the &pound;99.
              </p>
              <Link href="/signup" className="button teal-bg bf-caps-cta">
                Start free for 7 days <span aria-hidden="true">&#8599;</span>
              </Link>
            </aside>

            <div className="bf-caps-list">
              {CAPABILITIES.map(cap => (
                <article key={cap.title} className="bf-cap">
                  <p className="bf-cap-when">{cap.when}</p>
                  <h3>{cap.title}</h3>
                  <p className="bf-cap-body">{cap.body}</p>
                  <p className="bf-cap-tag">{cap.tag}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow ────────────────────────────────────────────────────── */}
        <section className="connection-section section" id="how-it-works">
          <div className="wrap">
            <div className="section-head reveal">
              <div>
                <p className="eyebrow">05 / A BETTER WORKING DAY</p>
                <h2>
                  One job. One journey.<br />
                  <span>Nothing falls through the gaps.</span>
                </h2>
              </div>
              <p>
                Less copying and pasting.<br />
                More getting on with the job.
              </p>
            </div>
            <div className="journey" aria-label="Journey from enquiry to invoice">
              {JOURNEY.map((item, i) => (
                <button
                  key={item.number}
                  type="button"
                  className={`journey-step${i === step ? " active" : ""}`}
                  aria-pressed={i === step}
                  onClick={() => setStep(i)}
                >
                  <span>{item.number}</span>
                  <h3>{item.heading}</h3>
                  <p>{item.summary}</p>
                  <b>{item.label}</b>
                </button>
              ))}
            </div>
            <div className="journey-detail" aria-live="polite">
              <span>{journey.detailLabel}</span>
              <p>{journey.detail}</p>
              <Link href={`/demo?view=${journey.view}`}>Explore this in the demo ↗</Link>
            </div>
          </div>
        </section>

        {/* ── Industries ──────────────────────────────────────────────────── */}
        <section className="industry-section section wrap" id="industries">
          <div className="industry-photo reveal">
            <img
              src="/bizzflow/images/trades-owners.jpg"
              loading="lazy"
              alt="Trades business owners planning work together on a residential building site"
            />
            <div className="photo-caption">
              <span>ON SITE. IN THE OFFICE. ON THE GO.</span>
              <strong>
                Built around<br />
                the way you work.
              </strong>
            </div>
          </div>
          <div className="industry-copy reveal">
            <p className="eyebrow">06 / YOUR TRADE. YOUR PLATFORM.</p>
            {/*
              "Real trades", not "Real businesses" - the showcase band further
              up now opens with "Real businesses." and two headings on one page
              starting with the same two words reads as carelessness. This is
              the generic one of the pair, so it gives way.
            */}
            <h2>
              Real trades.<br />
              Real graft.<br />
              <span className="teal">A smarter setup.</span>
            </h2>
            <p>
              You know your industry. Your tools should too. From a one-person business to a growing team, bring your
              online presence and operations together.
            </p>
            <div className="industry-options" aria-label="Choose an industry">
              {INDUSTRIES.map((item, i) => (
                <button
                  key={item.name}
                  type="button"
                  className={i === industry ? "active" : undefined}
                  aria-pressed={i === industry}
                  onClick={() => setIndustry(i)}
                >
                  {item.name} <span>↗</span>
                </button>
              ))}
            </div>
            <div className="industry-response" aria-live="polite">
              <strong id="industry-title">{trade.title}</strong>
              <p id="industry-description">{trade.description}</p>
            </div>
          </div>
        </section>

        {/* ── Statement ───────────────────────────────────────────────────── */}
        <section className="statement-section wrap reveal">
          <span className="eyebrow">YOUR CRAFT DESERVES BETTER TOOLS.</span>
          <h2>
            You didn't start a business<br />
            to spend your evenings<br />
            <span>running five different apps.</span>
          </h2>
          <p>
            A strong front door. A well-run business behind it.<br />
            That's BizzFlowUK.
          </p>
          <Link href="/signup" className="button dark">
            Start your free week <span>↗</span>
          </Link>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────────── */}
        {/* The page had no price and no way to buy. Every CTA pointed at the
            demo, so a visitor who was sold had nowhere to go. */}
        <section id="pricing" className="statement-section wrap reveal" style={{ borderBottom: "1px solid var(--line)" }}>
          <span className="eyebrow">ONE PRICE. EVERYTHING IN IT.</span>
          <h2 style={{ marginBottom: "6px" }}>
            £99 a month.<br />
            <span>Your website built in the first week.</span>
          </h2>
          <p style={{ maxWidth: "62ch", margin: "18px auto 0" }}>
            Website, hosting, and the whole toolkit — customers, quotes, invoices, card payments, projects,
            scheduling, cash flow, expenses, certificates, the customer portal and Flo, the assistant that
            can answer questions about your own business. No setup fee. No per-user charge. No separate
            bill for the site.
          </p>

          <div
            className="reveal"
            style={{
              display: "grid", gap: "18px", margin: "38px auto 0", maxWidth: "62rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", textAlign: "left",
            }}
          >
            {[
              ["Day 1", "You're working", "Sign up and start taking enquiries, quoting and invoicing straight away."],
              ["Within 2 days", "Your site goes up", "We build it around your trade, your work and your area. Usually inside 48 hours."],
              ["Day 7", "You decide", "Free until then. Stay and it's £99 a month. Walk away and you've paid nothing."],
            ].map(([when, what, detail]) => (
              <div key={when} style={{ background: "var(--mint)", borderRadius: "13px", padding: "26px 24px" }}>
                <p className="eyebrow" style={{ marginBottom: "10px" }}>{when}</p>
                <h3 style={{ fontSize: "20px", letterSpacing: "-0.6px", fontWeight: 650 }}>{what}</h3>
                <p style={{ marginTop: "10px", fontSize: "15px", lineHeight: 1.6, color: "var(--muted)" }}>{detail}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", marginTop: "38px" }}>
            <Link href="/signup" className="button teal-bg">
              Start your 7 days free <span>↗</span>
            </Link>
            <button type="button" onClick={demo.open} className="text-link" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit" }}>
              <span className="play">▶</span> {demo.busy ? "Opening…" : "Look around first"}
            </button>
          </div>
          <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)" }}>
            No card needed to start the trial.
          </p>
        </section>

        {/* ── FAQs ────────────────────────────────────────────────────────── */}
        <section id="faq" className="faq-section section wrap">
          <div className="reveal">
            <p className="eyebrow">A FEW THINGS, ANSWERED.</p>
            <h2>
              Good questions.<br />
              Straight answers.
            </h2>
            <p>Get to know the idea behind BizzFlowUK.</p>
          </div>
          {/* Native <details>, and deliberately not an accordion: more than one
              may stay open, exactly as in the reference. */}
          <div className="faq-list reveal">
            {FAQS.map((faq, i) => (
              <details key={faq.q} open={i === 0}>
                <summary>
                  {faq.q}
                  <span>+</span>
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Closing ─────────────────────────────────────────────────────── */}
        <section className="closing">
          <div className="wrap">
            <div>
              <p className="eyebrow">LET'S GET YOUR BUSINESS MOVING.</p>
              <h2>
                You've got the skills.<br />
                We've got the flow.
              </h2>
            </div>
            <Link href="/signup" className="button light">
              Start free for 7 days <span>↗</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="wrap">
        <div className="footer-top">
          <Link href="/" className="brand">
            <BizzFlowSymbol />
            <BizzFlowWordmark />
          </Link>
          <p>
            Built for the businesses<br />
            that keep Britain moving.
          </p>
          <div>
            <a href="#platform">The platform</a>
            <a href="#industries">Industries</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQs</a>
            <Link href="/demo">Interactive demo ↗</Link>
            <Link href="/signup">Start free ↗</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} BizzFlowUK. All rights reserved.</span>
          <span>One platform. Your whole business.</span>
          {/* Stays an <a>: the stylesheet targets `.footer-bottom a`, so a
              <button> here would lose the styling entirely. The reference's
              bare href="#" pushed a "#" entry into history and left it in the
              address bar, so the scroll is done deliberately instead and the
              default is prevented. */}
          <a
            href="#"
            aria-label="Back to top"
            onClick={event => {
              event.preventDefault();
              window.scrollTo({
                top: 0,
                behavior:
                  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
              });
            }}
          >
            Back to top ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
