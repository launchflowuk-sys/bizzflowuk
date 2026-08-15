import type { FaqItem } from "./content";
import { INK, MUTED, TEXT } from "./theme";

/**
 * Built on native <details>/<summary> rather than state.
 *
 * The public site is server rendered, so the answers are in the HTML on first paint — they're
 * readable and openable before any JavaScript arrives, and Google sees the text rather than an
 * empty shell. Keyboard operation and the expanded/collapsed announcement come from the browser.
 */
export default function FaqAccordion({ items, accent }: { items: FaqItem[]; accent: string }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-5 py-14">
      <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>Questions people ask us first</h2>
      <p className="mt-2 text-base leading-relaxed" style={{ color: MUTED }}>
        If yours isn't here, ring and ask. We'd rather answer it now than have you wondering.
      </p>

      <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
        {items.map(item => (
          <details key={item.question} className="group py-1">
            <summary
              className="flex cursor-pointer list-none items-start justify-between gap-5 py-4 text-base font-bold marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: INK, outlineColor: accent }}
            >
              <span>{item.question}</span>
              <svg
                className="mt-1 h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-45"
                viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.2} aria-hidden="true"
              >
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="pb-5 pr-10 text-[15px] leading-relaxed" style={{ color: TEXT }}>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
