import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthCtx } from "@/lib/auth";
import { BizzFlowSymbol, BizzFlowWordmark } from "./BizzFlowBrand";
import { useDocumentMeta, useScrollMeter, useScrollReveals, useSmoothAnchors } from "./useBizzFlowChrome";
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

  useEffect(() => {
    let live = true;
    fetch("/api/public/showcase")
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (live) setSites(Array.isArray(data) ? data : []); })
      .catch(() => { if (live) setSites([]); });
    return () => { live = false; };
  }, []);

  if (!sites?.length) return null;

  return (
    <section id="built-on-bizzflow" className="platform wrap section" style={{ paddingTop: 0 }}>
      <div className="section-head reveal">
        <div>
          <p className="eyebrow">ALREADY BUILT ON BIZZFLOWUK</p>
          <h2>
            Real businesses.<br />
            <span className="muted-heading">Real websites. Go and look.</span>
          </h2>
        </div>
        <p>
          Every one of these is a live site<br />
          running on the platform right now.
        </p>
      </div>

      <div className="tool-row reveal" style={{ gridTemplateColumns: `repeat(${Math.min(sites.length, 4)}, 1fr)` }}>
        {sites.map(site => (
          <a
            key={site.slug}
            href={site.url}
            {...(site.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            style={{ display: "block" }}
          >
            {/* The tenant's own colour, so the row reads as four different
                businesses rather than four cards of ours. */}
            <span
              aria-hidden="true"
              style={{
                display: "block", width: "34px", height: "4px", borderRadius: "2px",
                background: site.primaryColor || "var(--teal)", marginBottom: "18px",
              }}
            />
            <h3>{site.name}</h3>
            {site.blurb && <p>{site.blurb}</p>}
            <p style={{ marginTop: "14px", fontWeight: 650, color: "var(--teal)" }}>
              Visit the site ↗
            </p>
          </a>
        ))}
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
  useDocumentMeta(
    "BizzFlowUK — Built for the way you work",
    "Your website, customers, quotes, jobs and invoices. One connected platform built for UK trades and industry.",
  );

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

        {/* ── Real client sites ───────────────────────────────────────────── */}
        <ClientShowcase />

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

        {/* ── Workflow ────────────────────────────────────────────────────── */}
        <section className="connection-section section" id="how-it-works">
          <div className="wrap">
            <div className="section-head reveal">
              <div>
                <p className="eyebrow">02 / A BETTER WORKING DAY</p>
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
            <p className="eyebrow">03 / YOUR TRADE. YOUR PLATFORM.</p>
            <h2>
              Real businesses.<br />
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
            scheduling, cash flow, certificates and the customer portal. No setup fee. No per-user charge.
            No separate bill for the site.
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
