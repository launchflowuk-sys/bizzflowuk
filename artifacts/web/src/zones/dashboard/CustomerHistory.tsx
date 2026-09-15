import { useApi, money, shortDate } from "./tradeApi";

/**
 * Everything this customer has ever had done.
 *
 * Brandon, on why he uses a system at all: "can always go back through
 * customers to see what jobs I have done for them."
 *
 * The customer page showed contact details and stopped. The jobs, quotes,
 * invoices and certificates were all sitting in the database with this
 * customer's id on them; nothing put them on the one screen where somebody
 * looking that customer up would think to look. So the answer to "when were we
 * last out to Mrs Hartley and what did we charge" was a search across four
 * pages, which in practice means a phone call to whoever remembers.
 */

type History = {
  jobs: Array<{ id: number; title: string; status: string; scheduledStart: string | null; completedAt: string | null }>;
  quotes: Array<{ id: number; reference: string; status: string; total: string; createdAt: string }>;
  invoices: Array<{ id: number; reference: string; status: string; total: string; amountPaid: string; issuedOn: string | null; dueOn: string | null }>;
  certificates: Array<{ id: number; reference: string; type: string; status: string; checkedAt: string; expiresAt: string | null }>;
  totals: { jobs: number; billed: string; outstanding: string };
};

const CARD = "rounded-xl border border-slate-200 bg-white overflow-hidden";
const HEAD = "px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3";
const ROW = "flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition";

export default function CustomerHistory({ customerId }: { customerId: number }) {
  const { data, loading, error } = useApi<History>(`/customers/${customerId}/history`, [customerId]);

  if (loading) return <div className="py-8 text-center text-sm text-slate-400">Loading history…</div>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const { jobs, quotes, invoices, certificates, totals } = data;
  const nothing = !jobs.length && !quotes.length && !invoices.length && !certificates.length;

  if (nothing) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <p className="text-[15px] font-semibold text-slate-700">Nothing on record yet.</p>
        <p className="text-[13.5px] text-slate-500 mt-1">
          Jobs, quotes, invoices and certificates for this customer will all show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The two numbers a trade actually wants about a customer: what they
          have been worth, and whether they owe anything right now. */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Jobs", value: String(totals.jobs) },
          { label: "Billed", value: money(totals.billed) },
          { label: "Outstanding", value: money(totals.outstanding), alert: Number(totals.outstanding) > 0 },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className={`text-lg sm:text-2xl font-bold ${s.alert ? "text-amber-600" : "text-slate-900"}`}>{s.value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {jobs.length > 0 && (
        <div className={CARD}>
          <div className={HEAD}><h2 className="font-semibold text-slate-900">Jobs</h2>
            <span className="text-xs text-slate-400">{jobs.length}</span></div>
          {jobs.map(j => (
            <a key={j.id} href={`/dashboard/projects/${j.id}`} className={ROW}>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 truncate">{j.title}</span>
                <span className="block text-xs text-slate-500">
                  {j.completedAt ? `Completed ${shortDate(j.completedAt)}`
                    : j.scheduledStart ? `Booked ${shortDate(j.scheduledStart)}`
                    : "Not booked in"}
                </span>
              </span>
              <span className="text-xs font-medium text-slate-500">{j.status}</span>
            </a>
          ))}
        </div>
      )}

      {invoices.length > 0 && (
        <div className={CARD}>
          <div className={HEAD}><h2 className="font-semibold text-slate-900">Invoices</h2>
            <span className="text-xs text-slate-400">{invoices.length}</span></div>
          {invoices.map(i => (
            <a key={i.id} href={`/dashboard/invoices/${i.id}`} className={ROW}>
              <span className="min-w-0">
                <span className="block font-mono text-[13px] text-slate-700">{i.reference}</span>
                <span className="block text-xs text-slate-500">{i.issuedOn ? shortDate(i.issuedOn) : "Draft"}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-slate-900">{money(i.total)}</span>
                <span className="text-xs font-medium text-slate-500">{i.status.replace("_", " ")}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      {quotes.length > 0 && (
        <div className={CARD}>
          <div className={HEAD}><h2 className="font-semibold text-slate-900">Quotes</h2>
            <span className="text-xs text-slate-400">{quotes.length}</span></div>
          {quotes.map(q => (
            <a key={q.id} href={`/dashboard/quotes/${q.id}`} className={ROW}>
              <span className="min-w-0">
                <span className="block font-mono text-[13px] text-slate-700">{q.reference}</span>
                <span className="block text-xs text-slate-500">{shortDate(q.createdAt)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-slate-900">{money(q.total)}</span>
                <span className="text-xs font-medium text-slate-500">{q.status}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      {certificates.length > 0 && (
        <div className={CARD}>
          <div className={HEAD}><h2 className="font-semibold text-slate-900">Certificates</h2>
            <span className="text-xs text-slate-400">{certificates.length}</span></div>
          {certificates.map(c => (
            <a key={c.id} href={`/dashboard/certificates/${c.id}`} className={ROW}>
              <span className="min-w-0">
                <span className="block font-mono text-[13px] text-slate-700">{c.reference}</span>
                <span className="block text-xs text-slate-500">
                  Checked {shortDate(c.checkedAt)}
                  {/* Omitted for the records that do not lapse — a warning
                      notice has no renewal date and implying one is wrong. */}
                  {c.expiresAt ? ` · renews ${shortDate(c.expiresAt)}` : ""}
                </span>
              </span>
              <span className="text-xs font-medium text-slate-500">{c.status}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
