import { useState } from "react";
import { useSubmitQuoteRequest } from "@workspace/api-client-react";
import { fireQuoteRequestConversion } from "../analytics";
import { SERVICE_OPTIONS } from "./content";
import { INK, MUTED } from "./theme";

export interface QuoteFormProps {
  tenantSlug: string;
  accent: string;
  conversionId?: string;
  conversionLabel?: string;
  presetService?: string;
  /** Distinguishes the hero copy of the form from the one at the foot of the page. */
  idPrefix: string;
  heading?: string;
  subheading?: string;
}

/**
 * Four fields, and only three of them required.
 *
 * The site's main quote form asks for eight answers up front, which suits an organic visitor who
 * arrived ready to research. Paid traffic hasn't made that commitment yet — everything on that
 * longer form can be asked on the phone call this is trying to start.
 *
 * Email is required rather than optional: without it the customer gets no acknowledgement, and an
 * enquiry that vanishes into silence is exactly the complaint this whole batch of work exists to
 * fix. A confirmation landing in their inbox is also what stops them ringing the next renderer.
 *
 * `idPrefix` exists because the page renders this twice. Duplicate element ids would point every
 * label at the first form's fields, so tapping a label near the bottom of the page would focus an
 * input two screens up.
 */
export default function QuoteForm({
  tenantSlug, accent, conversionId, conversionLabel, presetService, idPrefix,
  heading = "Get your free quote",
  subheading = "A few details and we'll call you back.",
}: QuoteFormProps) {
  const mutation = useSubmitQuoteRequest();
  const [form, setForm] = useState({ name: "", phone: "", email: "", postcode: "", service: presetService ?? "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    try {
      // tenantSlug travels inside `data` — the /quote-request alias reads it from the body and
      // 400s without it.
      await mutation.mutateAsync({
        data: {
          tenantSlug,
          firstName: firstName || form.name.trim(),
          lastName: rest.join(" "),
          phone: form.phone.trim(),
          email: form.email.trim(),
          postcode: form.postcode.trim().toUpperCase(),
          serviceInterest: form.service || undefined,
          source: "Google",
          notes: "Submitted from the paid-search landing page.",
        },
      } as any);
      fireQuoteRequestConversion(conversionId, conversionLabel);
      setDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null;
      setError(message || "Something went wrong. Please call us instead — we'd rather not lose you.");
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-center">
        <svg className="mx-auto h-11 w-11 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="mt-3 text-lg font-extrabold text-emerald-900">Thanks — we've got your details</h2>
        <p className="mt-1.5 text-sm text-emerald-800">
          We'll call you within 24 hours to arrange your free survey. If it's urgent, ring us now
          and we'll pick up.
        </p>
      </div>
    );
  }

  const labelClass = "block text-xs font-bold uppercase tracking-wide mb-1.5";
  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base min-h-12 outline-none focus:ring-2 focus:border-transparent";
  const ring = { ["--tw-ring-color" as any]: accent };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-lg font-extrabold tracking-tight" style={{ color: INK }}>{heading}</h2>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>{subheading}</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-name`} className={labelClass} style={{ color: MUTED }}>Your name *</label>
          <input id={`${idPrefix}-name`} required autoComplete="name" className={inputClass} style={ring}
                 value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-phone`} className={labelClass} style={{ color: MUTED }}>Phone number *</label>
          <input id={`${idPrefix}-phone`} required type="tel" inputMode="tel" autoComplete="tel" className={inputClass} style={ring}
                 value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-email`} className={labelClass} style={{ color: MUTED }}>Email address *</label>
          <input id={`${idPrefix}-email`} required type="email" inputMode="email" autoComplete="email" className={inputClass} style={ring}
                 value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-postcode`} className={labelClass} style={{ color: MUTED }}>Property postcode *</label>
          <input id={`${idPrefix}-postcode`} required autoComplete="postal-code" placeholder="e.g. RM17 6XX" className={inputClass} style={ring}
                 value={form.postcode} onChange={e => setForm({ ...form, postcode: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-service`} className={labelClass} style={{ color: MUTED }}>
            What do you need? <span className="font-medium normal-case tracking-normal">(optional)</span>
          </label>
          <select id={`${idPrefix}-service`} className={inputClass} style={ring}
                  value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
            <option value="">Select if you know…</option>
            {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      <button type="submit" disabled={mutation.isPending}
              className="mt-5 w-full rounded-xl px-5 py-4 text-base font-bold text-white min-h-12 disabled:opacity-60"
              style={{ backgroundColor: accent }}>
        {mutation.isPending ? "Sending…" : "Get my free quote"}
      </button>
      <p className="mt-3 text-center text-xs" style={{ color: MUTED }}>
        No obligation. We'll never pass your details to anyone else.
      </p>
    </form>
  );
}
