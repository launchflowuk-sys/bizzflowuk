import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { projectsTable, projectUpdatesTable, projectItemsTable, customersTable, quotesTable, servicesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";
import { sanitizeUpdate, coerceTimestamps } from "../lib/sanitizeUpdate";
import { deleteProjectsDeep } from "../lib/cascadeDelete";

const router = Router();

/**
 * Rejects a body that points a project at another tenant's customer or quote.
 *
 * `projects.customer_id` and `projects.quote_id` are plain foreign keys with no
 * tenant constraint, and the create handler spreads `req.body` straight into
 * the insert. Forcing `tenantId` stops a row being planted in someone else's
 * tenant, but it does nothing about the row this one *points at*.
 *
 * The matching hole in quotes was found in practice, not in theory: an e2e run
 * that authenticated as one tenant while posting to another produced live
 * quotes linked to a stranger's leads. Projects had the same shape, so it gets
 * the same guard rather than waiting to be demonstrated too.
 */
async function assertOwnedProjectRefs(
  tenantId: number,
  body: { customerId?: unknown; quoteId?: unknown; serviceId?: unknown },
): Promise<string | null> {
  const customerId = Number(body.customerId);
  if (body.customerId != null && Number.isFinite(customerId)) {
    const [row] = await db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.id, customerId), eq(customersTable.tenantId, tenantId))).limit(1);
    if (!row) return "That customer does not belong to this business.";
  }
  const quoteId = Number(body.quoteId);
  if (body.quoteId != null && Number.isFinite(quoteId)) {
    const [row] = await db.select({ id: quotesTable.id }).from(quotesTable)
      .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.tenantId, tenantId))).limit(1);
    if (!row) return "That quote does not belong to this business.";
  }
  // service_id arrived with migration 0045 and is the same shape of hole as the
  // two above: an unconstrained foreign key a request body can point anywhere.
  // Every new FK on a tenant-owned table needs its own check here, or the guard
  // rots into a guard against the columns that happened to exist when it was
  // written.
  const serviceId = Number(body.serviceId);
  if (body.serviceId != null && Number.isFinite(serviceId)) {
    const [row] = await db.select({ id: servicesTable.id }).from(servicesTable)
      .where(and(eq(servicesTable.id, serviceId), eq(servicesTable.tenantId, tenantId))).limit(1);
    if (!row) return "That service does not belong to this business.";
  }
  return null;
}

router.get("/projects", requireTenantAccess, async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable)
      .where(tenantFilter(req, projectsTable.tenantId))
      .orderBy(sql`${projectsTable.createdAt} desc`);
    res.json(projects);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/projects", requireTenantAccess, async (req, res) => {
  try {
    const tenantId = req.authUser?.tenantId ?? -1;
    // Same exposure as quotes: customer_id and quote_id are unconstrained
    // foreign keys, so a body can point a project at another tenant's records.
    const refError = await assertOwnedProjectRefs(tenantId, req.body);
    if (refError) { res.status(400).json({ error: refError }); return; }

    // `coerceTimestamps` on CREATE as well as update. JSON has no date type, so
    // a client sending scheduledStart as an ISO string — which is the only
    // thing it can send — reached drizzle as a string and died inside
    // PgTimestamp.mapToDriverValue with nothing to explain it. PATCH has always
    // coerced; POST never did, so the two disagreed about what a valid body is.
    const p = await db.insert(projectsTable)
      .values({ ...coerceTimestamps(req.body), tenantId })
      .returning();
    res.status(201).json(p[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/projects/:id", requireTenantAccess, async (req, res) => {
  try {
    const p = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .limit(1);
    if (!p.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(p[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/projects/:id", requireTenantAccess, async (req, res) => {
  try {
    const before = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .limit(1);
    const updateData: any = sanitizeUpdate(coerceTimestamps(req.body));
    if (req.body.status === "Completed" && !before[0]?.completedAt) {
      updateData.completedAt = new Date();
    }
    const p = await db.update(projectsTable).set(updateData)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
      .returning();
    if (!p.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(p[0]);

    const newStatus = req.body.status;
    if (newStatus && before[0]?.status !== newStatus) {
      let firstName: string | undefined;
      let lastName: string | undefined;
      let customerEmail: string | undefined;
      let customerPhone: string | undefined;

      if (p[0].customerId) {
        const rows = await db.select().from(customersTable).where(eq(customersTable.id, p[0].customerId)).limit(1);
        const c = rows[0];
        if (c) { firstName = c.firstName; lastName = c.lastName; customerEmail = c.email ?? undefined; customerPhone = c.phone ?? undefined; }
      }

      const ctx = {
        tenantId: p[0].tenantId,
        firstName,
        lastName,
        customerEmail,
        customerPhone,
        projectTitle: p[0].title,
      };

      if (newStatus === "In Progress") {
        fireNotification({ ...ctx, event: "project_in_progress" });
      } else if (newStatus === "Completed") {
        fireNotification({ ...ctx, event: "project_completed" });
      }
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/projects/:id", requireTenantAccess, async (req, res) => {
  try {
    // Verify ownership first, then deep-delete (project updates die with the project).
    // A bare delete FK-violated (HTTP 500) on any project that had an update posted.
    const owned = await db.select({ id: projectsTable.id }).from(projectsTable)
      .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId))).limit(1);
    if (owned.length) await deleteProjectsDeep([owned[0].id]);
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Confirms :id refers to a project the caller's tenant actually owns (or bypasses for SUPER_ADMIN). */
async function requireOwnedProject(req: any, res: any): Promise<number | null> {
  const project = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, Number(req.params.id)), tenantFilter(req, projectsTable.tenantId)))
    .limit(1);
  if (!project.length) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return project[0].id;
}

router.get("/projects/:id/updates", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const updates = await db.select().from(projectUpdatesTable)
      .where(eq(projectUpdatesTable.projectId, projectId))
      .orderBy(sql`${projectUpdatesTable.createdAt} desc`);
    res.json(updates);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/projects/:id/updates", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const u = await db.insert(projectUpdatesTable).values({ ...req.body, projectId }).returning();
    res.status(201).json(u[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * The estimated work on a job (migration 0045).
 *
 * `total` is DERIVED on write, never taken from the request. The job's estimate
 * is the sum of these lines, so a caller that edits a quantity and forgets to
 * recompute the total would silently misprice the job — and that number goes on
 * to become a quote and then an invoice. The client may send whatever it likes;
 * the server decides what the line is worth.
 *
 * Ownership is checked through the parent job on every route via the existing
 * `requireOwnedProject`, so a line can only ever be read or written by the
 * business the job belongs to.
 */
/** Quantity x unit price, to the penny, as a fixed-point string. */
function lineTotal(quantity: unknown, unitPrice: unknown): string {
  const q = Number(quantity);
  const u = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(u)) return "0.00";
  return (q * u).toFixed(2);
}

router.get("/projects/:id/items", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const items = await db.select().from(projectItemsTable)
      .where(eq(projectItemsTable.projectId, projectId))
      .orderBy(projectItemsTable.sortOrder);
    res.json(items);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/projects/:id/items", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const body = req.body ?? {};
    const item = await db.insert(projectItemsTable).values({
      ...body,
      projectId,
      quantity: String(body.quantity ?? "1"),
      unitPrice: String(body.unitPrice ?? "0"),
      total: lineTotal(body.quantity ?? 1, body.unitPrice ?? 0),
    }).returning();
    res.status(201).json(item[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/projects/:id/items/:itemId", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    const itemId = Number(req.params.itemId);
    const [existing] = await db.select().from(projectItemsTable)
      .where(and(eq(projectItemsTable.id, itemId), eq(projectItemsTable.projectId, projectId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const patch = sanitizeUpdate(req.body) as Record<string, unknown>;
    patch.total = lineTotal(patch.quantity ?? existing.quantity, patch.unitPrice ?? existing.unitPrice);

    const [item] = await db.update(projectItemsTable).set(patch)
      .where(and(eq(projectItemsTable.id, itemId), eq(projectItemsTable.projectId, projectId)))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/projects/:id/items/:itemId", requireTenantAccess, async (req, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    await db.delete(projectItemsTable)
      .where(and(eq(projectItemsTable.id, Number(req.params.itemId)), eq(projectItemsTable.projectId, projectId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Sharing a job with the customer ──────────────────────────────────────────

/**
 * Mint (or return) the link a customer can open without an account.
 *
 * Idempotent: asking twice gives the same link back rather than orphaning the
 * one already printed on a job sheet or stuck to a boiler.
 *
 * 24 random bytes. The token IS the credential, so it has to be long enough
 * that it cannot be walked — and unguessable matters more here than short,
 * because nobody types this: they scan it or tap it.
 */
router.post("/projects/:id/share", requireTenantAccess, async (req: any, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;

    const [job] = await db.select().from(projectsTable)
      .where(eq(projectsTable.id, projectId)).limit(1);
    if (!job) { res.status(404).json({ error: "Not found" }); return; }

    let token = job.shareToken;
    // A revoked share is deliberately NOT reused. The old link stays dead so a
    // scan of an out-of-date printed sheet fails closed rather than quietly
    // coming back to life.
    if (!token || job.shareRevokedAt) {
      token = randomBytes(24).toString("hex");
      await db.update(projectsTable).set({
        shareToken: token,
        shareCreatedAt: new Date(),
        shareRevokedAt: null,
      }).where(eq(projectsTable.id, projectId));
    }

    const base = process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com";
    res.json({ token, url: `${base}/j/${token}` });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/projects/:id/share", requireTenantAccess, async (req: any, res) => {
  try {
    const projectId = await requireOwnedProject(req, res);
    if (projectId === null) return;
    await db.update(projectsTable).set({ shareRevokedAt: new Date() })
      .where(eq(projectsTable.id, projectId));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
