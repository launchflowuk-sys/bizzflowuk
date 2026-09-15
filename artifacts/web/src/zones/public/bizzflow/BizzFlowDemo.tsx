import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { BizzFlowSymbol, BizzFlowWordmark } from "./BizzFlowBrand";
import { useDocumentMeta } from "./useBizzFlowChrome";
import {
  CUSTOMERS, DemoCustomer, DemoJob, DemoQuote, DemoView, INITIAL_QUOTES, INVOICES, JOBS,
  NAV_ITEMS, QUOTE_CUSTOMERS, SCHEDULE_MONDAY, SCHEDULE_WEDNESDAY, VIEW_COPY,
  money, parseView, quoteTotal, statusClass,
} from "./demoData";
import "./bizzflow.css";
import "./bizzflow-overrides.css";

/**
 * The public BizzFlowUK demo workspace.
 *
 * A port of reference/demo.html + demo.js. The reference rebuilt each view by
 * assigning `innerHTML` and re-binding handlers afterwards; here every view is
 * a component and the records are React state, so nothing writes into DOM that
 * React owns and nothing has to be re-bound.
 *
 * The reference escaped user input by hand (`esc()`) because it was building
 * HTML strings. React escapes text nodes by construction, so that helper has no
 * equivalent here — and `dangerouslySetInnerHTML` must never be reintroduced to
 * render a quote title or a record detail, which is the one way the escaping
 * could come back as a real XSS hole.
 *
 * This is a marketing demo with fictional data. It performs no writes, calls no
 * API, and shares nothing with a real tenant workspace.
 */

const STATUS_TONE = (s: string) => `status ${statusClass(s)}`.trim();

function Status({ value }: { value: string }) {
  return <span className={STATUS_TONE(value)}>{value}</span>;
}

/** Wraps a table so a wide one scrolls inside its own box, never the page. */
function TableScroll({ headers, children }: { headers: readonly string[]; children: React.ReactNode }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ScheduleList({ items }: { items: readonly { time: string; title: string; detail: string }[] }) {
  return (
    <div className="schedule-list">
      {items.map(item => (
        <div key={item.time + item.title}>
          <time>{item.time}</time>
          <span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A native <dialog>.
 *
 * Native rather than a hand-rolled overlay because it brings focus trapping,
 * focus restoration and Escape for free — all three of which the acceptance
 * cases require and all three of which are easy to get subtly wrong by hand.
 * The outside-click check compares the pointer against the dialog's own rect,
 * exactly as the reference did: a click on the ::backdrop reports the dialog
 * itself as the target, so identity alone cannot tell the two apart.
 */
function Modal({
  open, onClose, labelledBy, closeLabel, children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  // Escape closes the dialog natively; this keeps React's state in step with it.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onCancelOrClose = () => onClose();
    node.addEventListener("close", onCancelOrClose);
    return () => node.removeEventListener("close", onCancelOrClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={event => {
        if (event.target !== ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const outside =
          event.clientX < r.left || event.clientX > r.right ||
          event.clientY < r.top || event.clientY > r.bottom;
        if (outside) onClose();
      }}
    >
      <button type="button" className="dialog-close" aria-label={closeLabel} onClick={onClose}>
        ×
      </button>
      {children}
    </dialog>
  );
}

/** What the details dialog is currently showing. */
type Detail =
  | { kind: "job"; job: DemoJob }
  | { kind: "customer"; customer: DemoCustomer }
  | { kind: "quote"; quote: DemoQuote }
  | null;

export default function BizzFlowDemo() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const view = parseView(search);

  /**
   * Quotes created during this visit.
   *
   * State, not localStorage and not the database: the banner promises "changes
   * last until you refresh" and that promise is the feature. A new quote
   * survives moving between views and disappears on reload, which is exactly
   * the reference's behaviour.
   */
  const [quotes, setQuotes] = useState<DemoQuote[]>(() => [...INITIAL_QUOTES]);
  const [detail, setDetail] = useState<Detail>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [copyTitle, copySubtitle] = VIEW_COPY[view];
  useDocumentMeta(
    "Explore the platform — BizzFlowUK",
    "Explore a sample BizzFlowUK workspace with customers, quotes, jobs, scheduling and invoices.",
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);

  // A pending toast timer after unmount would set state on a dead component.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  /**
   * `replace: true` matches the reference's history.replaceState — flicking
   * through seven views should not bury the page the visitor arrived from under
   * seven back-button presses.
   */
  const navigate = useCallback(
    (next: DemoView) => setLocation(next === "overview" ? "/demo" : `/demo?view=${next}`, { replace: true }),
    [setLocation],
  );

  // One search box, reused by the jobs and customers views. Cleared on view
  // change so a stale term cannot hide every row of the screen you just opened.
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(""), [view]);
  const needle = query.trim().toLowerCase();

  const visibleJobs = useMemo(
    () => JOBS.filter(j => !needle ||
      `${j.title} ${j.id} ${j.trade} ${j.customer} ${j.status} ${money(j.value)}`.toLowerCase().includes(needle)),
    [needle],
  );
  const visibleCustomers = useMemo(
    () => CUSTOMERS.filter(c => !needle ||
      `${c.name} ${c.jobs} ${c.work} ${c.area} ${c.stage}`.toLowerCase().includes(needle)),
    [needle],
  );

  return (
    <div className="bf bf-demo">
      <div className="demo-banner">
        <span>
          <strong>Interactive demo</strong> · Fictional sample data. Changes last until you refresh.
        </span>
        <Link href="/">Back to BizzFlowUK ↗</Link>
      </div>

      <div className="workspace">
        <aside className="workspace-sidebar">
          <Link href="/" className="brand">
            <BizzFlowSymbol />
            <BizzFlowWordmark />
          </Link>
          <div className="company">
            <span className="company-icon">O&S</span>
            <div>
              <strong>Oak & Stone</strong>
              <small>Sample business</small>
            </div>
          </div>
          <nav aria-label="Workspace navigation">
            {NAV_ITEMS.map(item => (
              <button
                key={item.view}
                type="button"
                className={item.view === view ? "active" : undefined}
                aria-current={item.view === view ? "page" : "false"}
                onClick={() => navigate(item.view)}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="avatar">JT</span>
            <div>
              <strong>James Taylor</strong>
              <small>Demo workspace</small>
            </div>
          </div>
        </aside>

        <main className="workspace-main">
          <div className="workspace-top">
            <span>Your business, in flow.</span>
            <span className="demo-chip">DEMO WORKSPACE</span>
          </div>
          <div className="view-heading">
            <div>
              <p className="eyebrow">OAK & STONE / WORKSPACE</p>
              <h1 id="view-title">{copyTitle}</h1>
              <p id="view-subtitle">{copySubtitle}</p>
            </div>
            <button type="button" className="button teal-bg" onClick={() => setQuoteOpen(true)}>
              Create a sample quote <span>+</span>
            </button>
          </div>

          <div id="workspace-content">
            {view === "overview" && (
              <>
                <div className="workspace-kpis">
                  {/* Illustrative headline figures, not totals of the four
                      sample jobs below. The captions say so, and they must stay
                      — presenting them as calculated business totals would be a
                      claim this demo cannot support. */}
                  <div>
                    <span>Revenue this month</span>
                    <strong>£24,850</strong>
                    <small>Illustrative monthly revenue</small>
                  </div>
                  <div>
                    <span>Active jobs</span>
                    <strong>12</strong>
                    <small>4 jobs shown in this demo</small>
                  </div>
                  <div>
                    <span>Quote pipeline</span>
                    <strong>£16,400</strong>
                    <small>Illustrative pipeline value</small>
                  </div>
                  <div>
                    <span>Outstanding invoices</span>
                    <strong>£2,800</strong>
                    <small>1 sample invoice awaiting payment</small>
                  </div>
                </div>

                <section className="workspace-panel">
                  <div className="panel-top">
                    <h2>Work in progress</h2>
                    <button type="button" onClick={() => navigate("jobs")}>View all jobs ↗</button>
                  </div>
                  <TableScroll headers={["Job", "Customer", "Status", "Value", ""]}>
                    {JOBS.slice(0, 3).map(job => (
                      <tr key={job.id}>
                        <td>
                          <strong>{job.title}</strong>
                          <small>{job.id} · {job.trade}</small>
                        </td>
                        <td>{job.customer}</td>
                        <td><Status value={job.status} /></td>
                        <td>{money(job.value)}</td>
                        <td>
                          <button type="button" aria-label={`View ${job.title}`} onClick={() => setDetail({ kind: "job", job })}>
                            View ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </TableScroll>
                </section>

                <div className="workspace-lower">
                  <section className="workspace-panel">
                    <div className="panel-top">
                      <h2>Today's schedule</h2>
                      <button type="button" onClick={() => navigate("schedule")}>Open schedule ↗</button>
                    </div>
                    <ScheduleList items={SCHEDULE_MONDAY} />
                  </section>
                  <section className="workspace-panel">
                    <h2>A little admin. Then back to work.</h2>
                    <TaskList />
                  </section>
                </div>
              </>
            )}

            {view === "jobs" && (
              <section className="workspace-panel">
                <div className="panel-top">
                  <h2>All jobs</h2>
                  <label className="search-label">
                    <span>Find a job</span>
                    <input
                      className="search-input"
                      placeholder="Search job or customer…"
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <TableScroll headers={["Job", "Customer", "Status", "Value", ""]}>
                  {visibleJobs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <strong>{job.title}</strong>
                        <small>{job.id} · {job.trade}</small>
                      </td>
                      <td>{job.customer}</td>
                      <td><Status value={job.status} /></td>
                      <td>{money(job.value)}</td>
                      <td>
                        <button type="button" aria-label={`View ${job.title}`} onClick={() => setDetail({ kind: "job", job })}>
                          View ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </TableScroll>
                <p className="empty-state" hidden={visibleJobs.length > 0}>No jobs match your search.</p>
              </section>
            )}

            {view === "customers" && (
              <section className="workspace-panel">
                <div className="panel-top">
                  <h2>Customer directory</h2>
                  <label className="search-label">
                    <span>Find a customer</span>
                    <input
                      className="search-input"
                      placeholder="Search name or location…"
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <TableScroll headers={["Customer", "Current work", "Location", "Stage", ""]}>
                  {visibleCustomers.map(customer => (
                    <tr key={customer.name}>
                      <td>
                        <strong>{customer.name}</strong>
                        <small>{customer.jobs} previous or active jobs</small>
                      </td>
                      <td>{customer.work}</td>
                      <td>{customer.area}</td>
                      <td><Status value={customer.stage} /></td>
                      <td>
                        <button type="button" aria-label={`View ${customer.name}`} onClick={() => setDetail({ kind: "customer", customer })}>
                          View ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </TableScroll>
                <p className="empty-state" hidden={visibleCustomers.length > 0}>No customers match your search.</p>
              </section>
            )}

            {view === "quotes" && (
              <section className="workspace-panel">
                <div className="panel-top">
                  <h2>Your quotes</h2>
                  <span className="demo-chip">{quotes.length} SAMPLE QUOTES</span>
                </div>
                <TableScroll headers={["Quote", "Customer", "Value", "Status", ""]}>
                  {quotes.map(quote => (
                    <tr key={quote.id}>
                      <td>
                        <strong>{quote.title}</strong>
                        <small>{quote.id}</small>
                      </td>
                      <td>{quote.customer}</td>
                      <td>{money(quote.value)}</td>
                      <td><Status value={quote.status} /></td>
                      <td>
                        <button type="button" aria-label={`View ${quote.title}`} onClick={() => setDetail({ kind: "quote", quote })}>
                          View ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </TableScroll>
              </section>
            )}

            {view === "schedule" && (
              <>
                <section className="workspace-panel">
                  <div className="panel-top">
                    <h2>Monday, 14 September</h2>
                    <span className="demo-chip">3 APPOINTMENTS</span>
                  </div>
                  <ScheduleList items={SCHEDULE_MONDAY} />
                </section>
                <section className="workspace-panel">
                  <h2>Coming up on Wednesday</h2>
                  <ScheduleList items={SCHEDULE_WEDNESDAY} />
                  <p>Customer and job information stay connected to the work on your calendar.</p>
                </section>
              </>
            )}

            {view === "invoices" && (
              <section className="workspace-panel">
                <h2>Your invoices</h2>
                <div className="invoice-total">
                  <div>
                    <span>Paid in this sample</span>
                    <strong>£4,875.00</strong>
                  </div>
                  <div>
                    <span>Awaiting payment</span>
                    <strong>£2,800.00</strong>
                  </div>
                </div>
                <TableScroll headers={["Invoice", "Customer", "Amount", "Status", "Date"]}>
                  {INVOICES.map(invoice => (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.title}</strong>
                        <small>{invoice.id}</small>
                      </td>
                      <td>{invoice.customer}</td>
                      <td>{money(invoice.value)}</td>
                      <td><Status value={invoice.status} /></td>
                      <td>{invoice.date}</td>
                    </tr>
                  ))}
                </TableScroll>
                <p>No payments are processed in this demo.</p>
              </section>
            )}

            {view === "website" && (
              <section className="workspace-panel">
                <div className="panel-top">
                  <h2>Oak & Stone · Sample website</h2>
                  <span className="demo-chip">DESIGN PREVIEW</span>
                </div>
                <div className="website-preview">
                  <span>OAK & STONE LANDSCAPES</span>
                  <h2>
                    Outdoor spaces.<br />
                    Extraordinary living.
                  </h2>
                  <p>Thoughtful gardens, beautiful patios and spaces made for everyday life.</p>
                  {/* Points at the Thomas Wilson record that already exists. It
                      deliberately does NOT create a customer — running it twice
                      must not leave two rows behind. */}
                  <button
                    type="button"
                    className="button light"
                    onClick={() => {
                      navigate("customers");
                      showToast("Sample enquiry: Thomas Wilson is in your customer directory.");
                    }}
                  >
                    Try a sample enquiry ↗
                  </button>
                </div>
                <p>This fictional business shows how a customer-facing website connects with your workspace.</p>
              </section>
            )}
          </div>
        </main>
      </div>

      <RecordDialog detail={detail} onClose={() => setDetail(null)} />
      <QuoteDialog
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        onCreate={quote => {
          setQuotes(current => [quote, ...current]);
          setQuoteOpen(false);
          navigate("quotes");
          showToast("Sample quote added. Nothing has been sent.");
        }}
        nextId={`QT-${2085 + quotes.length - INITIAL_QUOTES.length}`}
      />

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

/** Three sample tasks. Ticking one strikes it through; nothing is stored. */
function TaskList() {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const tasks = [
    "Follow up the Wilson garden quote",
    "Confirm Wednesday's materials delivery",
    "Review the boiler installation invoice",
  ];
  return (
    <div className="task-list">
      {tasks.map((task, i) => (
        <label key={task}>
          <input
            type="checkbox"
            checked={!!done[i]}
            onChange={e => setDone(current => ({ ...current, [i]: e.target.checked }))}
          />
          <span>{task}</span>
        </label>
      ))}
    </div>
  );
}

function RecordDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  return (
    <Modal open={detail !== null} onClose={onClose} closeLabel="Close details" labelledBy="detail-heading">
      <div id="detail-content">
        {detail?.kind === "job" && (
          <>
            <p className="eyebrow">{detail.job.id} / SAMPLE JOB</p>
            <h2 id="detail-heading">{detail.job.title}</h2>
            <div className="detail-grid">
              <div><span>Customer</span>{detail.job.customer}</div>
              <div><span>Job value</span>{money(detail.job.value)}</div>
              <div><span>Assigned team</span>{detail.job.team}</div>
              <div><span>Scheduled date</span>{detail.job.date}</div>
            </div>
            <Status value={detail.job.status} />
            <p className="detail-note">{detail.job.note}</p>
          </>
        )}
        {detail?.kind === "customer" && (
          <>
            <p className="eyebrow">CUSTOMER / SAMPLE RECORD</p>
            <h2 id="detail-heading">{detail.customer.name}</h2>
            <div className="detail-grid">
              <div><span>Location</span>{detail.customer.area}</div>
              <div><span>Jobs</span>{detail.customer.jobs}</div>
            </div>
            <Status value={detail.customer.stage} />
            <p className="detail-note">
              Current work: {detail.customer.work}.<br />
              This sample record contains no real contact information.
            </p>
          </>
        )}
        {detail?.kind === "quote" && (
          <>
            <p className="eyebrow">{detail.quote.id} / SAMPLE QUOTE</p>
            <h2 id="detail-heading">{detail.quote.title}</h2>
            <div className="detail-grid">
              <div><span>Customer</span>{detail.quote.customer}</div>
              <div><span>Total</span>{money(detail.quote.value)}</div>
            </div>
            <Status value={detail.quote.status} />
            <p className="detail-note">This quote is a demo record. It has not been sent to a customer.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * The quote builder.
 *
 * Field values persist across open/close within a visit, as in the reference.
 * Amounts are held as strings so an empty box stays empty rather than becoming
 * a silent zero — the handoff calls that out specifically, and "" coerced
 * through Number() is 0, which would let an empty required field submit as a
 * valid free quote.
 */
function QuoteDialog({
  open, onClose, onCreate, nextId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (quote: DemoQuote) => void;
  nextId: string;
}) {
  const [customer, setCustomer] = useState<string>(QUOTE_CUSTOMERS[0]);
  const [description, setDescription] = useState("Garden patio installation");
  const [labour, setLabour] = useState("1200");
  const [materials, setMaterials] = useState("650");
  const [tax, setTax] = useState("0");

  const parse = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const total = quoteTotal(parse(labour), parse(materials), parse(tax));
  const totalValid = Number.isFinite(total);

  const descriptionRef = useRef<HTMLInputElement | null>(null);

  return (
    <Modal open={open} onClose={onClose} closeLabel="Close quote builder" labelledBy="quote-heading">
      <p className="eyebrow">QUOTE BUILDER / DEMO</p>
      <h2 id="quote-heading">Put a price on the job.</h2>
      <p className="dialog-intro">Try a quote with sample details. Nothing is sent to a customer.</p>
      <form
        onSubmit={event => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;

          // Trimmed, so a description of nothing but spaces is rejected rather
          // than creating a quote with a blank title.
          const title = description.trim();
          if (!title) {
            descriptionRef.current?.setCustomValidity("Enter a work description.");
            descriptionRef.current?.reportValidity();
            return;
          }
          // A rejected submission must not add a record.
          if (!totalValid) return;

          onCreate({ id: nextId, customer, title, value: total, status: "Draft" });
        }}
      >
        <label>
          Customer
          <select value={customer} onChange={e => setCustomer(e.target.value)}>
            {QUOTE_CUSTOMERS.map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Work description
          <input
            ref={descriptionRef}
            required
            maxLength={150}
            value={description}
            onChange={e => {
              e.target.setCustomValidity("");
              setDescription(e.target.value);
            }}
          />
        </label>
        <div className="form-grid">
          <label>
            Labour (£)
            <input type="number" min="0" max="1000000" step="0.01" required value={labour} onChange={e => setLabour(e.target.value)} />
          </label>
          <label>
            Materials (£)
            <input type="number" min="0" max="1000000" step="0.01" required value={materials} onChange={e => setMaterials(e.target.value)} />
          </label>
          <label>
            Tax rate (%)
            <input type="number" min="0" max="100" step="0.1" required value={tax} onChange={e => setTax(e.target.value)} />
          </label>
        </div>
        <div className="quote-total">
          <span>Quote total</span>
          <strong>{totalValid ? money(total) : "—"}</strong>
        </div>
        <p className="quote-note">
          Choose the tax rate appropriate to your quote. This calculator makes no tax determination.
        </p>
        <button className="button teal-bg" type="submit">
          Add to sample quotes <span>↗</span>
        </button>
        <p className="quote-note">Saved only in this demo session. Refreshing resets the sample workspace.</p>
      </form>
    </Modal>
  );
}
