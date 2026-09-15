import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useApi } from "./tradeApi";

/**
 * The QR code that turns a van, a card or a leaflet into an enquiry.
 *
 * A code on the side of a van is the cheapest lead source a trade has: somebody
 * who already likes your work scans it at the moment they are thinking about
 * it, rather than trying to remember a phone number at 9pm. It points at the
 * tenant's own booking page with `?source=qr`, so the enquiry arrives labelled
 * — that label is the entire point, because without it nobody can tell whether
 * the van sticker is earning its keep.
 *
 * **Why a data URL and an <img>, not a canvas.**
 *
 * `QRCode.toCanvas(el, url, { width: 1024 })` does not only set the canvas
 * resolution — it writes `style.width = "1024px"` straight onto the element,
 * after React has rendered. So a React `style` prop capping it at 260px was
 * silently overwritten and the page rendered a 1024px square that dwarfed
 * everything around it. Rendering to a data URL and putting it in an <img>
 * removes the fight entirely: the bitmap stays at print resolution for the
 * download, and CSS alone decides how big it looks.
 */

/** Print resolution for the downloaded file. Never the on-screen size. */
const PRINT_SIZE = 1024;

export default function BookingQrPage() {
  const { data: settings } = useApi<any>("/settings");
  const { data: meData } = useApi<any>("/auth/me");
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const me = meData as any;
  const business = (me?.businesses ?? []).find((b: any) => b.tenantId === me?.tenantId) ?? (me?.businesses ?? [])[0];
  const slug = business?.slug as string | undefined;
  const customDomain = settings?.customDomain as string | undefined;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = slug
    ? (customDomain ? `https://${customDomain}/quote?source=qr` : `${origin}/site/${slug}/quote?source=qr`)
    : null;

  useEffect(() => {
    if (!bookingUrl) return;
    let cancelled = false;
    QRCode.toDataURL(bookingUrl, {
      width: PRINT_SIZE,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: settings?.primaryColor || "#102333", light: "#ffffff" },
    })
      .then(url => { if (!cancelled) setPng(url); })
      .catch(() => { if (!cancelled) setPng(null); });
    return () => { cancelled = true; };
  }, [bookingUrl, settings?.primaryColor]);

  function download() {
    if (!png) return;
    const link = document.createElement("a");
    link.download = `${slug ?? "booking"}-qr.png`;
    link.href = png;
    link.click();
  }

  async function copyLink() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* a blocked clipboard is not worth an error state */ }
  }

  const places = [
    ["On the van", "Rear doors and both sides. People photograph it at traffic lights."],
    ["On your quotes", "Somebody thinking it over can book without digging out your number."],
    ["On a business card", "The card survives the wallet. The phone number never gets typed in."],
    ["On the job", "A neighbour who likes the work you have just done is your cheapest next job."],
  ];

  return (
    <div className="px-5 sm:px-10 pb-16 max-w-[1320px]">
      <div className="ws-heading">
        <div>
          <p className="ws-eyebrow">{business?.name || "Your business"} / Workspace</p>
          <h1>Put your van to work.</h1>
          <p className="ws-sub">
            One code for the van, your cards and your quotes. Every scan lands in your leads,
            labelled so you know it came from the code.
          </p>
        </div>
      </div>

      {!slug && (
        <section className="ws-panel">
          <p style={{ color: "var(--ws-muted)" }}>
            Your website is still being set up. The code will appear here once it is live.
          </p>
        </section>
      )}

      {slug && (
        <div className="qr-layout">
          {/*
            The code is the smallest thing on the page on purpose. It is a
            thing you download and print, not a thing you look at — so it gets
            a thumbnail, and the space goes to what you can DO with it.
          */}
          <section className="ws-panel qr-code-panel">
            <div className="qr-thumb">
              {png
                ? <img src={png} alt="QR code linking to your booking page" width={PRINT_SIZE} height={PRINT_SIZE} />
                : <div className="qr-thumb-empty" aria-hidden="true" />}
            </div>

            <p className="qr-url" title={bookingUrl ?? ""}>{bookingUrl}</p>

            <div className="qr-actions">
              <button type="button" className="ws-btn" onClick={download} disabled={!png}>
                Download for print <span aria-hidden="true">↓</span>
              </button>
              <button type="button" className="ws-panel-link" onClick={copyLink}>
                {copied ? "✓ Link copied" : "Copy link"}
              </button>
            </div>

            <p className="qr-note">
              Downloads at {PRINT_SIZE}px, so it stays sharp on a sticker rather than going
              fuzzy when someone blows it up.
            </p>
          </section>

          <section className="ws-panel">
            <div className="ws-panel-top"><h2>Where to put it</h2></div>
            <ul className="qr-places">
              {places.map(([where, why]) => (
                <li key={where}>
                  <strong>{where}</strong>
                  <span>{why}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ws-panel">
            <div className="ws-panel-top"><h2>How you know it is working</h2></div>
            <p className="qr-body">
              Every enquiry that comes through the code is tagged with a source of{" "}
              <code className="qr-tag">qr</code> in your leads.
            </p>
            <p className="qr-body">
              So you can tell the difference between the work your website brings in and the work
              the van brings in — and whether the sticker was worth the money.
            </p>
            <a className="ws-panel-link" href="/dashboard/leads">See your leads ↗</a>
          </section>
        </div>
      )}
    </div>
  );
}
