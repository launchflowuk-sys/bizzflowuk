import { useState } from "react";
import { api, useApi } from "./tradeApi";

/**
 * Raising a certificate by hand.
 *
 * `POST /certificates` has existed the whole time. The page had no way to call
 * it: the empty state read "issue a record from a job, or bring last year's
 * certificates in" and offered neither. So the only route to a certificate was
 * through a job that already existed, and a gas engineer standing in a
 * landlord's kitchen with a CP12 to raise had nowhere to put it.
 *
 * Deliberately short. The reference, the expiry date and the status are all
 * derived by the server from the type and the date it was checked — asking for
 * them here would mean asking the engineer to work out what we already know,
 * and to get it wrong. The appliance detail belongs to the issue step, which
 * already exists; this creates the draft that step works on.
 */

export type CertificateType = {
  key: string;
  label: string;
  shortLabel?: string;
  validMonths: number;
};

export default function NewCertificateForm({ types, onClose, onCreated }: {
  types: CertificateType[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: customers } = useApi<any[]>("/customers");
  const { data: jobs } = useApi<any[]>("/projects");

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    type: types[0]?.key ?? "",
    propertyAddress: "",
    propertyPostcode: "",
    customerId: "",
    projectId: "",
    landlordName: "",
    tenantContactName: "",
    tenantContactEmail: "",
    engineerName: "",
    engineerRegNo: "",
    checkedAt: today,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const chosen = types.find(t => t.key === form.type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyAddress.trim()) { setErr("A certificate needs the property address."); return; }
    setSaving(true);
    setErr(null);
    try {
      await api.post("/certificates", {
        type: form.type,
        propertyAddress: form.propertyAddress.trim(),
        // The optional strings on the server are `z.string().optional()`, which
        // accepts undefined and REJECTS null — so an empty box must be left out
        // of the body entirely rather than sent as null. customerId and
        // projectId are `.optional().nullable()`, so null is fine for those.
        propertyPostcode: form.propertyPostcode.trim().toUpperCase() || undefined,
        customerId: form.customerId ? Number(form.customerId) : null,
        projectId: form.projectId ? Number(form.projectId) : null,
        landlordName: form.landlordName.trim() || undefined,
        tenantContactName: form.tenantContactName.trim() || undefined,
        tenantContactEmail: form.tenantContactEmail.trim() || undefined,
        engineerName: form.engineerName.trim() || undefined,
        engineerRegNo: form.engineerRegNo.trim() || undefined,
        // DATE ONLY, not a timestamp. The server does
        // `new Date(`${checkedAt}T00:00:00Z`)` to work out the expiry, so a
        // full ISO string concatenates into "...T00:00:00.000ZT00:00:00Z" and
        // throws RangeError: Invalid time value. <input type="date"> already
        // gives exactly the shape wanted.
        checkedAt: form.checkedAt,
        data: {},
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Could not create the certificate.");
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border px-3 py-2.5 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition";
  const box = { borderColor: "var(--ws-line)", background: "#fff" } as React.CSSProperties;

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="block text-[13px] font-semibold mb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px]" style={{ color: "var(--ws-muted)" }}>{hint}</span>}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/45 p-0 sm:p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl min-h-full sm:min-h-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-5 sm:px-7 py-4 sm:rounded-t-2xl" style={{ borderColor: "var(--ws-line)" }}>
          <div>
            <h2 className="text-lg font-bold">New certificate</h2>
            <p className="text-[13px]" style={{ color: "var(--ws-muted)" }}>
              Saved as a draft. Add the appliance detail when you issue it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 rounded-lg hover:bg-slate-100">✕</button>
        </div>

        <form onSubmit={submit} className="px-5 sm:px-7 py-6 space-y-5">
          {err && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</p>}

          <Row
            label="Type"
            hint={chosen ? `Valid for ${chosen.validMonths} months. The expiry date and the reference are worked out for you.` : undefined}
          >
            <select value={form.type} onChange={e => set("type", e.target.value)} className={input} style={box}>
              {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Row>

          <Row label="Property address">
            <input value={form.propertyAddress} onChange={e => set("propertyAddress", e.target.value)}
              placeholder="42 Maple Avenue, Grays" className={input} style={box} />
          </Row>

          <div className="grid sm:grid-cols-2 gap-4">
            <Row label="Postcode">
              <input value={form.propertyPostcode} onChange={e => set("propertyPostcode", e.target.value)}
                autoCapitalize="characters" spellCheck={false} placeholder="RM17 5DB" className={input} style={box} />
            </Row>
            <Row label="Date checked">
              <input type="date" value={form.checkedAt} onChange={e => set("checkedAt", e.target.value)} className={input} style={box} />
            </Row>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Row label="Customer">
              <select value={form.customerId} onChange={e => set("customerId", e.target.value)} className={input} style={box}>
                <option value="">Not set</option>
                {(customers ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || `Customer ${c.id}`}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Job">
              <select value={form.projectId} onChange={e => set("projectId", e.target.value)} className={input} style={box}>
                <option value="">Not set</option>
                {(jobs ?? []).map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </Row>
          </div>

          <Row label="Landlord" hint="Who the record is issued to, when that is not the person living there.">
            <input value={form.landlordName} onChange={e => set("landlordName", e.target.value)} className={input} style={box} />
          </Row>

          <div className="grid sm:grid-cols-2 gap-4">
            <Row label="Occupier name">
              <input value={form.tenantContactName} onChange={e => set("tenantContactName", e.target.value)} className={input} style={box} />
            </Row>
            <Row label="Occupier email">
              <input type="email" value={form.tenantContactEmail} onChange={e => set("tenantContactEmail", e.target.value)} className={input} style={box} />
            </Row>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Row label="Engineer" hint="Left blank, this is you.">
              <input value={form.engineerName} onChange={e => set("engineerName", e.target.value)} className={input} style={box} />
            </Row>
            <Row label="Registration number">
              <input value={form.engineerRegNo} onChange={e => set("engineerRegNo", e.target.value)} className={input} style={box} />
            </Row>
          </div>

          <div className="sticky bottom-0 -mx-5 sm:-mx-7 flex gap-3 border-t bg-white px-5 sm:px-7 py-4 sm:rounded-b-2xl" style={{ borderColor: "var(--ws-line)" }}>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-[var(--brand)] py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {saving ? "Creating…" : "Create certificate"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-slate-50" style={{ borderColor: "var(--ws-line)" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
