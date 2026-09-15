import { Router } from "express";
import { db } from "@workspace/db";
import { filesTable, FILE_CATEGORIES } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { buildObjectUrl } from "../lib/settingsHelpers";

/**
 * Files: the paperwork, on every phone.
 *
 * The bytes are uploaded through the storage service that already exists
 * (`POST /dashboard/uploads/request-url`, then a PUT to the returned target),
 * which is tenant-scoped and size-limited. These routes only manage the index
 * over those objects.
 *
 * Nothing here ever returns a raw object path as a link. A file is reached
 * through the signed-token storage route, so a URL that escapes the business
 * expires instead of staying open.
 */

const router = Router();

const VALID_CATEGORIES = new Set(FILE_CATEGORIES.map(c => c.key as string));

/** The category list, so the UI is never out of step with what the API accepts. */
router.get("/files/categories", requireTenantAccess, (_req, res) => {
  res.json(FILE_CATEGORIES);
});

/**
 * Everything on file, pinned first, then newest.
 *
 * `expiringSoon` is computed here rather than in the browser so the same
 * definition applies wherever it is shown — including, later, to the assistant.
 */
router.get("/files", requireTenantAccess, async (req: any, res) => {
  try {
    const rows = await db.select().from(filesTable)
      .where(tenantFilter(req, filesTable.tenantId))
      .orderBy(desc(filesTable.pinned), desc(filesTable.createdAt));

    const now = Date.now();
    const THIRTY_DAYS = 30 * 86_400_000;

    res.json(rows.map(f => {
      const expiresAt = f.expiresAt ? new Date(f.expiresAt) : null;
      return {
        ...f,
        // The fetchable, signed address. Regenerated per response, so it is
        // short-lived by construction.
        url: buildObjectUrl(f.objectPath),
        expired: !!expiresAt && expiresAt.getTime() < now,
        expiringSoon: !!expiresAt && expiresAt.getTime() >= now && expiresAt.getTime() - now < THIRTY_DAYS,
      };
    }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Record a file that has already been uploaded.
 *
 * `objectPath` comes from the upload-target response, which only ever issues
 * paths inside the caller's own tenant prefix — so a path from elsewhere cannot
 * be registered here and made readable.
 */
router.post("/files", requireTenantAccess, async (req: any, res) => {
  try {
    const { name, category, objectPath, contentType, sizeBytes, notes, expiresAt, pinned } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Give the file a name." });
      return;
    }
    if (!objectPath || typeof objectPath !== "string") {
      res.status(400).json({ error: "The upload did not complete. Please try again." });
      return;
    }
    const tenantId = req.authUser?.tenantId ?? -1;
    // The storage service issues paths under the tenant's own prefix. Anything
    // else is either a bug or someone trying to index another tenant's object.
    if (!objectPath.includes(`/${tenantId}/`)) {
      req.log.warn({ tenantId, objectPath }, "File registration rejected: path outside the tenant prefix");
      res.status(400).json({ error: "That upload does not belong to this business." });
      return;
    }

    const [row] = await db.insert(filesTable).values({
      tenantId,
      name: name.trim().slice(0, 200),
      category: VALID_CATEGORIES.has(category) ? category : "other",
      objectPath,
      contentType: contentType ?? null,
      sizeBytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
      notes: typeof notes === "string" ? notes.slice(0, 1000) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      pinned: !!pinned,
      uploadedByUserId: req.authUser?.id ?? null,
    }).returning();

    res.status(201).json({ ...row, url: buildObjectUrl(row.objectPath) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/files/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const { name, category, notes, expiresAt, pinned } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) patch.name = name.trim().slice(0, 200);
    if (typeof category === "string" && VALID_CATEGORIES.has(category)) patch.category = category;
    if (typeof notes === "string") patch.notes = notes.slice(0, 1000);
    if (expiresAt !== undefined) patch.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (pinned !== undefined) patch.pinned = !!pinned;

    // drizzle throws on an empty .set(), so an update with nothing in it is a
    // no-op rather than a 500.
    if (!Object.keys(patch).length) { res.status(400).json({ error: "Nothing to update" }); return; }

    const [row] = await db.update(filesTable).set(patch)
      .where(and(eq(filesTable.id, Number(req.params.id)), tenantFilter(req, filesTable.tenantId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, url: buildObjectUrl(row.objectPath) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/files/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const [row] = await db.delete(filesTable)
      .where(and(eq(filesTable.id, Number(req.params.id)), tenantFilter(req, filesTable.tenantId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    // The stored object is left in place deliberately. Deleting the index entry
    // is instant and reversible by re-registering; deleting bytes is neither,
    // and an accidental tap should not destroy a company's insurance document.
    res.json({ ok: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Counts for the dashboard and, later, the assistant. */
router.get("/files/summary", requireTenantAccess, async (req: any, res) => {
  try {
    const [row] = await db.select({
      total: sql<number>`count(*)::int`,
      expired: sql<number>`count(*) filter (where ${filesTable.expiresAt} < now())::int`,
      expiringSoon: sql<number>`count(*) filter (where ${filesTable.expiresAt} >= now() and ${filesTable.expiresAt} < now() + interval '30 days')::int`,
    }).from(filesTable).where(tenantFilter(req, filesTable.tenantId));
    res.json(row ?? { total: 0, expired: 0, expiringSoon: 0 });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
