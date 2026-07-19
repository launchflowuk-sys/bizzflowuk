import { useState, useMemo, useRef, useEffect } from "react";
import { useGetPublicSite, useListPublicPriceItems, useSubmitQuoteRequest } from "@workspace/api-client-react";
import { useSiteBase } from "./PublicSiteApp";

// Neutral palette (kept local so this component doesn't couple to either template's colours).
const TEXT = "#26323F";
const MUTED = "#64717F";

interface PriceItem {
  id: number;
  category: string | null;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: string;
  fixed: boolean;
  minQuantity: number;
}

function money(n: number): string {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Shared, platform-wide cost calculator. Reads whichever tenant it's mounted on, renders that
 * tenant's own price items grouped by category, tracks quantities live, and submits the picked
 * lines + running total as a lead through the existing quote-request flow. Nothing is hardcoded
 * per tenant; `accent`/`panel` re-theme it for each site template.
 *
 * The total is presented as an INDICATIVE estimate — deliberately not a binding quote — because
 * for most trades the final price depends on a site survey. Its real job is to convert: give a
 * ballpark and capture the lead with that number attached.
 */
export function PriceCalculatorSection({ tenantSlug, accent, panel }: { tenantSlug: string; accent: string; panel: string }) {
  const siteBase = useSiteBase();
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant } = (siteData as any) || {};
  const { data: itemsData } = useListPublicPriceItems(tenantSlug);
  const items = ((itemsData as any[]) || []) as PriceItem[];
  const mutation = useSubmitQuoteRequest();

  const [qty, setQty] = useState<Record<number, number>>({});
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "", postcode: "", consentAgreed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (submitted) successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [submitted]);

  const getQty = (it: PriceItem) => qty[it.id] ?? (it.fixed ? 0 : it.minQuantity || 0);

  const groups = useMemo(() => {
    const m = new Map<string, PriceItem[]>();
    for (const it of items) {
      const k = it.category?.trim() || "Options";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [items]);

  const lines = useMemo(() =>
    items
      .map(it => {
        const q = getQty(it);
        const line = q * parseFloat(it.unitPrice || "0");
        return { it, q, line };
      })
      .filter(l => l.q > 0 && l.line > 0),
    [items, qty]);

  const total = lines.reduce((s, l) => s + l.line, 0);

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide mb-1";
  const ringStyle = { ['--tw-ring-color' as any]: accent };

  const setItemQty = (id: number, v: number) => setQty(prev => ({ ...prev, [id]: Math.max(0, v) }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!contact.firstName.trim()) e.name = "Your name is required";
    if (!contact.phone.trim()) e.phone = "Phone number is required";
    if (!contact.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) e.email = "Enter a valid email";
    if (!contact.consentAgreed) e.consentAgreed = "Please confirm before submitting";
    if (!lines.length) e.items = "Add at least one item to your estimate";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    // Human-readable breakdown for the lead body...
    const breakdown = lines.map(l => `${l.it.name} — ${l.q} ${l.it.unit} @ ${money(parseFloat(l.it.unitPrice))} = ${money(l.line)}`).join("\n");
    const projectDescription = `Cost calculator estimate:\n${breakdown}\n\nEstimated total: ${money(total)} (indicative)`;
    // ...plus a structured version so "Convert to Quote" can pre-fill the quote's line items.
    const estimateItems = lines.map(l => ({ name: l.it.name, quantity: l.q, unit: l.it.unit, unitPrice: parseFloat(l.it.unitPrice || "0").toFixed(2), lineTotal: l.line.toFixed(2) }));
    try {
      const result = await mutation.mutateAsync({ data: {
        ...contact, tenantSlug,
        budget: money(total),
        serviceInterest: "Cost Calculator Estimate",
        projectDescription,
        notes: projectDescription,
        source: "Cost Calculator",
        estimateItems,
        estimateTotal: total.toFixed(2),
      } } as any) as any;
      setReference(result?.reference ?? null);
      setSubmitted(true);
    } catch { /* surfaced via mutation.isError below */ }
  };

  if (!items.length) {
    return (
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold" style={{ color: TEXT }}>Pricing coming soon</h2>
          <p className="mt-3" style={{ color: MUTED }}>Our online estimate tool isn't ready just yet. In the meantime, request a free quote and we'll come straight back to you.</p>
          <a href={`${siteBase}/quote`} className="mt-6 inline-flex items-center rounded-lg px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>Request A Free Quote</a>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-white" style={ringStyle}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {submitted ? (
          <div ref={successRef} className="max-w-xl mx-auto text-center space-y-5 py-12">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: accent + "20" }}>
              <svg className="w-8 h-8" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 className="text-2xl font-bold" style={{ color: TEXT }}>Estimate Sent</h2>
            <p style={{ color: MUTED }}>Thanks — we've received your estimate of <strong style={{ color: TEXT }}>{money(total)}</strong> and will be in touch to confirm a firm price.</p>
            {reference && <p className="text-sm font-mono" style={{ color: MUTED }}>Reference: <span className="font-bold" style={{ color: TEXT }}>{reference}</span></p>}
            <a href={siteBase || "/"} className="inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>Back to Home</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Items */}
            <div className="lg:col-span-2 space-y-8">
              {groups.map(([cat, its]) => (
                <div key={cat}>
                  <h2 className="font-bold text-lg mb-4" style={{ color: TEXT }}>{cat}</h2>
                  <div className="space-y-3">
                    {its.map(it => {
                      const q = getQty(it);
                      return (
                        <div key={it.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm" style={{ color: TEXT }}>{it.name}</p>
                            {it.description && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{it.description}</p>}
                            <p className="text-xs mt-1 font-medium" style={{ color: accent }}>{money(parseFloat(it.unitPrice || "0"))} {it.unit !== "fixed" && it.unit !== "each" ? `per ${it.unit}` : it.unit === "each" ? "each" : ""}</p>
                          </div>
                          {it.fixed ? (
                            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: TEXT }}>
                              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" style={{ accentColor: accent }} checked={q > 0} onChange={e => setItemQty(it.id, e.target.checked ? 1 : 0)} />
                              Add
                            </label>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button type="button" aria-label="decrease" onClick={() => setItemQty(it.id, q - 1)} className="w-8 h-8 rounded-lg border border-slate-200 font-bold" style={{ color: TEXT }}>−</button>
                              <input type="number" min={0} inputMode="numeric" value={q} onChange={e => setItemQty(it.id, parseInt(e.target.value || "0", 10))} className="w-16 text-center rounded-lg border border-slate-200 px-2 py-1.5 text-sm" style={ringStyle} />
                              <button type="button" aria-label="increase" onClick={() => setItemQty(it.id, q + 1)} className="w-8 h-8 rounded-lg border border-slate-200 font-bold" style={{ color: TEXT }}>+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + capture */}
            <div className="lg:sticky lg:top-24 space-y-5">
              <div className="rounded-2xl p-6 text-white" style={{ backgroundColor: panel }}>
                <h2 className="font-bold text-lg">Your Estimate</h2>
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto text-sm">
                  {lines.length === 0
                    ? <p className="text-white/60">Add items on the left to build your estimate.</p>
                    : lines.map(l => (
                        <div key={l.it.id} className="flex justify-between gap-3">
                          <span className="text-white/80 truncate">{l.it.name} × {l.q}</span>
                          <span className="font-semibold whitespace-nowrap">{money(l.line)}</span>
                        </div>
                      ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/15 flex items-baseline justify-between">
                  <span className="font-bold">Estimated total</span>
                  <span className="text-2xl font-extrabold" style={{ color: accent }}>{money(total)}</span>
                </div>
                <p className="mt-2 text-xs text-white/60">Indicative only — the final price is confirmed after a site visit.</p>
              </div>

              <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 p-6 space-y-3 shadow-sm">
                <h3 className="font-bold" style={{ color: TEXT }}>Get this estimate by email</h3>
                <div>
                  <label className={labelCls} style={{ color: MUTED }}>Full Name *</label>
                  <input className={inputCls} style={ringStyle} value={contact.firstName + (contact.lastName ? " " + contact.lastName : "")} onChange={e => { const p = e.target.value.split(" "); setContact({ ...contact, firstName: p[0] || "", lastName: p.slice(1).join(" ") }); }} />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className={labelCls} style={{ color: MUTED }}>Phone *</label>
                  <input className={inputCls} style={ringStyle} value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} />
                  {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className={labelCls} style={{ color: MUTED }}>Email *</label>
                  <input type="email" className={inputCls} style={ringStyle} value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} />
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className={labelCls} style={{ color: MUTED }}>Postcode</label>
                  <input className={inputCls} style={ringStyle} value={contact.postcode} onChange={e => setContact({ ...contact, postcode: e.target.value })} />
                </div>
                <label className="flex items-start gap-2 text-sm" style={{ color: TEXT }}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" style={{ accentColor: accent }} checked={contact.consentAgreed} onChange={e => setContact({ ...contact, consentAgreed: e.target.checked })} />
                  <span>I agree to the <a href={`${siteBase}/terms`} target="_blank" rel="noreferrer" className="underline" style={{ color: accent }}>Terms</a> and <a href={`${siteBase}/privacy`} target="_blank" rel="noreferrer" className="underline" style={{ color: accent }}>Privacy Policy</a>, and consent to {tenant?.name || "this business"} contacting me.</span>
                </label>
                {errors.consentAgreed && <p className="text-xs text-red-600">{errors.consentAgreed}</p>}
                {errors.items && <p className="text-xs text-red-600">{errors.items}</p>}
                <button type="submit" disabled={mutation.isPending} className="w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: accent }}>
                  {mutation.isPending ? "Sending…" : "Send Me This Estimate"}
                </button>
                {mutation.isError && <p className="text-sm text-red-600 text-center">Something went wrong. Please try again or call us.</p>}
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
