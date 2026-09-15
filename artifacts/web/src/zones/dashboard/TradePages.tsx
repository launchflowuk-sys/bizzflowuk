import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  api, useApi, money, shortDate, dayMonth, timeOf, daysUntil,
  INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE,
} from "./tradeApi";
import NewCertificateForm from "./NewCertificateForm";
import NewJobForm from "./NewJobForm";
import DictatableTextarea from "./VoiceInput";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { FileText, AlarmClock, CheckCircle2 } from "lucide-react";

/**
 * The trade modules: Invoices, Expenses, Schedule, Certificates, Automations.
 *
 * Kept in their own file rather than added to DashboardApp, which is already
 * 3,600 lines. Nothing here changes an existing screen — these mount as new
 * routes, so the three live tenants see exactly what they saw before.
 */

// ── Shared bits ──────────────────────────────────────────────────────────────

/**
 * The same solid pill as everywhere else, behind this module's existing tone
 * names so the call sites do not have to change.
 *
 * `Pill` is used for two different things here and only one of them is a
 * status: `<Pill tone="info">{engineer.name}</Pill>` is a label, and a
 * bordered wash was fine for that. The two look the same on screen now, which
 * is the point — one pill shape, one weight, one set of grounds.
 */
const PILL_TONE: Record<string, StatusTone> = {
  good: "success",
  warn: "warn",
  bad: "danger",
  muted: "neutral",
  info: "info",
};

function Pill({ tone = "muted", children }: { tone?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[13px] font-semibold text-white ${
        { success: "bg-state-success", warn: "bg-state-warning", danger: "bg-state-danger", neutral: "bg-state-neutral", info: "bg-state-info" }[
          PILL_TONE[tone] ?? "neutral"
        ]
      }`}
    >
      {children}
    </span>
  );
}

function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-slate-900">{title}</h1>
        {sub && <p className="mt-1 text-[14.5px] text-slate-500 max-w-[62ch]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Page padding, matching the rest of the dashboard.
 *
 * Every existing page wraps its content in `p-4 sm:p-6`. These pages returned a
 * bare fragment, so their headings sat flush against the edge of the screen while
 * every other page was inset — subtle, and exactly the kind of thing that makes a
 * product feel assembled rather than designed.
 */
function Page({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-6">{children}</div>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-[20px] ${className}`}>{children}</div>;
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="p-12 text-center">
      <h3 className="text-[17px] font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-[14.5px] text-slate-500 max-w-[46ch] mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

function Btn({ children, onClick, tone = "primary", type = "button", disabled }: {
  children: React.ReactNode; onClick?: () => void; tone?: "primary" | "ghost" | "danger"; type?: "button" | "submit"; disabled?: boolean;
}) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 h-11 px-4 rounded-[14px] text-[14.5px] font-semibold transition-colors disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[12.5px] text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full h-12 px-3.5 rounded-[14px] border border-slate-200 bg-transparent text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500";

function Loading() {
  return <Card className="p-12 text-center text-slate-400 text-[14.5px]">Loading…</Card>;
}

function ErrorNote({ message }: { message: string }) {
  return (
    <Card className="p-5 border-red-200 bg-red-50">
      <p className="text-[14.5px] text-red-700">{message}</p>
    </Card>
  );
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const [, navigate] = useLocation();
  const { data, loading, error, reload } = useApi<any[]>("/invoices");
  const [creating, setCreating] = useState(false);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const outstanding = rows
      .filter(r => !["paid", "void", "draft"].includes(r.status))
      .reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
    const overdue = rows.filter(r => r.status === "overdue")
      .reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
    const paidThisMonth = rows.filter(r => r.status === "paid" && r.paidAt && new Date(r.paidAt).getMonth() === new Date().getMonth())
      .reduce((s, r) => s + Number(r.total ?? 0), 0);
    return { outstanding, overdue, paidThisMonth };
  }, [data]);

  async function createDraft() {
    setCreating(true);
    try {
      const inv = await api.post<any>("/invoices", { items: [] });
      navigate(`/dashboard/invoices/${inv.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally { setCreating(false); }
  }

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;

  const rows = data ?? [];

  return (
<Page>
      <PageHead
        title="Invoices"
        sub="Raise it, send it, and see what is actually outstanding."
        action={<Btn onClick={createDraft} disabled={creating}>New invoice</Btn>}
      />

      {/* Red text on a white card was easy to miss in a page of white cards.
          Overdue money is the one figure on this screen that needs a person, so
          it takes the alarm ground and says so — and drops back to navy the
          moment it reaches zero, because a vivid 0 reads as data when it is
          really the absence of it. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 mb-6 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <StatCard label="Outstanding" value={money(totals.outstanding)} hint="raised and not yet paid" category="money" icon={FileText} />
        <StatCard label="Overdue" value={money(totals.overdue)} hint="past its due date" attention={totals.overdue > 0} icon={AlarmClock} />
        <StatCard label="Paid this month" value={money(totals.paidThisMonth)} hint="cleared funds" category="money" icon={CheckCircle2} />
      </div>

      {rows.length === 0 ? (
        <Empty
          title="No invoices yet"
          body="Raise one from scratch, or turn an accepted quote into an invoice so nothing gets retyped."
          action={<Btn onClick={createDraft}>New invoice</Btn>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14.5px] min-w-[680px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-[0.05em] text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-5 py-3 font-semibold">Issued</th>
                  <th className="px-5 py-3 font-semibold">Due</th>
                  <th className="px-5 py-3 font-semibold text-right">Total</th>
                  <th className="px-5 py-3 font-semibold text-right">Outstanding</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}
                    onClick={() => navigate(`/dashboard/invoices/${r.id}`)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 font-mono text-[13.5px]">{r.reference}</td>
                    <td className="px-5 py-3.5 text-slate-600">{shortDate(r.issuedOn)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{shortDate(r.dueOn)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-900">{money(r.total)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{money(r.outstanding)}</td>
                    <td className="px-5 py-3.5">
                      <Pill tone={INVOICE_STATUS_TONE[r.status]}>{INVOICE_STATUS_LABEL[r.status] ?? r.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>  );
}

/**
 * One invoice.
 *
 * The old version wrote to the server on every blur, rebuilding and re-sending
 * the WHOLE items array each time. Typing a description and tabbing to the
 * quantity fired two full saves, and two of them in flight at once raced: the
 * slower reply overwrote the newer edit. It also meant an invoice could not be
 * drafted on a phone with no signal, and a twelve-column grid put a description
 * box five columns wide next to a delete cross one column wide, which on a
 * phone is a row of slots too narrow to read.
 *
 * So the lines are edited locally and saved once, deliberately. The rest of the
 * page is the stuff a real invoice needs and never had: how it repeats, what it
 * says about VAT and CIS, and how the customer is actually supposed to pay it.
 */

const RECURRENCE_LABEL: Record<string, string> = {
  weekly: "Every week",
  fortnightly: "Every fortnight",
  monthly: "Every month",
  quarterly: "Every quarter",
  six_monthly: "Every six months",
  yearly: "Every year",
};

type DraftLine = { id?: number; description: string; quantity: string; unitPrice: string; vatRate: string | null };

function toDraft(items: any[]): DraftLine[] {
  return items.map(i => ({
    id: i.id,
    description: i.description ?? "",
    quantity: String(i.quantity ?? "1"),
    unitPrice: String(i.unitPrice ?? "0"),
    vatRate: i.vatRate === null || i.vatRate === undefined ? null : String(i.vatRate),
  }));
}

/** Pence, so the running total on screen matches the server to the penny. */
function linePence(l: DraftLine): number {
  const q = Number(l.quantity);
  const u = Number(l.unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(u)) return 0;
  return Math.round(Math.round(u * 100) * q);
}

export function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data, loading, error, reload } = useApi<any>(`/invoices/${params.id}`);
  const { data: customers } = useApi<any[]>("/customers");
  const { data: settings } = useApi<any>("/settings");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [showDraft, setShowDraft] = useState(false);

  /**
   * The lines being edited, owned locally until Save.
   *
   * Reseeding needs care. Changing the customer or recording a payment reloads
   * the whole invoice, and naively re-copying the server's lines on every
   * reload would throw away line edits the person had not saved yet — you
   * would pick a customer from the dropdown and watch your typing vanish.
   *
   * So the server's version is adopted only when the local draft still matches
   * what the server last said. The moment there are unsaved edits, the draft
   * wins and the banner asks for a decision.
   */
  const [lines, setLines] = useState<DraftLine[] | null>(null);
  const serverItems: any[] = data?.items ?? [];
  const loadedId = useRef<number | null>(null);
  const lastServer = useRef<string>("");
  useEffect(() => {
    if (!data) return;
    const shape = (ls: DraftLine[]) => JSON.stringify(ls.map(({ id, ...l }) => l));
    const snapshot = shape(toDraft(data.items ?? []));

    if (lines === null || loadedId.current !== data.id) {
      loadedId.current = data.id;
      lastServer.current = snapshot;
      setLines(toDraft(data.items ?? []));
      return;
    }
    if (snapshot === lastServer.current) return;
    if (shape(lines) === lastServer.current) setLines(toDraft(data.items ?? []));
    lastServer.current = snapshot;
  }, [data]);

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;
  if (!data) return null;

  const locked = data.status === "void";
  const draft = lines ?? toDraft(serverItems);
  const isCopy = Boolean(data.recurrenceSourceId);

  const dirty = JSON.stringify(draft.map(({ id, ...l }) => l))
    !== JSON.stringify(toDraft(serverItems).map(({ id, ...l }) => l));

  const subtotalPence = draft.reduce((s, l) => s + linePence(l), 0);

  async function run(fn: () => Promise<any>, ok: string) {
    setBusy(true); setNote(null);
    try { await fn(); reload(); setNote(ok); }
    catch (e: any) { setNote(e.message); }
    finally { setBusy(false); }
  }

  function setLine(idx: number, patch: Partial<DraftLine>) {
    setLines(draft.map((l, n) => n === idx ? { ...l, ...patch } : l));
  }

  /**
   * Look at it before the customer does.
   *
   * There was no way to see an invoice. You filled in the lines, pressed Send,
   * and the first person to see how it actually read was the customer — a poor
   * moment to notice the address is wrong or a line still says "New line".
   *
   * The window is opened BEFORE the fetch, not after. Popup blockers allow a
   * window opened synchronously inside a click and block one opened after an
   * await, so doing it the obvious way means the preview silently never
   * appears for some people.
   */
  async function preview() {
    const tab = window.open("", "_blank");
    try {
      const url = await api.blob(`/invoices/${data.id}/pdf`);
      if (tab) tab.location.href = url;
      else window.location.href = url;   // popup blocked: same tab beats nothing
    } catch (e: any) {
      tab?.close();
      setNote(e?.message || "Could not build the PDF.");
    }
  }

  async function downloadPdf() {
    try {
      const url = await api.blob(`/invoices/${data.id}/pdf?download=1`);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.reference}.pdf`;
      a.click();
      // Freed on the next tick — revoking immediately can cancel the save in
      // some browsers before it has read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      setNote(e?.message || "Could not build the PDF.");
    }
  }

  function saveLines() {
    const clean = draft
      .filter(l => l.description.trim())
      .map(l => ({
        description: l.description.trim(),
        quantity: l.quantity === "" ? "1" : l.quantity,
        unitPrice: l.unitPrice === "" ? "0" : l.unitPrice,
        vatRate: l.vatRate,
      }));
    run(() => api.patch(`/invoices/${data.id}`, { items: clean }), "Lines saved");
  }

  return (
<Page>
      <PageHead
        title={data.reference}
        sub={`${INVOICE_STATUS_LABEL[data.status] ?? data.status} · ${money(data.total)} · ${money(data.outstanding)} outstanding`}
        action={
          <div className="flex flex-wrap gap-2">
            <Btn tone="ghost" onClick={() => navigate("/dashboard/invoices")}>Back</Btn>
            <Btn tone="ghost" onClick={preview} disabled={dirty}>Preview</Btn>
            <Btn tone="ghost" onClick={downloadPdf} disabled={dirty}>Download</Btn>
            {data.status === "draft" && (
              <Btn onClick={() => run(() => api.post(`/invoices/${data.id}/send`), "Invoice sent")} disabled={busy || dirty}>Send</Btn>
            )}
            {!locked && data.status !== "draft" && (
              <Btn tone="danger" onClick={() => run(() => api.post(`/invoices/${data.id}/void`, { reason: "Voided from the dashboard" }), "Invoice voided")} disabled={busy}>Void</Btn>
            )}
          </div>
        }
      />

      {note && <div className="mb-5"><Card className="p-4"><p className="text-[14.5px] text-slate-700">{note}</p></Card></div>}

      {dirty && !locked && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[14.5px] font-semibold text-amber-900">Unsaved changes to the lines.</p>
          <div className="flex gap-2">
            <Btn onClick={saveLines} disabled={busy}>Save lines</Btn>
            <Btn tone="ghost" onClick={() => setLines(toDraft(serverItems))} disabled={busy}>Discard</Btn>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-[16px] font-bold text-slate-900">What the work was</h2>
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  <Btn tone="ghost" onClick={() => setShowDraft(v => !v)}>
                    {showDraft ? "Close" : "Describe it"}
                  </Btn>
                  <Btn tone="ghost" onClick={() => setLines([...draft, { description: "", quantity: "1", unitPrice: "0", vatRate: null }])}>
                    Add a line
                  </Btn>
                </div>
              )}
            </div>

            {showDraft && !locked && (
              <DraftFromNotes
                onLines={got => {
                  setLines([
                    ...draft.filter(l => l.description.trim()),
                    ...got.map(g => ({
                      description: g.description,
                      quantity: String(g.quantity),
                      unitPrice: String(g.unitPrice),
                      vatRate: null,
                    })),
                  ]);
                  setShowDraft(false);
                }}
              />
            )}

            {draft.length === 0 ? (
              <p className="text-[14.5px] text-slate-500 py-6 text-center">
                Nothing on it yet. An invoice needs at least one line before it can be sent.
              </p>
            ) : (
              <>
                {/* Column headings only from sm up — on a phone each line is its
                    own block with its own labels, so a header row would be
                    pointing at nothing. */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                <div className="space-y-3 sm:space-y-2">
                  {draft.map((l, idx) => (
                    <div key={l.id ?? `new-${idx}`}
                      className="rounded-[14px] border border-slate-200 p-3 sm:border-0 sm:p-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center">
                      <div className="sm:col-span-6">
                        <span className="sm:hidden block text-[12px] font-semibold text-slate-500 mb-1">Description</span>
                        <input className={inputCls} value={l.description} disabled={locked}
                          placeholder="Replaced kitchen mixer tap"
                          onChange={e => setLine(idx, { description: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 sm:mt-0 sm:contents">
                        <div className="sm:col-span-2">
                          <span className="sm:hidden block text-[12px] font-semibold text-slate-500 mb-1">Qty</span>
                          <input className={`${inputCls} text-right`} value={l.quantity} type="number" step="0.01" inputMode="decimal" disabled={locked}
                            onChange={e => setLine(idx, { quantity: e.target.value })} />
                        </div>
                        <div className="sm:col-span-2">
                          <span className="sm:hidden block text-[12px] font-semibold text-slate-500 mb-1">Unit price</span>
                          <input className={`${inputCls} text-right`} value={l.unitPrice} type="number" step="0.01" inputMode="decimal" disabled={locked}
                            onChange={e => setLine(idx, { unitPrice: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2 sm:mt-0 sm:col-span-2 sm:justify-end">
                        <span className="sm:hidden text-[12px] font-semibold text-slate-500">Line total</span>
                        <span className="tabular-nums font-semibold text-slate-900">{money((linePence(l) / 100).toFixed(2))}</span>
                        {!locked && (
                          <button onClick={() => setLines(draft.filter((_, n) => n !== idx))}
                            className="text-slate-400 hover:text-red-600 text-[18px] leading-none px-1 sm:ml-1"
                            aria-label={`Remove ${l.description || "this line"}`}>×</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200 space-y-1.5 text-[14.5px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="tabular-nums">{money((subtotalPence / 100).toFixed(2))}</span>
              </div>
              {dirty ? (
                <p className="text-[13px] text-amber-700 pt-1">
                  VAT, CIS and the total are worked out by the server. Save the lines to see them.
                </p>
              ) : (
                <>
                  {Number(data.vatAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">VAT{data.vatRate ? ` at ${Number(data.vatRate)}%` : ""}</span>
                      <span className="tabular-nums">{money(data.vatAmount)}</span>
                    </div>
                  )}
                  {Number(data.cisDeduction) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">CIS deducted{settings?.cisRate ? ` at ${Number(settings.cisRate)}%` : ""}</span>
                      <span className="tabular-nums text-amber-700">−{money(data.cisDeduction)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 font-bold text-slate-900">
                    <span>Total</span><span className="tabular-nums">{money(data.total)}</span>
                  </div>
                  {Number(data.amountPaid) > 0 && (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="tabular-nums">{money(data.amountPaid)}</span></div>
                      <div className="flex justify-between font-bold text-slate-900"><span>Still to pay</span><span className="tabular-nums">{money(data.outstanding)}</span></div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* The two tax facts a trade is judged on, said out loud rather than
                left for them to infer from a missing row. */}
            {!dirty && settings && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-[13px] text-slate-500 space-y-1">
                {!settings.vatRegistered && <p>No VAT on this invoice — you are not registered. Change that in Settings.</p>}
                {settings.cisRegistered && Number(data.cisDeduction) === 0 && Number(data.subtotal) > 0 && (
                  <p>No CIS shown. It is deducted at {Number(settings.cisRate ?? 20)}% on invoices to contractors.</p>
                )}
              </div>
            )}
          </Card>

          <RepeatCard invoice={data} busy={busy} run={run} isCopy={isCopy} />

          {data.status !== "draft" && !locked && (
            <Card className="p-5">
              <h2 className="text-[16px] font-bold text-slate-900 mb-4">Record a payment</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <Field label="Amount">
                    <input className={inputCls} type="number" step="0.01" inputMode="decimal" value={payAmount}
                      placeholder={data.outstanding} onChange={e => setPayAmount(e.target.value)} />
                  </Field>
                </div>
                <Btn disabled={busy || !payAmount} onClick={() => {
                  run(() => api.post(`/invoices/${data.id}/payments`, { amount: payAmount }), "Payment recorded");
                  setPayAmount("");
                }}>Record</Btn>
              </div>

              {(data.payments ?? []).length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-200 space-y-2">
                  {data.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-[14px]">
                      <span className="text-slate-600">{shortDate(p.paidOn)} · {p.method.replace("_", " ")}</span>
                      <span className="tabular-nums font-semibold">{money(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[16px] font-bold text-slate-900 mb-4">Details</h2>
            <div className="space-y-4">
              <Field label="Customer">
                <select className={inputCls} value={data.customerId ?? ""} disabled={locked}
                  onChange={e => run(() => api.patch(`/invoices/${data.id}`, { customerId: e.target.value ? Number(e.target.value) : null }), "Saved")}>
                  <option value="">Choose a customer…</option>
                  {(customers ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}</option>
                  ))}
                </select>
              </Field>
              <Field label="Issued">
                <input className={inputCls} type="date" defaultValue={data.issuedOn ?? ""} disabled={locked}
                  onBlur={e => e.target.value !== data.issuedOn && run(() => api.patch(`/invoices/${data.id}`, { issuedOn: e.target.value }), "Saved")} />
              </Field>
              <Field label="Due" hint={data.dueOn && data.issuedOn ? `${Math.round((Date.parse(data.dueOn) - Date.parse(data.issuedOn)) / 86400000)} days to pay` : undefined}>
                <input className={inputCls} type="date" defaultValue={data.dueOn ?? ""} disabled={locked}
                  onBlur={e => e.target.value !== data.dueOn && run(() => api.patch(`/invoices/${data.id}`, { dueOn: e.target.value }), "Saved")} />
              </Field>
            </div>
          </Card>

          <PaymentDetailsCard invoice={data} settings={settings} locked={locked} busy={busy} run={run} />
        </div>
      </div>
    </Page>  );
}

/**
 * Say what you did; get lines you can correct.
 *
 * The thing that actually stops invoices being raised is not the arithmetic,
 * it is the blank page at nine at night after a twelve-hour day. So the box
 * takes the job the way a trade would say it out loud — and can be dictated
 * rather than typed, because the person using this is often still in the van.
 *
 * The lines come back as a SUGGESTION and are dropped into the editor
 * unsaved. Nothing reaches the invoice until a human has looked at the
 * figures and pressed Save. Anything that writes straight onto a money
 * document is one hallucinated zero away from a very bad morning.
 */
function DraftFromNotes({ onLines }: {
  onLines: (lines: Array<{ description: string; quantity: number; unitPrice: number }>) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function draft() {
    if (text.trim().length < 3) { setErr("Say a bit more about the job first."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await api.post<{ lines: Array<{ description: string; quantity: number; unitPrice: number }> }>(
        "/invoices/draft-lines", { notes: text.trim() },
      );
      onLines(res.lines ?? []);
      setText("");
    } catch (e: any) {
      setErr(e?.message || "Could not draft the lines.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-5 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[14.5px] font-semibold text-slate-900 mb-1">Describe the job</p>
      <p className="text-[13px] text-slate-500 mb-3">
        In your own words, the way you would tell someone. Your own price list is used where it
        matches, and anything it cannot price is left at zero for you to fill in rather than guessed at.
      </p>
      <DictatableTextarea
        value={text}
        onChange={setText}
        disabled={busy}
        rows={3}
        placeholder="Swapped the kitchen mixer tap, hour and a half on site, tap was eighty five quid. Also bled two rads upstairs."
        className={`${inputCls} h-auto py-3`}
      />
      {err && <p className="mt-2 text-[13px] text-amber-700">{err}</p>}
      <div className="mt-3">
        <Btn onClick={draft} disabled={busy || !text.trim()}>
          {busy ? "Working it out…" : "Draft the lines"}
        </Btn>
      </div>
    </div>
  );
}

/**
 * How the customer pays, and anything they need to be told.
 *
 * The bank block is read from the tenant's settings rather than typed per
 * invoice — it is the same on every one, and retyping a sort code is exactly
 * how a digit gets transposed and a payment lands in a stranger's account. What
 * IS per-invoice is the note and the terms, because those change with the job.
 */
function PaymentDetailsCard({ invoice, settings, locked, busy, run }: {
  invoice: any; settings: any; locked: boolean; busy: boolean;
  run: (fn: () => Promise<any>, ok: string) => void;
}) {
  const hasBank = Boolean(settings?.bankAccountNumber || settings?.bankSortCode);

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-slate-900 mb-1">How to pay it</h2>
      <p className="text-[13px] text-slate-500 mb-4">
        Printed on the invoice the customer receives.
      </p>

      {hasBank ? (
        <div className="rounded-[14px] bg-slate-50 border border-slate-200 p-3.5 text-[14px] space-y-1 mb-4">
          {settings.bankAccountName && <p className="font-semibold text-slate-900">{settings.bankAccountName}</p>}
          {settings.bankName && <p className="text-slate-600">{settings.bankName}</p>}
          <p className="tabular-nums text-slate-700">
            {settings.bankSortCode && <span>Sort code {settings.bankSortCode}</span>}
            {settings.bankSortCode && settings.bankAccountNumber && <span> · </span>}
            {settings.bankAccountNumber && <span>Account {settings.bankAccountNumber}</span>}
          </p>
          {settings.paymentInstructions && (
            <p className="text-slate-600 pt-1">{settings.paymentInstructions}</p>
          )}
        </div>
      ) : (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3.5 mb-4">
          <p className="text-[14px] font-semibold text-amber-900">No bank details set.</p>
          <p className="text-[13px] text-amber-800 mt-1">
            This invoice tells the customer what they owe and nothing about where to send it.
            Add them once in Settings and every invoice carries them.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <Field label="Note to the customer" hint="Sits under the lines. Anything about this particular job.">
          <textarea className={`${inputCls} h-24 py-3`} defaultValue={invoice.notes ?? ""} disabled={locked}
            placeholder="Thanks for the tea. The stopcock under the sink is stiff — worth replacing next visit."
            onBlur={e => e.target.value !== (invoice.notes ?? "") && run(() => api.patch(`/invoices/${invoice.id}`, { notes: e.target.value }), "Saved")} />
        </Field>
        <Field label="Terms" hint={settings?.invoiceTerms ? "Overrides your default terms for this one invoice." : "Your payment terms, in your words."}>
          <textarea className={`${inputCls} h-20 py-3`} defaultValue={invoice.terms ?? settings?.invoiceTerms ?? ""} disabled={locked}
            placeholder="Payment due within 14 days. Late payment may incur interest under the Late Payment of Commercial Debts Act."
            onBlur={e => e.target.value !== (invoice.terms ?? "") && run(() => api.patch(`/invoices/${invoice.id}`, { terms: e.target.value }), "Saved")} />
        </Field>
      </div>
    </Card>
  );
}

/**
 * Whether this invoice repeats.
 *
 * A one-off is the default and says nothing about itself. Turning on a cadence
 * turns THIS invoice into the head of a series: the platform clones it on
 * schedule rather than keeping a separate template, so what goes out next month
 * is exactly what went out this month.
 */
function RepeatCard({ invoice, busy, run, isCopy }: {
  invoice: any; busy: boolean; isCopy: boolean;
  run: (fn: () => Promise<any>, ok: string) => void;
}) {
  const [cadence, setCadence] = useState<string>(invoice.recurrence ?? "");
  const [until, setUntil] = useState<string>(invoice.recurrenceUntil ?? "");
  const [autoSend, setAutoSend] = useState<boolean>(Boolean(invoice.recurrenceAutoSend));
  const { data: series } = useApi<any[]>(
    invoice.recurrence ? `/invoices/${invoice.id}/series` : null, [invoice.id, invoice.recurrence],
  );

  if (isCopy) {
    return (
      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-slate-900 mb-1">Part of a repeating series</h2>
        <p className="text-[14px] text-slate-600">
          This one was raised automatically. To change the schedule, open the first invoice in the
          series — changing it here would fork it and the customer would start getting two of everything.
        </p>
      </Card>
    );
  }

  const live = Boolean(invoice.recurrence);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-[16px] font-bold text-slate-900">Does this repeat?</h2>
        {live && <Pill tone="info">{RECURRENCE_LABEL[invoice.recurrence] ?? invoice.recurrence}</Pill>}
      </div>
      <p className="text-[13px] text-slate-500 mb-4">
        {live
          ? `Next one is raised on ${shortDate(invoice.recurrenceNextOn)}${invoice.recurrenceCount > 0 ? ` · ${invoice.recurrenceCount} issued so far` : ""}.`
          : "A maintenance contract, a landlord safety round, a quarterly service — set it once and it raises itself."}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="How often">
          <select className={inputCls} value={cadence} onChange={e => setCadence(e.target.value)}>
            <option value="">One-off — does not repeat</option>
            {Object.entries(RECURRENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {cadence && (
          <Field label="Stop after" hint="Leave blank to run until you stop it.">
            <input className={inputCls} type="date" value={until} onChange={e => setUntil(e.target.value)} />
          </Field>
        )}
      </div>

      {cadence && (
        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <input type="checkbox" className="mt-1 h-5 w-5 rounded border-slate-300 accent-sky-600"
            checked={autoSend} onChange={e => setAutoSend(e.target.checked)} />
          <span>
            <span className="block text-[14.5px] font-semibold text-slate-900">Send each one automatically</span>
            <span className="block text-[13px] text-slate-500">
              Off, each copy waits as a draft for you to check and send. On, it goes straight to the
              customer on the day — so make sure the figure above is one you are happy to repeat.
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Btn disabled={busy} onClick={() => run(
          () => api.put(`/invoices/${invoice.id}/recurrence`, {
            recurrence: cadence || null,
            until: until || null,
            autoSend,
          }),
          cadence ? "Schedule saved" : "This invoice no longer repeats",
        )}>
          {cadence ? (live ? "Update the schedule" : "Start repeating") : "Save"}
        </Btn>
        {live && (
          <Btn tone="ghost" disabled={busy} onClick={() => {
            setCadence(""); setUntil("");
            run(() => api.put(`/invoices/${invoice.id}/recurrence`, { recurrence: null }), "Stopped repeating");
          }}>Stop repeating</Btn>
        )}
      </div>

      {(series ?? []).length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-200">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-slate-400 mb-2">
            Raised by this series
          </h3>
          <div className="space-y-1.5">
            {(series ?? []).map(s => (
              <a key={s.id} href={`/dashboard/invoices/${s.id}`}
                className="flex items-center justify-between gap-3 text-[14px] py-1 hover:text-sky-700">
                <span className="font-mono text-[13px]">{s.reference}</span>
                <span className="text-slate-500">{shortDate(s.issuedOn)}</span>
                <span className="tabular-nums font-semibold">{money(s.total)}</span>
                <Pill tone={INVOICE_STATUS_TONE[s.status]}>{INVOICE_STATUS_LABEL[s.status] ?? s.status}</Pill>
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Expenses ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["materials", "fuel", "tools", "subcontractor", "insurance", "vehicle", "other"];

export function ExpensesPage() {
  const { data, loading, error, reload } = useApi<any[]>("/expenses");
  const emptyExpense = {
    supplier: "", category: "materials", spentOn: new Date().toISOString().slice(0, 10),
    net: "", vatAmount: "", expectedOn: "",
  };
  const [form, setForm] = useState(emptyExpense);
  // Whether this is a receipt for something already in the van, or an order
  // that has yet to turn up. Only the second kind can be chased.
  const [onOrder, setOnOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const total = useMemo(() => (data ?? []).reduce((s, e) => s + Number(e.total ?? 0), 0), [data]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplier) { setNote("A supplier is needed."); return; }
    setBusy(true); setNote(null);
    try {
      await api.post("/expenses", {
        ...form,
        net: form.net || 0,
        vatAmount: form.vatAmount || 0,
        // Only an order carries an expected date. Sending one on a receipt
        // would put a paid-for item straight onto the late-delivery list.
        expectedOn: onOrder && form.expectedOn ? form.expectedOn : null,
      });
      setForm(emptyExpense);
      setOnOrder(false);
      reload();
    } catch (err: any) { setNote(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;

  return (
<Page>
      <PageHead title="Expenses" sub="What goes out, so the cash flow forecast tells the truth." />

      <Card className="p-5 mb-5">
        <form onSubmit={add} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-2">
            <Field label="Supplier">
              <input className={inputCls} value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Plumb Center" />
            </Field>
          </div>
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input className={inputCls} type="date" value={form.spentOn} onChange={e => setForm({ ...form, spentOn: e.target.value })} />
          </Field>
          <Field label="Net">
            <input className={inputCls} type="number" step="0.01" value={form.net} onChange={e => setForm({ ...form, net: e.target.value })} placeholder="0.00" />
          </Field>
          <div className="flex gap-2 items-end">
            <Field label="VAT">
              <input className={inputCls} type="number" step="0.01" value={form.vatAmount} onChange={e => setForm({ ...form, vatAmount: e.target.value })} placeholder="0.00" />
            </Field>
          </div>
          {/* Ordered and not arrived yet. Without a promised date the
              late-delivery automation has nothing to chase, which is exactly
              the trap VAT and payment terms were in before this. */}
          <div className="lg:col-span-6 flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 accent-sky-600"
                checked={onOrder} onChange={e => setOnOrder(e.target.checked)} />
              <span className="text-[14.5px] text-slate-700">This is on order and has not arrived</span>
            </label>
            {onOrder && (
              <div className="min-w-[200px]">
                <Field label="Promised for" hint="Chased for you if it does not turn up.">
                  <input className={inputCls} type="date" value={form.expectedOn}
                    onChange={e => setForm({ ...form, expectedOn: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
          <div className="lg:col-span-6">
            <Btn type="submit" disabled={busy}>Add expense</Btn>
            {note && <span className="ml-3 text-[14px] text-red-600">{note}</span>}
          </div>
        </form>
      </Card>

      {(data ?? []).length === 0 ? (
        <Empty title="No expenses yet" body="Add what you spend on materials, fuel and subcontractors and the cash flow forecast starts working." />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between text-[14.5px]">
            <span className="text-slate-500">{(data ?? []).length} expenses</span>
            <span className="font-bold tabular-nums text-slate-900">{money(total)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[14.5px] min-w-[560px]">
              <tbody>
                {(data ?? []).map(e => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{shortDate(e.spentOn)}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {e.supplier}
                      {e.expectedOn && !e.receivedOn && (
                        <span className="ml-2 align-middle"><Pill tone={e.expectedOn < new Date().toISOString().slice(0, 10) ? "warn" : "info"}>
                          {e.expectedOn < new Date().toISOString().slice(0, 10) ? "late" : `due ${shortDate(e.expectedOn)}`}
                        </Pill></span>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><Pill>{e.category}</Pill></td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{money(e.net)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-900">{money(e.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>  );
}

// ── Schedule ─────────────────────────────────────────────────────────────────

/**
 * The diary.
 *
 * It used to be one month grid and nothing else. A month is the wrong unit for
 * most of the day: a trade sitting in a van at half seven wants to know what
 * today looks like and where the next address is, not how the 26th is shaping
 * up. So the same data now reads four ways, and the one you picked last is the
 * one you get back.
 *
 *   Day     an hour rail with the jobs on it, which is the morning view
 *   Week    seven columns, which is how work actually gets planned
 *   Month   the wide view, for spotting the quiet fortnight
 *   Route   the day by address, in order, with the driving handed to the phone
 *
 * Dates are keyed LOCALLY, never through toISOString(). A job at 00:30 on a
 * British Summer Time morning is 23:30 the previous day in UTC, and keying it
 * the old way filed it under yesterday — a whole job missing from today for
 * half the year.
 */

type ScheduleView = "day" | "week" | "month" | "route";

const VIEW_LABEL: Record<ScheduleView, string> = {
  day: "Day", week: "Week", month: "Month", route: "Route",
};

/** Local YYYY-MM-DD. See the note above about why this is not toISOString(). */
function dayKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday, because a UK working week starts on one. */
function startOfWeek(d: Date) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function SchedulePage() {
  const [view, setView] = useState<ScheduleView>(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("bf.schedule.view"); } catch { /* private mode */ }
    return saved === "day" || saved === "week" || saved === "month" || saved === "route" ? saved : "week";
  });
  // One anchor date drives every view, so switching between them keeps your
  // place instead of throwing you back to today.
  const [anchor, setAnchor] = useState(() => new Date());

  function pickView(v: ScheduleView) {
    setView(v);
    try { localStorage.setItem("bf.schedule.view", v); } catch { /* private mode */ }
  }

  // The window of days this view needs. The API filters on scheduledStart, so
  // `to` is the last day inclusive and gets a time put on it below.
  const { from, to, days } = useMemo(() => {
    if (view === "month") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { from: dayKey(first), to: dayKey(last), days: [] as Date[] };
    }
    if (view === "week") {
      const mon = startOfWeek(anchor);
      const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
      return { from: dayKey(mon), to: dayKey(week[6]), days: week };
    }
    return { from: dayKey(anchor), to: dayKey(anchor), days: [anchor] };
  }, [view, anchor]);

  // `to` needs the end of that day, or anything booked after midday on the
  // last day of the window falls outside it.
  const { data, loading, error } = useApi<any[]>(
    `/schedule?from=${from}&to=${to}T23:59:59`, [from, to],
  );
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  // Booking a slot IS creating a job, so this opens the same form rather than a
  // second, thinner one that would drift out of step with it.
  const [showNewJob, setShowNewJob] = useState(false);

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const job of data ?? []) {
      const key = dayKey(job.scheduledStart);
      const list = m.get(key) ?? []; list.push(job); m.set(key, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => +new Date(a.scheduledStart) - +new Date(b.scheduledStart));
    }
    return m;
  }, [data]);

  // Monday-first grid, which is how a UK working week reads.
  const cells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const out: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setDate(1 - offset + i);
      out.push({ date: d, inMonth: d.getMonth() === anchor.getMonth() });
    }
    return out;
  }, [anchor]);

  const todayKey = dayKey(new Date());

  function step(direction: -1 | 1) {
    if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
    else if (view === "week") setAnchor(addDays(anchor, 7 * direction));
    else setAnchor(addDays(anchor, direction));
  }

  const heading = useMemo(() => {
    if (view === "month") return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (view === "week") {
      const mon = startOfWeek(anchor), sun = addDays(mon, 6);
      const sameMonth = mon.getMonth() === sun.getMonth();
      const left = mon.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
      return `${left} – ${sun.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
    }
    return anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }, [view, anchor]);

  const openDay = (d: Date) => { setAnchor(d); pickView("day"); };

  const all = data ?? [];
  const anchorJobs = byDay.get(dayKey(anchor)) ?? [];

  return (
<Page>
      <PageHead
        title="Schedule"
        sub="Every booked job, and who is on it."
        action={
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setShowNewJob(true)}>+ New job</Btn>
            <Btn tone="ghost" onClick={() => setAnchor(new Date())}>Today</Btn>
            <Btn tone="ghost" onClick={async () => {
              try { const f = await api.post<any>("/schedule/feed"); setFeedUrl(f.url); }
              catch (e: any) { alert(e.message); }
            }}>Add to my calendar</Btn>
          </div>
        }
      />

      {showNewJob && (
        <NewJobForm
          onClose={() => setShowNewJob(false)}
          onCreated={() => { setShowNewJob(false); window.location.reload(); }}
        />
      )}

      {feedUrl && (
        <CalendarFeedCard url={feedUrl} onRevoked={() => setFeedUrl(null)} />
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex items-center gap-2 order-2 sm:order-1 w-full sm:w-auto">
            <button className="h-10 w-10 shrink-0 rounded-[12px] border border-slate-200 hover:bg-slate-50" aria-label={`Previous ${VIEW_LABEL[view].toLowerCase()}`}
              onClick={() => step(-1)}>‹</button>
            <h2 className="flex-1 sm:flex-none text-center sm:text-left text-[16px] sm:text-[19px] font-bold text-slate-900">{heading}</h2>
            <button className="h-10 w-10 shrink-0 rounded-[12px] border border-slate-200 hover:bg-slate-50" aria-label={`Next ${VIEW_LABEL[view].toLowerCase()}`}
              onClick={() => step(1)}>›</button>
          </div>

          <div className="order-1 sm:order-2 w-full sm:w-auto grid grid-cols-4 sm:flex gap-1 p-1 rounded-[12px] bg-slate-100">
            {(["day", "week", "month", "route"] as ScheduleView[]).map(v => (
              <button key={v} type="button" onClick={() => pickView(v)}
                aria-pressed={view === v}
                className={`px-3 py-2 rounded-[9px] text-[13.5px] font-semibold transition ${
                  view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorNote message={error} />}
        {loading && <p className="text-center text-slate-400 py-8 text-[14.5px]">Loading…</p>}

        {!loading && !error && view === "month" && (
          <>
            <div className="grid grid-cols-7 gap-px mb-px">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="text-[10px] sm:text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-400 text-center py-1.5 sm:py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-[14px] overflow-hidden">
              {cells.map(({ date, inMonth }, i) => {
                const key = dayKey(date);
                const jobs = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <button key={i} type="button" onClick={() => openDay(date)}
                    aria-label={`${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${jobs.length} booked`}
                    className={`text-left bg-white min-h-[64px] sm:min-h-[104px] p-1 sm:p-2 hover:bg-slate-50 transition ${inMonth ? "" : "opacity-40"}`}>
                    <div className={`text-[12px] sm:text-[13px] font-semibold mb-1 sm:mb-1.5 text-center sm:text-left ${isToday ? "inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-900 text-white" : "text-slate-500"}`}>
                      {date.getDate()}
                    </div>
                    {/* Phones: dots, because a ~50px cell turns any label into an
                        ellipsis. Tapping the day opens it in full. */}
                    {jobs.length > 0 && (
                      <div className="flex sm:hidden flex-wrap gap-1 justify-center mt-1">
                        {jobs.slice(0, 4).map(j => <span key={j.id} className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />)}
                        {jobs.length > 4 && <span className="text-[10px] text-slate-400 leading-none">+{jobs.length - 4}</span>}
                      </div>
                    )}

                    <div className="hidden sm:block space-y-1">
                      {jobs.slice(0, 3).map(j => (
                        <div key={j.id} className="text-[12px] leading-tight px-1.5 py-1 rounded-[8px] bg-sky-50 border border-sky-100 text-sky-900 truncate"
                          title={`${timeOf(j.scheduledStart)} ${j.title}${j.assignedTo ? ` — ${j.assignedTo.name}` : ""}`}>
                          <span className="font-semibold">{timeOf(j.scheduledStart)}</span> {j.title}
                        </div>
                      ))}
                      {jobs.length > 3 && <div className="text-[11.5px] text-slate-400 px-1.5">+{jobs.length - 3} more</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!loading && !error && view === "week" && (
          <WeekView days={days} byDay={byDay} todayKey={todayKey} onOpenDay={openDay} />
        )}

        {!loading && !error && view === "day" && (
          <DayView jobs={anchorJobs} isToday={dayKey(anchor) === todayKey} />
        )}

        {!loading && !error && view === "route" && (
          <RouteView jobs={anchorJobs} date={anchor} />
        )}
      </Card>

      {/* The ordered list under the grid earns its place on the wide views,
          where a cell only shows a truncated chip. Day and Route already ARE
          ordered lists, so repeating one under them is just noise. */}
      {(view === "month" || view === "week") && all.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-[16px] font-bold text-slate-900">This {view}, in order</h2>
          </div>
          {all.map(j => (
            <button key={j.id} type="button" onClick={() => openDay(new Date(j.scheduledStart))}
              className="w-full text-left px-5 py-3.5 border-b border-slate-100 last:border-0 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{j.title}</p>
                <p className="text-[13.5px] text-slate-500">
                  {dayMonth(j.scheduledStart)} {timeOf(j.scheduledStart)}
                  {j.address ? ` · ${j.address}` : ""}
                </p>
              </div>
              {j.assignedTo
                ? <Pill tone="info">{j.assignedTo.name}</Pill>
                : <Pill tone="warn">Unassigned</Pill>}
            </button>
          ))}
        </Card>
      )}

      {!loading && !error && all.length === 0 && view !== "day" && view !== "route" && (
        <div className="mt-5">
          <Empty title={`Nothing booked this ${view}`}
            body="Book a job from here, or give an existing one a start date on its own page and it appears with whoever it is assigned to."
            action={<Btn onClick={() => setShowNewJob(true)}>+ New job</Btn>} />
        </div>
      )}
    </Page>  );
}

/**
 * The subscription link, once it exists.
 *
 * The old version printed the URL and said "you can revoke it any time",
 * which was not true of anything on the screen — there was no revoke. The
 * endpoint had been there the whole time with nothing calling it. A live link
 * to your working diary that you cannot turn off is worse than no link.
 *
 * Copy is a button rather than a selection job because this URL is 80
 * characters of hex and it is being read on a phone.
 */
function CalendarFeedCard({ url, onRevoked }: { url: string; onRevoked: () => void }) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers.
      // The URL is on screen either way, so say so rather than fail silently.
      alert("Could not copy automatically — select the link and copy it by hand.");
    }
  }

  async function revoke() {
    if (!confirm("Turn this link off? Any calendar subscribed to it stops updating, and anyone holding the link loses access. You can make a new one whenever you like.")) return;
    setRevoking(true);
    try { await api.del("/schedule/feed"); onRevoked(); }
    catch (e: any) { alert(e.message); setRevoking(false); }
  }

  return (
    <Card className="p-5 mb-5">
      <p className="text-[14.5px] text-slate-700 mb-1">
        Paste this into Google Calendar, Outlook or your phone. It keeps itself up to date.
      </p>
      <p className="text-[13px] text-slate-500 mb-3">
        Treat it like a password: anyone with the link can see what it shows, without logging in.
      </p>
      <code className="block bg-slate-50 border border-slate-200 rounded-[12px] px-3.5 py-2.5 text-[13px] break-all">{url}</code>
      <div className="flex flex-wrap gap-2 mt-3">
        <Btn onClick={copy}>{copied ? "Copied" : "Copy link"}</Btn>
        <Btn tone="ghost" onClick={revoke} disabled={revoking}>
          {revoking ? "Turning off…" : "Turn this link off"}
        </Btn>
      </div>
    </Card>
  );
}

/**
 * Seven columns on a desktop, seven stacked days on a phone. Not a
 * time-proportional week grid: a trade's day is four jobs, not forty, and
 * drawing them to scale spends the screen on empty afternoons.
 */
function WeekView({ days, byDay, todayKey, onOpenDay }: {
  days: Date[];
  byDay: Map<string, any[]>;
  todayKey: string;
  onOpenDay: (d: Date) => void;
}) {
  return (
    <>
      <div className="hidden md:grid grid-cols-7 gap-px bg-slate-200 rounded-[14px] overflow-hidden">
        {days.map(d => {
          const key = dayKey(d);
          const jobs = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={key} className={`min-h-[220px] p-2 ${isWeekend ? "bg-slate-50" : "bg-white"}`}>
              <button type="button" onClick={() => onOpenDay(d)}
                className="w-full flex items-baseline justify-between gap-1 mb-2 px-1 py-1 rounded-[8px] hover:bg-slate-100 transition">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                  {d.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span className={`text-[13px] font-bold ${isToday ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white" : "text-slate-600"}`}>
                  {d.getDate()}
                </span>
              </button>
              <div className="space-y-1.5">
                {jobs.map(j => (
                  <div key={j.id} className="px-2 py-1.5 rounded-[10px] bg-sky-50 border border-sky-100"
                    title={j.address || undefined}>
                    <p className="text-[11.5px] font-bold text-sky-700 tabular-nums">{timeOf(j.scheduledStart)}</p>
                    <p className="text-[12.5px] leading-snug text-slate-800">{j.title}</p>
                    {j.assignedTo && <p className="text-[11px] text-slate-500 truncate mt-0.5">{j.assignedTo.name}</p>}
                  </div>
                ))}
                {jobs.length === 0 && <p className="px-1 text-[12px] text-slate-300">—</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="md:hidden divide-y divide-slate-100">
        {days.map(d => {
          const key = dayKey(d);
          const jobs = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} className="py-3">
              <button type="button" onClick={() => onOpenDay(d)} className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold ${isToday ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {d.getDate()}
                </span>
                <span className="text-[14px] font-semibold text-slate-800">
                  {d.toLocaleDateString("en-GB", { weekday: "long" })}
                </span>
                <span className="text-[12.5px] text-slate-400">
                  {jobs.length === 0 ? "nothing booked" : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
                </span>
              </button>
              {jobs.map(j => (
                <div key={j.id} className="ml-9 mb-1.5 px-3 py-2 rounded-[10px] bg-sky-50 border border-sky-100">
                  <p className="text-[12px] font-bold text-sky-700 tabular-nums">{timeOf(j.scheduledStart)}</p>
                  <p className="text-[14px] font-semibold text-slate-800 leading-snug">{j.title}</p>
                  {j.address && <p className="text-[12.5px] text-slate-500 mt-0.5">{j.address}</p>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * One day, on a rail. Only the jobs are drawn, not an empty 06:00–20:00
 * ladder: fourteen rows of nothing is a lot to scroll past on a phone to find
 * the three that matter.
 */
function DayView({ jobs, isToday }: { jobs: any[]; isToday: boolean }) {
  if (jobs.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] font-semibold text-slate-700">
          {isToday ? "Nothing booked today." : "Nothing booked."}
        </p>
        <p className="text-[13.5px] text-slate-400 mt-1">A free day, or a day to go and find work.</p>
      </div>
    );
  }
  return (
    <ol className="relative border-l-2 border-slate-100 ml-[52px] sm:ml-[62px] space-y-3">
      {jobs.map(j => (
        <li key={j.id} className="relative pl-4 sm:pl-5">
          <span className="absolute -left-[57px] sm:-left-[67px] top-2.5 w-[46px] sm:w-[56px] text-right text-[12.5px] sm:text-[13px] font-bold tabular-nums text-slate-500">
            {timeOf(j.scheduledStart)}
          </span>
          <span className="absolute -left-[7px] top-3 w-3 h-3 rounded-full bg-sky-500 ring-2 ring-white" />
          <div className="rounded-[14px] border border-slate-200 bg-white p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[15.5px] font-bold text-slate-900 leading-snug">{j.title}</p>
              {j.assignedTo
                ? <Pill tone="info">{j.assignedTo.name}</Pill>
                : <Pill tone="warn">Unassigned</Pill>}
            </div>
            {j.scheduledEnd && (
              <p className="text-[13px] text-slate-500 mt-1 tabular-nums">Until {timeOf(j.scheduledEnd)}</p>
            )}
            {fullAddress(j) && (
              <a href={mapsSearchHref(j)} target="_blank" rel="noreferrer"
                className="inline-block mt-2 text-[13.5px] font-semibold text-sky-700 hover:underline">
                {fullAddress(j)} ↗
              </a>
            )}
            {j.customer && (
              <p className="text-[13.5px] text-slate-500 mt-1">
                {[j.customer.firstName, j.customer.lastName].filter(Boolean).join(" ")}
                {j.customer.phone
                  ? <> · <a className="font-semibold text-sky-700 hover:underline" href={`tel:${j.customer.phone}`}>{j.customer.phone}</a></>
                  : null}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One stop's address, the way a person would write it on an envelope. */
function fullAddress(j: any) {
  return [j.address, j.city, j.postcode].filter(Boolean).join(", ");
}

function mapsSearchHref(j: any) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(j))}`;
}

/**
 * The day by address, in the order it happens, with the driving handed to the
 * phone.
 *
 * Deliberately NOT an embedded map. An embed needs a paid key, a tile budget
 * and a pin-drawing pass that is stale the moment a job moves — and it would
 * still end with the driver pressing "open in Maps", because that is where
 * their traffic, their voice and their car screen live. So we build the
 * multi-stop route and hand it over: one tap, the whole day, in order.
 */
function RouteView({ jobs, date }: { jobs: any[]; date: Date }) {
  // Google's directions URL takes a destination plus the rest as waypoints
  // joined by a pipe. Origin is left off on purpose so it starts where the van
  // actually is, rather than where we guessed it would be.
  const routeHref = useMemo(() => {
    const points = jobs.map(fullAddress).filter(Boolean);
    if (points.length === 0) return null;
    const params = new URLSearchParams({
      api: "1", destination: points[points.length - 1], travelmode: "driving",
    });
    const waypoints = points.slice(0, -1);
    if (waypoints.length) params.set("waypoints", waypoints.join("|"));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] font-semibold text-slate-700">No stops on this day.</p>
        <p className="text-[13.5px] text-slate-400 mt-1">Book something and the run appears here in order.</p>
      </div>
    );
  }

  const withAddress = jobs.filter(j => fullAddress(j)).length;
  const missing = jobs.length - withAddress;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[14px] text-slate-500">
          {withAddress} stop{withAddress === 1 ? "" : "s"} on {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {missing > 0 && <span className="text-amber-700"> · {missing} without an address</span>}
        </p>
        {routeHref && (
          <a href={routeHref} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-slate-800 transition">
            Drive the whole day ↗
          </a>
        )}
      </div>

      <ol className="space-y-2.5">
        {jobs.map((j, i) => {
          const addr = fullAddress(j);
          return (
            <li key={j.id} className="flex gap-3 rounded-[14px] border border-slate-200 p-3.5">
              <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-[13px] font-bold tabular-nums text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold tabular-nums text-sky-700">{timeOf(j.scheduledStart)}</p>
                <p className="text-[15px] font-bold text-slate-900 leading-snug">{j.title}</p>
                {addr
                  ? <p className="text-[13.5px] text-slate-500 mt-0.5">{addr}</p>
                  : <p className="text-[13.5px] text-amber-700 mt-0.5">No address on this job yet.</p>}
              </div>
              {addr && (
                <a href={mapsSearchHref(j)} target="_blank" rel="noreferrer"
                  className="self-center shrink-0 rounded-[11px] border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition">
                  Navigate
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Certificates ─────────────────────────────────────────────────────────────

export function CertificatesPage() {
  const [, navigate] = useLocation();
  const { data, loading, error, reload } = useApi<any[]>("/certificates");
  const { data: types } = useApi<any[]>("/certificates/types");
  const [showNew, setShowNew] = useState(false);

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;

  const rows = data ?? [];
  const dueSoon = rows.filter(r => r.status === "issued" && (daysUntil(r.expiresAt) ?? 999) <= 60);

  return (
<Page>
      <PageHead
        title="Certificates"
        sub="Compliance records — issue them, send them, and get booked for next year automatically."
        action={(types ?? []).length > 0 ? <Btn onClick={() => setShowNew(true)}>+ New certificate</Btn> : undefined}
      />

      {showNew && (
        <NewCertificateForm
          types={types ?? []}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); reload(); }}
        />
      )}

      {dueSoon.length > 0 && (
        <Card className="p-5 mb-5 border-amber-200 bg-amber-50/50">
          <p className="text-[15px] font-semibold text-amber-900">
            {dueSoon.length} {dueSoon.length === 1 ? "certificate is" : "certificates are"} due within 60 days
          </p>
          <p className="text-[14px] text-amber-800 mt-1">
            Turn on the certificate renewal automation and each one becomes a lead before it runs out.
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <Empty
          title="No certificates yet"
          body="Issue a record from a job, or bring last year's certificates in so renewal reminders start now rather than in twelve months."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14.5px] min-w-[720px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-[0.05em] text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-5 py-3 font-semibold">Property</th>
                  <th className="px-5 py-3 font-semibold">Checked</th>
                  <th className="px-5 py-3 font-semibold">Expires</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const left = daysUntil(r.expiresAt);
                  const tone = r.status !== "issued" ? "muted" : left === null ? "muted" : left < 0 ? "bad" : left <= 42 ? "warn" : "good";
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-mono text-[13.5px] font-semibold text-slate-900">{r.reference}</td>
                      <td className="px-5 py-3.5 text-slate-700">{r.propertyAddress}</td>
                      <td className="px-5 py-3.5 text-slate-600">{shortDate(r.checkedAt)}</td>
                      <td className="px-5 py-3.5">
                        <Pill tone={tone}>
                          {shortDate(r.expiresAt)}
                          {r.status === "issued" && left !== null && (left < 0 ? " · expired" : ` · ${left}d`)}
                        </Pill>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge value={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(types ?? []).length > 0 && (
        <p className="mt-4 text-[13.5px] text-slate-500">
          Available types: {(types ?? []).map(t => t.label).join(" · ")}
        </p>
      )}
    </Page>  );
}

// ── Automations ──────────────────────────────────────────────────────────────

/**
 * The automations page.
 *
 * It listed three rules and could edit exactly one kind of setting: a list of
 * days. Everything else a rule might want to be told — what the message says,
 * how many hours before, how many months quiet — had nowhere to be typed, so
 * adding a rule with any other shape of setting meant the tenant was stuck
 * with whatever the defaults happened to be.
 *
 * Now the `setup` list each rule declares is rendered generically. A rule
 * describes its own questions; this page draws them. That is what makes adding
 * an automation an entry in a file rather than a job of work here too.
 */
export function AutomationsPage() {
  const { data, loading, error, reload } = useApi<any>("/automations");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;

  const rules: any[] = data?.rules ?? [];

  // Grouped in the order the server declares, which reads as a week — winning
  // it, doing it, getting paid for it — rather than alphabetically.
  const groups: string[] = [];
  for (const r of [...rules].sort((a, b) => (a.groupOrder ?? 99) - (b.groupOrder ?? 99))) {
    if (!groups.includes(r.group)) groups.push(r.group);
  }

  async function toggle(rule: any, enabled: boolean) {
    setBusy(rule.key); setNote(null);
    try {
      await api.patch(`/automations/${rule.key}`, { enabled, config: rule.config });
      reload();
      // Turning one on for the first time opens its settings, because the
      // defaults are a starting point and the wording is the bit a trade
      // actually wants to change before anything goes out in their name.
      if (enabled && (rule.setup ?? []).length) setEditing(rule.key);
    } catch (e: any) { setNote(e.message); }
    finally { setBusy(null); }
  }

  async function saveConfig(rule: any, config: Record<string, unknown>) {
    setBusy(rule.key); setNote(null);
    try {
      await api.patch(`/automations/${rule.key}`, { config });
      setEditing(null);
      reload();
      setNote(`${rule.label} — settings saved.`);
    } catch (e: any) { setNote(e.message); }
    finally { setBusy(null); }
  }

  return (
<Page>
      <PageHead
        title="Automations"
        sub="BizzFlow does these for you. Each one asks a few questions first, so you know exactly what goes out in your name before it is switched on."
        action={
          <Btn tone="ghost" onClick={async () => {
            setBusy("run");
            try { const r = await api.post<any>("/automations/run"); setNote(`Ran now — ${r.actions} ${r.actions === 1 ? "action" : "actions"} taken.`); reload(); }
            catch (e: any) { setNote(e.message); }
            finally { setBusy(null); }
          }} disabled={busy === "run"}>Run now</Btn>
        }
      />

      <Card className="p-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[15px] font-semibold text-slate-900">
          {data?.setUpCount ?? 0} of {data?.totalCount ?? 0} set up
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-[15px] text-slate-600">
          BizzFlow did <strong className="text-slate-900">{data?.actionsThisMonth ?? 0}</strong> {data?.actionsThisMonth === 1 ? "thing" : "things"} for you this month
        </span>
      </Card>

      {note && <div className="mb-5"><Card className="p-4"><p className="text-[14.5px] text-slate-700">{note}</p></Card></div>}

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group}>
            <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-2.5">{group}</h2>
            <Card className="overflow-hidden">
              {rules.filter(r => r.group === group).map((r, i, arr) => (
                <AutomationRow
                  key={r.key}
                  rule={r}
                  last={i === arr.length - 1}
                  busy={busy === r.key}
                  editing={editing === r.key}
                  onEdit={() => setEditing(editing === r.key ? null : r.key)}
                  onToggle={enabled => toggle(r, enabled)}
                  onSave={config => saveConfig(r, config)}
                />
              ))}
            </Card>
          </div>
        ))}
      </div>
    </Page>  );
}

/**
 * One automation.
 *
 * A live automation is doing work while nobody is looking, so it should be
 * obvious at a glance which ones are on: the whole row takes a wash of the
 * tenant's own colour and a bar down its left edge, rather than only the little
 * switch, which you have to hunt for across a list.
 */
function AutomationRow({ rule, last, busy, editing, onEdit, onToggle, onSave }: {
  rule: any;
  last: boolean;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, any>>(() => ({ ...(rule.config ?? rule.defaults ?? {}) }));
  const setup: any[] = rule.setup ?? [];
  // A rule we cannot switch on gets no switch. A control that looks live and
  // does nothing is how a trade loses a job believing the software has it.
  const available = rule.available !== false;

  return (
    <div
      className={`relative p-5 pl-6 transition-colors ${last ? "" : "border-b border-slate-100"}`}
      style={rule.enabled ? { background: "var(--ws-active)" } : undefined}
    >
      {rule.enabled && (
        <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: "var(--brand)" }} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold text-slate-900">{rule.label}</h3>
          <div className="mt-1.5">
            {!available
              ? <span className="ws-pill" data-tone="done">Needs setting up with us</span>
              : rule.enabled
                ? <span className="ws-pill" data-tone="active">On</span>
                : <span className="ws-pill" data-tone="done">Not set up</span>}
          </div>
          <p className="mt-1.5 text-[14.5px] text-slate-600 max-w-[62ch] leading-relaxed">{rule.description}</p>

          {/* What this rule needs before it can do anything. Said on the card,
              so a switch that would silently do nothing explains itself. */}
          {rule.needs && (
            <p className="mt-2 text-[13.5px] text-amber-800 max-w-[62ch] leading-relaxed">
              <strong>Needs:</strong> {rule.needs}
            </p>
          )}

          {rule.enabled && rule.actionsTaken > 0 && (
            <p className="mt-2.5 text-[13.5px] text-slate-500">
              {rule.actionsTaken} {rule.actionsTaken === 1 ? "action" : "actions"} so far
              {rule.lastRunAt ? ` · last ran ${shortDate(rule.lastRunAt)}` : ""}
            </p>
          )}

          {rule.enabled && setup.length > 0 && !editing && (
            <button onClick={onEdit} className="mt-2.5 text-[13.5px] font-semibold text-sky-700 hover:underline">
              Change what it says and when
            </button>
          )}
        </div>

        {available && (
          <button
            onClick={() => onToggle(!rule.enabled)}
            disabled={busy}
            aria-label={rule.enabled ? `Turn off ${rule.label}` : `Turn on ${rule.label}`}
            className="shrink-0 w-[52px] h-[30px] rounded-full transition-colors relative disabled:opacity-50"
            style={{ background: rule.enabled ? "var(--brand)" : "#e2e8f0" }}
          >
            <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all ${rule.enabled ? "left-[25px]" : "left-[3px]"}`} />
          </button>
        )}
      </div>

      {/* The rule's own questions, rendered from what it declares about itself.
          A textarea for wording, a number box for a delay, a text box for a
          list of days — the rule decides, this just draws it. */}
      {editing && setup.length > 0 && (
        <div className="mt-4 rounded-[14px] border border-slate-200 bg-white p-4 space-y-4">
          {setup.map(field => (
            <label key={field.key} className="block">
              <span className="block text-[13.5px] font-semibold text-slate-800 mb-1.5">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  rows={3}
                  className={`${inputCls} h-auto py-2.5`}
                  value={String(draft[field.key] ?? "")}
                  onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}
                />
              ) : field.type === "boolean" ? (
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 accent-sky-600"
                    checked={draft[field.key] !== false}
                    onChange={e => setDraft({ ...draft, [field.key]: e.target.checked })}
                  />
                  <span className="text-[14px] text-slate-600">{field.hint}</span>
                </span>
              ) : field.type === "number" ? (
                <input
                  type="number"
                  className={`${inputCls} w-[140px]`}
                  value={String(draft[field.key] ?? "")}
                  onChange={e => setDraft({ ...draft, [field.key]: e.target.value === "" ? "" : Number(e.target.value) })}
                />
              ) : (
                <input
                  className={inputCls}
                  value={Array.isArray(draft[field.key]) ? draft[field.key].join(", ") : String(draft[field.key] ?? "")}
                  onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}
                />
              )}
              {field.hint && field.type !== "boolean" && (
                <span className="mt-1 block text-[12.5px] text-slate-500">{field.hint}</span>
              )}
            </label>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <Btn onClick={() => onSave(draft)} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
            <Btn tone="ghost" onClick={onEdit} disabled={busy}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cash flow ────────────────────────────────────────────────────────────────

export function CashFlowPage() {
  const { data, loading, error } = useApi<any>("/money/cash-flow");
  const { data: vat } = useApi<any>("/money/vat-position");

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;
  if (!data) return null;

  const series: any[] = data.series ?? [];
  // Scale bars to the biggest single figure so a quiet week is not invisible.
  const peak = Math.max(1, ...series.map(s => Math.max(Number(s.in), Number(s.out))));
  const safe = Number(data.safeToSpend);

  return (
<Page>
      <PageHead
        title="Cash flow"
        sub={`Next ${data.weeks} weeks. ${data.basis}`}
      />

      <Card className="p-6 mb-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">
          Safe to spend, next {data.weeks} weeks
        </p>
        <p className={`mt-1 text-[44px] font-bold tabular-nums leading-none ${safe < 0 ? "text-red-600" : "text-slate-900"}`}>
          {money(data.safeToSpend)}
        </p>
        <p className="mt-2 text-[14.5px] text-slate-500">Money you can count on after bills.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6 pt-5 border-t border-slate-200">
          <div>
            <p className="text-[13px] text-slate-500">Counted on</p>
            <p className="text-[19px] font-bold tabular-nums text-slate-900">{money(data.countedOn)}</p>
            <p className="text-[12.5px] text-slate-400">invoices due</p>
          </div>
          <div>
            <p className="text-[13px] text-slate-500">Going out</p>
            <p className="text-[19px] font-bold tabular-nums text-slate-900">{money(data.goingOut)}</p>
            <p className="text-[12.5px] text-slate-400">based on recent spending</p>
          </div>
          <div>
            <p className="text-[13px] text-slate-500">Not counted</p>
            <p className="text-[19px] font-bold tabular-nums text-slate-500">{money(data.notCounted)}</p>
            <p className="text-[12.5px] text-slate-400">{data.notCountedLabel}</p>
          </div>
          <div>
            <p className="text-[13px] text-slate-500">Overdue</p>
            <p className={`text-[19px] font-bold tabular-nums ${Number(data.overdue) > 0 ? "text-red-600" : "text-slate-900"}`}>
              {money(data.overdue)}
            </p>
            <p className="text-[12.5px] text-slate-400">{Number(data.overdue) > 0 ? "chase these" : "nothing overdue"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-5">
        <h2 className="text-[16px] font-bold text-slate-900 mb-1">Week by week</h2>
        <p className="text-[13.5px] text-slate-500 mb-5">Money in against money out.</p>

        <div className="overflow-x-auto">
          <div className="flex items-end gap-2 min-w-[620px] h-[180px]">
            {series.map(s => (
              <div key={s.week} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${s.weekStart}: in ${money(s.in)}, out ${money(s.out)}`}>
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div className="w-1/2 bg-sky-500 rounded-t-[4px] min-h-[2px]" style={{ height: `${(Number(s.in) / peak) * 100}%` }} />
                  <div className="w-1/2 bg-amber-500 rounded-t-[4px] min-h-[2px]" style={{ height: `${(Number(s.out) / peak) * 100}%` }} />
                </div>
                <span className="text-[10.5px] text-slate-400 whitespace-nowrap">{dayMonth(s.weekStart)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-5 mt-4 text-[13px] text-slate-600">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-sky-500 inline-block" />Money in</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-amber-500 inline-block" />Money out</span>
        </div>
      </Card>

      {vat && (
        <Card className="p-6">
          <h2 className="text-[16px] font-bold text-slate-900 mb-1">VAT position</h2>
          <p className="text-[13.5px] text-slate-500 mb-4">{vat.basis}</p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
            <span className="text-[26px] font-bold tabular-nums text-slate-900">{money(vat.rollingTurnover)}</span>
            <span className="text-[14.5px] text-slate-500">of {money(vat.threshold)} threshold</span>
          </div>

          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${vat.percentOfThreshold >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.max(1, vat.percentOfThreshold)}%` }} />
          </div>

          <p className="mt-3 text-[14.5px] text-slate-600">{vat.note}</p>
        </Card>
      )}
    </Page>  );
}
