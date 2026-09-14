import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  api, useApi, money, shortDate, dayMonth, timeOf, daysUntil,
  INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE,
} from "./tradeApi";

/**
 * The trade modules: Invoices, Expenses, Schedule, Certificates, Automations.
 *
 * Kept in their own file rather than added to DashboardApp, which is already
 * 3,600 lines. Nothing here changes an existing screen — these mount as new
 * routes, so the three live tenants see exactly what they saw before.
 */

// ── Shared bits ──────────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-red-50 text-red-700 border-red-200",
  muted: "bg-slate-100 text-slate-600 border-slate-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
};

function Pill({ tone = "muted", children }: { tone?: keyof typeof TONE | string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[12px] font-semibold ${TONE[tone] ?? TONE.muted}`}>
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

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];

  return (
    <>
      <PageHead
        title="Invoices"
        sub="Raise it, send it, and see what is actually outstanding."
        action={<Btn onClick={createDraft} disabled={creating}>New invoice</Btn>}
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">Outstanding</p>
          <p className="mt-1.5 text-[30px] font-bold tabular-nums text-slate-900">{money(totals.outstanding)}</p>
        </Card>
        <Card className={`p-5 ${totals.overdue > 0 ? "border-red-200 bg-red-50/40" : ""}`}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">Overdue</p>
          <p className={`mt-1.5 text-[30px] font-bold tabular-nums ${totals.overdue > 0 ? "text-red-600" : "text-slate-900"}`}>{money(totals.overdue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">Paid this month</p>
          <p className="mt-1.5 text-[30px] font-bold tabular-nums text-emerald-700">{money(totals.paidThisMonth)}</p>
        </Card>
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
    </>
  );
}

export function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data, loading, error, reload } = useApi<any>(`/invoices/${params.id}`);
  const { data: customers } = useApi<any[]>("/customers");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const locked = data.status === "void";
  const items: any[] = data.items ?? [];

  async function run(fn: () => Promise<any>, ok: string) {
    setBusy(true); setNote(null);
    try { await fn(); reload(); setNote(ok); }
    catch (e: any) { setNote(e.message); }
    finally { setBusy(false); }
  }

  function addLine() {
    const next = [...items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate })),
      { description: "New line", quantity: "1", unitPrice: "0" }];
    run(() => api.patch(`/invoices/${data.id}`, { items: next }), "Line added");
  }

  function updateLine(idx: number, patch: Record<string, unknown>) {
    const next = items.map((i, n) => n === idx
      ? { description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, ...patch }
      : { description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate });
    run(() => api.patch(`/invoices/${data.id}`, { items: next }), "Saved");
  }

  function removeLine(idx: number) {
    const next = items.filter((_, n) => n !== idx)
      .map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate }));
    run(() => api.patch(`/invoices/${data.id}`, { items: next }), "Line removed");
  }

  return (
    <>
      <PageHead
        title={data.reference}
        sub={`${INVOICE_STATUS_LABEL[data.status] ?? data.status} · ${money(data.total)} · ${money(data.outstanding)} outstanding`}
        action={
          <div className="flex flex-wrap gap-2">
            <Btn tone="ghost" onClick={() => navigate("/dashboard/invoices")}>Back</Btn>
            {data.status === "draft" && (
              <Btn onClick={() => run(() => api.post(`/invoices/${data.id}/send`), "Invoice sent")} disabled={busy}>Send</Btn>
            )}
            {!locked && data.status !== "draft" && (
              <Btn tone="danger" onClick={() => run(() => api.post(`/invoices/${data.id}/void`, { reason: "Voided from the dashboard" }), "Invoice voided")} disabled={busy}>Void</Btn>
            )}
          </div>
        }
      />

      {note && <div className="mb-5"><Card className="p-4"><p className="text-[14.5px] text-slate-700">{note}</p></Card></div>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-slate-900">Lines</h2>
              {!locked && <Btn tone="ghost" onClick={addLine} disabled={busy}>Add line</Btn>}
            </div>

            {items.length === 0 ? (
              <p className="text-[14.5px] text-slate-500 py-6 text-center">No lines yet. An invoice needs at least one before it can be sent.</p>
            ) : (
              <div className="space-y-2">
                {items.map((i, idx) => (
                  <div key={i.id ?? idx} className="grid grid-cols-12 gap-2 items-center">
                    <input className={`${inputCls} col-span-5`} defaultValue={i.description}
                      onBlur={e => e.target.value !== i.description && updateLine(idx, { description: e.target.value })} disabled={locked} />
                    <input className={`${inputCls} col-span-2 text-right`} defaultValue={i.quantity} type="number" step="0.01"
                      onBlur={e => e.target.value !== String(i.quantity) && updateLine(idx, { quantity: e.target.value })} disabled={locked} />
                    <input className={`${inputCls} col-span-2 text-right`} defaultValue={i.unitPrice} type="number" step="0.01"
                      onBlur={e => e.target.value !== String(i.unitPrice) && updateLine(idx, { unitPrice: e.target.value })} disabled={locked} />
                    <div className="col-span-2 text-right tabular-nums font-semibold text-slate-900">{money(i.total)}</div>
                    {!locked && (
                      <button onClick={() => removeLine(idx)} className="col-span-1 text-slate-400 hover:text-red-600 text-[18px]" aria-label="Remove line">×</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200 space-y-1.5 text-[14.5px]">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{money(data.subtotal)}</span></div>
              {Number(data.vatAmount) > 0 && <div className="flex justify-between"><span className="text-slate-500">VAT</span><span className="tabular-nums">{money(data.vatAmount)}</span></div>}
              {Number(data.cisDeduction) > 0 && <div className="flex justify-between"><span className="text-slate-500">CIS deduction</span><span className="tabular-nums">−{money(data.cisDeduction)}</span></div>}
              <div className="flex justify-between pt-1.5 font-bold text-slate-900"><span>Total</span><span className="tabular-nums">{money(data.total)}</span></div>
              {Number(data.amountPaid) > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="tabular-nums">{money(data.amountPaid)}</span></div>
                  <div className="flex justify-between font-bold text-slate-900"><span>Still to pay</span><span className="tabular-nums">{money(data.outstanding)}</span></div>
                </>
              )}
            </div>
          </Card>

          {data.status !== "draft" && !locked && (
            <Card className="p-5">
              <h2 className="text-[16px] font-bold text-slate-900 mb-4">Record a payment</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <Field label="Amount">
                    <input className={inputCls} type="number" step="0.01" value={payAmount}
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
                  onBlur={e => run(() => api.patch(`/invoices/${data.id}`, { issuedOn: e.target.value }), "Saved")} />
              </Field>
              <Field label="Due">
                <input className={inputCls} type="date" defaultValue={data.dueOn ?? ""} disabled={locked}
                  onBlur={e => run(() => api.patch(`/invoices/${data.id}`, { dueOn: e.target.value }), "Saved")} />
              </Field>
              <Field label="Notes">
                <textarea className={`${inputCls} h-24 py-3`} defaultValue={data.notes ?? ""} disabled={locked}
                  onBlur={e => run(() => api.patch(`/invoices/${data.id}`, { notes: e.target.value }), "Saved")} />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Expenses ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["materials", "fuel", "tools", "subcontractor", "insurance", "vehicle", "other"];

export function ExpensesPage() {
  const { data, loading, error, reload } = useApi<any[]>("/expenses");
  const [form, setForm] = useState({ supplier: "", category: "materials", spentOn: new Date().toISOString().slice(0, 10), net: "", vatAmount: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const total = useMemo(() => (data ?? []).reduce((s, e) => s + Number(e.total ?? 0), 0), [data]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplier) { setNote("A supplier is needed."); return; }
    setBusy(true); setNote(null);
    try {
      await api.post("/expenses", { ...form, net: form.net || 0, vatAmount: form.vatAmount || 0 });
      setForm({ supplier: "", category: "materials", spentOn: new Date().toISOString().slice(0, 10), net: "", vatAmount: "" });
      reload();
    } catch (err: any) { setNote(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;

  return (
    <>
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
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{e.supplier}</td>
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
    </>
  );
}

// ── Schedule ─────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data, loading, error } = useApi<any[]>(`/schedule?from=${from}&to=${to}`, [from, to]);
  const { data: engineers } = useApi<any[]>("/schedule/engineers");
  const [feedUrl, setFeedUrl] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const job of data ?? []) {
      const key = new Date(job.scheduledStart).toISOString().slice(0, 10);
      const list = m.get(key) ?? []; list.push(job); m.set(key, list);
    }
    return m;
  }, [data]);

  // Monday-first grid, which is how a UK working week reads.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const out: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setDate(1 - offset + i);
      out.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
    }
    return out;
  }, [month]);

  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHead
        title="Schedule"
        sub="Every booked job, and who is on it."
        action={
          <div className="flex flex-wrap gap-2">
            <Btn tone="ghost" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Btn>
            <Btn tone="ghost" onClick={async () => {
              try { const f = await api.post<any>("/schedule/feed"); setFeedUrl(f.url); }
              catch (e: any) { alert(e.message); }
            }}>Add to my calendar</Btn>
          </div>
        }
      />

      {feedUrl && (
        <Card className="p-5 mb-5">
          <p className="text-[14.5px] text-slate-700 mb-2">
            Paste this into Google Calendar, Outlook or your phone. It stays up to date on its own, and you can revoke it any time.
          </p>
          <code className="block bg-slate-50 border border-slate-200 rounded-[12px] px-3.5 py-2.5 text-[13px] break-all">{feedUrl}</code>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <button className="h-10 w-10 rounded-[12px] border border-slate-200 hover:bg-slate-50" aria-label="Previous month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <h2 className="text-[19px] font-bold text-slate-900">
            {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <button className="h-10 w-10 rounded-[12px] border border-slate-200 hover:bg-slate-50" aria-label="Next month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>

        {error && <ErrorNote message={error} />}
        {loading && <p className="text-center text-slate-400 py-8 text-[14.5px]">Loading…</p>}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-7 gap-px mb-px">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-400 text-center py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-[14px] overflow-hidden">
              {cells.map(({ date, inMonth }, i) => {
                const key = date.toISOString().slice(0, 10);
                const jobs = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={i} className={`bg-white min-h-[104px] p-2 ${inMonth ? "" : "opacity-40"}`}>
                    <div className={`text-[13px] font-semibold mb-1.5 ${isToday ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white" : "text-slate-500"}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {jobs.slice(0, 3).map(j => (
                        <div key={j.id} className="text-[12px] leading-tight px-1.5 py-1 rounded-[8px] bg-sky-50 border border-sky-100 text-sky-900 truncate"
                          title={`${timeOf(j.scheduledStart)} ${j.title}${j.assignedTo ? ` — ${j.assignedTo.name}` : ""}`}>
                          <span className="font-semibold">{timeOf(j.scheduledStart)}</span> {j.title}
                        </div>
                      ))}
                      {jobs.length > 3 && <div className="text-[11.5px] text-slate-400 px-1.5">+{jobs.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {(data ?? []).length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-[16px] font-bold text-slate-900">This month, in order</h2>
          </div>
          {(data ?? []).map(j => (
            <div key={j.id} className="px-5 py-3.5 border-b border-slate-100 last:border-0 flex flex-wrap items-center justify-between gap-3">
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
            </div>
          ))}
        </Card>
      )}

      {!loading && (data ?? []).length === 0 && (
        <div className="mt-5">
          <Empty title="Nothing booked this month"
            body="Give a project a start date on its own page and it appears here, with whoever it is assigned to." />
        </div>
      )}
    </>
  );
}

// ── Certificates ─────────────────────────────────────────────────────────────

export function CertificatesPage() {
  const [, navigate] = useLocation();
  const { data, loading, error, reload } = useApi<any[]>("/certificates");
  const { data: types } = useApi<any[]>("/certificates/types");

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const dueSoon = rows.filter(r => r.status === "issued" && (daysUntil(r.expiresAt) ?? 999) <= 60);

  return (
    <>
      <PageHead
        title="Certificates"
        sub="Compliance records — issue them, send them, and get booked for next year automatically."
      />

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
                      <td className="px-5 py-3.5"><Pill tone={r.status === "issued" ? "good" : "muted"}>{r.status}</Pill></td>
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
    </>
  );
}

// ── Automations ──────────────────────────────────────────────────────────────

export function AutomationsPage() {
  const { data, loading, error, reload } = useApi<any>("/automations");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;

  const rules: any[] = data?.rules ?? [];
  const groups = [...new Set(rules.map(r => r.group))];

  async function toggle(rule: any, enabled: boolean) {
    setBusy(rule.key); setNote(null);
    try {
      await api.patch(`/automations/${rule.key}`, { enabled, config: rule.config });
      reload();
    } catch (e: any) { setNote(e.message); }
    finally { setBusy(null); }
  }

  async function saveConfig(rule: any, raw: string) {
    const days = raw.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
    if (!days.length) { setNote("Give at least one number of days, e.g. 3, 7, 14"); return; }
    setBusy(rule.key); setNote(null);
    try {
      await api.patch(`/automations/${rule.key}`, { config: { ...rule.config, days } });
      reload();
    } catch (e: any) { setNote(e.message); }
    finally { setBusy(null); }
  }

  return (
    <>
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
                <div key={r.key} className={`p-5 ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-[16px] font-bold text-slate-900">{r.label}</h3>
                        {r.enabled ? <Pill tone="good">On</Pill> : <Pill>Not set up</Pill>}
                      </div>
                      <p className="mt-1.5 text-[14.5px] text-slate-600 max-w-[62ch] leading-relaxed">{r.description}</p>

                      {r.enabled && Array.isArray(r.config?.days) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] text-slate-500">{r.setup?.[0]?.label ?? "Days"}:</span>
                          <input
                            className="h-9 px-3 rounded-[10px] border border-slate-200 text-[14px] w-[150px] focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                            defaultValue={r.config.days.join(", ")}
                            onBlur={e => e.target.value !== r.config.days.join(", ") && saveConfig(r, e.target.value)}
                            disabled={busy === r.key}
                          />
                        </div>
                      )}

                      {r.enabled && r.actionsTaken > 0 && (
                        <p className="mt-2.5 text-[13.5px] text-slate-500">
                          {r.actionsTaken} {r.actionsTaken === 1 ? "action" : "actions"} so far
                          {r.lastRunAt ? ` · last ran ${shortDate(r.lastRunAt)}` : ""}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggle(r, !r.enabled)}
                      disabled={busy === r.key}
                      aria-label={r.enabled ? `Turn off ${r.label}` : `Turn on ${r.label}`}
                      className={`shrink-0 w-[52px] h-[30px] rounded-full transition-colors relative ${r.enabled ? "bg-emerald-500" : "bg-slate-200"} disabled:opacity-50`}
                    >
                      <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all ${r.enabled ? "left-[25px]" : "left-[3px]"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
