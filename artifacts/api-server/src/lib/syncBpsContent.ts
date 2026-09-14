import { db } from "@workspace/db";
import { tenantsTable, servicesTable, areasTable, blogPostsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { BPS_SERVICES, BPS_AREAS } from "./bpsContent";
import { BPS_POSTS } from "./bpsPosts";

/**
 * Brings the BPS tenant up to the migrated site content.
 *
 * The tenant seed only runs when the tenant row is missing, so it cannot reach a
 * tenant already created with the earlier placeholder content. This reconciles
 * instead, and is safe to run on every boot:
 *
 *  - inserts anything missing, keyed on slug
 *  - backfills a row that is still bare (no benefits, no description) but never
 *    overwrites a row someone has edited from the dashboard
 *  - removes only the specific placeholder slugs this code originally created,
 *    listed explicitly rather than "anything not in the new list", so a service
 *    added from the dashboard is never deleted
 */

const SLUG = "bps";

/** Placeholder slugs from the first seed, superseded by the migrated content. */
const RETIRED_SERVICE_SLUGS = ["central-heating", "bathrooms", "emergency-plumbing"];
const RETIRED_AREA_SLUGS = [
  "thurrock", "tilbury", "chafford-hundred",
  "south-ockendon", "corringham", "stanford-le-hope",
];

export async function syncBpsContent(): Promise<void> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);
  if (!tenant) return;
  const tid = tenant.id;

  let added = 0, filled = 0, removed = 0;

  // ── Services ──────────────────────────────────────────────────────────────
  const existingServices = await db.select().from(servicesTable).where(eq(servicesTable.tenantId, tid));
  const serviceBySlug = new Map(existingServices.map(s => [s.slug, s]));

  for (const [i, s] of BPS_SERVICES.entries()) {
    const row = serviceBySlug.get(s.slug);
    if (!row) {
      await db.insert(servicesTable).values({
        tenantId: tid,
        name: s.name,
        slug: s.slug,
        tagline: s.tagline,
        description: s.description,
        content: s.content,
        benefits: s.benefits,
        processSteps: s.processSteps ?? [],
        published: true,
        sortOrder: i + 1,
      });
      added++;
      continue;
    }
    // Only fill a row that never received the richer content.
    const bare = !row.content && (!Array.isArray(row.benefits) || row.benefits.length === 0);
    if (bare) {
      await db.update(servicesTable)
        .set({ tagline: s.tagline, description: s.description, content: s.content, benefits: s.benefits, processSteps: s.processSteps ?? [], sortOrder: i + 1 })
        .where(eq(servicesTable.id, row.id));
      filled++;
    }
  }

  const retiredServices = existingServices.filter(s => RETIRED_SERVICE_SLUGS.includes(s.slug));
  if (retiredServices.length) {
    await db.delete(servicesTable).where(and(
      eq(servicesTable.tenantId, tid),
      inArray(servicesTable.slug, RETIRED_SERVICE_SLUGS),
    ));
    removed += retiredServices.length;
  }

  // ── Areas ─────────────────────────────────────────────────────────────────
  const existingAreas = await db.select().from(areasTable).where(eq(areasTable.tenantId, tid));
  const areaBySlug = new Map(existingAreas.map(a => [a.slug, a]));

  for (const [i, a] of BPS_AREAS.entries()) {
    const row = areaBySlug.get(a.slug);
    if (!row) {
      await db.insert(areasTable).values({
        tenantId: tid, name: a.name, slug: a.slug, county: a.county,
        description: a.description, content: a.content, published: true, sortOrder: i + 1,
      });
      added++;
      continue;
    }
    if (!row.content) {
      await db.update(areasTable)
        .set({ description: row.description || a.description, content: a.content, county: row.county || a.county, sortOrder: i + 1 })
        .where(eq(areasTable.id, row.id));
      filled++;
    }
  }

  const retiredAreas = existingAreas.filter(a => RETIRED_AREA_SLUGS.includes(a.slug));
  if (retiredAreas.length) {
    await db.delete(areasTable).where(and(
      eq(areasTable.tenantId, tid),
      inArray(areasTable.slug, RETIRED_AREA_SLUGS),
    ));
    removed += retiredAreas.length;
  }

  // ── Blog ──────────────────────────────────────────────────────────────────
  // Inserted only where the slug is absent, so an edited or deleted post stays
  // deleted rather than reappearing on the next deploy.
  const existingPosts = await db.select().from(blogPostsTable).where(eq(blogPostsTable.tenantId, tid));
  const postSlugs = new Set(existingPosts.map(p => p.slug));

  const now = Date.now();
  for (const [i, p] of BPS_POSTS.entries()) {
    if (postSlugs.has(p.slug)) continue;
    await db.insert(blogPostsTable).values({
      tenantId: tid,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      published: true,
      // Spread the dates backwards so the index isn't fifteen posts stamped
      // with the same minute, which reads as a dump rather than a blog.
      publishedAt: new Date(now - i * 7 * 24 * 60 * 60 * 1000),
      authorName: tenant.name,
      readTime: p.readTime,
      seoTitle: p.seoTitle ?? p.title,
      seoDescription: p.seoDescription ?? p.excerpt,
    });
    added++;
  }

  if (added || filled || removed) {
    logger.info({ added, filled, removed }, "BPS content synced from the migrated site");
  }
}
