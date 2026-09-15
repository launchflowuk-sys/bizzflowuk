import { useRef, useState } from "react";
import { Link } from "wouter";
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

/** The six industries. Copy verbatim from reference/site.js. */
const INDUSTRIES = [
  {
    name: "Construction",
    title: "From site survey to final handover.",
    description:
      "Keep enquiries, project quotes, site schedules and customer records connected as each build moves forward.",
  },
  {
    name: "Engineering",
    title: "Give complex work a clear plan.",
    description:
      "Bring client requirements, project estimates, team schedules and progress updates into one working view.",
  },
  {
    name: "Landscaping",
    title: "From the first idea to the final planting.",
    description:
      "Connect garden enquiries, site visits, design quotes and seasonal work without losing the customer details.",
  },
  {
    name: "Paving",
    title: "A smoother path from quote to completion.",
    description:
      "Keep measurements, material estimates, installation dates and invoices alongside each driveway or patio job.",
  },
  {
    name: "Plumbing & heating",
    title: "Keep the work flowing.",
    description:
      "Organise customer enquiries, installation quotes, appointments and job records from one connected workspace.",
  },
  {
    name: "Other trades",
    title: "Your expertise. A more organised business.",
    description:
      "Bring your website, customer records, quotes, workload and invoices together around the way your business works.",
  },
] as const;

/** The five FAQ entries. Answers verbatim, including the demo disclaimer. */
const FAQS = [
  {
    q: "Is this just a website builder?",
    a: "No. The website is your business's front door. BizzFlowUK brings the tools behind it together too: customer management, quoting, job planning, scheduling and invoicing.",
  },
  {
    q: "Which businesses is it designed for?",
    a: "UK businesses in construction, engineering, landscaping, paving, plumbing, heating and related trades. The aim is to support both independent business owners and teams.",
  },
  {
    q: "Can I see how the tools fit together?",
    a: "Yes. Open the interactive demo to explore a sample business, switch between tools, inspect jobs and try the quote builder. The demo uses fictional sample data.",
  },
  {
    q: "Does the demo send quotes or take payments?",
    a: "No. The demo lets you explore the experience safely. It does not send messages, charge customers, connect to a bank or store real business records.",
  },
  {
    q: "Can I use it on site as well as in the office?",
    a: "The website and demo adapt to mobile, tablet and desktop, so you can explore the same connected workflow wherever you work.",
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

export default function BizzFlowHome() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useScrollMeter();
  const revealClass = useScrollReveals(rootRef);

  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState(0);

  useSmoothAnchors();
  useDocumentMeta(
    "BizzFlowUK — Built for the way you work",
    "Your website, customers, quotes, jobs and invoices. One connected platform built for UK trades and industry.",
  );

  const journey = JOURNEY[step];
  const trade = INDUSTRIES[industry];
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`bf ${revealClass}`.trim()} ref={rootRef}>
      <div className="scroll-meter" aria-hidden="true" ref={meterRef} />

      <header className="header">
        <Link href="/" className="brand" aria-label="BizzFlowUK home">
          <BizzFlowSymbol />
          <BizzFlowWordmark />
        </Link>
        <nav aria-label="Main navigation" className={menuOpen ? "open" : undefined}>
          <a href="#platform" onClick={closeMenu}>The platform</a>
          <a href="#industries" onClick={closeMenu}>Who it's for</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
        </nav>
        <Link href="/demo" className="button small dark">
          Explore the demo <span>↗</span>
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
        >
          ☰
        </button>
      </header>

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
              <Link href="/demo" className="button teal-bg">
                See it in action <span>↗</span>
              </Link>
              <a className="text-link" href="#platform">
                <span className="play">▶</span> Meet your new toolkit
              </a>
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
              <span>⌂ &nbsp; Construction</span>
              <span>⚙ &nbsp; Engineering</span>
              <span>♧ &nbsp; Landscaping</span>
              <span>▦ &nbsp; Paving</span>
              <span>♧ &nbsp; Plumbing & heating</span>
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
            <Link href="/demo?view=website" className="feature-card website-card reveal">
              <div className="card-top">
                <span className="feature-icon">↗</span>
                <span className="round-arrow">↗</span>
              </div>
              <h3>Your best first impression.</h3>
              <p>A professional website that showcases your work and turns interest into enquiries.</p>
              <div className="mini-browser">
                <div className="browser-bar">
                  <i />
                  <i />
                  <i />
                  <span>YOUR BUSINESS. ONLINE.</span>
                </div>
                <div className="mini-website">
                  <span>
                    OAK & STONE <small>LANDSCAPES</small>
                  </span>
                  <b>
                    Outdoor spaces.<br />
                    Extraordinary living.
                  </b>
                  <span className="mini-cta">Let's transform your garden ↗</span>
                </div>
              </div>
              <span className="feature-tag">YOUR WEBSITE</span>
            </Link>
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
          <div className="tool-row reveal">
            <div>
              <span>♧</span>
              <h3>Customer management</h3>
              <p>
                Every conversation. Every detail.<br />
                One complete customer history.
              </p>
            </div>
            <div>
              <span>▤</span>
              <h3>Quotes & invoices</h3>
              <p>
                Price the work, track approvals<br />
                and keep your paperwork together.
              </p>
            </div>
            <div>
              <span>▣</span>
              <h3>Jobs & scheduling</h3>
              <p>
                Know who's where, what's next<br />
                and what needs your attention.
              </p>
            </div>
            <div>
              <span>↗</span>
              <h3>Business overview</h3>
              <p>
                A clear view of your pipeline,<br />
                your workload and your progress.
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
          <Link href="/demo" className="button dark">
            Take a look around <span>↗</span>
          </Link>
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
            <Link href="/demo" className="button light">
              Explore BizzFlowUK <span>↗</span>
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
            <a href="#faq">FAQs</a>
            <Link href="/demo">Interactive demo ↗</Link>
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
