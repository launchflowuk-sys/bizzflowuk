/**
 * The BizzFlowUK mark: supplied symbol plus a live-text wordmark.
 *
 * The PNG is a symbol only — the word "bizzflow" and the raised "UK" are real
 * text, set in DM Sans, so they stay crisp at any size and are readable by a
 * screen reader without alt text doing the work. The handoff is explicit that
 * the symbol must not be cropped, flattened, recoloured, put on a tile, given a
 * glow or stretched, and that the wordmark must never be replaced by a text
 * character standing in for the logo.
 *
 * Sizes live in the scoped stylesheet (`.brand`, `.brand-icon`, `.brand-uk`),
 * including the mobile step-down and the demo sidebar's own values — so this
 * component carries structure, not measurements.
 */

/**
 * Where the symbol lives once installed under the app's public directory.
 *
 * WebP at 256px, not the 1254px PNG it used to be. That PNG was 397KB for a
 * mark drawn at 30x40 in the header and 88px in the loader — Lighthouse put it
 * at 1.9 seconds of the mobile load, and it sat on the critical path of every
 * single page because the loader shows it while the app boots. Same artwork,
 * 8KB.
 */
export const BIZZFLOW_SYMBOL = "/bizzflow/brand/bizzflowuk-symbol.webp";

export function BizzFlowWordmark() {
  return (
    <span>
      bizzflow<span className="brand-uk">UK</span>
    </span>
  );
}

/**
 * `alt=""` is deliberate and required: the symbol sits directly beside the word
 * "bizzflowUK" as live text, so describing it again would make a screen reader
 * announce the brand twice. The accessible name comes from the link's own
 * aria-label where one is needed.
 */
export function BizzFlowSymbol() {
  // Intrinsic size so the header does not reflow as the mark arrives, and
  // eager+high priority because it is in the first thing anybody sees.
  return <img src={BIZZFLOW_SYMBOL} alt="" className="brand-icon" width={30} height={40} fetchPriority="high" />;
}
