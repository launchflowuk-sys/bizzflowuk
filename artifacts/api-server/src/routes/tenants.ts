import { Router } from "express";
import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, leadsTable, projectsTable } from "@workspace/db";
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
