import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable, quotesTable, projectsTable, contactMessagesTable } from "@workspace/db";
import { eq, sql, count, and } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";

const router = Router();
function tid(req: any) { return req.authUser?.tenantId!; }

router.get("/dashboard/stats", requireTenantAccess, async (req, res) => {
  try {
    const tenantId = tid(req);
    const [totalLeads] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.tenantId, tenantId));
    const [activeProjects] = await db.select({ count: count() }).from(projectsTable).where(and(eq(projectsTable.tenantId, tenantId), sql`${projectsTable.status} = 'In Progress'`));
    const [newLeads] = await db.select({ count: count() }).from(leadsTable).where(and(eq(leadsTable.tenantId, tenantId), sql`${leadsTable.status} = 'New'`));
    const [completedProjects] = await db.select({ count: count() }).from(projectsTable).where(and(eq(projectsTable.tenantId, tenantId), sql`${projectsTable.status} = 'Completed'`));
    const [unreadMessages] = await db.select({ count: count() }).from(contactMessagesTable).where(eq(contactMessagesTable.tenantId, tenantId));
    res.json({ totalLeads: totalLeads.count, activeProjects: activeProjects.count, newLeads: newLeads.count, completedProjects: completedProjects.count, unreadMessages: unreadMessages.count });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/activity", requireTenantAccess, async (req, res) => {
  try {
    const tenantId = tid(req);
    const recentLeads = await db.select().from(leadsTable).where(eq(leadsTable.tenantId, tenantId)).orderBy(sql`${leadsTable.createdAt} desc`).limit(5);
    const recentProjects = await db.select().from(projectsTable).where(eq(projectsTable.tenantId, tenantId)).orderBy(sql`${projectsTable.updatedAt} desc`).limit(5);
    const activity = [
      ...recentLeads.map(l => ({ type: "lead", id: l.id, description: `New lead: ${l.firstName} ${l.lastName}`, status: l.status, createdAt: l.createdAt })),
      ...recentProjects.map(p => ({ type: "project", id: p.id, description: `Project: ${p.title}`, status: p.status, createdAt: p.updatedAt })),
    ].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()).slice(0, 10);
    res.json(activity);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/pipeline", requireTenantAccess, async (req, res) => {
  try {
    const tenantId = tid(req);
    const statuses = ["New", "Contacted", "Survey Booked", "Quote Sent", "Won", "Lost"];
    const pipeline = await Promise.all(statuses.map(async (status) => {
      const [result] = await db.select({ count: count() }).from(leadsTable).where(and(eq(leadsTable.tenantId, tenantId), sql`${leadsTable.status} = ${status}`));
      return { status, count: result.count };
    }));
    res.json(pipeline);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
