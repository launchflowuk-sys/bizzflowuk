import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicesTable, areasTable, galleryImagesTable, beforeAfterTable,
  reviewsTable, caseStudiesTable, faqsTable, teamMembersTable, tenantSettingsTable, tenantsTable, priceItemsTable
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { maskSecretsForAuth } from "../lib/settingsHelpers";
import { sanitizeUpdate, coerceTableTimestamps } from "../lib/sanitizeUpdate";
import { invalidateTenantPageCache } from "../lib/pageCache";
import { syncGoogleReviews } from "../lib/reviews/googleSync";

const router = Router();
function tid(req: any) { return req.authUser?.tenantId!; }

// Helper: generic CRUD factory
function crud<T>(table: any, routePrefix: string, extraInsert?: (req: any) => object) {
  router.get(`/${routePrefix}`, requireTenantAccess, async (req, res) => {
    try {
      const rows = await db.select().from(table).where(eq(table.tenantId, tid(req)));
      res.json(rows);
    } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
  });
  router.post(`/${routePrefix}`, requireTenantAccess, async (req, res) => {
    try {
      const row = await db.insert(table).values({ ...coerceTableTimestamps(table, req.body), tenantId: tid(req), ...(extraInsert ? extraInsert(req) : {}) }).returning() as any[];
      res.status(201).json(row[0]);
      invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
    } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
  });
  router.get(`/${routePrefix}/:id`, requireTenantAccess, async (req, res) => {
    try {
      const row = await db.select().from(table).where(and(eq(table.id, Number(req.params.id)), eq(table.tenantId, tid(req)))).limit(1);
      if (!row.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json(row[0]);
    } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
  });
  router.patch(`/${routePrefix}/:id`, requireTenantAccess, async (req, res) => {
    try {
      // coerceTableTimestamps: these endpoints return a whole row and take the
      // whole row back, so any timestamp on the table arrives as a string.
      const row = await db.update(table).set(coerceTableTimestamps(table, sanitizeUpdate(req.body))).where(and(eq(table.id, Number(req.params.id)), eq(table.tenantId, tid(req)))).returning();
      if (!row.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json(row[0]);
      invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
    } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
  });
  router.delete(`/${routePrefix}/:id`, requireTenantAccess, async (req, res) => {
    try {
      await db.delete(table).where(and(eq(table.id, Number(req.params.id)), eq(table.tenantId, tid(req))));
      res.status(204).send();
      invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
    } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
  });
}

crud(servicesTable, "services");
crud(areasTable, "areas");
crud(galleryImagesTable, "gallery");
crud(beforeAfterTable, "before-after");
crud(reviewsTable, "reviews");
crud(caseStudiesTable, "case-studies");
crud(faqsTable, "faqs");
crud(teamMembersTable, "team");
crud(priceItemsTable, "price-items");

// Settings — single record per tenant (also reads/writes customDomain from tenants table)
router.get("/settings", requireTenantAccess, async (req, res) => {
  try {
    const [tenantRows, settingsRows] = await Promise.all([
      db.select({ customDomain: tenantsTable.customDomain }).from(tenantsTable).where(eq(tenantsTable.id, tid(req))).limit(1),
      db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tid(req))).limit(1),
    ]);
    let settings = settingsRows[0];
    if (!settings) {
      const newSettings = await db.insert(tenantSettingsTable).values({ tenantId: tid(req) }).returning();
      settings = newSettings[0];
    }
    res.json({ ...maskSecretsForAuth(settings), customDomain: tenantRows[0]?.customDomain ?? null });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/settings", requireTenantAccess, async (req, res) => {
  try {
    const body = req.body as any;
    // Strip out blank password/token fields so they don't overwrite stored values.
    // maskSecretsForAuth returns "" for a secret that IS set, so the settings
    // form posts "" straight back on every save that did not retype it — without
    // this, opening settings and pressing Save would silently wipe the tenant's
    // ability to take payments or send email.
    if (!body.smtpPass) delete body.smtpPass;
    if (!body.twilioAuthToken) delete body.twilioAuthToken;
    if (!body.squareAccessToken) delete body.squareAccessToken;
    if (!body.stripeSecretKey) delete body.stripeSecretKey;
    if (!body.stripeWebhookSecret) delete body.stripeWebhookSecret;

    /**
     * Fields the SERVER owns. The form must never write them back.
     *
     * This is what broke Save Settings with a 500: `GET /settings` returns the
     * whole row, the form holds all of it in state, and Save posts all of it
     * back. `googleReviewsSyncedAt` is a timestamp column, so it arrives as an
     * ISO *string* and drizzle throws "value.toISOString is not a function"
     * deep inside PgTimestamp.mapToDriverValue, with nothing in the response to
     * explain it.
     *
     * It only started failing when the Google review sync began working — until
     * then the column was NULL, and null round-trips harmlessly. A latent bug
     * that fires the day an unrelated feature starts writing a column.
     *
     * Stripped rather than coerced: the rating, the review count and the sync
     * time are the sync's output. Letting a settings form overwrite them would
     * be wrong even if the types lined up.
     */
    for (const field of ["googleRating", "googleReviewCount", "googleReviewsSyncedAt"]) {
      delete body[field];
    }

    // customDomain lives on tenantsTable — split it out
    const { customDomain, ...rest } = body;
    /**
     * Belt and braces: coerce any remaining timestamp-shaped field.
     *
     * The strip above fixes the column we know about. This stops the NEXT
     * timestamp added to tenant_settings reintroducing exactly the same 500,
     * because the failure mode is silent until someone presses Save.
     */
    const settingsBody = coerceTableTimestamps(tenantSettingsTable, sanitizeUpdate(rest));
    if (customDomain !== undefined) {
      await db.update(tenantsTable).set({ customDomain: customDomain || null }).where(eq(tenantsTable.id, tid(req)));
    }

    const existing = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tid(req))).limit(1);
    let updated;
    if (!existing.length) {
      updated = (await db.insert(tenantSettingsTable).values({ ...settingsBody, tenantId: tid(req) }).returning())[0];
    } else {
      updated = (await db.update(tenantSettingsTable).set(settingsBody).where(eq(tenantSettingsTable.tenantId, tid(req))).returning())[0];
    }
    const tenantRows = await db.select({ customDomain: tenantsTable.customDomain }).from(tenantsTable).where(eq(tenantsTable.id, tid(req))).limit(1);
    res.json({ ...maskSecretsForAuth(updated), customDomain: tenantRows[0]?.customDomain ?? null });
    invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});


/**
 * Pull this business's Google reviews now, rather than waiting for the daily
 * sweep. Useful right after pasting a Place ID, when nobody wants to be told
 * to come back tomorrow.
 */
router.post("/reviews/sync-google", requireTenantAccess, async (req: any, res) => {
  try {
    const result = await syncGoogleReviews(tid(req));
    if (!result.ok) { res.status(400).json({ error: result.reason }); return; }
    res.json(result);
  } catch (err) {
    req.log.error(err, "Manual Google review sync failed");
    res.status(502).json({ error: "Could not reach Google just now. Please try again." });
  }
});

export default router;
