import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable, EXPENSE_CATEGORIES } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { requireTenantAccess } from "../middlewares/auth";

const router = Router();

function tid(req: any): number { return req.authUser?.tenantId!; }

const expenseSchema = z.object({
  supplier: z.string().min(1, "A supplier is required"),
  description: z.string().nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES as unknown as [string, ...string[]]).optional(),
  spentOn: z.string().min(1, "A date is required"),
  net: z.union([z.string(), z.number()]).optional(),
  vatAmount: z.union([z.string(), z.number()]).optional(),
  projectId: z.number().int().nullable().optional(),
  billable: z.boolean().optional(),
  receiptPath: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  /**
   * Ordered goods (migration 0048). `expectedOn` is what the merchant
   * promised; `receivedOn` is when it actually turned up. An expense with the
   * first and not the second is what the late-delivery automation chases.
   */
  expectedOn: z.string().nullable().optional(),
  receivedOn: z.string().nullable().optional(),
});

/** Total is always derived, never taken from the client — the two must agree. */
function totalOf(net: unknown, vat: unknown): string {
  const n = Number(net ?? 0), v = Number(vat ?? 0);
  return (Math.round(((Number.isFinite(n) ? n : 0) + (Number.isFinite(v) ? v : 0)) * 100) / 100).toFixed(2);
}

router.get("/expenses", requireTenantAccess, async (req: any, res) => {
  try {
    const { from, to, category, projectId } = req.query as Record<string, string | undefined>;
    const filters = [eq(expensesTable.tenantId, tid(req))];
    if (category) filters.push(eq(expensesTable.category, category));
    if (projectId) filters.push(eq(expensesTable.projectId, Number(projectId)));
    if (from) filters.push(sql`${expensesTable.spentOn} >= ${from}`);
    if (to) filters.push(sql`${expensesTable.spentOn} <= ${to}`);

    const rows = await db.select().from(expensesTable)
      .where(and(...filters))
      .orderBy(desc(expensesTable.spentOn), desc(expensesTable.id))
      .limit(500);
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/expenses", requireTenantAccess, async (req: any, res) => {
  try {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid expense", details: parsed.error.issues }); return; }
    const e = parsed.data;

    const [row] = await db.insert(expensesTable).values({
      tenantId: tid(req),
      projectId: e.projectId ?? null,
      supplier: e.supplier,
      description: e.description ?? null,
      category: e.category ?? "materials",
      spentOn: e.spentOn,
      net: String(e.net ?? 0),
      vatAmount: String(e.vatAmount ?? 0),
      total: totalOf(e.net, e.vatAmount),
      billable: e.billable ?? false,
      receiptPath: e.receiptPath ?? null,
      notes: e.notes ?? null,
      expectedOn: e.expectedOn || null,
      receivedOn: e.receivedOn || null,
    }).returning();

    res.status(201).json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/expenses/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(expensesTable)
      .where(and(eq(expensesTable.id, id), eq(expensesTable.tenantId, tid(req)))).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const parsed = expenseSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid expense", details: parsed.error.issues }); return; }
    const e = parsed.data;

    const patch: Record<string, unknown> = {};
    for (const k of ["supplier", "description", "category", "spentOn", "projectId", "billable", "receiptPath", "notes", "expectedOn", "receivedOn"] as const) {
      if (e[k] !== undefined) patch[k] = e[k];
    }
    if (e.net !== undefined) patch.net = String(e.net);
    if (e.vatAmount !== undefined) patch.vatAmount = String(e.vatAmount);
    if (e.net !== undefined || e.vatAmount !== undefined) {
      patch.total = totalOf(e.net ?? existing.net, e.vatAmount ?? existing.vatAmount);
    }
    if (!Object.keys(patch).length) { res.json(existing); return; }

    const [row] = await db.update(expensesTable).set(patch).where(eq(expensesTable.id, id)).returning();
    res.json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/expenses/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(expensesTable)
      .where(and(eq(expensesTable.id, id), eq(expensesTable.tenantId, tid(req)))).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(expensesTable).where(eq(expensesTable.id, id));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
