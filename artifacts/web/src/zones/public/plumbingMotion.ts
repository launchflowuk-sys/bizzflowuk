/**
 * Plumbing template motion — scroll reveals for the BizzFlow stack (Vite + React, no Next).
 *
 * Port of the supplied MotionEnhancements.tsx with the Next-only bits removed
 * ('use client' does nothing here) and the same data-reveal contract kept, so
 * bps-motion.css layers on top of it unchanged.
 *
 * Progressive enhancement, deliberately: elements render VISIBLE and are only
 * marked pending once we know an observer exists and will un-hide them. If JS
 * fails, is disabled, or the user prefers reduced motion, the page is simply a
 * finished page — nothing is stuck at opacity 0 waiting for an event.
 *
 * Usage, once, in PlumbingSiteApp:
 *     usePlumbingMotion();
 */

import { useEffect } from "react";

/** Sections that reveal on scroll. Matches the supplied spec's selector list. */
const REVEAL_SELECTOR = [
  ".section-heading",
  ".service-card",
  ".personal",
  ".emergency",
  ".review-grid article",
  ".area-links a",
  ".quote-cta .wrap",
  ".bps-rad",
  ".tick-list",
  ".step-card",
  // The rebuilt homepage sections opt in with one class rather than each
  // adding its own selector here, which is how this list got to ten entries.
  ".bps-reveal",
].join(",");

const REVEAL_THRESHOLD = 0.08;
const REVEAL_ROOT_MARGIN = "0px 0px -25px 0px";

/**
 * @param contentKey changes once the tenant's services/areas/reviews have loaded.
 *   Without it the observer scans on mount, finds none of the cards (they render
 *   after the API resolves) and never reveals anything — the page then looks
 *   completely static, which is exactly the bug this parameter exists to fix.
 */
export function usePlumbingMotion(contentKey: number | string = 0): void {
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let observer: IntersectionObserver | null = null;

    /** Clear every pending mark so content is visible with no transition. */
    function revealEverything(): void {
      document
        .querySelectorAll<HTMLElement>('[data-reveal="pending"]')
        .forEach((el) => {
          delete el.dataset.reveal;
        });
    }

    function start(): void {
      if (motionQuery.matches || !("IntersectionObserver" in window)) return;

      observer = new IntersectionObserver(
        (entries) => {
          sawCallback = true;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            el.dataset.reveal = "visible";
            observer?.unobserve(el);
          }
        },
        { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN },
      );

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR),
      );

      for (const el of nodes) {
        const box = el.getBoundingClientRect();
        const alreadyOnScreen = box.top < window.innerHeight && box.bottom > 0;

        // Anything already in the first frame is left alone — hiding it now
        // would blank content the visitor can see, which is worse than no
        // animation at all.
        if (alreadyOnScreen) {
          el.dataset.reveal = "visible";
          continue;
        }

        el.dataset.reveal = "pending";
        observer.observe(el);
      }
    }

    function stop(): void {
      observer?.disconnect();
      observer = null;
      revealEverything();
    }

    /**
     * Safety net. IntersectionObserver exists in every browser we support, but
     * it does not always deliver — some embedded webviews and preview panes
     * never fire the callback, and an element left marked pending is invisible,
     * not merely un-animated. So if nothing has been revealed shortly after
     * setup, drop the animation and show everything.
     *
     * Content must never depend on an API firing.
     */
    let sawCallback = false;
    const failsafe = window.setTimeout(() => {
      if (!sawCallback) {
        observer?.disconnect();
        observer = null;
        revealEverything();
      }
    }, 1200);

    /** If the preference flips mid-visit, honour it immediately. */
    function onPreferenceChange(): void {
      if (motionQuery.matches) stop();
    }

    start();
    motionQuery.addEventListener("change", onPreferenceChange);

    return () => {
      window.clearTimeout(failsafe);
      motionQuery.removeEventListener("change", onPreferenceChange);
      observer?.disconnect();
      observer = null;
    };
  }, [contentKey]);
}

export default usePlumbingMotion;
