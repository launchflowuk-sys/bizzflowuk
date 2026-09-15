import { useEffect, useRef, useState } from "react";

/**
 * Page-level behaviour the reference put in site.js, as cleaned-up React effects.
 *
 * The reference did this by mutating the document directly — adding a class to
 * `<html>`, querying the whole page, writing `style.transform` on a node it
 * found by selector. None of that can stay: it fights React over the DOM, and
 * more importantly a class left on `<html>` outlives the route. That is exactly
 * how a "reveal" rule ends up hiding content on unrelated screens.
 *
 * Everything here is scoped to the route and torn down on unmount.
 */

/** True when the visitor has asked for less motion. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Adds `bf-scroll` to the document element for smooth anchor scrolling, and
 * takes it off again on unmount.
 *
 * `scroll-behavior` and `scroll-padding-top` only work on the scrolling
 * element, which no wrapper class can reach — so this is the one thing that
 * genuinely has to touch `<html>`, and the one thing that therefore has to be
 * cleaned up.
 */
export function useSmoothAnchors() {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("bf-scroll");
    return () => el.classList.remove("bf-scroll");
  }, []);
}

/**
 * The 3px teal progress line across the top of the page.
 *
 * Kept in a ref and written through `requestAnimationFrame` on a passive
 * listener, so scrolling never waits on layout. A ref rather than state on
 * purpose: this changes on every frame of a scroll and re-rendering the whole
 * marketing page that often would be absurd.
 */
export function useScrollMeter() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let queued = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      queued = false;
      const node = ref.current;
      if (!node) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      node.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

/**
 * Scroll reveals.
 *
 * Returns the class to put on the route wrapper. It is empty until the effect
 * has run and an observer is actually watching, and only then becomes `bf-js`
 * — which is the class the stylesheet's `opacity: 0` starting state hangs off.
 *
 * That ordering is the whole point, and it is the bug this project has already
 * shipped once: if the hiding rule is live before anything can reveal it, a
 * browser that never fires the observer — or a preview pane that renders
 * without a real viewport — leaves the page permanently blank. Content is
 * visible by default here, and only opts into being hidden once something
 * exists to bring it back.
 *
 * Reduced motion never opts in at all: everything is simply visible.
 */
export function useScrollReveals(rootRef: React.RefObject<HTMLElement | null>, contentKey?: unknown) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof IntersectionObserver !== "function") return;

    const root = rootRef.current;
    if (!root) return;

    const targets = root.querySelectorAll<HTMLElement>(".reveal");
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }),
      { threshold: 0.09 },
    );
    targets.forEach(el => observer.observe(el));
    setReady(true);

    // Anything already on screen when the observer attaches gets revealed on
    // the first callback, so there is no flash of hidden content.
    return () => {
      observer.disconnect();
      setReady(false);
    };
  }, [rootRef, contentKey]);

  return ready ? "bf-js" : "";
}

/**
 * The document title and meta description for a route.
 *
 * Restores whatever was there before on unmount, so navigating from the
 * marketing page back into the dashboard does not leave the marketing title in
 * the browser tab.
 */
export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = tag?.getAttribute("content") ?? null;
    if (tag) tag.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (tag && previousDescription !== null) tag.setAttribute("content", previousDescription);
    };
  }, [title, description]);
}
