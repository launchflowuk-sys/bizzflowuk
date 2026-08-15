import { useState } from "react";
import { INK, MUTED, TEXT } from "./theme";

export interface BeforeAfterItem {
  id: number;
  title: string;
  location?: string | null;
  propertyType?: string | null;
  serviceType?: string | null;
  beforeImageUrl: string;
  afterImageUrl: string;
  description?: string | null;
}

/**
 * Drag-to-compare before/after.
 *
 * The slider is a real <input type="range"> laid over the images with its track and thumb hidden.
 * Doing it that way means drag, touch, arrow keys, focus ring and screen-reader announcement all
 * come from the platform instead of from pointer-event handling we'd have to get right ourselves —
 * and it degrades to a usable control if the styling ever fails to load.
 */
function Compare({ item, accent }: { item: BeforeAfterItem; accent: string }) {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-t-2xl bg-slate-100">
      <img
        src={item.afterImageUrl}
        alt={`${item.title} after rendering`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/*
        Clipped rather than width-constrained: the image stays at full container size and only its
        visible region changes, so it never squashes as the handle moves and there's no divide-by-
        zero at either end of the track.
      */}
      <img
        src={item.beforeImageUrl}
        alt={`${item.title} before rendering`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />

      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/65 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: accent }}>
        After
      </span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l-4 6 4 6M15 6l4 6-4 6" />
          </svg>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={e => setPos(Number(e.target.value))}
        aria-label={`Compare before and after: ${item.title}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent focus:outline-none [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-ew-resize [&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-10 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"
      />
    </div>
  );
}

/**
 * Renders nothing at all when the tenant has no before/after records.
 *
 * An empty gallery frame reads as a broken page, which is worse than not having a gallery. The
 * section below this one carries the page on its own until real work is uploaded, and this slots in
 * above it the moment it exists.
 */
export default function BeforeAfterGallery({ items, accent }: { items: BeforeAfterItem[]; accent: string }) {
  if (items.length === 0) return null;

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>Work we've finished nearby</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
          Real properties, photographed before we started and after we handed back. Drag the handle
          across any of them.
        </p>

        <div className="mt-8 grid gap-7 md:grid-cols-2">
          {items.map(item => (
            <figure key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Compare item={item} accent={accent} />
              <figcaption className="p-5">
                <h3 className="text-base font-bold" style={{ color: INK }}>{item.title}</h3>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                  {item.serviceType && <span>{item.serviceType}</span>}
                  {item.propertyType && <span>{item.propertyType}</span>}
                  {item.location && <span>{item.location}</span>}
                </div>
                {item.description && (
                  <p className="mt-2.5 text-sm leading-relaxed" style={{ color: TEXT }}>{item.description}</p>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
