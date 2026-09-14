import { Router } from "express";
import { db } from "@workspace/db";
import {
  certificatesTable, certificateAppliancesTable,
  tenantsTable, tenantSettingsTable, customersTable,
} from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import {
  getCertificateType, listCertificateTypes,
  certificateInputSchema, computeExpiry,
} from "../lib/certificates/registry";
import { logger } from "../lib/logger";

const router = Router();

function tid(req: any): number { return req.authUser?.tenantId!; }

/**
 * Next reference for a tenant and type, e.g. "BPS-GS-0007".
 *
 * Shares the per-tenant prefix with quotes (tenant_settings.quote_ref_prefix),
 * so a business's paperwork reads consistently, with the type code between them.
 * Numbering counts only references already on this exact prefix, so changing the
 * prefix starts a fresh sequence rather than inheriting old numbers.
 */
async function nextReference(tenantId: number, typeCode: string): Promise<string> {
  const [settings] = await db.select({ prefix: tenantSettingsTable.quoteRefPrefix })
    .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  const base = `${(settings?.prefix || "CERT").toUpperCase()}-${typeCode}`;

  const rows = await db.select({ reference: certificatesTable.reference })
    .from(certificatesTable)
    .where(and(
      eq(certificatesTable.tenantId, tenantId),
      sql`${certificatesTable.reference} ~ ${`^${base}-[0-9]{1,6}$`}`,
    ));

  let max = 0;
  for (const r of rows) {
    const n = Number(r.reference.slice(base.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${base}-${String(max + 1).padStart(4, "0")}`;
}

/** An issued certificate is a legal record. Nothing may edit it in place. */
function isLocked(status: string): boolean {
  return status !== "draft";
}

async function loadAppliances(certificateIds: number[]) {
  if (!certificateIds.length) return new Map<number, any[]>();
  const rows = await db.select().from(certificateAppliancesTable)
    .where(inArray(certificateAppliancesTable.certificateId, certificateIds))
    .orderBy(certificateAppliancesTable.position);
  const byCert = new Map<number, any[]>();
  for (const r of rows) {
    const list = byCert.get(r.certificateId) ?? [];
    list.push(r);
    byCert.set(r.certificateId, list);
  }
  return byCert;
}

// ── Types registry ───────────────────────────────────────────────────────────

router.get("/certificates/types", requireTenantAccess, (_req, res) => {
  // The zod schemas are server-side concerns; the client only needs the shape.
  res.json(listCertificateTypes().map(t => ({
    key: t.key,
    label: t.label,
    shortLabel: t.shortLabel,
    validMonths: t.validMonths,
    renewalWindowDays: t.renewalWindowDays,
    deliveryDeadlineDays: t.deliveryDeadlineDays,
    retentionMonths: t.retentionMonths,
    usesAppliances: t.usesAppliances,
  })));
});

// ── List ─────────────────────────────────────────────────────────────────────

router.get("/certificates", requireTenantAccess, async (req: any, res) => {
  try {
    const { status, type, dueWithinDays } = req.query as Record<string, string | undefined>;

    const filters = [eq(certificatesTable.tenantId, tid(req))];
    if (status) filters.push(eq(certificatesTable.status, status));
    if (type) filters.push(eq(certificatesTable.type, type));
    if (dueWithinDays) {
      const days = Math.max(0, Math.min(400, Number(dueWithinDays) || 0));
      filters.push(sql`${certificatesTable.expiresAt} <= (CURRENT_DATE + ${days} * INTERVAL '1 day')`);
      filters.push(eq(certificatesTable.status, "issued"));
      filters.push(sql`${certificatesTable.supersededById} IS NULL`);
    }

    const rows = await db.select().from(certificatesTable)
      .where(and(...filters))
      .orderBy(desc(certificatesTable.checkedAt), desc(certificatesTable.id))
      .limit(500);

    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Read one ─────────────────────────────────────────────────────────────────

router.get("/certificates/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }

    const appliances = (await loadAppliances([cert.id])).get(cert.id) ?? [];
    res.json({ ...cert, appliances });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Create draft ─────────────────────────────────────────────────────────────

router.post("/certificates", requireTenantAccess, async (req: any, res) => {
  try {
    const parsed = certificateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid certificate", details: parsed.error.issues });
      return;
    }
    const input = parsed.data;

    const type = getCertificateType(input.type);
    if (!type) { res.status(400).json({ error: `Unknown certificate type: ${input.type}` }); return; }

    const dataParsed = type.dataSchema.safeParse(input.data ?? {});
    if (!dataParsed.success) {
      res.status(400).json({ error: "Invalid data for this certificate type", details: dataParsed.error.issues });
      return;
    }

    const tenantId = tid(req);
    const reference = await nextReference(tenantId, type.referenceCode);

    const [cert] = await db.insert(certificatesTable).values({
      tenantId,
      type: type.key,
      reference,
      status: "draft",
      customerId: input.customerId ?? null,
      projectId: input.projectId ?? null,
      propertyAddress: input.propertyAddress,
      propertyPostcode: input.propertyPostcode ?? null,
      landlordName: input.landlordName ?? null,
      landlordAddress: input.landlordAddress ?? null,
      tenantContactName: input.tenantContactName ?? null,
      tenantContactEmail: input.tenantContactEmail || null,
      // The signed-in user is the engineer unless one is named explicitly.
      engineerUserId: req.authUser?.id ?? null,
      engineerName: input.engineerName ?? req.authUser?.name ?? null,
      engineerRegNo: input.engineerRegNo ?? null,
      checkedAt: input.checkedAt,
      expiresAt: computeExpiry(input.checkedAt, type.validMonths),
      outcome: input.outcome ?? null,
      data: dataParsed.data as Record<string, unknown>,
    }).returning();

    if (type.usesAppliances && input.appliances?.length) {
      await db.insert(certificateAppliancesTable).values(
        input.appliances.map((a: any, i: number) => ({ ...a, certificateId: cert.id, position: i })),
      );
    }

    const appliances = (await loadAppliances([cert.id])).get(cert.id) ?? [];
    res.status(201).json({ ...cert, appliances });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Update draft ─────────────────────────────────────────────────────────────

router.patch("/certificates/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }

    if (isLocked(cert.status)) {
      res.status(409).json({
        error: "This certificate has been issued and cannot be edited. Create a replacement instead.",
        supersede: `/certificates/${cert.id}/supersede`,
      });
      return;
    }

    const parsed = certificateInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid certificate", details: parsed.error.issues });
      return;
    }
    const input = parsed.data;
    const type = getCertificateType(input.type ?? cert.type);
    if (!type) { res.status(400).json({ error: "Unknown certificate type" }); return; }

    const patch: Record<string, unknown> = {};
    for (const k of [
      "propertyAddress", "propertyPostcode", "landlordName", "landlordAddress",
      "tenantContactName", "tenantContactEmail", "engineerName", "engineerRegNo",
      "outcome", "customerId", "projectId",
    ] as const) {
      if (input[k] !== undefined) patch[k] = input[k] === "" ? null : input[k];
    }
    if (input.checkedAt) {
      patch.checkedAt = input.checkedAt;
      patch.expiresAt = computeExpiry(input.checkedAt, type.validMonths);
    }
    if (input.data !== undefined) {
      const d = type.dataSchema.safeParse(input.data);
      if (!d.success) { res.status(400).json({ error: "Invalid data for this certificate type", details: d.error.issues }); return; }
      patch.data = d.data;
    }

    // A body that only replaces appliances leaves nothing to set on the parent,
    // and drizzle throws on an empty set() rather than treating it as a no-op.
    const [updated] = Object.keys(patch).length
      ? await db.update(certificatesTable).set(patch).where(eq(certificatesTable.id, id)).returning()
      : [cert];

    // Appliances are replaced wholesale when supplied — a partial merge on a
    // safety checklist is how a stale row survives into an issued record.
    if (input.appliances) {
      await db.delete(certificateAppliancesTable).where(eq(certificateAppliancesTable.certificateId, id));
      if (input.appliances.length) {
        await db.insert(certificateAppliancesTable).values(
          input.appliances.map((a: any, i: number) => ({ ...a, certificateId: id, position: i })),
        );
      }
    }

    const appliances = (await loadAppliances([id])).get(id) ?? [];
    res.json({ ...updated, appliances });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Delete draft ─────────────────────────────────────────────────────────────

router.delete("/certificates/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }

    if (isLocked(cert.status)) {
      res.status(409).json({ error: "An issued certificate cannot be deleted. Void it instead." });
      return;
    }

    await db.delete(certificatesTable).where(eq(certificatesTable.id, id));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
export { nextReference, isLocked, loadAppliances, tid };
