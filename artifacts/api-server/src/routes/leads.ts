import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable, leadNotesTable, quotesTable, projectsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";

const router = Router();

function resolvedTenantId(req: any): number {
  return req.authUser?.tenantId ?? -1;
}

router.get("/leads", requireTenantAccess, async (req, res) => {
  try {
    const leads = await db.select().from(leadsTable)
      .where(tenantFilter(req, leadsTable.tenantId))
      .orderBy(sql`${leadsTable.createdAt} desc`);
    res.json(leads);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads", requireTenantAccess, async (req, res) => {
  try {
    const lead = await db.insert(leadsTable).values({ ...req.body, tenantId: resolvedTenantId(req) }).returning();
    res.status(201).json(lead[0]);
    fireNotification({
      tenantId: lead[0].tenantId,
      event: "lead_new",
      leadName: `${lead[0].firstName ?? ""} ${lead[0].lastName ?? ""}`.trim(),
      customerEmail: lead[0].email ?? undefined,
      customerPhone: lead[0].phone ?? undefined,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/leads/:id", requireTenantAccess, async (req, res) => {
  try {
    const l = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .limit(1);
    if (!l.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(l[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/leads/:id", requireTenantAccess, async (req, res) => {
  try {
    const before = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .limit(1);
    const l = await db.update(leadsTable).set(req.body)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .returning();
    if (!l.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(l[0]);
    if (req.body.status && before[0]?.status !== req.body.status) {
      fireNotification({
        tenantId: l[0].tenantId,
        event: "lead_status_change",
        leadName: `${l[0].firstName ?? ""} ${l[0].lastName ?? ""}`.trim(),
        customerEmail: l[0].email ?? undefined,
        customerPhone: l[0].phone ?? undefined,
        oldStatus: before[0]?.status ?? undefined,
        newStatus: req.body.status,
      });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/leads/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(leadsTable)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/leads/:id/notes", requireTenantAccess, async (req, res) => {
  try {
    const notes = await db.select().from(leadNotesTable)
      .where(eq(leadNotesTable.leadId, Number(req.params.id)))
      .orderBy(sql`${leadNotesTable.createdAt} desc`);
    res.json(notes);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads/:id/notes", requireTenantAccess, async (req, res) => {
  try {
    const note = await db.insert(leadNotesTable).values({
      leadId: Number(req.params.id),
      authorId: req.authUser!.id,
      content: req.body.content,
    }).returning();
    res.status(201).json(note[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads/:id/convert-to-quote", requireTenantAccess, async (req, res) => {
  try {
    const lead = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .limit(1);
    if (!lead.length) { res.status(404).json({ error: "Not found" }); return; }
    const ref = `QUO-${Date.now()}`;
    const quote = await db.insert(quotesTable).values({ tenantId: lead[0].tenantId, reference: ref, leadId: lead[0].id }).returning();
    await db.update(leadsTable).set({ status: "Quote Sent" }).where(eq(leadsTable.id, lead[0].id));
    res.status(201).json(quote[0]);
    fireNotification({
      tenantId: lead[0].tenantId,
      event: "lead_status_change",
      leadName: `${lead[0].firstName ?? ""} ${lead[0].lastName ?? ""}`.trim(),
      customerEmail: lead[0].email ?? undefined,
      customerPhone: lead[0].phone ?? undefined,
      oldStatus: lead[0].status ?? undefined,
      newStatus: "Quote Sent",
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads/:id/convert-to-project", requireTenantAccess, async (req, res) => {
  try {
    const lead = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .limit(1);
    if (!lead.length) { res.status(404).json({ error: "Not found" }); return; }
    const project = await db.insert(projectsTable).values({
      tenantId: lead[0].tenantId,
      title: `${lead[0].firstName} ${lead[0].lastName} - ${lead[0].serviceInterest ?? "Project"}`,
      city: lead[0].city ?? undefined,
      address: lead[0].address ?? undefined,
    }).returning();
    await db.update(leadsTable).set({ status: "Won" }).where(eq(leadsTable.id, lead[0].id));
    res.status(201).json(project[0]);
    fireNotification({
      tenantId: lead[0].tenantId,
      event: "lead_status_change",
      leadName: `${lead[0].firstName ?? ""} ${lead[0].lastName ?? ""}`.trim(),
      customerEmail: lead[0].email ?? undefined,
      customerPhone: lead[0].phone ?? undefined,
      oldStatus: lead[0].status ?? undefined,
      newStatus: "Won",
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
