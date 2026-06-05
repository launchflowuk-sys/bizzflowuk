import { Router } from "express";
import { db } from "@workspace/db";
import { visualiserRequestsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";

const router = Router();
function tid(req: any) { return req.authUser?.tenantId!; }

router.get("/visualiser-requests", requireTenantAccess, async (req, res) => {
  try {
    const reqs = await db.select().from(visualiserRequestsTable).where(eq(visualiserRequestsTable.tenantId, tid(req))).orderBy(sql`${visualiserRequestsTable.createdAt} desc`);
    res.json(reqs);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/visualiser-requests/:id", requireTenantAccess, async (req, res) => {
  try {
    const r = await db.select().from(visualiserRequestsTable).where(and(eq(visualiserRequestsTable.id, Number(req.params.id)), eq(visualiserRequestsTable.tenantId, tid(req)))).limit(1);
    if (!r.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(r[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/visualiser-requests/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(visualiserRequestsTable).where(and(eq(visualiserRequestsTable.id, Number(req.params.id)), eq(visualiserRequestsTable.tenantId, tid(req))));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
