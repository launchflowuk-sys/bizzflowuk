import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectUpdatesTable, customersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";

const router = Router();

router.get("/projects", requireTenantAccess, async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable)
      .where(tenantFilter(req, projectsTable.tenantId))
      .orderBy(sql`${projectsTable.createdAt} desc`);
    res.json(projects);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/projects", requireTenantAccess, async (req, res) => {
  try {
    const p = await db.insert(projectsTable).values({ ...req.body, tenantId: req.authUser?.tenantId ?? -1 }).returning();
    res.status(201).json(p[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/projects/:id", requireTenantAccess, async (req, res) => {
  try {
    const p = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .limit(1);
    if (!p.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(p[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/projects/:id", requireTenantAccess, async (req, res) => {
  try {
    const before = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .limit(1);
    const updateData: any = { ...req.body };
    if (req.body.status === "Completed" && !before[0]?.completedAt) {
      updateData.completedAt = new Date();
    }
    const p = await db.update(projectsTable).set(updateData)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .returning();
    if (!p.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(p[0]);
    if (req.body.status && before[0]?.status !== req.body.status) {
      let customer: { email?: string | null; phone?: string | null; firstName?: string; lastName?: string } | undefined;
      if (p[0].customerId) {
        const rows = await db.select().from(customersTable).where(eq(customersTable.id, p[0].customerId)).limit(1);
        customer = rows[0];
      }
      const isCompleted = req.body.status === "Completed";
      fireNotification({
        tenantId: p[0].tenantId,
        event: isCompleted ? "project_completed" : "project_status_change",
        projectTitle: p[0].title,
        oldStatus: before[0]?.status ?? undefined,
        newStatus: req.body.status,
        customerName: customer ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() : undefined,
        customerEmail: customer?.email ?? undefined,
        customerPhone: customer?.phone ?? undefined,
      });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/projects/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(projectsTable)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/projects/:id/updates", requireTenantAccess, async (req, res) => {
  try {
    const updates = await db.select().from(projectUpdatesTable)
      .where(eq(projectUpdatesTable.projectId, Number(req.params.id)))
      .orderBy(sql`${projectUpdatesTable.createdAt} desc`);
    res.json(updates);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/projects/:id/updates", requireTenantAccess, async (req, res) => {
  try {
    const u = await db.insert(projectUpdatesTable).values({ ...req.body, projectId: Number(req.params.id) }).returning();
    res.status(201).json(u[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
