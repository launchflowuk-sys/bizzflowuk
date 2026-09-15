import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useApi } from "./tradeApi";

/**
 * The QR code that turns a van, a card or a leaflet into an enquiry.
 *
 * A code on the side of a van is the cheapest lead source a trade has: somebody
 * who already likes your work scans it at the moment they are thinking about
 * it, rather than trying to remember a phone number at 9pm.
 *
 * It points at the tenant's own booking page, with `?source=qr` so the enquiry
 * arrives labelled. That label is the entire point — without it nobody can tell
 * whether the van sticker is working.
 *
 * Rendered to a canvas at print resolution so the download is usable on
 * something physical, not a 200px screenshot that goes fuzzy on a sticker.
 */

const PRINT_SIZE = 1024;

export default function BookingQrPage() {
  const { data: settings } = useApi<any>("/settings");
  const [me, setMe] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  // The slug lives on the /me payload's business list.
  const { data: meData } = useApi<any>("/auth/me");
  useEffect(() => { if (meData) setMe(meData); }, [meData]);

  const business = (me?.businesses ?? []).find((b: any) => b.tenantId === me?.tenantId) ?? (me?.businesses ?? [])[0];
  const slug = business?.slug as string | undefined;
  const customDomain = settings?.customDomain as string | undefined;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = slug
    ? (customDomain ? `https://${customDomain}/quote?source=qr` : `${origin}/site/${slug}/quote?source=qr`)
    : null;

  useEffect(() => {
    if (!bookingUrl || !canvasRef.current) return;
    let cancelled = false;
    QRCode.toCanvas(canvasRef.current, bookingUrl, {
      width: PRINT_SIZE,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: settings?.primaryColor || "#102333",
        light: "#ffffff",
      },
    })
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; };
  }, [bookingUrl, settings?.primaryColor]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${slug ?? "booking"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="px-5 sm:px-10 pb-16 max-w-[1320px]">
      <div className="ws-heading">
        <div>
          <p className="ws-eyebrow">{business?.name || "Your business"} / Workspace</p>
          <h1>Put your van to work.</h1>
          <p className="ws-sub">
            A code for the van, your cards and your quotes. Every scan lands in your leads, labelled so you
            know it came from the code.
          </p>
        </div>
        <button type="button" className="ws-btn" onClick={download} disabled={!ready}>
          Download for print <span aria-hidden="true">↓</span>
        </button>
      </div>

      {!slug && (
        <section className="ws-panel">
          <p style={{ color: "var(--ws-muted)" }}>Your website is still being set up. The code will appear here once it is live.</p>
        </section>
      )}

      {slug && (
        <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit,minmax(20rem,1fr))" }}>
          <section className="ws-panel" style={{ textAlign: "center" }}>
            <div className="ws-panel-top" style={{ justifyContent: "center" }}><h2>Your code</h2></div>
            {/* Drawn at print resolution and scaled down for display, so the
                downloaded file is sharp on a sticker rather than a blurry
                screen-sized image. */}
            <canvas
              ref={canvasRef}
              style={{ width: "min(260px, 70vw)", height: "auto", borderRadius: "10px" }}
              aria-label="QR code linking to your booking page"
            />
            <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--ws-muted)", wordBreak: "break-all" }}>
              {bookingUrl}
            </p>
          </section>

          <section className="ws-panel">
            <div className="ws-panel-top"><h2>Where to put it</h2></div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "16px" }}>
              {[
                ["On the van", "Rear doors and both sides. People photograph it at traffic lights."],
                ["On your quotes", "A customer thinking it over can book without digging out your number."],
                ["On a business card", "The card survives the wallet; the phone number never gets typed in."],
                ["On the job", "A neighbour who likes the work you have just done is your cheapest next job."],
              ].map(([where, why]) => (
                <li key={where}>
                  <strong style={{ display: "block", fontSize: "15px" }}>{where}</strong>
                  <span style={{ fontSize: "14px", color: "var(--ws-muted)" }}>{why}</span>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: "20px", fontSize: "13.5px", color: "var(--ws-muted)" }}>
              Enquiries from the code show a source of <strong>qr</strong> in your leads, so you can tell
              whether it is earning its keep.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
