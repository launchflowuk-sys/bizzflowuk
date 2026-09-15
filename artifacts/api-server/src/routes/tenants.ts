import { Router } from "express";
import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, leadsTable, projectsTable, reviewsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";
import { sanitizeUpdate } from "../lib/sanitizeUpdate";
import { invalidateTenantPageCache } from "../lib/pageCache";

const router = Router();

router.get("/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
    res.json(tenants);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await db.insert(tenantsTable).values(req.body).returning();
    await db.insert(tenantSettingsTable).values({ tenantId: tenant[0].id }).onConflictDoNothing();
    res.status(201).json(tenant[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const t = await db.select().from(tenantsTable).where(eq(tenantsTable.id, Number(req.params.id))).limit(1);
    if (!t.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(t[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const t = await db.update(tenantsTable).set(sanitizeUpdate(req.body)).where(eq(tenantsTable.id, Number(req.params.id))).returning();
    if (!t.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(t[0]);
    invalidateTenantPageCache(t[0].id).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Settings a platform admin can set on a tenant's behalf.
 *
 * `PATCH /settings` writes `req.authUser.tenantId`, which a SUPER_ADMIN does
 * not have — so onboarding a tenant meant knowing their password, which we do
 * not and should not. This is the way in that does not require one.
 *
 * Explicitly an ALLOWLIST, not `sanitizeUpdate`. Everything here is
 * operational and non-secret. The tenant's Stripe key, Square token, SMTP
 * password and Twilio token live in the same table, and a blocklist-shaped
 * route here would quietly become a way to read or rewrite another business's
 * payment credentials from the platform console. Adding a field is a
 * deliberate act; forgetting to exclude one must not be possible.
 */
const ADMIN_WRITABLE_SETTINGS = ["googlePlaceId", "whatsappNumber"] as const;

/**
 * Read back only those same fields.
 *
 * `GET /tenants/:id` returns the tenants row, and these live in
 * tenant_settings alongside the Stripe key, the Square token, the SMTP
 * password and the Twilio token — so this returns the allowlist explicitly
 * rather than the row.
 */
router.get("/tenants/:id/settings", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    if (!Number.isInteger(tenantId)) { res.status(400).json({ error: "Bad tenant id" }); return; }
    const [row] = await db.select({
      googlePlaceId: tenantSettingsTable.googlePlaceId,
      whatsappNumber: tenantSettingsTable.whatsappNumber,
      googleRating: tenantSettingsTable.googleRating,
      googleReviewCount: tenantSettingsTable.googleReviewCount,
      googleReviewsSyncedAt: tenantSettingsTable.googleReviewsSyncedAt,
    }).from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
    res.json(row ?? { googlePlaceId: null, whatsappNumber: null, googleRating: null, googleReviewCount: null, googleReviewsSyncedAt: null });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/tenants/:id/settings", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    if (!Number.isInteger(tenantId)) { res.status(400).json({ error: "Bad tenant id" }); return; }

    const patch: Record<string, unknown> = {};
    for (const field of ADMIN_WRITABLE_SETTINGS) {
      if (!(field in req.body)) continue;
      const value = req.body[field];
      patch[field] = typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    }
    if (!Object.keys(patch).length) { res.status(400).json({ error: "Nothing to update" }); return; }

    // A tenant created before the settings row existed would otherwise silently
    // update zero rows and report success.
    const [existing] = await db.select({ tenantId: tenantSettingsTable.tenantId })
      .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);

    const [updated] = existing
      ? await db.update(tenantSettingsTable).set(patch).where(eq(tenantSettingsTable.tenantId, tenantId)).returning()
      : await db.insert(tenantSettingsTable).values({ ...patch, tenantId }).returning();

    // Only the fields this route owns go back — never the whole settings row,
    // which carries the secrets above.
    res.json({
      googlePlaceId: updated?.googlePlaceId ?? null,
      whatsappNumber: updated?.whatsappNumber ?? null,
    });
    invalidateTenantPageCache(tenantId).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Pull a tenant's Google reviews now, rather than waiting for the daily sweep.
 *
 * Immediately after setting a Place ID you want to know whether it was the
 * right one. Waiting up to 24 hours to find out it was wrong is how a tenant
 * ends up live with an empty reviews section.
 */
router.post("/tenants/:id/sync-google-reviews", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    if (!Number.isInteger(tenantId)) { res.status(400).json({ error: "Bad tenant id" }); return; }
    const { syncGoogleReviews } = await import("../lib/reviews/googleSync");
    const result = await syncGoogleReviews(tenantId);
    res.json(result);
    if (result.ok) invalidateTenantPageCache(tenantId).catch(() => {});
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ ok: false, reason: err?.message || "Sync failed" });
  }
});

/**
 * Import reviews a tenant already has elsewhere.
 *
 * Google's API returns five reviews and no more, so a business with forty-eight
 * of them shows five. The rest exist, they are just not reachable through any
 * API — and Facebook recommendations have no API worth the name at all. The
 * only honest way to get them onto a tenant's own site is to transcribe them.
 *
 * These rows carry `external_id = NULL`, which matters twice over:
 *   - the partial unique index only covers non-null external ids, so these
 *     never collide with a synced review;
 *   - the Google sync only ever touches rows it created, so an import is never
 *     overwritten by the nightly sweep.
 *
 * Unlike a synced review, an imported one is a SNAPSHOT. If the customer later
 * edits or deletes theirs, this copy does not change. That is a reason to show
 * its original date, not to avoid importing it.
 *
 * Deduplicated on reviewer plus the opening of the text, so running the same
 * paste twice adds nothing and a re-import after an edit is safe.
 */
router.post("/tenants/:id/reviews/import", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    if (!Number.isInteger(tenantId)) { res.status(400).json({ error: "Bad tenant id" }); return; }

    const incoming = Array.isArray(req.body?.reviews) ? req.body.reviews : null;
    if (!incoming) { res.status(400).json({ error: "Expected { reviews: [...] }" }); return; }
    if (incoming.length > 200) { res.status(400).json({ error: "Too many at once — 200 maximum" }); return; }

    const existing = await db.select({
      name: reviewsTable.reviewerName,
      content: reviewsTable.content,
    }).from(reviewsTable).where(eq(reviewsTable.tenantId, tenantId));

    const fingerprint = (name: string, content: string) =>
      `${String(name).trim().toLowerCase()}|${String(content).trim().toLowerCase().slice(0, 60)}`;
    const seen = new Set(existing.map(r => fingerprint(r.name ?? "", r.content ?? "")));

    let inserted = 0, skipped = 0;
    const problems: string[] = [];

    for (const [i, r] of incoming.entries()) {
      const name = typeof r?.reviewerName === "string" ? r.reviewerName.trim() : "";
      const content = typeof r?.content === "string" ? r.content.trim() : "";
      if (!name || !content) { problems.push(`#${i + 1}: needs a reviewerName and content`); continue; }

      const key = fingerprint(name, content);
      if (seen.has(key)) { skipped += 1; continue; }
      seen.add(key);

      const rating = Number(r?.rating);
      const when = r?.sourceCreatedAt ? new Date(r.sourceCreatedAt) : null;

      await db.insert(reviewsTable).values({
        tenantId,
        reviewerName: name,
        content,
        rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : 5,
        platform: typeof r?.platform === "string" && r.platform.trim() ? r.platform.trim() : "Google",
        sourceCreatedAt: when && !Number.isNaN(when.getTime()) ? when : null,
        // Imported reviews are already public where they were written, so
        // hiding them by default would only mean nobody notices the import
        // worked. The owner can unpublish any of them.
        published: true,
      });
      inserted += 1;
    }

    res.json({ inserted, skipped, problems });
    if (inserted) invalidateTenantPageCache(tenantId).catch(() => {});
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err?.message || "Import failed" });
  }
});

router.delete("/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/tenants/:id/suspend", requireSuperAdmin, async (req, res) => {
  try {
    const t = await db.update(tenantsTable).set({ suspended: req.body.suspended }).where(eq(tenantsTable.id, Number(req.params.id))).returning();
    res.json(t[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/tenants/:id/stats", requireSuperAdmin, async (req, res) => {
  try {
    const tid = Number(req.params.id);
    const [leadCount] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.tenantId, tid));
    const [projectCount] = await db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.tenantId, tid));
    res.json({ leads: leadCount.count, projects: projectCount.count });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/platform/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [tenantCount] = await db.select({ count: count() }).from(tenantsTable);
    const [leadCount] = await db.select({ count: count() }).from(leadsTable);
    const [projectCount] = await db.select({ count: count() }).from(projectsTable);
    res.json({ tenants: tenantCount.count, leads: leadCount.count, projects: projectCount.count });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
