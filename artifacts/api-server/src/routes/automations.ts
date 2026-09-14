import { Router } from "express";
import { db } from "@workspace/db";
import { automationsTable, automationRunsTable, tenantsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { requireTenantAccess } from "../middlewares/auth";
import { getRule, listRules, describeRules, makeContext } from "../lib/automations/registry";
import { logger } from "../lib/logger";

const router = Router();
function tid(req: any): number { return req.authUser?.tenantId!; }

/**
 * Runs every enabled rule for one tenant.
 *
 * Exported so the scheduled job can sweep all tenants and the dashboard can run
 * a single tenant on demand. A rule that throws is logged and skipped — one
 * broken automation must never stop the others.
 */
export async function runAutomationsForTenant(tenantId: number, onlyKey?: string): Promise<{ ran: number; actions: number }> {
  const rows = await db.select().from(automationsTable)
    .where(and(eq(automationsTable.tenantId, tenantId), eq(automationsTable.enabled, true)));

  let ran = 0, actions = 0;
  for (const row of rows) {
    if (onlyKey && row.key !== onlyKey) continue;
    const rule = getRule(row.key);
    if (!rule) continue;

    try {
      const ctx = makeContext(tenantId, rule.key, row.config ?? {});
      const count = await rule.run(ctx);
      await db.update(automationsTable).set({
        lastRunAt: new Date(),
        actionsTaken: (row.actionsTaken ?? 0) + count,
      }).where(eq(automationsTable.id, row.id));
      ran++; actions += count;
    } catch (err) {
      logger.error({ err, tenantId, key: row.key }, "Automation failed");
      await db.insert(automationRunsTable).values({
        tenantId, key: row.key, summary: `${rule.label} could not run`, outcome: "failed",
        detail: err instanceof Error ? err.message.slice(0, 400) : null,
      });
    }
  }
  return { ran, actions };
}

export async function runAutomationsForAllTenants(): Promise<{ tenants: number; actions: number }> {
  const tenants = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .where(sql`${tenantsTable.suspended} = false`);
  let actions = 0;
  for (const t of tenants) {
    const r = await runAutomationsForTenant(t.id);
    actions += r.actions;
  }
  return { tenants: tenants.length, actions };
}

// ── Catalogue + state ────────────────────────────────────────────────────────

router.get("/automations", requireTenantAccess, async (req: any, res) => {
  try {
    const tenantId = tid(req);
    const saved = await db.select().from(automationsTable).where(eq(automationsTable.tenantId, tenantId));
    const byKey = new Map(saved.map(s => [s.key, s]));

    // Count only this calendar month, because that is what the headline claims.
    const [{ count } = { count: 0 } as any] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationRunsTable)
      .where(and(
        eq(automationRunsTable.tenantId, tenantId),
        eq(automationRunsTable.outcome, "ok"),
        sql`${automationRunsTable.createdAt} >= date_trunc('month', CURRENT_DATE)`,
      ));

    const rules = describeRules().map(r => {
      const row = byKey.get(r.key);
      return {
        ...r,
        enabled: row?.enabled ?? false,
        config: row?.config ?? r.defaults,
        lastRunAt: row?.lastRunAt ?? null,
        actionsTaken: row?.actionsTaken ?? 0,
      };
    });

    res.json({
      rules,
      setUpCount: rules.filter(r => r.enabled).length,
      totalCount: rules.length,
      actionsThisMonth: count ?? 0,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Enable / configure ───────────────────────────────────────────────────────

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

router.patch("/automations/:key", requireTenantAccess, async (req: any, res) => {
  try {
    const key = String(req.params.key);
    const rule = getRule(key);
    if (!rule) { res.status(404).json({ error: "Unknown automation" }); return; }

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid", details: parsed.error.issues }); return; }

    const tenantId = tid(req);
    const [existing] = await db.select().from(automationsTable)
      .where(and(eq(automationsTable.tenantId, tenantId), eq(automationsTable.key, key))).limit(1);

    const nextConfig = parsed.data.config ?? existing?.config ?? rule.defaults;

    // Config is validated before the switch can move, so a rule can never be
    // enabled with settings it cannot run on.
    const valid = rule.configSchema.safeParse(nextConfig);
    if (!valid.success) {
      res.status(400).json({ error: "These settings are not valid for this automation", details: valid.error.issues });
      return;
    }

    const enabled = parsed.data.enabled ?? existing?.enabled ?? false;

    const [row] = existing
      ? await db.update(automationsTable).set({ enabled, config: valid.data as Record<string, unknown> })
          .where(eq(automationsTable.id, existing.id)).returning()
      : await db.insert(automationsTable)
          .values({ tenantId, key, enabled, config: valid.data as Record<string, unknown> }).returning();

    res.json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Activity ─────────────────────────────────────────────────────────────────

router.get("/automations/activity", requireTenantAccess, async (req: any, res) => {
  try {
    const rows = await db.select().from(automationRunsTable)
      .where(eq(automationRunsTable.tenantId, tid(req)))
      .orderBy(desc(automationRunsTable.createdAt))
      .limit(100);
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Run this tenant's automations now — the "test it" button in the dashboard. */
router.post("/automations/run", requireTenantAccess, async (req: any, res) => {
  try {
    const result = await runAutomationsForTenant(tid(req), req.body?.key);
    res.json({ ok: true, ...result });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
