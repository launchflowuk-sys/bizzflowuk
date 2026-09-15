import { useMemo, useState } from "react";
import { api, useApi, shortDate, daysUntil } from "./tradeApi";

/**
 * Properties — the landlord portfolio view.
 *
 * Certificates carry a free-text address, which is fine for a one-off and
 * useless for a landlord with eleven flats: the same building gets typed eleven
 * ways, so "what is due on 42 Maple Avenue" cannot be answered. A property has
 * an identity, and the portfolio falls out of it.
 *
 * This page also carries the importer, because the two belong together: the
 * first thing anyone does with a new portfolio is tell the system what is
 * already certified on it.
 */

type Property = {
  id: number; addressLine1: string; addressLine2: string | null; city: string | null;
  postcode: string | null; unit: string | null; propertyType: string | null;
  tenantName: string | null; tenantPhone: string | null; accessNotes: string | null;
  address: string; customerId: number | null; customerName: string | null;
  certificateCount: number; nextExpiry: string | null; overdueCount: number;
};

type Customer = { id: number; firstName: string | null; lastName: string | null };
type CertType = { key: string; label: string };

const BLANK = {
  addressLine1: "", unit: "", city: "", postcode: "",
  customerId: "", tenantName: "", tenantPhone: "", accessNotes: "",
};

export default function PropertiesPage() {
  const { data: properties, loading, error, reload } = useApi<Property[]>("/properties");
  const { data: customers } = useApi<Customer[]>("/customers");
  const { data: certTypes } = useApi<CertType[]>("/certificates/types");

  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (properties ?? []).filter(p =>
      !needle || `${p.address} ${p.customerName ?? ""} ${p.tenantName ?? ""}`.toLowerCase().includes(needle));
  }, [properties, query]);

  const dueSoon = (properties ?? []).filter(p => p.overdueCount > 0 ||
    (p.nextExpiry && (daysUntil(p.nextExpiry) ?? 999) <= 42)).length;

  async function addProperty(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.post("/properties", {
        ...form,
        customerId: form.customerId ? Number(form.customerId) : null,
      });
      setForm({ ...BLANK });
      setShowAdd(false);
      setMessage({ kind: "ok", text: "Property added." });
      reload();
    } catch (err: any) {
      setMessage({ kind: "bad", text: err?.message || "Could not add that property." });
    } finally { setSaving(false); }
  }

  return (
    <div className="px-5 sm:px-10 pb-16 max-w-[1320px]">
      <div className="ws-heading">
        <div>
          <p className="ws-eyebrow">Your business / Workspace</p>
          <h1>Every property, in one place.</h1>
          <p className="ws-sub">
            What is certified, what is due, and who to ring to get in.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" className="ws-panel-link" onClick={() => setShowImport(v => !v)}>
            Bring in existing certificates
          </button>
          <button type="button" className="ws-btn" onClick={() => setShowAdd(v => !v)}>
            Add a property <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="ws-panel mb-4" role="status"
          style={message.kind === "bad"
            ? { borderColor: "#e5b4ad", background: "#fbe9e7", color: "#8c2f22" }
            : { borderColor: "var(--ws-line)", background: "var(--ws-active)", color: "var(--brand-ink)" }}>
          {message.text}
        </div>
      )}

      {dueSoon > 0 && (
        <div className="ws-panel mb-4" style={{ borderColor: "#e5cf9b", background: "#faf0d8" }}>
          <p style={{ color: "#896723", fontWeight: 600 }}>
            {dueSoon} {dueSoon === 1 ? "property needs" : "properties need"} attention.
          </p>
          <p style={{ color: "#896723", marginTop: "4px", fontSize: "14px" }}>
            Something has expired or runs out within six weeks. Your automations will chase these if they are switched on.
          </p>
        </div>
      )}

      {showAdd && (
        <section className="ws-panel mb-4">
          <div className="ws-panel-top"><h2>New property</h2></div>
          <form onSubmit={addProperty} style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit,minmax(15rem,1fr))" }}>
            <Field label="Address line 1" required value={form.addressLine1} onChange={v => setForm({ ...form, addressLine1: v })} placeholder="42 Maple Avenue" />
            <Field label="Flat / unit" value={form.unit} onChange={v => setForm({ ...form, unit: v })} placeholder="Flat 3" />
            <Field label="Town" value={form.city} onChange={v => setForm({ ...form, city: v })} placeholder="Grays" />
            <Field label="Postcode" value={form.postcode} onChange={v => setForm({ ...form, postcode: v })} placeholder="RM17 5DB" />
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "7px" }}>Landlord / customer</span>
              <select className="ws-field" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Not linked yet</option>
                {(customers ?? []).map(c => (
                  <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</option>
                ))}
              </select>
            </label>
            <Field label="Occupier name" value={form.tenantName} onChange={v => setForm({ ...form, tenantName: v })} />
            <Field label="Occupier phone" value={form.tenantPhone} onChange={v => setForm({ ...form, tenantPhone: v })} />
            <Field label="Access notes" value={form.accessNotes} onChange={v => setForm({ ...form, accessNotes: v })} placeholder="Key safe by the side gate" />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px" }}>
              <button type="submit" className="ws-btn" disabled={saving}>{saving ? "Saving…" : "Save property"}</button>
              <button type="button" className="ws-panel-link" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {showImport && (
        <CertificateImporter
          certTypes={certTypes ?? []}
          properties={properties ?? []}
          onDone={(text) => { setMessage({ kind: "ok", text }); setShowImport(false); reload(); }}
          onError={(text) => setMessage({ kind: "bad", text })}
        />
      )}

      <section className="ws-panel">
        <div className="ws-panel-top" style={{ flexWrap: "wrap" }}>
          <h2>Your properties</h2>
          <input className="ws-field" style={{ maxWidth: "280px" }} type="search"
            placeholder="Search address or landlord…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {loading && <p style={{ color: "var(--ws-muted)" }}>Loading…</p>}
        {error && <p style={{ color: "#8c2f22" }}>{error}</p>}
        {!loading && !rows.length && (
          <p style={{ color: "var(--ws-muted)" }}>
            {properties?.length ? "Nothing matches that search."
              : "No properties yet. Add one, then bring in the certificates you already hold for it."}
          </p>
        )}

        {!!rows.length && (
          <div className="ws-table-scroll">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Landlord</th>
                  <th scope="col">Certificates</th>
                  <th scope="col">Next due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const days = p.nextExpiry ? daysUntil(p.nextExpiry) : null;
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.address}</strong>
                        {p.tenantName && <small>Occupier: {p.tenantName}{p.tenantPhone ? ` · ${p.tenantPhone}` : ""}</small>}
                      </td>
                      <td>{p.customerName ?? <span style={{ color: "var(--ws-muted)" }}>Not linked</span>}</td>
                      <td>
                        {p.certificateCount}
                        {p.overdueCount > 0 && (
                          <span className="ws-pill" data-tone="danger" style={{ marginLeft: "8px" }}>
                            {p.overdueCount} expired
                          </span>
                        )}
                      </td>
                      <td>
                        {p.nextExpiry ? (
                          <>
                            {shortDate(p.nextExpiry)}
                            {days !== null && days <= 42 && (
                              <span className="ws-pill" data-tone="pending" style={{ marginLeft: "8px" }}>
                                {days} days
                              </span>
                            )}
                          </>
                        ) : <span style={{ color: "var(--ws-muted)" }}>Nothing recorded</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "7px" }}>{label}</span>
      <input className="ws-field" value={value} required={required} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}

/**
 * Bring in last year's certificates.
 *
 * Without this the renewal engine is blind for twelve months: it only knows
 * about certificates issued here, so the first year of reminders — the whole
 * reason a plumber signs up — never fires.
 *
 * Paste rather than a file upload, deliberately. Everyone has this data
 * somewhere they can copy from, nobody wants to be told their CSV has the wrong
 * headers, and a textarea works on a phone in a van.
 */
function CertificateImporter({ certTypes, properties, onDone, onError }: {
  certTypes: CertType[];
  properties: Property[];
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [type, setType] = useState(certTypes[0]?.key ?? "gas_safety");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<Array<{ row: number; error?: string }>>([]);

  /** address | expiry | reference(optional) | check date(optional), comma or tab separated. */
  function parse(raw: string) {
    return raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/\t|,(?![^(]*\))/).map(p => p.trim());
      const [address, expiresAt, reference, checkedAt] = parts;
      // Match an existing property by its formatted address, so an import can
      // attach to the portfolio rather than creating orphan free-text records.
      const match = properties.find(p => p.address.toLowerCase() === (address ?? "").toLowerCase());
      return {
        type,
        propertyAddress: address,
        expiresAt,
        reference: reference || undefined,
        checkedAt: checkedAt || undefined,
        propertyId: match?.id,
      };
    });
  }

  const preview = parse(text);

  async function submit() {
    setBusy(true);
    setFailures([]);
    try {
      const res = await api.post<{ imported: number; failed: number; results: any[] }>(
        "/certificates/import", { rows: preview });
      setFailures(res.results.filter(r => !r.ok));
      if (res.imported) {
        setText("");
        onDone(`${res.imported} certificate${res.imported === 1 ? "" : "s"} brought in.${res.failed ? ` ${res.failed} row${res.failed === 1 ? "" : "s"} could not be read.` : ""}`);
      } else {
        onError("None of those rows could be imported.");
      }
    } catch (err: any) {
      onError(err?.message || "Could not import those certificates.");
    } finally { setBusy(false); }
  }

  return (
    <section className="ws-panel mb-4">
      <div className="ws-panel-top"><h2>Bring in existing certificates</h2></div>
      <p style={{ color: "var(--ws-muted)", fontSize: "14px", marginBottom: "16px", maxWidth: "70ch" }}>
        One per line: <strong>address, expiry date</strong>, and optionally the old reference and check date.
        Commas or tabs — paste straight from a spreadsheet. These are recorded as issued so renewals start
        chasing them, and marked as imported so it is clear they were not produced here.
      </p>

      <div style={{ display: "grid", gap: "14px", maxWidth: "46rem" }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "7px" }}>Certificate type</span>
          <select className="ws-field" value={type} onChange={e => setType(e.target.value)}>
            {certTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>

        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "7px" }}>Your certificates</span>
          <textarea className="ws-field" rows={7} value={text} onChange={e => setText(e.target.value)}
            placeholder={"42 Maple Avenue, Grays, RM17 5DB, 2027-03-04\nFlat 3, 12 High Street, RM16 2AB, 2027-01-19, CP12-8841"} />
        </label>

        {!!preview.length && (
          <p style={{ fontSize: "13.5px", color: "var(--ws-muted)" }}>
            {preview.length} row{preview.length === 1 ? "" : "s"} ready.
            {" "}{preview.filter(p => p.propertyId).length} matched to a property you already have.
          </p>
        )}

        {!!failures.length && (
          <div style={{ background: "#fbe9e7", color: "#8c2f22", borderRadius: "8px", padding: "12px 14px", fontSize: "13.5px" }}>
            <strong>Some rows could not be read:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
              {failures.slice(0, 6).map(f => <li key={f.row}>Line {f.row}: {f.error}</li>)}
            </ul>
          </div>
        )}

        <div>
          <button type="button" className="ws-btn" disabled={busy || !preview.length} onClick={submit}>
            {busy ? "Importing…" : `Import ${preview.length || ""} certificate${preview.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </section>
  );
}
