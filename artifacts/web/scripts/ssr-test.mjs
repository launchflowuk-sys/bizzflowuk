// Stage 2 proof-of-concept: renders a real public-site page to HTML through Node, using Vite's
// SSR dev API to load entry-server.tsx with the project's normal JSX/alias resolution — no
// separate build step, no wiring into any server or route yet. Talks to the live production API
// (public, read-only GET endpoints) to prefetch real data. Safe to run any time; touches nothing.
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const args = process.argv.slice(2);
const tenantSlug = args[0] || "amo-rendering";
const routePath = args[1] || "/";
const apiBaseUrl = args[2] || "https://amorendering.co.uk";

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: "custom",
  configFile: path.join(root, "vite.config.ts"),
});

try {
  const { renderPublicPage } = await vite.ssrLoadModule("/src/entry-server.tsx");
  const start = Date.now();
  const { html, dehydratedState } = await renderPublicPage({
    tenantSlug,
    path: routePath,
    origin: apiBaseUrl,
    apiBaseUrl,
  });
  const ms = Date.now() - start;

  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
  const jsonLdCount = (html.match(/application\/ld\+json/g) || []).length;

  console.log(`Rendered ${tenantSlug}${routePath} in ${ms}ms\n`);
  console.log("title:      ", titleMatch?.[1] ?? "(none found)");
  console.log("description:", descMatch?.[1]?.slice(0, 100) ?? "(none found)");
  console.log("canonical:  ", canonicalMatch?.[1] ?? "(none found)");
  console.log("JSON-LD blocks:", jsonLdCount);
  console.log("HTML length:", html.length, "chars");
  console.log("dehydrated queries:", (dehydratedState?.queries ?? []).length);
  console.log("\n--- first 800 chars of rendered HTML ---\n");
  console.log(html.slice(0, 800));
} finally {
  await vite.close();
}
