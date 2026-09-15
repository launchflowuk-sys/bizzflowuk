import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, portalMessagesTable, projectsTable, quotesTable, invoicesTable, certificatesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireTenantAccess, requireAuth, tenantFilter } from "../middlewares/auth";
import { sanitizeUpdate } from "../lib/sanitizeUpdate";
import { deleteCustomersDeep } from "../lib/cascadeDelete";

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

/**
 * Everything this customer has ever had done.
 *
 * Brandon, on what he uses a system for: "can always go back through customers
 * to see what jobs I have done for them."
 *
 * The customer page showed contact details and stopped. The jobs, quotes,
 * invoices and certificates were all in the database with this customer's id
 * on them, and nothing put them on the one screen where somebody looking that
 * customer up would think to look.
 *
 * One endpoint rather than four calls from the page: it is one question --
 * "what is the history here" -- and answering it in four round trips from a
 * van on 5G is four chances to half-load.
 */
router.get("/customers/:id/history", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = req.authUser?.tenantId ?? -1;

    // Ownership first. Without this, any customer id would return another
    // business's history to whoever guessed the number.
    const [owned] = await db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.id, id), eq(customersTable.tenantId, tenantId))).limit(1);
    if (!owned) { res.status(404).json({ error: "Not found" }); return; }

    const [jobs, quotes, invoices, certificates] = await Promise.all([
      db.select({
        id: projectsTable.id, title: projectsTable.title, status: projectsTable.status,
        scheduledStart: projectsTable.scheduledStart, completedAt: projectsTable.completedAt,
      }).from(projectsTable)
        .where(and(eq(projectsTable.tenantId, tenantId), eq(projectsTable.customerId, id)))
        .orderBy(desc(projectsTable.createdAt)).limit(100),

      db.select({
        id: quotesTable.id, reference: quotesTable.reference,
        status: quotesTable.status, total: quotesTable.total, createdAt: quotesTable.createdAt,
      }).from(quotesTable)
        .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.customerId, id)))
        .orderBy(desc(quotesTable.createdAt)).limit(100),

      db.select({
        id: invoicesTable.id, reference: invoicesTable.reference, status: invoicesTable.status,
        total: invoicesTable.total, amountPaid: invoicesTable.amountPaid,
        issuedOn: invoicesTable.issuedOn, dueOn: invoicesTable.dueOn,
      }).from(invoicesTable)
        .where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.customerId, id)))
        .orderBy(desc(invoicesTable.issuedOn)).limit(100),

      db.select({
        id: certificatesTable.id, reference: certificatesTable.reference,
        type: certificatesTable.type, status: certificatesTable.status,
        checkedAt: certificatesTable.checkedAt, expiresAt: certificatesTable.expiresAt,
      }).from(certificatesTable)
        .where(and(eq(certificatesTable.tenantId, tenantId), eq(certificatesTable.customerId, id)))
        .orderBy(desc(certificatesTable.checkedAt)).limit(100),
    ]);

    // The headline a trade actually wants: what this customer is worth and
    // whether they owe anything right now.
    const billed = invoices
      .filter(i => i.status !== "draft" && i.status !== "void")
      .reduce((sum, i) => sum + Number(i.total ?? 0), 0);
    const outstanding = invoices
      .filter(i => !["paid", "void", "draft"].includes(i.status))
      .reduce((sum, i) => sum + Math.max(0, Number(i.total ?? 0) - Number(i.amountPaid ?? 0)), 0);

    res.json({
      jobs, quotes, invoices, certificates,
      totals: {
        jobs: jobs.length,
        billed: billed.toFixed(2),
        outstanding: outstanding.toFixed(2),
      },
    });
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
    const c = await db.update(customersTable).set(sanitizeUpdate(req.body))
      .where(and(eq(customersTable.id, Number(req.params.id)), tenantFilter(req, customersTable.tenantId)))
      .returning();
    if (!c.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(c[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/customers/:id", requireTenantAccess, async (req, res) => {
  try {
    // Verify ownership first, then deep-delete (portal messages die with the customer; contact
    // messages, quotes, projects and reviews unlink). A bare delete FK-violated (HTTP 500) on
    // any customer with linked history — i.e. every real customer.
    const owned = await db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.id, Number(req.params.id)), tenantFilter(req, customersTable.tenantId))).limit(1);
    if (owned.length) await deleteCustomersDeep([owned[0].id]);
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/portal/me", requireAuth, async (req, res) => {
  try {
    const clerkId = req.authUser!.clerkId;
    if (!clerkId) { res.status(404).json({ error: "Customer not found" }); return; }
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
    if (!clerkId) { res.json([]); return; }
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
    if (!clerkId) { res.status(404).json({ error: "Customer not found" }); return; }
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
