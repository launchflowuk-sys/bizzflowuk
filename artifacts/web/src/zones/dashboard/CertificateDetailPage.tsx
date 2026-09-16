import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { api, useApi, shortDate, daysUntil } from "./tradeApi";
import { Page, PageHead, Card, Btn, Loading, ErrorNote, Pill } from "./TradePages";
import { StatusBadge } from "@/components/StatusBadge";
import Spinner from "./Spinner";
import SignaturePad from "./SignaturePad";
import PhotoStrip from "./PhotoStrip";

/**
 * Filling in a certificate, on site, on a phone.
 *
 * WHY THIS EXISTS. The API could already create a draft, record appliances,
 * issue, render a PDF, email it and schedule the renewal. The dashboard could
 * create the draft and list it. Nothing in between: `NewCertificateForm` ended
 * with "add the appliance detail when you issue it" and there was no screen
 * that did that, so every certificate anyone made was a dead end. The engine
 * was finished and unreachable.
 *
 * DESIGNED FOR A PHONE IN AN AIRING CUPBOARD, not for a desk. The engineer is
 * standing up, one-handed, in bad light:
 *
 *   - Safety checks are three big buttons (Pass / Fail / N/A), not a select.
 *     A dropdown on a phone is a modal wheel, and a wheel that defaults to the
 *     first option is how a check gets recorded as passed without being read.
 *   - Nothing is pre-answered. A blank check stays blank and blocks issue.
 *     The software records; the engineer certifies.
 *   - Every input is 16px, because anything smaller makes iOS zoom the page on
 *     focus and the engineer then has to pinch back out for every field.
 *   - What is still missing is listed before the Issue button, in the same
 *     words the server uses to refuse, so nobody presses it to find out.
 *
 * Issued records are read-only here. Correcting one means superseding it, so
 * the copy in the landlord's inbox and the copy in the database can never
 * disagree.
 */

type Appliance = {
  id?: number;
  /** Stable across saves, unlike id. Photographs hang off this. */
  clientKey?: string | null;
  location: string;
  applianceType?: string | null;
  make?: string | null;
  model?: string | null;
  isLandlordOwned?: boolean;
  wasInspected?: boolean;
  flueFlowPass?: boolean | null;
  safetyDevicesPass?: boolean | null;
  ventilationPass?: boolean | null;
  visualConditionPass?: boolean | null;
  gasTightnessPass?: boolean | null;
  combustionReading?: string | null;
  operatingPressure?: string | null;
  defects?: string | null;
  actionTaken?: string | null;
  safeToUse?: boolean | null;
};

type Certificate = {
  id: number; type: string; reference: string; status: string;
  propertyAddress: string | null; propertyPostcode: string | null;
  landlordName: string | null; landlordAddress: string | null;
  tenantContactName: string | null; tenantContactEmail: string | null;
  engineerName: string | null; engineerRegNo: string | null;
  checkedAt: string | null; expiresAt: string | null;
  outcome: string | null; supersededById: number | null;
  engineerSignaturePath: string | null; customerSignaturePath: string | null;
  customerSignatureName: string | null;
  appliances: Appliance[];
};

type CertType = {
  key: string; label: string; shortLabel: string;
  usesAppliances: boolean; expires: boolean; validMonths: number;
  deliveryDeadlineDays: number | null;
};

const SAFETY_CHECKS: Array<{ field: keyof Appliance; label: string; hint?: string }> = [
  { field: "flueFlowPass", label: "Flue flow / spillage" },
  { field: "safetyDevicesPass", label: "Safety devices operating" },
  { field: "ventilationPass", label: "Ventilation" },
  { field: "visualConditionPass", label: "Visual condition of flue & termination" },
  { field: "gasTightnessPass", label: "Gas tightness" },
];

const input =
  "w-full rounded-xl border border-slate-300 px-3.5 py-3 text-[16px] text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]";
const labelCls = "block text-[13px] font-semibold text-slate-700 mb-1.5";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-slate-500">{hint}</span>}
    </label>
  );
}

/**
 * Pass / Fail / N/A as three real buttons.
 *
 * `null` is unanswered and stays unanswered — there is deliberately no default.
 * The point of a safety check is that somebody looked; a control that arrives
 * pre-set to Pass quietly turns "not checked" into "checked and fine".
 */
function TriState({ value, onChange, disabled }: {
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  const base = "flex-1 min-w-[76px] rounded-xl border px-3 py-2.5 text-[14px] font-semibold transition disabled:opacity-60";
  return (
    <div className="flex gap-2">
      <button type="button" disabled={disabled} onClick={() => onChange(value === true ? null : true)}
        aria-pressed={value === true}
        className={`${base} ${value === true
          ? "border-green-600 bg-green-600 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}>
        Pass
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange(value === false ? null : false)}
        aria-pressed={value === false}
        className={`${base} ${value === false
          ? "border-red-600 bg-red-600 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}>
        Fail
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange(null)}
        aria-pressed={value === null || value === undefined}
        className={`${base} ${value === null || value === undefined
          ? "border-slate-400 bg-slate-100 text-slate-700"
          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"}`}>
        N/A
      </button>
    </div>
  );
}

function Toggle({ value, onChange, on, off, disabled }: {
  value: boolean | undefined; onChange: (v: boolean) => void;
  on: string; off: string; disabled?: boolean;
}) {
  const base = "flex-1 rounded-xl border px-3 py-2.5 text-[14px] font-semibold transition disabled:opacity-60";
  return (
    <div className="flex gap-2">
      {[true, false].map(v => (
        <button key={String(v)} type="button" disabled={disabled} onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`${base} ${value === v
            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}>
          {v ? on : off}
        </button>
      ))}
    </div>
  );
}

/** A key that survives the wholesale replace the server does on every save. */
function newKey(): string {
  return (crypto.randomUUID?.() ?? `k${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 64);
}

function blankAppliance(): Appliance {
  return {
    clientKey: newKey(),
    location: "", applianceType: "", make: "", model: "",
    isLandlordOwned: true, wasInspected: true,
    flueFlowPass: null, safetyDevicesPass: null, ventilationPass: null,
    visualConditionPass: null, gasTightnessPass: null,
    combustionReading: "", operatingPressure: "",
    defects: "", actionTaken: "", safeToUse: null,
  };
}

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = Number(params.id);

  const { data, loading, error, reload } = useApi<Certificate>(`/certificates/${id}`, [id]);
  const { data: types } = useApi<CertType[]>("/certificates/types");

  const [cert, setCert] = useState<Certificate | null>(null);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const [savingSig, setSavingSig] = useState<"engineer" | "customer" | null>(null);
  const { data: photoData, reload: reloadPhotos } = useApi<any[]>(`/certificates/${id}/photos`, [id]);
  const photos = photoData ?? [];

  useEffect(() => {
    if (!data) return;
    setCert(data);
    // Rows saved before client keys existed get one now, so their photographs
    // have something stable to attach to from here on.
    setAppliances((data.appliances ?? []).map(a => (a.clientKey ? a : { ...a, clientKey: newKey() })));
    setDirty(false);
  }, [data]);

  /**
   * A half-filled certificate is somebody's afternoon. Warn before it is lost
   * to a back gesture, which on a phone is an easy accident.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const type = (types ?? []).find(t => t.key === cert?.type) ?? null;
  const locked = !!cert && cert.status !== "draft";

  function touch() {
    setDirty(true);
    setProblems([]);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    // Long enough not to fire mid-word, short enough that walking away from a
    // finished appliance does not lose it.
    saveTimer.current = window.setTimeout(() => { void save(true); }, 2500);
  }

  function setField<K extends keyof Certificate>(k: K, v: Certificate[K]) {
    setCert(c => (c ? { ...c, [k]: v } : c));
    touch();
  }

  function setAppliance(i: number, patch: Partial<Appliance>) {
    setAppliances(list => list.map((a, n) => (n === i ? { ...a, ...patch } : a)));
    touch();
  }

  async function save(quiet = false): Promise<boolean> {
    if (!cert || locked) return false;
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
    setSaving(true);
    try {
      await api.patch(`/certificates/${cert.id}`, {
        type: cert.type,
        propertyAddress: cert.propertyAddress ?? "",
        propertyPostcode: cert.propertyPostcode ?? "",
        landlordName: cert.landlordName ?? "",
        landlordAddress: cert.landlordAddress ?? "",
        tenantContactName: cert.tenantContactName ?? "",
        tenantContactEmail: cert.tenantContactEmail ?? "",
        engineerName: cert.engineerName ?? "",
        engineerRegNo: cert.engineerRegNo ?? "",
        checkedAt: cert.checkedAt,
        outcome: cert.outcome ?? "",
        // Sent whole. The server replaces the set rather than merging, because a
        // partial merge on a safety checklist is how a stale row survives.
        appliances: appliances
          .filter(a => a.location.trim())
          .map(a => ({ ...a, clientKey: a.clientKey ?? newKey(), location: a.location.trim() })),
      });
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      if (!quiet) setNote({ ok: true, text: "Saved." });
      return true;
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "Could not save that." });
      return false;
    } finally { setSaving(false); }
  }

  /**
   * Signatures save on their own, immediately, and not as part of the record.
   *
   * A signature captured at the door and then lost because the van drove out of
   * signal before Save was pressed is the one failure that sends an engineer
   * back to the property. It goes the moment it is drawn.
   */
  async function saveSignature(who: "engineer" | "customer", dataUrl: string) {
    if (!cert) return;
    setSavingSig(who); setNote(null);
    try {
      const updated = await api.post<Certificate>(`/certificates/${cert.id}/signature`, {
        who, dataUrl, name: who === "customer" ? cert.customerSignatureName ?? "" : undefined,
      });
      setCert(c => (c ? { ...c, ...updated } : c));
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "Could not save that signature." });
    } finally { setSavingSig(null); }
  }

  async function clearSignature(who: "engineer" | "customer") {
    if (!cert) return;
    try {
      const updated = await api.post<Certificate>(`/certificates/${cert.id}/signature`, { who, dataUrl: null });
      setCert(c => (c ? { ...c, ...updated } : c));
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "Could not clear that signature." });
    }
  }

  /** Renaming who signed, without making them sign again. */
  async function saveSignatureName() {
    if (!cert?.customerSignaturePath) return;
    try {
      await api.post(`/certificates/${cert.id}/signature`, { who: "customer", name: cert.customerSignatureName ?? "" });
    } catch { /* the name is a nicety; never block the record for it */ }
  }

  async function issue() {
    if (!cert) return;
    setIssuing(true); setNote(null); setProblems([]);
    try {
      if (dirty && !(await save(true))) return;
      await api.post(`/certificates/${cert.id}/issue`);
      setNote({ ok: true, text: "Issued, and on its way to the customer." });
      reload();
    } catch (e: any) {
      // The server refuses an incomplete record and says exactly what is
      // missing. Show its words rather than a generic failure.
      const list = e?.body?.problems ?? e?.problems;
      if (Array.isArray(list) && list.length) setProblems(list);
      else setNote({ ok: false, text: e?.message || "Could not issue that." });
    } finally { setIssuing(false); }
  }

  async function supersede() {
    if (!cert) return;
    if (!confirm("This creates a fresh draft copy to correct. The issued one stays on file and stays downloadable. Carry on?")) return;
    try {
      const fresh = await api.post<{ id: number }>(`/certificates/${cert.id}/supersede`);
      navigate(`/dashboard/certificates/${fresh.id}`);
    } catch (e: any) { setNote({ ok: false, text: e?.message || "Could not do that." }); }
  }

  if (loading && !cert) return <Page><Loading /></Page>;
  if (error) return <Page><ErrorNote message={error} /></Page>;
  if (!cert) return <Page><ErrorNote message="That certificate could not be found." /></Page>;

  const left = daysUntil(cert.expiresAt);
  const tone = cert.status !== "issued" ? "muted" : left === null ? "muted" : left < 0 ? "bad" : left <= 42 ? "warn" : "good";

  return (
    <Page>
      <PageHead
        title={type?.label ?? "Certificate"}
        sub={`${cert.reference}${cert.propertyAddress ? " · " + cert.propertyAddress : ""}`}
        action={<Link href="/dashboard/certificates" className="text-[14px] font-semibold text-slate-500 hover:text-slate-800">← All certificates</Link>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <StatusBadge value={cert.status} />
        {cert.expiresAt && (
          <Pill tone={tone}>
            Expires {shortDate(cert.expiresAt)}
            {cert.status === "issued" && left !== null && (left < 0 ? " · expired" : ` · ${left}d`)}
          </Pill>
        )}
        {locked && <span className="text-[13px] text-slate-500">Issued records cannot be edited.</span>}
      </div>

      {note && (
        <p className={`mb-4 text-[14px] font-medium ${note.ok ? "text-green-700" : "text-red-600"}`}>{note.text}</p>
      )}

      {/* ── Who and where ─────────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 mb-4">
        <h2 className="text-[17px] font-semibold text-slate-900 mb-4">The property and the engineer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property address">
            <textarea className={input} rows={2} disabled={locked}
              value={cert.propertyAddress ?? ""} onChange={e => setField("propertyAddress", e.target.value)} />
          </Field>
          <Field label="Postcode">
            <input className={input} disabled={locked}
              value={cert.propertyPostcode ?? ""} onChange={e => setField("propertyPostcode", e.target.value)} />
          </Field>
          <Field label="Landlord / customer name">
            <input className={input} disabled={locked}
              value={cert.landlordName ?? ""} onChange={e => setField("landlordName", e.target.value)} />
          </Field>
          <Field label="Landlord address" hint="If different from the property.">
            <textarea className={input} rows={2} disabled={locked}
              value={cert.landlordAddress ?? ""} onChange={e => setField("landlordAddress", e.target.value)} />
          </Field>
          <Field label="Engineer name">
            <input className={input} disabled={locked}
              value={cert.engineerName ?? ""} onChange={e => setField("engineerName", e.target.value)} />
          </Field>
          <Field label="Gas Safe registration number">
            <input className={input} inputMode="numeric" disabled={locked}
              value={cert.engineerRegNo ?? ""} onChange={e => setField("engineerRegNo", e.target.value)} />
          </Field>
          <Field label="Date of the check">
            <input type="date" className={input} disabled={locked}
              value={(cert.checkedAt ?? "").slice(0, 10)} onChange={e => setField("checkedAt", e.target.value)} />
          </Field>
          <Field label="Who gets the copy" hint={type?.deliveryDeadlineDays
            ? `Must reach them within ${type.deliveryDeadlineDays} days.` : undefined}>
            <input className={input} type="email" placeholder="tenant@example.com" disabled={locked}
              value={cert.tenantContactEmail ?? ""} onChange={e => setField("tenantContactEmail", e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* ── Appliances ────────────────────────────────────────────────────── */}
      {type?.usesAppliances !== false && (
        <div className="space-y-4 mb-4">
          {appliances.map((a, i) => (
            <Card key={i} className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-[17px] font-semibold text-slate-900">
                  Appliance {i + 1}{a.location ? ` — ${a.location}` : ""}
                </h2>
                {!locked && (
                  <button type="button"
                    onClick={() => { setAppliances(l => l.filter((_, n) => n !== i)); touch(); }}
                    className="text-[13px] font-semibold text-slate-400 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Where is it?" hint="Kitchen, airing cupboard, garage.">
                  <input className={input} disabled={locked}
                    value={a.location} onChange={e => setAppliance(i, { location: e.target.value })} />
                </Field>
                <Field label="Type">
                  <input className={input} placeholder="Boiler, fire, hob" disabled={locked}
                    value={a.applianceType ?? ""} onChange={e => setAppliance(i, { applianceType: e.target.value })} />
                </Field>
                <Field label="Make">
                  <input className={input} disabled={locked}
                    value={a.make ?? ""} onChange={e => setAppliance(i, { make: e.target.value })} />
                </Field>
                <Field label="Model">
                  <input className={input} disabled={locked}
                    value={a.model ?? ""} onChange={e => setAppliance(i, { model: e.target.value })} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <Field label="Owned by">
                  <Toggle value={a.isLandlordOwned} disabled={locked} on="Landlord" off="Tenant"
                    onChange={v => setAppliance(i, { isLandlordOwned: v })} />
                </Field>
                <Field label="Was it inspected?" hint="No if you could not get to it or access was refused.">
                  <Toggle value={a.wasInspected} disabled={locked} on="Inspected" off="Not inspected"
                    onChange={v => setAppliance(i, { wasInspected: v })} />
                </Field>
              </div>

              {a.wasInspected !== false && (
                <>
                  <div className="mt-5 space-y-4">
                    {SAFETY_CHECKS.map(c => (
                      <div key={String(c.field)}>
                        <span className={labelCls}>{c.label}</span>
                        <TriState
                          value={a[c.field] as boolean | null | undefined}
                          disabled={locked}
                          onChange={v => setAppliance(i, { [c.field]: v } as Partial<Appliance>)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <Field label="Combustion reading" hint="Ratio / CO ppm, as your analyser gives it.">
                      <input className={input} disabled={locked}
                        value={a.combustionReading ?? ""} onChange={e => setAppliance(i, { combustionReading: e.target.value })} />
                    </Field>
                    <Field label="Operating pressure / heat input">
                      <input className={input} disabled={locked}
                        value={a.operatingPressure ?? ""} onChange={e => setAppliance(i, { operatingPressure: e.target.value })} />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Defects found" hint="Leave empty if there were none.">
                      <textarea className={input} rows={2} disabled={locked}
                        value={a.defects ?? ""} onChange={e => setAppliance(i, { defects: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Action taken">
                      <textarea className={input} rows={2} disabled={locked}
                        value={a.actionTaken ?? ""} onChange={e => setAppliance(i, { actionTaken: e.target.value })} />
                    </Field>
                  </div>

                  <div className="mt-5">
                    <PhotoStrip
                      certificateId={cert.id}
                      applianceKey={a.clientKey ?? null}
                      photos={photos}
                      onChanged={reloadPhotos}
                      disabled={locked}
                      label="Photos of this appliance"
                    />
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <span className={labelCls}>Is this appliance safe to use?</span>
                    <p className="mb-2 text-[12.5px] text-slate-500">
                      The one answer the record cannot be issued without.
                    </p>
                    <Toggle value={a.safeToUse ?? undefined} disabled={locked} on="Safe to use" off="NOT safe to use"
                      onChange={v => setAppliance(i, { safeToUse: v })} />
                  </div>
                </>
              )}
            </Card>
          ))}

          {!locked && (
            <button type="button"
              onClick={() => { setAppliances(l => [...l, blankAppliance()]); touch(); }}
              className="w-full rounded-[20px] border-2 border-dashed border-slate-300 bg-white py-4 text-[15px] font-semibold text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)]">
              + Add {appliances.length ? "another appliance" : "an appliance"}
            </button>
          )}
        </div>
      )}

      {/* ── Photos of the job ─────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 mb-4">
        <h2 className="text-[17px] font-semibold text-slate-900">Photos of the job</h2>
        <p className="mt-1 mb-4 text-[13px] text-slate-500">
          Anything that is not about one appliance. On a disputed job a photograph taken at the
          time is the difference between your word and evidence.
        </p>
        <PhotoStrip
          certificateId={cert.id}
          applianceKey={null}
          photos={photos}
          onChanged={reloadPhotos}
          disabled={locked}
        />
      </Card>

      {/* ── Signatures ────────────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 mb-4">
        <h2 className="text-[17px] font-semibold text-slate-900">Signatures</h2>
        <p className="mt-1 mb-4 text-[13px] text-slate-500">
          Signed on the screen, at the property. Saved the moment you press save, so a lost
          connection later cannot take it with it.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <SignaturePad
            label="Engineer"
            hint="Yours. Required before this can be issued."
            existing={!!cert.engineerSignaturePath}
            disabled={locked}
            busy={savingSig === "engineer"}
            onSave={d => saveSignature("engineer", d)}
            onClear={() => clearSignature("engineer")}
          />
          <div>
            <SignaturePad
              label="Received by"
              hint="The customer or tenant, if they are here. Optional."
              existing={!!cert.customerSignaturePath}
              disabled={locked}
              busy={savingSig === "customer"}
              onSave={d => saveSignature("customer", d)}
              onClear={() => clearSignature("customer")}
            />
            {!locked && (
              <div className="mt-3">
                <Field label="Their name">
                  <input className={input} placeholder="Who signed"
                    value={cert.customerSignatureName ?? ""}
                    onChange={e => setCert(c => (c ? { ...c, customerSignatureName: e.target.value } : c))}
                    onBlur={() => { if (cert.customerSignaturePath) void saveSignatureName(); }} />
                </Field>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── What is stopping this ─────────────────────────────────────────── */}
      {problems.length > 0 && (
        <Card className="p-5 mb-4 border-amber-200 bg-amber-50">
          <p className="text-[15px] font-semibold text-amber-900">Not ready to issue yet</p>
          <ul className="mt-2 space-y-1.5">
            {problems.map((p, i) => (
              <li key={i} className="text-[14px] text-amber-900">• {p}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 border-t border-slate-200 bg-white/97 px-4 sm:px-6 py-3 backdrop-blur">
        {locked ? (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/certificates/${cert.id}/pdf`} target="_blank" rel="noreferrer"
              className="inline-flex h-11 items-center rounded-xl bg-[var(--brand)] px-5 text-[14.5px] font-semibold text-white">
              Download the PDF
            </a>
            {cert.status === "issued" && !cert.supersededById && (
              <Btn tone="ghost" onClick={supersede}>Correct this record</Btn>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void save()} disabled={saving || !dirty}
                className="inline-flex h-11 items-center rounded-xl border border-slate-300 px-4 text-[14.5px] font-semibold text-slate-700 disabled:opacity-50">
                {saving && <Spinner className="mr-2" />}
                {dirty ? "Save" : "Saved"}
              </button>
              <button type="button" onClick={issue} disabled={issuing}
                className="inline-flex h-11 flex-1 min-w-[190px] items-center justify-center rounded-xl bg-[var(--brand)] px-5 text-[15px] font-semibold text-white disabled:opacity-60">
                {issuing && <Spinner className="mr-2" />}
                {issuing ? "Issuing…" : "Issue and send"}
              </button>
            </div>
            <p className="mt-2 text-[12.5px] text-slate-500">
              {dirty
                ? "Unsaved changes — they save on their own in a moment."
                : savedAt
                  ? `Saved at ${savedAt}. Issuing locks the record and emails the customer.`
                  : "Issuing locks the record and emails the customer."}
            </p>
          </>
        )}
      </div>
    </Page>
  );
}
