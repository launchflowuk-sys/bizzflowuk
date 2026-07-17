import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { db } from "@workspace/db";
import { tenantsTable, pageRenderCacheTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

const INDEX_HTML_PATH = path.join(process.cwd(), "web-public", "index.html");
const SSR_ENTRY_PATH = path.join(process.cwd(), "ssr", "entry-server.js");

type SsrModule = {
  renderPublicPage(opts: { tenantSlug: string; path: string; origin: string; apiBaseUrl: string }): Promise<{ html: string; dehydratedState: unknown }>;
};

let ssrModulePromise: Promise<SsrModule> | null = null;
function loadSsrModule(): Promise<SsrModule> {
  if (!ssrModulePromise) ssrModulePromise = import(SSR_ENTRY_PATH) as Promise<SsrModule>;
  return ssrModulePromise;
}

function injectIntoShell(indexHtml: string, appHtml: string, dehydratedState: unknown): string {
  const serialized = JSON.stringify(dehydratedState).replace(/</g, "\\u003c");
  const stateScript = `<script>window.__DEHYDRATED_STATE__=${serialized}</script>`;
  return indexHtml.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>${stateScript}`);
}

/**
 * GET /public/render/*path
 *
 * Serves a fully rendered public marketing page: a cache hit returns the stored HTML instantly;
 * a miss renders it on the spot (via the pre-built SSR bundle, see entry-server.tsx) and caches
 * the result, so every page is guaranteed real HTML by its second-ever visit. Not yet reachable
 * from real traffic — nginx doesn't route anything here until the Stage 6 cutover — so this is
 * only exercised directly against this route for now.
 */
router.get("/public/render/*path", async (req, res) => {
  try {
    const host = (req.query.host as string) || (req.headers.host as string) || "";
    const tenants = await db
      .select()
      .from(tenantsTable)
      .where(and(eq(tenantsTable.customDomain, host), sql`${tenantsTable.suspended} = false`))
      .limit(1);
    if (!tenants.length) { res.status(404).json({ error: "Domain not found" }); return; }
    const tenant = tenants[0];

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const requestPath = `/${wildcardPath}`;

    const cached = await db
      .select()
      .from(pageRenderCacheTable)
      .where(and(eq(pageRenderCacheTable.tenantId, tenant.id), eq(pageRenderCacheTable.path, requestPath)))
      .limit(1);

    let html: string;
    let dehydratedState: unknown;

    if (cached.length) {
      html = cached[0].html;
      dehydratedState = cached[0].dehydratedState;
    } else {
      const ssrModule = await loadSsrModule();
      const rendered = await ssrModule.renderPublicPage({
        tenantSlug: tenant.slug,
        path: requestPath,
        origin: `https://${tenant.customDomain}`,
        // Points at this same process over loopback rather than the public domain — avoids a
        // render depending on Traefik successfully routing back to itself over the network.
        apiBaseUrl: `http://localhost:${process.env.PORT ?? 8080}`,
      });
      html = rendered.html;
      dehydratedState = rendered.dehydratedState;

      await db
        .insert(pageRenderCacheTable)
        .values({ tenantId: tenant.id, path: requestPath, html, dehydratedState })
        .onConflictDoUpdate({
          target: [pageRenderCacheTable.tenantId, pageRenderCacheTable.path],
          set: { html, dehydratedState, renderedAt: new Date() },
        });
    }

    const indexHtml = fs.readFileSync(INDEX_HTML_PATH, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(injectIntoShell(indexHtml, html, dehydratedState));
  } catch (err) {
    req.log.error({ err }, "Error rendering public page");
    res.status(500).json({ error: "Failed to render page" });
  }
});

export default router;
