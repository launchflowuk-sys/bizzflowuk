import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable, certificatesTable, customersTable, formatPropertyAddress } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";

/**
 * Properties, and the landlord portfolio view that falls out of them.
 *
 * The question this exists to answer is "what is due on which of my landlord's
 * flats", which free-text addresses on certificates could never answer because
 * the same building gets typed a dozen ways.
 */

const router = Router();

/** Every property, newest first, with what is certified on it. */
router.get("/properties", requireTenantAccess, async (req: any, res) => {
  try {
    const rows = await db
      .select({
        property: propertiesTable,
        customerName: sql<string | null>`concat_ws(' ', ${customersTable.firstName}, ${customersTable.lastName})`,
        certificateCount: sql<number>`(
          select count(*)::int from certificates c
          where c.property_id = ${propertiesTable.id} and c.status = 'issued'
        )`,
        nextExpiry: sql<string | null>`(
          select min(c.expires_at) from certificates c
          where c.property_id = ${propertiesTable.id} and c.status = 'issued' and c.expires_at >= now()
        )`,
        overdueCount: sql<number>`(
          select count(*)::int from certificates c
          where c.property_id = ${propertiesTable.id} and c.status = 'issued' and c.expires_at < now()
        )`,
      })
      .from(propertiesTable)
      .leftJoin(customersTable, eq(customersTable.id, propertiesTable.customerId))
      .where(and(tenantFilter(req, propertiesTable.tenantId), eq(propertiesTable.archived, false)))
      .orderBy(desc(propertiesTable.createdAt));

    res.json(rows.map(r => ({
      ...r.property,
      address: formatPropertyAddress(r.property),
      customerName: (r.customerName ?? "").trim() || null,
      certificateCount: r.certificateCount,
      nextExpiry: r.nextExpiry,
      overdueCount: r.overdueCount,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/properties", requireTenantAccess, async (req: any, res) => {
  try {
    const b = req.body ?? {};
    if (!b.addressLine1 || typeof b.addressLine1 !== "string" || !b.addressLine1.trim()) {
      res.status(400).json({ error: "The property needs at least a first line of address." });
      return;
    }
    const tenantId = req.authUser?.tenantId ?? -1;

    // A customerId from the body could point at another tenant's customer —
    // customers.customer_id carries no tenant constraint in the database.
    if (b.customerId != null) {
      const [owned] = await db.select({ id: customersTable.id }).from(customersTable)
        .where(and(eq(customersTable.id, Number(b.customerId)), eq(customersTable.tenantId, tenantId))).limit(1);
      if (!owned) { res.status(400).json({ error: "That customer does not belong to this business." }); return; }
    }

    const [row] = await db.insert(propertiesTable).values({
      tenantId,
      customerId: b.customerId != null ? Number(b.customerId) : null,
      addressLine1: String(b.addressLine1).trim().slice(0, 200),
      addressLine2: b.addressLine2?.trim() || null,
      city: b.city?.trim() || null,
      postcode: b.postcode?.trim().toUpperCase() || null,
      unit: b.unit?.trim() || null,
      propertyType: b.propertyType?.trim() || null,
      notes: b.notes?.slice(0, 2000) || null,
      accessNotes: b.accessNotes?.slice(0, 1000) || null,
      tenantName: b.tenantName?.trim() || null,
      tenantPhone: b.tenantPhone?.trim() || null,
    }).returning();

    res.status(201).json({ ...row, address: formatPropertyAddress(row) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/properties/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const b = req.body ?? {};
    const tenantId = req.authUser?.tenantId ?? -1;
    if (b.customerId != null) {
      const [owned] = await db.select({ id: customersTable.id }).from(customersTable)
        .where(and(eq(customersTable.id, Number(b.customerId)), eq(customersTable.tenantId, tenantId))).limit(1);
      if (!owned) { res.status(400).json({ error: "That customer does not belong to this business." }); return; }
    }

    const patch: Record<string, unknown> = {};
    for (const key of ["addressLine1", "addressLine2", "city", "postcode", "unit",
                       "propertyType", "notes", "accessNotes", "tenantName", "tenantPhone"]) {
      if (b[key] !== undefined) patch[key] = b[key] === "" ? null : b[key];
    }
    if (b.customerId !== undefined) patch.customerId = b.customerId != null ? Number(b.customerId) : null;
    if (b.archived !== undefined) patch.archived = !!b.archived;
    if (!Object.keys(patch).length) { res.status(400).json({ error: "Nothing to update" }); return; }

    const [row] = await db.update(propertiesTable).set(patch)
      .where(and(eq(propertiesTable.id, Number(req.params.id)), tenantFilter(req, propertiesTable.tenantId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, address: formatPropertyAddress(row) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** One property with its full certificate history — the portfolio detail view. */
router.get("/properties/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const [property] = await db.select().from(propertiesTable)
      .where(and(eq(propertiesTable.id, Number(req.params.id)), tenantFilter(req, propertiesTable.tenantId)))
      .limit(1);
    if (!property) { res.status(404).json({ error: "Not found" }); return; }

    const certificates = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.propertyId, property.id), tenantFilter(req, certificatesTable.tenantId)))
      .orderBy(desc(certificatesTable.issuedAt));

    res.json({ ...property, address: formatPropertyAddress(property), certificates });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
