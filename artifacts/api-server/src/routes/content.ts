import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicesTable, areasTable, galleryImagesTable, beforeAfterTable,
  reviewsTable, caseStudiesTable, faqsTable, teamMembersTable, tenantSettingsTable, tenantsTable
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { maskSecretsForAuth } from "../lib/settingsHelpers";

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
      const row = await db.insert(table).values({ ...req.body, tenantId: tid(req), ...(extraInsert ? extraInsert(req) : {}) }).returning() as any[];
      res.status(201).json(row[0]);
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
      const row = await db.update(table).set(req.body).where(and(eq(table.id, Number(req.params.id)), eq(table.tenantId, tid(req)))).returning();
      if (!row.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json(row[0]);
    } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
  });
  router.delete(`/${routePrefix}/:id`, requireTenantAccess, async (req, res) => {
    try {
      await db.delete(table).where(and(eq(table.id, Number(req.params.id)), eq(table.tenantId, tid(req))));
      res.status(204).send();
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
    // Strip out blank password/token fields so they don't overwrite stored values
    if (!body.smtpPass) delete body.smtpPass;
    if (!body.twilioAuthToken) delete body.twilioAuthToken;

    // customDomain lives on tenantsTable — split it out
    const { customDomain, ...settingsBody } = body;
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
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
