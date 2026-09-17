import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FileText, Send, Hammer, ArrowRight } from "lucide-react";
import { api, useApi, money, INVOICE_STATUS_LABEL } from "./tradeApi";

interface QuoteInvoiceCardProps {
  quoteId: number;
  quoteStatus: string;
}

type When = "now" | "on_completion";

/**
 * "Invoice the customer" on a quote.
 *
 * Plenty of trades never take a card payment up front: they finish the job and
 * send an invoice. This card turns the quote into an invoice and asks one
 * question — send it now, or when the job is marked complete. The second waits
 * as a draft; completing the job releases it, sent automatically or left for
 * the business to send, per the switch in Settings → Invoices & payments.
 */
export default function QuoteInvoiceCard({ quoteId, quoteStatus }: QuoteInvoiceCardProps) {
  const [, navigate] = useLocation();
  const invoices = useApi<any[]>("/invoices");
  const settings = useApi<any>("/settings");
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState<When | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);

  if (quoteStatus === "Rejected") return null;

  const existing = (invoices.data ?? []).find(i => i.quoteId === quoteId && i.status !== "void");
  const autoSend = settings.data?.autoSendInvoiceOnCompletion ?? true;

  async function raise(when: When) {
    setBusy(when);
    setProblems(null);
    try {
      const inv = await api.post<any>(`/quotes/${quoteId}/convert-invoice`, { when });
      if (when === "now" && inv.sent === false) {
        // Raised, but something stops it going. Show why; the invoice is saved.
        setProblems(inv.sendProblems ?? ["The invoice could not be sent."]);
        invoices.reload();
        return;
      }
      navigate(`/dashboard/invoices/${inv.id}`);
    } catch (e: any) {
      setProblems(e.problems ?? [e.message]);
    } finally {
      setBusy(null);
    }
  }

  if (existing) {
    const waiting = existing.status === "draft" && existing.sendOnCompletion;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Invoice</h2>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-slate-900">{existing.reference}</div>
            <div className="text-xs text-slate-500">
              {waiting ? "Waiting for the job to be completed" : (INVOICE_STATUS_LABEL[existing.status] ?? existing.status)}
              {" · "}{money(existing.total)}
            </div>
          </div>
          <Link href={`/dashboard/invoices/${existing.id}`} className="shrink-0 text-sm font-semibold text-[var(--brand-ink)] hover:underline">
            Open
          </Link>
        </div>
        {problems && <ProblemList problems={problems} invoiceId={existing.id} />}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--brand)]/30 bg-white p-4 sm:p-5 space-y-3 shadow-sm">
      <div>
        <h2 className="font-semibold text-slate-900">Invoice the customer</h2>
        <p className="text-xs text-slate-500 mt-1">Turns this quote into an invoice. Every line is copied across.</p>
      </div>

      {!choosing ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          disabled={invoices.loading}
          className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-[15px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> Invoice the customer
        </button>
      ) : (
        <div className="space-y-2" role="group" aria-label="When should the invoice go?">
          <p className="text-sm font-medium text-slate-700">When should it go?</p>
          <button
            type="button"
            onClick={() => raise("now")}
            disabled={busy !== null}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] disabled:opacity-50"
          >
            <Send className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-ink)]" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{busy === "now" ? "Sending…" : "Send it now"}</span>
              <span className="block text-xs text-slate-500">Emailed to the customer straight away.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => raise("on_completion")}
            disabled={busy !== null}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] disabled:opacity-50"
          >
            <Hammer className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-ink)]" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{busy === "on_completion" ? "Saving…" : "When the job is complete"}</span>
              <span className="block text-xs text-slate-500">
                {autoSend
                  ? "Saved now, sent automatically the moment you mark the job complete."
                  : "Saved now, ready for you to send once the job is complete."}
              </span>
            </span>
          </button>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Link href="/dashboard/settings?tab=money" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-ink)] hover:underline">
              Automatic sending is {autoSend ? "on" : "off"} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => { setChoosing(false); setProblems(null); }} className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}
      {problems && <ProblemList problems={problems} />}
    </div>
  );
}

function ProblemList({ problems, invoiceId }: { problems: string[]; invoiceId?: number }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1" role="alert">
      <p className="font-semibold">The invoice is saved but hasn't been sent:</p>
      <ul className="list-disc pl-4">{problems.map(p => <li key={p}>{p}</li>)}</ul>
      {invoiceId && (
        <Link href={`/dashboard/invoices/${invoiceId}`} className="inline-block font-semibold underline">Fix it on the invoice</Link>
      )}
    </div>
  );
}
