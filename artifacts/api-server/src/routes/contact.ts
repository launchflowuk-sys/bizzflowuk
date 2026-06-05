import { Router } from "express";
import { db } from "@workspace/db";
import { contactMessagesTable, tenantsTable, leadsTable, visualiserRequestsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";

const router = Router();
function tid(req: any) { return req.authUser?.tenantId!; }

// Public contact form submission — no auth required
router.post("/public/:tenantSlug/contact", async (req, res) => {
  try {
    const tenant = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, req.params.tenantSlug)).limit(1);
    if (!tenant.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const msg = await db.insert(contactMessagesTable).values({ ...req.body, tenantId: tenant[0].id, source: "contact_form" }).returning();
    res.status(201).json(msg[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Public quote request
router.post("/public/:tenantSlug/quote-request", async (req, res) => {
  try {
    const tenant = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, req.params.tenantSlug)).limit(1);
    if (!tenant.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const lead = await db.insert(leadsTable).values({ ...req.body, tenantId: tenant[0].id, status: "New", source: "Website" }).returning();
    res.status(201).json(lead[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Public visualiser submission
router.post("/public/:tenantSlug/visualiser", async (req, res) => {
  try {
    const tenant = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, req.params.tenantSlug)).limit(1);
    if (!tenant.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const r = await db.insert(visualiserRequestsTable).values({ ...req.body, tenantId: tenant[0].id, status: "pending" }).returning();
    res.status(201).json(r[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Admin: list contact messages
router.get("/contact-messages", requireTenantAccess, async (req, res) => {
  try {
    const msgs = await db.select().from(contactMessagesTable).where(eq(contactMessagesTable.tenantId, tid(req))).orderBy(sql`${contactMessagesTable.createdAt} desc`);
    res.json(msgs);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/contact-messages/:id", requireTenantAccess, async (req, res) => {
  try {
    const msg = await db.select().from(contactMessagesTable).where(and(eq(contactMessagesTable.id, Number(req.params.id)), eq(contactMessagesTable.tenantId, tid(req)))).limit(1);
    if (!msg.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(msg[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/contact-messages/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(contactMessagesTable).where(and(eq(contactMessagesTable.id, Number(req.params.id)), eq(contactMessagesTable.tenantId, tid(req))));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
