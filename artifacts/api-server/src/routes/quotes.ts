import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, quoteItemsTable, projectsTable, leadsTable, customersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";

const router = Router();

router.get("/quotes", requireTenantAccess, async (req, res) => {
  try {
    const quotes = await db.select().from(quotesTable)
      .where(tenantFilter(req, quotesTable.tenantId))
      .orderBy(sql`${quotesTable.createdAt} desc`);
    res.json(quotes);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/quotes", requireTenantAccess, async (req, res) => {
  try {
    const ref = req.body.reference ?? `QUO-${Date.now()}`;
    const q = await db.insert(quotesTable).values({ ...req.body, reference: ref, tenantId: req.authUser?.tenantId ?? -1 }).returning();
    res.status(201).json(q[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/quotes/:id", requireTenantAccess, async (req, res) => {
  try {
    const q = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    if (!q.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(q[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/quotes/:id", requireTenantAccess, async (req, res) => {
  try {
    const before = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    const q = await db.update(quotesTable).set(req.body)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .returning();
    if (!q.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(q[0]);

    const newStatus = req.body.status;
    if (newStatus && before[0]?.status !== newStatus) {
      // Resolve customer/lead details for recipient routing
      let firstName: string | undefined;
      let lastName: string | undefined;
      let customerEmail: string | undefined;
      let customerPhone: string | undefined;

      if (q[0].customerId) {
        const rows = await db.select().from(customersTable).where(eq(customersTable.id, q[0].customerId)).limit(1);
        const c = rows[0];
        if (c) { firstName = c.firstName; lastName = c.lastName; customerEmail = c.email ?? undefined; customerPhone = c.phone ?? undefined; }
      } else if (q[0].leadId) {
        const rows = await db.select().from(leadsTable).where(eq(leadsTable.id, q[0].leadId)).limit(1);
        const l = rows[0];
        if (l) { firstName = l.firstName ?? undefined; lastName = l.lastName ?? undefined; customerEmail = l.email ?? undefined; customerPhone = l.phone ?? undefined; }
      }

      if (newStatus === "Sent") {
        fireNotification({ tenantId: q[0].tenantId, event: "quote_sent", firstName, lastName, customerEmail, customerPhone, reference: q[0].reference });
      } else if (newStatus === "Accepted") {
        fireNotification({ tenantId: q[0].tenantId, event: "quote_accepted", firstName, lastName, customerEmail, customerPhone, reference: q[0].reference });
      }
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/quotes/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/quotes/:id/convert-to-project", requireTenantAccess, async (req, res) => {
  try {
    const q = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    if (!q.length) { res.status(404).json({ error: "Not found" }); return; }
    const project = await db.insert(projectsTable).values({
      tenantId: q[0].tenantId,
      quoteId: q[0].id,
      customerId: q[0].customerId ?? undefined,
      title: `Project from ${q[0].reference}`,
    }).returning();
    await db.update(quotesTable).set({ status: "Accepted" }).where(eq(quotesTable.id, q[0].id));
    res.status(201).json(project[0]);

    // Resolve customer details for admin notification
    let firstName: string | undefined;
    let lastName: string | undefined;
    let customerEmail: string | undefined;
    let customerPhone: string | undefined;

    if (q[0].customerId) {
      const rows = await db.select().from(customersTable).where(eq(customersTable.id, q[0].customerId)).limit(1);
      const c = rows[0];
      if (c) { firstName = c.firstName; lastName = c.lastName; customerEmail = c.email ?? undefined; customerPhone = c.phone ?? undefined; }
    } else if (q[0].leadId) {
      const rows = await db.select().from(leadsTable).where(eq(leadsTable.id, q[0].leadId)).limit(1);
      const l = rows[0];
      if (l) { firstName = l.firstName ?? undefined; lastName = l.lastName ?? undefined; customerEmail = l.email ?? undefined; customerPhone = l.phone ?? undefined; }
    }

    fireNotification({ tenantId: q[0].tenantId, event: "quote_accepted", firstName, lastName, customerEmail, customerPhone, reference: q[0].reference });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/quotes/:id/items", requireTenantAccess, async (req, res) => {
  try {
    const items = await db.select().from(quoteItemsTable)
      .where(eq(quoteItemsTable.quoteId, Number(req.params.id)))
      .orderBy(quoteItemsTable.sortOrder);
    res.json(items);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/quotes/:id/items", requireTenantAccess, async (req, res) => {
  try {
    const item = await db.insert(quoteItemsTable).values({ ...req.body, quoteId: Number(req.params.id) }).returning();
    res.status(201).json(item[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/quotes/:id/items/:itemId", requireTenantAccess, async (req, res) => {
  try {
    const item = await db.update(quoteItemsTable).set(req.body).where(eq(quoteItemsTable.id, Number(req.params.itemId))).returning();
    res.json(item[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/quotes/:id/items/:itemId", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(quoteItemsTable).where(eq(quoteItemsTable.id, Number(req.params.itemId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
