import { Router } from "express";
import { db } from "@workspace/db";
import {
  certificatesTable, certificateAppliancesTable,
  tenantsTable, tenantSettingsTable, customersTable, propertiesTable,
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
    category: t.category,
    validMonths: t.validMonths,
    expires: t.expires,
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


/**
 * Bring in last year's certificates.
 *
 * Every plumber arriving on the platform already has a year of CP12s in a
 * folder, an old system, or a filing cabinet. Without these the renewal engine
 * is blind for twelve months: it only knows about certificates issued here, so
 * the first year of reminders — the entire reason they signed up — never fires.
 *
 * Imported records are deliberately NOT issued by this engine. They are marked
 * `imported`, they keep whatever reference the old system gave them, and they
 * carry no generated PDF. What they do carry is an expiry date, which is all
 * the renewal sweep needs. A record that says "we do not know what is on this
 * document, but it runs out on 4 March" is worth far more than no record.
 *
 * Accepts a batch, reports per-row, and never fails the whole import because
 * one line was wrong — somebody pasting thirty rows should not lose twenty-nine
 * good ones to a typo in the tenth.
 */
router.post("/certificates/import", requireTenantAccess, async (req: any, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows?.length) { res.status(400).json({ error: "Nothing to import." }); return; }
    if (rows.length > 500) { res.status(400).json({ error: "Import up to 500 at a time." }); return; }

    const tenantId = tid(req);
    const results: Array<{ row: number; ok: boolean; id?: number; reference?: string; error?: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      try {
        const type = getCertificateType(r.type || "gas_safety");
        if (!type) throw new Error(`Unknown certificate type: ${r.type}`);

        const address = String(r.propertyAddress ?? "").trim();
        if (!address) throw new Error("Property address is required");

        const expiresAt = r.expiresAt ? new Date(r.expiresAt) : null;
        if (!expiresAt || Number.isNaN(expiresAt.getTime())) throw new Error("A valid expiry date is required");

        const issuedAt = r.issuedAt ? new Date(r.issuedAt) : null;

        /**
         * When the inspection actually happened. Required by the schema, and
         * genuinely important: it is the date on the paper document.
         *
         * If the import does not carry one, derive it from the expiry rather
         * than refusing the row. A CP12 runs twelve months, so expiry minus a
         * year is the check date to within a day or two — and a record with an
         * approximately-right check date and an exactly-right expiry is far
         * more useful than no record at all.
         */
        const checked = r.checkedAt ? new Date(r.checkedAt)
          : issuedAt && !Number.isNaN(issuedAt.getTime()) ? issuedAt
          : new Date(expiresAt.getTime() - 365 * 86_400_000);
        if (Number.isNaN(checked.getTime())) throw new Error("Check date is not a valid date");

        // A propertyId from the body must belong to this tenant — the column is
        // a plain foreign key with no tenant constraint.
        let propertyId: number | null = null;
        if (r.propertyId != null) {
          const [owned] = await db.select({ id: propertiesTable.id }).from(propertiesTable)
            .where(and(eq(propertiesTable.id, Number(r.propertyId)), eq(propertiesTable.tenantId, tenantId))).limit(1);
          if (!owned) throw new Error("That property does not belong to this business");
          propertyId = owned.id;
        }

        const reference = String(r.reference ?? "").trim() || await nextReference(tenantId, type.referenceCode);

        const [cert] = await db.insert(certificatesTable).values({
          tenantId,
          type: type.key,
          reference,
          // Issued, not draft: it is a real certificate that really exists, and
          // only issued records are swept for renewal.
          status: "issued",
          propertyAddress: address,
          propertyPostcode: r.propertyPostcode?.trim() || null,
          landlordName: r.landlordName?.trim() || null,
          propertyId,
          checkedAt: checked.toISOString().slice(0, 10),
          issuedAt: issuedAt && !Number.isNaN(issuedAt.getTime()) ? issuedAt : null,
          // expires_at is a DATE column: it wants YYYY-MM-DD, not a Date, and
          // passing the object silently fails the insert's type contract.
          expiresAt: expiresAt.toISOString().slice(0, 10),
          imported: true,
          importedNote: r.note?.slice(0, 500) || "Imported from previous records",
          data: {},
        }).returning();

        results.push({ row: i + 1, ok: true, id: cert.id, reference: cert.reference });
      } catch (rowErr: any) {
        results.push({ row: i + 1, ok: false, error: rowErr?.message || "Could not import this row" });
      }
    }

    const imported = results.filter(r => r.ok).length;
    req.log.info({ tenantId, imported, failed: results.length - imported }, "Certificate import");
    res.status(201).json({ imported, failed: results.length - imported, results });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

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
