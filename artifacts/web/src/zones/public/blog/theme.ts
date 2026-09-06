// One blog design, three tenants. Everything visual here is derived from the tenant's own
// primaryColor, so AMO Rendering, AMO Services and KD Essex share the layout, the type scale and
// the graphic language while still looking like themselves. Nothing in this file may branch on a
// tenant slug or industry — that is how the shared public UI leaked one client's copy into
// another's site before (see brandCopy / service_base).

export type BlogTheme = ReturnType<typeof blogTheme>;

const FALLBACK_ACCENT = "#1F8CFF";

/** #abc | #aabbcc -> {r,g,b}. Returns null for anything else so callers can fall back. */
function parseHex(hex?: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgba({ r, g, b }: { r: number; g: number; b: number }, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Relative luminance, for deciding whether text on the accent should be white or ink. */
function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function shift({ r, g, b }: { r: number; g: number; b: number }, amount: number) {
  const mix = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  return `#${[mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Tokens for the whole blog surface. Pass the tenant's settings row; primaryColor drives the
 * accent and everything tinted from it, and the neutrals carry a faint bias toward that accent so
 * the greys read as chosen rather than inherited.
 */
export function blogTheme(settings?: any, tenant?: any) {
  const raw = settings?.primaryColor || tenant?.primaryColor || FALLBACK_ACCENT;
  const rgb = parseHex(raw) || parseHex(FALLBACK_ACCENT)!;
  const accent = parseHex(raw) ? raw : FALLBACK_ACCENT;
  const onAccent = luminance(rgb) > 0.55 ? "#12181F" : "#FFFFFF";

  return {
    accent,
    accentRgb: rgb,
    accentDeep: shift(rgb, -0.28),
    accentSoft: rgba(rgb, 0.08),
    accentEdge: rgba(rgb, 0.22),
    onAccent,
    ink: "#111821",
    body: "#48545F",
    muted: "#77828C",
    line: "#E3E8ED",
    lineSoft: "#EFF2F5",
    surface: "#FFFFFF",
    ground: "#F6F8FA",
  };
}

/**
 * The house graphic. Four motifs from one family — every card and every article header without a
 * photograph gets one, picked deterministically from the post's own id so it never reshuffles
 * between renders or between SSR and hydration. Rendered as an inline data URI: no network
 * request, no broken-image state, and it recolours itself per tenant for free.
 */
export function blogPattern(theme: BlogTheme, seed: number): string {
  const stroke = rgba(theme.accentRgb, 0.34);
  const strokeSoft = rgba(theme.accentRgb, 0.16);
  const fill = rgba(theme.accentRgb, 0.05);
  const i = Math.abs(Math.trunc(seed)) % 4;

  // Each motif tiles seamlessly at 80x80 so cards of any size stay even.
  const motifs = [
    // Courses — offset blockwork, for anything built up in layers.
    `<rect width="80" height="80" fill="${fill}"/>
     <g stroke="${stroke}" stroke-width="1.4" fill="none">
       <path d="M0 20h80M0 40h80M0 60h80"/>
       <path d="M20 0v20M60 0v20M0 20v20M40 20v20M80 20v20M20 40v20M60 40v20M0 60v20M40 60v20M80 60v20"/>
     </g>`,
    // Arcs — overlapping scallops, the softest of the four.
    `<rect width="80" height="80" fill="${fill}"/>
     <g stroke="${stroke}" stroke-width="1.4" fill="none">
       <path d="M0 40a40 40 0 0140-40 40 40 0 0140 40"/>
       <path d="M0 80a40 40 0 0140-40 40 40 0 0140 40"/>
       <path d="M-40 40a40 40 0 0140-40M40 0a40 40 0 0140 40"/>
     </g>`,
    // Weave — diagonal hatch, reads as texture at card size.
    `<rect width="80" height="80" fill="${fill}"/>
     <g stroke="${stroke}" stroke-width="1.3" fill="none">
       <path d="M-10 10L10 -10M-10 50L50 -10M-10 90L90 -10M30 90L90 30M70 90L90 70"/>
     </g>
     <g stroke="${strokeSoft}" stroke-width="1.3" fill="none">
       <path d="M-10 70L70 -10M-10 30L30 -10M10 90L90 10M50 90L90 50"/>
     </g>`,
    // Grid — measured dots on a rule, the most technical of the set.
    `<rect width="80" height="80" fill="${fill}"/>
     <g stroke="${strokeSoft}" stroke-width="1.2" fill="none"><path d="M0 40h80M40 0v80"/></g>
     <g fill="${stroke}">
       <circle cx="40" cy="40" r="3"/><circle cx="0" cy="0" r="2"/><circle cx="80" cy="0" r="2"/>
       <circle cx="0" cy="80" r="2"/><circle cx="80" cy="80" r="2"/>
     </g>`,
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">${motifs[i]}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Stable positive integer from a slug, so a post's motif survives a re-seed that changes its id. */
export function seedFrom(value: string | number | undefined | null): number {
  if (typeof value === "number") return value;
  const s = String(value ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
