import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, portalMessagesTable, projectsTable, quotesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, requireAuth, tenantFilter } from "../middlewares/auth";

const router = Router();

router.get("/customers", requireTenantAccess, async (req, res) => {
  try {
    const customers = await db.select().from(customersTable)
      .where(tenantFilter(req, customersTable.tenantId))
      .orderBy(sql`${customersTable.createdAt} desc`);
    res.json(customers);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/customers", requireTenantAccess, async (req, res) => {
  try {
    const c = await db.insert(customersTable).values({ ...req.body, tenantId: req.authUser?.tenantId ?? -1 }).returning();
    res.status(201).json(c[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/customers/:id", requireTenantAccess, async (req, res) => {
  try {
    const c = await db.select().from(customersTable)
      .where(and(eq(customersTable.id, Number(req.params.id)), tenantFilter(req, customersTable.tenantId)))
      .limit(1);
    if (!c.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(c[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/customers/:id", requireTenantAccess, async (req, res) => {
  try {
    const c = await db.update(customersTable).set(req.body)
      .where(and(eq(customersTable.id, Number(req.params.id)), tenantFilter(req, customersTable.tenantId)))
      .returning();
    if (!c.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(c[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/customers/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(customersTable)
      .where(and(eq(customersTable.id, Number(req.params.id)), tenantFilter(req, customersTable.tenantId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/portal/me", requireAuth, async (req, res) => {
  try {
    const clerkId = req.authUser!.clerkId;
    const customer = await db.select().from(customersTable).where(eq(customersTable.clerkId, clerkId)).limit(1);
    if (!customer.length) { res.status(404).json({ error: "Customer not found" }); return; }
    const projects = await db.select().from(projectsTable).where(eq(projectsTable.customerId, customer[0].id));
    const quotes = await db.select().from(quotesTable).where(eq(quotesTable.customerId, customer[0].id));
    res.json({ customer: customer[0], projects, quotes });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/portal/messages", requireAuth, async (req, res) => {
  try {
    const clerkId = req.authUser!.clerkId;
    const customer = await db.select().from(customersTable).where(eq(customersTable.clerkId, clerkId)).limit(1);
    if (!customer.length) { res.json([]); return; }
    const msgs = await db.select().from(portalMessagesTable)
      .where(eq(portalMessagesTable.customerId, customer[0].id))
      .orderBy(sql`${portalMessagesTable.createdAt} asc`);
    res.json(msgs);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/portal/messages", requireAuth, async (req, res) => {
  try {
    const clerkId = req.authUser!.clerkId;
    const customer = await db.select().from(customersTable).where(eq(customersTable.clerkId, clerkId)).limit(1);
    if (!customer.length) { res.status(404).json({ error: "Customer not found" }); return; }
    const msg = await db.insert(portalMessagesTable).values({
      ...req.body,
      customerId: customer[0].id,
      tenantId: customer[0].tenantId,
      senderRole: "customer",
    }).returning();
    res.status(201).json(msg[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
