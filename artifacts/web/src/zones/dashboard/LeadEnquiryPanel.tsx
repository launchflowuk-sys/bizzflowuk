import { useMemo } from "react";
import { Mail, MessageCircle, Phone, Paperclip } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { buildLeadView, waNumber } from "./leadFields";

interface LeadEnquiryPanelProps {
  lead: Record<string, any>;
  onEmail: () => void;
}

function initials(first?: string, last?: string): string {
  return `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "?";
}

function received(createdAt?: string): string {
  if (!createdAt) return "";
  const at = new Date(createdAt);
  const stamp = at.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const mins = Math.floor((Date.now() - at.getTime()) / 60_000);
  const ago = mins < 60 ? `${Math.max(mins, 1)} min ago`
    : mins < 1440 ? `${Math.floor(mins / 60)} h ago`
    : `${Math.floor(mins / 1440)} days ago`;
  return `${stamp} · ${ago}`;
}

const action = "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors";

/**
 * The enquiry, the way the customer sent it: who, how to reach them, what they
 * asked for, and only the details they actually gave.
 */
export default function LeadEnquiryPanel({ lead, onEmail }: LeadEnquiryPanelProps) {
  const view = useMemo(() => buildLeadView(lead), [lead]);
  const wa = waNumber(lead.phone);
  const photos: string[] = Array.isArray(lead.photoUrls) ? lead.photoUrls : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-[var(--brand-tint)] px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-lg font-bold text-white">
            {initials(lead.firstName, lead.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{lead.firstName} {lead.lastName}</h1>
              <StatusBadge value={lead.status} />
            </div>
            {lead.companyName && <p className="mt-0.5 text-base font-medium text-slate-700">{lead.companyName}</p>}
            <p className="mt-1 text-sm text-slate-500">
              {received(lead.createdAt)}
              {lead.source && <> · via {lead.source}</>}
              {lead.reference && <> · <span className="font-mono">{lead.reference}</span></>}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className={`${action} bg-[var(--brand)] text-white hover:brightness-110`}>
              <Phone className="h-4 w-4" aria-hidden="true" /> {lead.phone}
            </a>
          )}
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${action} bg-emerald-600 text-white hover:bg-emerald-700`}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
            </a>
          )}
          {lead.email && (
            <button type="button" onClick={onEmail} className={`${action} col-span-2 min-w-0 border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /> <span className="truncate">{lead.email}</span>
            </button>
          )}
          {!lead.phone && !lead.email && <p className="col-span-2 text-sm text-slate-500">No phone or email was given.</p>}
        </div>
      </header>

      <div className="space-y-6 px-5 py-6 sm:px-7">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">What they asked for</h2>
            {view.service && (
              <span className="rounded-full bg-[var(--brand-tint)] px-3 py-1 text-sm font-semibold text-[var(--brand-ink)]">{view.service}</span>
            )}
          </div>
          {view.message ? (
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-5 py-4 text-base leading-relaxed text-slate-800">{view.message}</p>
          ) : (
            <p className="text-sm text-slate-400">They didn't leave a message.</p>
          )}
        </div>

        {view.details.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Details they gave</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {view.details.map(d => (
                <div key={d.label} className={d.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
                  <dt className="text-xs text-slate-500">{d.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[15px] font-medium text-slate-900">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {photos.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Attachments</h2>
            <div className="flex flex-wrap gap-2">
              {photos.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-[var(--brand-ink)] hover:bg-[var(--brand-tint)]">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Attachment {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {view.notes && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{view.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}
