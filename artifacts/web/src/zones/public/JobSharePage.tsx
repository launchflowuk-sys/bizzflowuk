import { useEffect, useState } from "react";

/**
 * What the customer sees when they scan the QR on their job sheet.
 *
 * Written for a phone held in a hallway, not a desk. The three questions a
 * customer actually has — when are you coming, who is it, and do I owe you
 * anything — are answered in the first screen, in that order, in type big
 * enough to read without glasses. Everything else is below.
 *
 * No login, no app, no account. The token in the URL is the credential, which
 * is the only reason this is worth having: the moment it asks a customer to
 * sign up, they ring instead, and the point of the thing is gone.
 */

type JobShare = {
  business: {
    name: string; phone: string | null; email: string | null;
    logoUrl: string | null; primaryColor: string | null; whatsappNumber: string | null;
  };
  job: {
    title: string; status: string;
    scheduledStart: string | null; scheduledEnd: string | null; allDay: boolean;
    completedAt: string | null;
    address: string | null; city: string | null; postcode: string | null;
    customerFirstName: string | null;
  };
  engineer: { firstName: string } | null;
  items: Array<{ description: string; quantity: string; total: string }>;
  invoice: { reference: string; status: string; total: string; outstanding: string; dueOn: string | null } | null;
};

function money(v: unknown) {
  const n = Number(v ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

/** "Thursday 18 September, 8:30am" — the way a person says it. */
function whenText(job: JobShare["job"]): string | null {
  if (!job.scheduledStart) return null;
  const start = new Date(job.scheduledStart);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (job.allDay) return day;
  const time = start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }).replace(":00", "");
  const end = job.scheduledEnd ? new Date(job.scheduledEnd) : null;
  const endTime = end && !Number.isNaN(end.getTime())
    ? end.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }).replace(":00", "")
    : null;
  return `${day}, ${time}${endTime ? ` – ${endTime}` : ""}`;
}

/** How far off it is, said the way a person would say it. */
function relativeText(iso: string | null): string | null {
  if (!iso) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(start) - startOfDay(new Date())) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1) return null;
  return null;
}

export default function JobSharePage({ token }: { token: string }) {
  const [data, setData] = useState<JobShare | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");

  useEffect(() => {
    let live = true;
    fetch(`/api/public/job/${encodeURIComponent(token)}`)
      .then(async r => {
        if (!live) return;
        if (r.status === 404) { setState("missing"); return; }
        if (!r.ok) { setState("error"); return; }
        setData(await r.json());
        setState("ok");
      })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    if (data) document.title = `${data.job.title} — ${data.business.name}`;
  }, [data]);

  if (state === "loading") {
    return (
      <Shell>
        <div className="py-20 text-center text-slate-400 text-[15px]">Loading…</div>
      </Shell>
    );
  }

  if (state === "missing") {
    return (
      <Shell>
        <div className="py-16 text-center">
          <h1 className="text-[22px] font-bold text-slate-900">This link is no longer active.</h1>
          <p className="mt-2 text-[15px] text-slate-500 max-w-sm mx-auto">
            It may have been turned off, or the job sheet it came from may be an old one.
            Give the business a ring and they will send you a new one.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === "error" || !data) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <h1 className="text-[22px] font-bold text-slate-900">Could not load this job.</h1>
          <p className="mt-2 text-[15px] text-slate-500">Try again in a moment.</p>
        </div>
      </Shell>
    );
  }

  const { business, job, engineer, items, invoice } = data;
  const brand = business.primaryColor || "#0F172A";
  const when = whenText(job);
  const relative = relativeText(job.scheduledStart);
  const address = [job.address, job.city, job.postcode].filter(Boolean).join(", ");
  const done = Boolean(job.completedAt) || job.status === "Completed";
  const estimateTotal = items.reduce((s, i) => s + Number(i.total ?? 0), 0);

  return (
    <Shell>
      <header className="flex items-center gap-3 py-5 border-b border-slate-200">
        {business.logoUrl
          ? <img src={business.logoUrl} alt="" className="h-9 w-auto max-w-[140px] object-contain" />
          : <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-white font-bold"
              style={{ background: brand }}>{business.name.slice(0, 1)}</span>}
        <span className="font-bold text-slate-900">{business.name}</span>
      </header>

      <main className="py-7 space-y-7">
        <section>
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {done ? "Completed job" : "Your booking"}
          </p>
          <h1 className="mt-1 text-[26px] sm:text-[30px] font-bold text-slate-900 leading-tight">
            {job.title}
          </h1>
          {job.customerFirstName && (
            <p className="mt-1 text-[15px] text-slate-500">For {job.customerFirstName}</p>
          )}
        </section>

        {/* The first question, answered biggest. */}
        <section className="rounded-[18px] p-5 text-white" style={{ background: brand }}>
          {done ? (
            <>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] opacity-70">Finished</p>
              <p className="mt-1 text-[22px] font-bold">
                {job.completedAt
                  ? new Date(job.completedAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                  : "This job is complete."}
              </p>
            </>
          ) : when ? (
            <>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] opacity-70">
                {relative ?? "Booked for"}
              </p>
              <p className="mt-1 text-[22px] font-bold">{when}</p>
              {engineer && <p className="mt-1.5 text-[15px] opacity-90">{engineer.firstName} is coming out to you.</p>}
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] opacity-70">Not booked in yet</p>
              <p className="mt-1 text-[19px] font-bold">We will be in touch with a date.</p>
            </>
          )}
        </section>

        {address && (
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-1.5">Where</h2>
            <p className="text-[16px] text-slate-800">{address}</p>
          </section>
        )}

        {items.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-2">
              What is being done
            </h2>
            <div className="rounded-[16px] border border-slate-200 divide-y divide-slate-100">
              {items.map((i, n) => (
                <div key={n} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <span className="text-[15px] text-slate-800">
                    {i.description}
                    {Number(i.quantity) !== 1 && <span className="text-slate-400"> × {Number(i.quantity)}</span>}
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-slate-900 shrink-0">{money(i.total)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 px-4 py-3 bg-slate-50 rounded-b-[15px]">
                <span className="text-[14px] font-semibold text-slate-600">Estimated</span>
                <span className="text-[16px] font-bold tabular-nums text-slate-900">{money(estimateTotal)}</span>
              </div>
            </div>
            <p className="mt-2 text-[13px] text-slate-400">
              An estimate of the work planned. The invoice is what you pay.
            </p>
          </section>
        )}

        {invoice && (
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-2">Invoice</h2>
            <div className="rounded-[16px] border border-slate-200 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[14px] text-slate-600">{invoice.reference}</span>
                <span className="text-[19px] font-bold tabular-nums text-slate-900">{money(invoice.total)}</span>
              </div>
              <p className="mt-1.5 text-[14.5px] text-slate-600">
                {Number(invoice.outstanding) === 0
                  ? "Paid in full — thank you."
                  : <>
                      {money(invoice.outstanding)} outstanding
                      {invoice.dueOn && `, due ${new Date(invoice.dueOn).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`}.
                      {" "}The invoice we emailed has the bank details on it.
                    </>}
              </p>
            </div>
          </section>
        )}

        {/* Last, because it is the fallback — but always there, because the one
            thing worse than not knowing is not being able to ask. */}
        <section className="pt-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-2">
            Need to change something?
          </h2>
          <div className="flex flex-wrap gap-2">
            {business.phone && (
              <a href={`tel:${business.phone.replace(/\s+/g, "")}`}
                className="rounded-[14px] px-5 py-3 text-[15px] font-semibold text-white"
                style={{ background: brand }}>
                Call {business.name}
              </a>
            )}
            {business.whatsappNumber && (
              <a href={`https://wa.me/${business.whatsappNumber.replace(/\D/g, "").replace(/^0/, "44")}`}
                target="_blank" rel="noreferrer"
                className="rounded-[14px] border border-slate-200 px-5 py-3 text-[15px] font-semibold text-slate-800">
                WhatsApp
              </a>
            )}
            {business.email && (
              <a href={`mailto:${business.email}`}
                className="rounded-[14px] border border-slate-200 px-5 py-3 text-[15px] font-semibold text-slate-800">
                Email
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-5 text-[12.5px] text-slate-400">
        This page is private to you. Please do not share the link.
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[560px] px-5">{children}</div>
    </div>
  );
}
