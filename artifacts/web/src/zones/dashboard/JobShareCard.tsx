import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "./tradeApi";

/**
 * The QR a customer scans off their job sheet.
 *
 * It opens one job and nothing else: when you are coming, who is coming, what
 * is being done, and what is owed. No login — the token IS the credential, the
 * same as the payment link — because the moment it asks a customer to make an
 * account they ring instead, and the point of the thing is gone.
 *
 * The sheet is printed from here: the QR, the job, the address and the date on
 * one page a van printer or an office printer can both handle. `window.print()`
 * against a print stylesheet rather than a PDF library — nothing to download,
 * nothing to install, and it prints from a phone as readily as a laptop.
 *
 * Data URL and <img>, never `QRCode.toCanvas`: toCanvas writes style.width
 * onto the element AFTER React renders, which is exactly how the booking QR
 * ended up a 1024px square that dwarfed the page.
 */

/** Print resolution for the downloaded and printed file. Never the on-screen size. */
const PRINT_SIZE = 1024;

export default function JobShareCard({ projectId, job }: { projectId: number; job: any }) {
  // Seeded from the job itself, so reopening the page shows the link that
  // already exists instead of offering to create one that is already printed.
  const [url, setUrl] = useState<string | null>(
    job?.shareToken && !job?.shareRevokedAt ? `${window.location.origin}/j/${job.shareToken}` : null,
  );
  const [png, setPng] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!url) { setPng(null); return; }
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: PRINT_SIZE,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#102333", light: "#ffffff" },
    })
      .then(d => { if (!cancelled) setPng(d); })
      .catch(() => { if (!cancelled) setPng(null); });
    return () => { cancelled = true; };
  }, [url]);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const res = await api.post<{ url: string }>(`/projects/${projectId}/share`);
      setUrl(res.url);
    } catch (e: any) { setErr(e?.message || "Could not create the link."); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!confirm("Turn this link off? Anyone holding it — including a printed job sheet already with the customer — will stop being able to open the job.")) return;
    setBusy(true); setErr(null);
    try { await api.del(`/projects/${projectId}/share`); setUrl(null); }
    catch (e: any) { setErr(e?.message || "Could not turn the link off."); }
    finally { setBusy(false); }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Could not copy automatically — the link is shown above.");
    }
  }

  function download() {
    if (!png) return;
    const a = document.createElement("a");
    a.href = png;
    a.download = `job-${projectId}-qr.png`;
    a.click();
  }

  const address = [job?.address, job?.city, job?.postcode].filter(Boolean).join(", ");
  const when = job?.scheduledStart
    ? new Date(job.scheduledStart).toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    })
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 print:border-0">
      <div className="print:hidden">
        <h2 className="font-semibold text-slate-900">Share with the customer</h2>
        <p className="text-xs text-slate-500 mt-1">
          A page showing this job only — when you are coming, who is coming and what is owed.
          No login, so anyone with the link can see it.
        </p>
      </div>

      {!url ? (
        <div className="print:hidden">
          <button type="button" onClick={create} disabled={busy}
            className="w-full rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
            {busy ? "Creating…" : "Create the link and QR"}
          </button>
          {err && <p className="mt-2 text-xs text-amber-700">{err}</p>}
        </div>
      ) : (
        <>
          {/* The printable sheet. Everything else on the page is hidden by the
              print rules below, so this is what comes out of the printer. */}
          <div className="job-sheet text-center">
            {png && (
              <img src={png} alt="QR code linking to this job"
                className="mx-auto w-[172px] h-[172px] print:w-[260px] print:h-[260px]" />
            )}
            <p className="mt-2 text-sm font-semibold text-slate-900">{job?.title}</p>
            {when && <p className="text-xs text-slate-600">{when}</p>}
            {address && <p className="text-xs text-slate-600">{address}</p>}
            <p className="mt-2 text-[11px] text-slate-400 break-all print:text-[10px]">{url}</p>
            <p className="hidden print:block mt-3 text-[11px] text-slate-500">
              Scan this to see when we are coming and what is being done.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={copy}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" onClick={() => window.print()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Print job sheet
            </button>
            <button type="button" onClick={download} disabled={!png}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Download QR
            </button>
            <button type="button" onClick={revoke} disabled={busy}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:text-red-600">
              Turn off
            </button>
          </div>
          {err && <p className="text-xs text-amber-700 print:hidden">{err}</p>}
        </>
      )}

      {/*
        Print rules, scoped to this component rather than the app's stylesheet.

        `visibility` rather than `display: none` on the ancestors: hiding them
        outright collapses the layout the sheet is positioned inside, and the
        page comes out with the QR halfway down the second sheet.
      */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .job-sheet, .job-sheet * { visibility: visible; }
          .job-sheet {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 24px 0;
          }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
