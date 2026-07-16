import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectUpdatesTable, customersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";
import { sanitizeUpdate } from "../lib/sanitizeUpdate";

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
    const updateData: any = sanitizeUpdate(req.body);
    if (req.body.status === "Completed" && !before[0]?.completedAt) {
      updateData.completedAt = new Date();
    }
    const p = await db.update(projectsTable).set(updateData)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .returning();
    if (!p.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(p[0]);

    const newStatus = req.body.status;
    if (newStatus && before[0]?.status !== newStatus) {
      let firstName: string | undefined;
      let lastName: string | undefined;
      let customerEmail: string | undefined;
      let customerPhone: string | undefined;

      if (p[0].customerId) {
        const rows = await db.select().from(customersTable).where(eq(customersTable.id, p[0].customerId)).limit(1);
        const c = rows[0];
        if (c) { firstName = c.firstName; lastName = c.lastName; customerEmail = c.email ?? undefined; customerPhone = c.phone ?? undefined; }
      }

      const ctx = {
        tenantId: p[0].tenantId,
        firstName,
        lastName,
        customerEmail,
        customerPhone,
        projectTitle: p[0].title,
      };

      if (newStatus === "In Progress") {
        fireNotification({ ...ctx, event: "project_in_progress" });
      } else if (newStatus === "Completed") {
        fireNotification({ ...ctx, event: "project_completed" });
      }
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

/** Confirms :id refers to a project the caller's tenant actually owns (or bypasses for SUPER_ADMIN). */
async function requireOwnedProject(req: any, res: any): Promise<number | null> {
  const project = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
    .limit(1);
  if (!project.length) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return project[0].id;
}

router.get("/projects/:id/updates", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const updates = await db.select().from(projectUpdatesTable)
      .where(eq(projectUpdatesTable.projectId, projectId))
      .orderBy(sql`${projectUpdatesTable.createdAt} desc`);
    res.json(updates);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/projects/:id/updates", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const u = await db.insert(projectUpdatesTable).values({ ...req.body, projectId }).returning();
    res.status(201).json(u[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
