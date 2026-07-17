import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable, leadNotesTable, quotesTable, projectsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";
import { sanitizeUpdate } from "../lib/sanitizeUpdate";

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
    const reference = req.body.reference ?? `ENQ-${Date.now()}`;
    const lead = await db.insert(leadsTable).values({ ...req.body, reference, tenantId: resolvedTenantId(req) }).returning();
    res.status(201).json(lead[0]);
    fireNotification({
      tenantId: lead[0].tenantId,
      event: "lead_new",
      firstName: lead[0].firstName ?? undefined,
      lastName: lead[0].lastName ?? undefined,
      customerEmail: lead[0].email ?? undefined,
      customerPhone: lead[0].phone ?? undefined,
      reference: lead[0].reference ?? undefined,
      serviceInterest: lead[0].serviceInterest ?? undefined,
      address: lead[0].address ?? undefined,
      postcode: lead[0].postcode ?? undefined,
      budget: lead[0].budget ?? undefined,
      notes: lead[0].notes ?? undefined,
      propertyType: lead[0].propertyType ?? undefined,
      propertyTypeOther: lead[0].propertyTypeOther ?? undefined,
      existingSurface: lead[0].existingSurface ?? undefined,
      desiredFinish: lead[0].desiredFinish ?? undefined,
      timeframe: lead[0].timeframe ?? undefined,
      photoUrls: (lead[0].photoUrls as string[] | null) ?? undefined,
      preferredContactMethod: lead[0].preferredContactMethod ?? undefined,
      bestTimeToContact: lead[0].bestTimeToContact ?? undefined,
      areaToRender: lead[0].areaToRender ?? undefined,
      areaToRenderOther: lead[0].areaToRenderOther ?? undefined,
      numberOfStoreys: lead[0].numberOfStoreys ?? undefined,
      wallArea: lead[0].wallArea ?? undefined,
      currentCondition: (lead[0].currentCondition as string[] | null) ?? undefined,
      preferredColour: lead[0].preferredColour ?? undefined,
      preferredColourOther: lead[0].preferredColourOther ?? undefined,
      requiresInsulation: lead[0].requiresInsulation ?? undefined,
      insulationThickness: lead[0].insulationThickness ?? undefined,
      insulationMaterial: lead[0].insulationMaterial ?? undefined,
      accessConditions: (lead[0].accessConditions as string[] | null) ?? undefined,
      propertyStatus: lead[0].propertyStatus ?? undefined,
      companyName: lead[0].companyName ?? undefined,
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
    const l = await db.update(leadsTable).set(sanitizeUpdate(req.body))
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .returning();
    if (!l.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(l[0]);
    const newStatus = req.body.status;
    if (newStatus && before[0]?.status !== newStatus) {
      const ctx = {
        tenantId: l[0].tenantId,
        firstName: l[0].firstName ?? undefined,
        lastName: l[0].lastName ?? undefined,
        customerEmail: l[0].email ?? undefined,
        customerPhone: l[0].phone ?? undefined,
      };
      // Note: "Quote Sent" is deliberately not wired to a notification here — the customer is
      // only ever emailed about a quote via the explicit "Send Payment Link" action (see
      // POST /payment-links/:id/send), which has the real amount and pay link to include.
      // Firing from a bare status change produced a content-less "quote is ready" email with
      // no link, since neither this handler nor a lead conversion has that data.
      if (newStatus === "Survey Booked") {
        fireNotification({ ...ctx, event: "survey_booked" });
      } else if (newStatus === "Won") {
        fireNotification({ ...ctx, event: "lead_won" });
      }
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

/** Confirms :id refers to a lead the caller's tenant actually owns (or bypasses for SUPER_ADMIN). */
async function requireOwnedLead(req: any, res: any): Promise<number | null> {
  const lead = await db.select({ id: leadsTable.id }).from(leadsTable)
    .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
    .limit(1);
  if (!lead.length) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return lead[0].id;
}

router.get("/leads/:id/notes", requireTenantAccess, async (req, res) => {
  try {
    const leadId = await requireOwnedLead(req, res);
    if (leadId === null) return;
    const notes = await db.select().from(leadNotesTable)
      .where(eq(leadNotesTable.leadId, leadId))
      .orderBy(sql`${leadNotesTable.createdAt} desc`);
    res.json(notes);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads/:id/notes", requireTenantAccess, async (req, res) => {
  try {
    const leadId = await requireOwnedLead(req, res);
    if (leadId === null) return;
    const note = await db.insert(leadNotesTable).values({
      leadId,
      authorId: req.authUser!.id,
      content: req.body.content,
    }).returning();
    res.status(201).json(note[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads/:id/convert-quote", requireTenantAccess, async (req, res) => {
  try {
    const lead = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.id, Number(req.params.id)), tenantFilter(req, leadsTable.tenantId)))
      .limit(1);
    if (!lead.length) { res.status(404).json({ error: "Not found" }); return; }
    const ref = `QUO-${Date.now()}`;
    const quote = await db.insert(quotesTable).values({ tenantId: lead[0].tenantId, reference: ref, leadId: lead[0].id }).returning();
    // Note: converting a lead to a quote just creates the draft — it does not email the customer.
    // Mark still needs to add line items and generate/send a payment link before anything goes
    // out; auto-firing here produced a content-less "quote is ready" email with no pay link.
    await db.update(leadsTable).set({ status: "Quote Sent" }).where(eq(leadsTable.id, lead[0].id));
    res.status(201).json(quote[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/leads/:id/convert-project", requireTenantAccess, async (req, res) => {
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
      event: "lead_won",
      firstName: lead[0].firstName ?? undefined,
      lastName: lead[0].lastName ?? undefined,
      customerEmail: lead[0].email ?? undefined,
      customerPhone: lead[0].phone ?? undefined,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
