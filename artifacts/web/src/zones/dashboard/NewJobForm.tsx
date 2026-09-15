import { useMemo, useState } from "react";
import { api, useApi, money } from "./tradeApi";
import DictatableTextarea from "./VoiceInput";

/**
 * Putting a job in the diary without a website, a lead, or a quote.
 *
 * The platform was built lead-first: an enquiry arrives from the site, becomes
 * a quote, and an accepted quote becomes a job. That is a real path and it
 * works — it is just not the path most trades are on.
 *
 * Brandon gets a phone call at seven in the morning. There is no lead and no
 * quote: there is a customer who may not exist yet and a job that needs to be
 * in the diary before he puts the kettle on. What he had was a form with three
 * fields — title, city, description — which is not a job, it is a note.
 *
 * So this form holds everything a job actually needs, and the two things that
 * used to force you out of it are handled in place:
 *
 *   - a customer who is not on file yet is added WITHOUT leaving the form
 *   - the work is priced here, rather than going and writing a quote first
 *
 * Each of those, done the other way, means abandoning a half-filled form and
 * coming back — which on a phone, in a van, means it does not get done.
 */

export type NewJobFormProps = {
  onClose: () => void;
  /** Called with the created job so the list can refresh and navigate. */
  onCreated: (job: any) => void;
};

type Line = { description: string; quantity: string; unitPrice: string };

const BLANK_LINE: Line = { description: "", quantity: "1", unitPrice: "" };

/** Now, rounded to the next half hour, as a value <input type="datetime-local"> accepts. */
function defaultStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  // Local time, not ISO: `toISOString` is UTC and would show a British user
  // the wrong hour for half the year.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function plusHours(value: string, hours: number): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewJobForm({ onClose, onCreated }: NewJobFormProps) {
  const { data: customers } = useApi<any[]>("/customers");
  const { data: services } = useApi<any[]>("/services");
  const { data: team } = useApi<any[]>("/team");

  const [form, setForm] = useState({
    title: "",
    customerId: "",
    serviceId: "",
    assignedUserId: "",
    scheduledStart: defaultStart(),
    scheduledEnd: plusHours(defaultStart(), 2),
    address: "",
    city: "",
    postcode: "",
    description: "",
    status: "Scheduled",
  });

  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adding a customer without leaving the form.
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines],
  );

  const customerList = customers ?? [];
  const serviceList = services ?? [];
  const teamList = team ?? [];

  function setLine(i: number, patch: Partial<Line>) {
    setLines(ls => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  }

  async function addCustomer() {
    const first = newCustomer.firstName.trim();
    if (!first) { setError("A customer needs at least a first name."); return; }
    setSavingCustomer(true);
    setError(null);
    try {
      const created = await api.post<any>("/customers", {
        firstName: first,
        lastName: newCustomer.lastName.trim() || null,
        phone: newCustomer.phone.trim() || null,
        email: newCustomer.email.trim() || null,
      });
      // Select them immediately — the whole point of adding here is not
      // having to go and find them afterwards.
      set("customerId", String(created.id));
      customerList.push(created);
      setAddingCustomer(false);
      setNewCustomer({ firstName: "", lastName: "", phone: "", email: "" });
    } catch (err: any) {
      setError(err?.message || "Could not add that customer.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Give the job a name."); return; }
    setSaving(true);
    setError(null);
    try {
      const job = await api.post<any>("/projects", {
        title: form.title.trim(),
        customerId: form.customerId ? Number(form.customerId) : null,
        serviceId: form.serviceId ? Number(form.serviceId) : null,
        assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : null,
        scheduledStart: form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null,
        scheduledEnd: form.scheduledEnd ? new Date(form.scheduledEnd).toISOString() : null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postcode: form.postcode.trim().toUpperCase() || null,
        description: form.description.trim() || null,
        status: form.status,
      });

      // Lines are saved after the job exists, because they hang off its id.
      // A line with no description is a row the user tabbed through and left,
      // not something they meant to price.
      const real = lines.filter(l => l.description.trim());
      for (const [i, l] of real.entries()) {
        await api.post(`/projects/${job.id}/items`, {
          description: l.description.trim(),
          quantity: l.quantity || "1",
          unitPrice: l.unitPrice || "0",
          sortOrder: i,
        });
      }

      onCreated(job);
    } catch (err: any) {
      setError(err?.message || "Could not create the job.");
      setSaving(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition";
  const label = "block text-[13px] font-semibold text-slate-700 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/45 p-0 sm:p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-3xl bg-white sm:rounded-2xl shadow-2xl min-h-full sm:min-h-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 sm:px-7 py-4 sm:rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New job</h2>
            <p className="text-[13px] text-slate-500">Everything you need to put it in the diary.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <form onSubmit={submit} className="px-5 sm:px-7 py-6 space-y-7">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {/* ---- what and who ---- */}
          <section className="space-y-4">
            <div>
              <label className={label} htmlFor="job-title">What is the job <span className="text-red-500">*</span></label>
              <input id="job-title" required value={form.title} onChange={e => set("title", e.target.value)}
                placeholder="e.g. Boiler service — 42 Maple Avenue" className={field} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="job-customer">Customer</label>
                <div className="flex gap-2">
                  <select id="job-customer" value={form.customerId} onChange={e => set("customerId", e.target.value)} className={field}>
                    <option value="">Not set</option>
                    {customerList.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || `Customer ${c.id}`}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setAddingCustomer(v => !v)}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {addingCustomer ? "Cancel" : "+ New"}
                  </button>
                </div>
              </div>

              <div>
                <label className={label} htmlFor="job-service">Service</label>
                <select id="job-service" value={form.serviceId} onChange={e => set("serviceId", e.target.value)} className={field}>
                  <option value="">Not set</option>
                  {serviceList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Added here rather than on another page: abandoning a half-filled
                form to go and create a customer is how a job stops getting
                logged at all. */}
            {addingCustomer && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-[13px] font-semibold text-slate-700">New customer</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={newCustomer.firstName} onChange={e => setNewCustomer(c => ({ ...c, firstName: e.target.value }))}
                    placeholder="First name *" className={field} />
                  <input value={newCustomer.lastName} onChange={e => setNewCustomer(c => ({ ...c, lastName: e.target.value }))}
                    placeholder="Last name" className={field} />
                  <input value={newCustomer.phone} onChange={e => setNewCustomer(c => ({ ...c, phone: e.target.value }))}
                    placeholder="Phone" inputMode="tel" className={field} />
                  <input value={newCustomer.email} onChange={e => setNewCustomer(c => ({ ...c, email: e.target.value }))}
                    placeholder="Email" inputMode="email" className={field} />
                </div>
                <button type="button" onClick={addCustomer} disabled={savingCustomer}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {savingCustomer ? "Adding…" : "Add and select"}
                </button>
              </div>
            )}
          </section>

          {/* ---- when ---- */}
          <section className="space-y-4">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">When</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="job-start">Start</label>
                <input id="job-start" type="datetime-local" value={form.scheduledStart} className={field}
                  onChange={e => {
                    set("scheduledStart", e.target.value);
                    // Keep the end after the start rather than making them fix it.
                    if (!form.scheduledEnd || new Date(form.scheduledEnd) <= new Date(e.target.value)) {
                      set("scheduledEnd", plusHours(e.target.value, 2));
                    }
                  }} />
              </div>
              <div>
                <label className={label} htmlFor="job-end">Finish</label>
                <input id="job-end" type="datetime-local" value={form.scheduledEnd}
                  onChange={e => set("scheduledEnd", e.target.value)} className={field} />
              </div>
            </div>
            {teamList.length > 0 && (
              <div>
                <label className={label} htmlFor="job-assignee">Who is doing it</label>
                <select id="job-assignee" value={form.assignedUserId} onChange={e => set("assignedUserId", e.target.value)} className={field}>
                  <option value="">Not assigned</option>
                  {teamList.map((m: any) => (
                    <option key={m.id} value={m.userId ?? m.id}>
                      {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || `Member ${m.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* ---- where ---- */}
          <section className="space-y-4">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">Where</h3>
            <div>
              <label className={label} htmlFor="job-address">Address</label>
              <input id="job-address" value={form.address} onChange={e => set("address", e.target.value)}
                placeholder="42 Maple Avenue" className={field} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="job-city">Town or city</label>
                <input id="job-city" value={form.city} onChange={e => set("city", e.target.value)} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="job-postcode">Postcode</label>
                <input id="job-postcode" value={form.postcode} onChange={e => set("postcode", e.target.value)}
                  autoCapitalize="characters" spellCheck={false} placeholder="RM17 5DB" className={field} />
              </div>
            </div>
          </section>

          {/* ---- what it is worth ---- */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">Estimated work</h3>
              <button type="button" onClick={() => setLines(ls => [...ls, { ...BLANK_LINE }])}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                + Add line
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_6rem_2rem] gap-2 items-center">
                  <input value={l.description} onChange={e => setLine(i, { description: e.target.value })}
                    placeholder="Description" className={field} />
                  <input value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })}
                    inputMode="decimal" placeholder="Qty" className={field} />
                  <input value={l.unitPrice} onChange={e => setLine(i, { unitPrice: e.target.value })}
                    inputMode="decimal" placeholder="£0.00" className={field} />
                  <button type="button" aria-label="Remove line"
                    onClick={() => setLines(ls => (ls.length === 1 ? [{ ...BLANK_LINE }] : ls.filter((_, n) => n !== i)))}
                    className="h-10 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-3">
              <p className="text-sm font-semibold text-slate-900">
                Estimate <span className="ml-3 text-lg">{money(subtotal)}</span>
              </p>
            </div>
          </section>

          {/* ---- anything else ---- */}
          <section>
            <label className={label} htmlFor="job-notes">Notes</label>
            {/* Dictatable: this is usually filled in on a phone, one-handed,
                stood in someone's hallway. */}
            <DictatableTextarea rows={3} value={form.description} onChange={v => set("description", v)}
              placeholder="Access, parts needed, anything worth knowing before you turn up." className={field} />
          </section>

          <div className="sticky bottom-0 -mx-5 sm:-mx-7 flex gap-3 border-t border-slate-200 bg-white px-5 sm:px-7 py-4 sm:rounded-b-2xl">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-[var(--brand)] py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {saving ? "Creating…" : "Create job"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
