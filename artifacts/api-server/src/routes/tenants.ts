import { Router } from "express";
import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, leadsTable, projectsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

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
    const t = await db.update(tenantsTable).set(req.body).where(eq(tenantsTable.id, Number(req.params.id))).returning();
    if (!t.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(t[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
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
