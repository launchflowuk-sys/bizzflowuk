/**
 * Turn the BizzFlowUK handoff stylesheets into one route-scoped stylesheet.
 *
 *   node scripts/bizzflow/scope-reference-css.cjs <repoRoot> <referenceDir>
 *
 * The handoff's reference/style.css and reference/demo.css are the design's
 * source of truth, and they style bare `body`, `html`, `*`, `h1`, `button`,
 * `table` and `a`. Dropped into this app as-is they would repaint the
 * dashboard, the admin console and every tenant's public site. This prefixes
 * every selector so none of it can reach anything but the two new routes.
 *
 * Regenerate rather than hand-editing the output: a fix typed into the
 * generated file is silently lost the next time this runs.
 */
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
const REF = process.argv[3];
if (!ROOT || !REF) { console.error('usage: <repoRoot> <referenceDir>'); process.exit(1); }
const postcss = require(path.join(ROOT, 'node_modules/.pnpm/postcss@8.5.14/node_modules/postcss'));

/**
 * The reference served assets from the web root; ours live under /bizzflow/.
 *
 * Two CSS backgrounds carry the photograph — the marketing page's mini browser
 * and the demo's website preview. The implementation guide names both because
 * they are the easy ones to miss: neither is an <img>, so a missed rewrite
 * renders an empty tinted box instead of a broken-image icon, and nothing errors.
 */
const ASSET_URLS = [
  [/url\((['"]?)\/trades\.jpg\1\)/g, "url('/bizzflow/images/trades-owners.jpg')"],
  [/url\((['"]?)\/logo\.png\1\)/g, "url('/bizzflow/brand/bizzflowuk-symbol-transparent.png')"],
];
const rewriteAssets = css => ASSET_URLS.reduce((acc, [re, to]) => acc.replace(re, to), css);

/**
 * Prefix every selector with `wrapper`.
 *
 * Parsed rather than regexed: minified CSS carries commas inside :is(), :not()
 * and attribute selectors, and splitting a selector list on "," corrupts those
 * without raising anything.
 */
function scope(css, wrapper, ancestors = {}) {
  const root = postcss.parse(css);
  root.walkAtRules(at => { if (at.name === 'import') at.remove(); });

  root.walkRules(rule => {
    // Children of @keyframes are percentages and from/to, never selectors.
    for (let p = rule.parent; p; p = p.parent) {
      if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
    }
    rule.selectors = rule.selectors.map(sel => {
      const s = sel.trim();
      // Document-level rules become the wrapper itself: it is the page ground
      // on these routes and the scope the custom properties live in.
      if (s === ':root' || s === 'html' || s === 'body') return wrapper;
      if (s === '*') return `${wrapper}, ${wrapper} *`;
      if (s.startsWith(wrapper)) return s;

      /**
       * Classes the reference put on <html> or <body>.
       *
       * These sit ABOVE everything in the page, so naively prefixing them gives
       * `.bf .js .reveal` — a descendant selector that can never match once
       * `.js` is no longer an ancestor of the wrapper. Nothing errors; the rule
       * simply never applies and the whole scroll-reveal animation quietly
       * stops existing. Map them onto the wrapper itself as a compound
       * selector instead: `.bf.bf-js .reveal`.
       */
      for (const [cls, marker] of Object.entries(ancestors)) {
        if (s === cls) return wrapper + (marker || '');
        if (s.startsWith(cls + ' ')) {
          return wrapper + (marker || '') + ' ' + s.slice(cls.length + 1);
        }
      }
      return `${wrapper} ${s}`;
    });
  });
  return root.toString();
}

const style = rewriteAssets(fs.readFileSync(path.join(REF, 'style.css'), 'utf8'));
const demo = rewriteAssets(fs.readFileSync(path.join(REF, 'demo.css'), 'utf8'));

const header = `/* =============================================================================
 * BizzFlowUK reference design — GENERATED, do not hand-edit.
 *
 * Source of truth: the handoff package's reference/style.css and
 * reference/demo.css, reproduced rule for rule with every selector prefixed.
 * Regenerate with scripts/bizzflow/scope-reference-css.cjs; a fix typed in here
 * disappears the next time that runs.
 *
 * Scoping applied:
 *   :root / html / body  ->  the wrapper itself (tokens and page ground)
 *   *                    ->  the wrapper and its descendants only
 *   everything else      ->  a descendant of the wrapper
 *
 * .bf       shared styles — both the marketing page and the demo load these
 * .bf-demo  the workspace demo only
 *
 * Why this matters here: the reference styles bare body, h1, button, table and
 * a. Unscoped, it would repaint the dashboard, the admin console and every
 * tenant's public site.
 *
 * The reference pulled DM Sans from Google Fonts. It is self-hosted instead, so
 * the page makes no third-party request and cannot be left unstyled by someone
 * else's outage. Licence: public/bizzflow/fonts/OFL.txt
 * ========================================================================== */

@font-face {
  font-family: 'DM Sans';
  src: url('/bizzflow/fonts/DMSans-Variable.ttf') format('truetype');
  font-style: normal;
  font-weight: 100 1000;
  font-display: swap;
}

/* The reference set these on <html>, which no wrapper class can reach. The
   route adds this class to the document element and removes it on unmount, so
   smooth anchor scrolling exists on these two routes and nowhere else. */
html.bf-scroll { scroll-behavior: smooth; scroll-padding-top: 100px; }
@media (prefers-reduced-motion: reduce) { html.bf-scroll { scroll-behavior: auto; } }

`;

const out = header
  + '/* ---------- reference/style.css, scoped to .bf ---------- */\n'
  + scope(style, '.bf', { '.js': '.bf-js' }) + '\n\n'
  + '/* ---------- reference/demo.css, scoped to .bf-demo ---------- */\n'
  + scope(demo, '.bf-demo', { '.demo-body': null }) + '\n';

const dest = path.join(ROOT, 'artifacts/web/src/zones/public/bizzflow/bizzflow.css');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);

// Gates. A silent miss here is a repainted dashboard or an invisible photo.
const leaks = [];
postcss.parse(out).walkRules(r => {
  for (let p = r.parent; p; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
  }
  r.selectors.forEach(s => { if (!s.trim().startsWith('.bf')) leaks.push(s.trim()); });
});
const escaping = leaks.filter(s => !s.startsWith('html.bf-scroll'));
const stale = out.match(/url\((['"]?)\/(trades\.jpg|logo\.png)\1\)/g) || [];
// An ancestor class left as a descendant matches nothing, in silence.
const unmatchable = out.match(/\.bf \.js\b|\.bf-demo \.demo-body\b/g) || [];
const revealRules = (out.match(/\.bf\.bf-js \.reveal/g) || []).length;
const photos = (out.match(/bizzflow\/images\/trades-owners\.jpg/g) || []).length;

console.log(`written ${dest} (${(out.length / 1024).toFixed(1)}KB)`);
console.log(`selectors escaping .bf: ${escaping.length}`);
console.log(`stale reference asset paths: ${stale.length}`);
console.log(`photo backgrounds rewritten: ${photos} (expect 2)`);
console.log(`unmatchable ancestor selectors: ${unmatchable.length}`);
console.log(`reveal rules bound to the wrapper: ${revealRules} (expect 3)`);
if (escaping.length || stale.length || photos !== 2 || unmatchable.length || revealRules !== 3) {
  console.error('FAILED — refusing to leave a broken stylesheet behind');
  process.exit(1);
}
console.log('OK');
