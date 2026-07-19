import { db } from "@workspace/db";
import { pageRenderCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Wipes every cached rendered page for a tenant — called after any public-content save so the
 * next visit to an affected page re-renders instead of serving stale content. Deliberately
 * coarse (clears everything for the tenant, not just the one page that changed) rather than
 * per-route surgical invalidation: missing one of the many content-mutation call sites would
 * silently leave stale content live indefinitely, whereas over-clearing just costs one extra
 * render for the next visitor to each affected page.
 */
export async function invalidateTenantPageCache(tenantId: number): Promise<void> {
  await db.delete(pageRenderCacheTable).where(eq(pageRenderCacheTable.tenantId, tenantId));
}

/**
 * Wipes the entire page-render cache — called once at server boot. Cached HTML embeds the
 * hashed JS/CSS bundle URLs and markup of the deploy that rendered it, so after any redeploy
 * every cached page is potentially stale (and its bundle references dead). Re-rendering on
 * first visit is cheap; serving a page wired to deleted assets is a broken site.
 */
export async function clearAllPageCache(): Promise<void> {
  await db.delete(pageRenderCacheTable);
}
