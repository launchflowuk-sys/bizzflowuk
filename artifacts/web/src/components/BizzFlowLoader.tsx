import { useEffect, useState } from "react";
import { BIZZFLOW_SYMBOL } from "@/zones/public/bizzflow/BizzFlowBrand";

/**
 * The platform's own loading mark — dashboard, portal and admin.
 *
 * Those zones fell through to a grey generic spinner: the one screen where an
 * unbranded loader is least excusable, because the person looking at it has
 * just signed into BizzFlowUK and is waiting on BizzFlowUK.
 *
 * The treatment is the BPS loader's, dialled down. There, a hot flame on navy
 * says "gas engineer". Here the same idea has to say something much quieter —
 * this screen appears many times a day to someone working, and anything with
 * real presence would become an irritation by the third load.
 *
 * **The light is on the BACKDROP, not on the symbol.** The brand pack is
 * explicit that the symbol must not be cropped, flattened, recoloured, tiled,
 * stretched or given a glow — so there is no filter, no drop-shadow and no
 * blend mode on the mark itself. `.bf-loader-aura` is a separate element
 * behind it. Visually it reads as the same warmth; technically the symbol is
 * untouched, which is what the rule actually protects.
 */
export function BizzFlowLoader() {
  // A loader that appears for 80ms is a flash, not feedback. Hold it back so a
  // fast navigation shows nothing rather than a blink.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bf-loader-screen flex h-screen items-center justify-center">
      <div className="bf-loader" data-shown={shown ? "true" : "false"} role="img" aria-label="Loading">
        <span className="bf-loader-aura" aria-hidden="true" />
        <img src={BIZZFLOW_SYMBOL} alt="" className="bf-loader-mark" />
      </div>
    </div>
  );
}
