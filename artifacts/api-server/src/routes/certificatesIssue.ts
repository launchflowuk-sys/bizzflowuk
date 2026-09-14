import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { certificatesTable, certificateAppliancesTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { getCertificateType, computeExpiry } from "../lib/certificates/registry";
import { renderCertificatePdf } from "../lib/certificates/pdf";
import { storeCertificatePdf } from "../lib/certificates/storage";
import { sendCertificateEmail } from "../lib/certificates/deliver";
import { nextReference, loadAppliances, tid } from "./certificates";

const router = Router();

/**
 * Issue a certificate.
 *
 * This is the point the record becomes legal, so it is also the point it becomes
 * immutable. After this: render the PDF, store it, hash it, stamp issued_at, and
 * refuse every further write at the route layer. A correction never edits — it
 * supersedes, creating a new certificate and pointing the old one at it, so both
 * remain downloadable and the history is defensible.
 */
router.post("/certificates/:id/issue", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);

    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tenantId))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (cert.status !== "draft") {
      res.status(409).json({ error: "Only a draft can be issued." });
      return;
    }

    const type = getCertificateType(cert.type);
    if (!type) { res.status(400).json({ error: "Unknown certificate type" }); return; }

    const appliances = (await loadAppliances([cert.id])).get(cert.id) ?? [];

    // ── Refuse to issue an incomplete record ────────────────────────────────
    // The software records, the engineer certifies. We never infer or default a
    // safety outcome — an unanswered check blocks issue rather than passing.
    const problems: string[] = [];
    if (!cert.engineerName) problems.push("The engineer's name is required.");
    if (type.key === "gas_safety" && !cert.engineerRegNo) {
      problems.push("A Gas Safe registration number is required on a landlord gas safety record.");
    }
    if (!cert.propertyAddress) problems.push("A property address is required.");
    if (type.usesAppliances && appliances.length === 0) {
      problems.push("At least one appliance must be recorded.");
    }
    for (const a of appliances) {
      if (a.wasInspected && a.safeToUse === null) {
        problems.push(`"${a.location}": you must record whether the appliance is safe to use.`);
      }
    }
    if (problems.length) {
      res.status(422).json({ error: "This certificate is not ready to issue", problems });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    const [settings] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);

    const pdf = await renderCertificatePdf({ certificate: cert, appliances, type, tenant, settings });
    const sha256 = createHash("sha256").update(pdf).digest("hex");
    const pdfPath = await storeCertificatePdf(tenantId, cert.id, pdf);

    const [issued] = await db.update(certificatesTable).set({
      status: "issued",
      issuedAt: new Date(),
      pdfPath,
      pdfSha256: sha256,
    }).where(eq(certificatesTable.id, cert.id)).returning();

    // Delivery is best-effort and always logged, so a silent drop is visible in
    // the dashboard rather than discovered when someone asks for their copy.
    sendCertificateEmail({ certificate: issued, appliances, type, tenant, settings })
      .catch(e => req.log.error({ err: e }, "Certificate email failed"));

    res.json({ ...issued, appliances });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Supersede: the correction path for an issued certificate.
 *
 * Copies the record into a fresh draft, links the old one forward, and leaves
 * the original downloadable. Editing in place would let the copy in a landlord's
 * inbox and the copy in the database disagree, which is exactly what the
 * retention rule exists to prevent.
 */
router.post("/certificates/:id/supersede", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);

    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tenantId))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (cert.status !== "issued") {
      res.status(409).json({ error: "Only an issued certificate can be superseded." });
      return;
    }
    if (cert.supersededById) {
      res.status(409).json({ error: "This certificate has already been superseded.", by: cert.supersededById });
      return;
    }

    const type = getCertificateType(cert.type);
    if (!type) { res.status(400).json({ error: "Unknown certificate type" }); return; }

    const checkedAt = (req.body?.checkedAt as string) || new Date().toISOString().slice(0, 10);
    const reference = await nextReference(tenantId, type.referenceCode);

    const [draft] = await db.insert(certificatesTable).values({
      tenantId,
      type: cert.type,
      reference,
      status: "draft",
      customerId: cert.customerId,
      projectId: cert.projectId,
      propertyAddress: cert.propertyAddress,
      propertyPostcode: cert.propertyPostcode,
      landlordName: cert.landlordName,
      landlordAddress: cert.landlordAddress,
      tenantContactName: cert.tenantContactName,
      tenantContactEmail: cert.tenantContactEmail,
      engineerUserId: req.authUser?.id ?? cert.engineerUserId,
      engineerName: cert.engineerName,
      engineerRegNo: cert.engineerRegNo,
      checkedAt,
      expiresAt: computeExpiry(checkedAt, type.validMonths),
      outcome: cert.outcome,
      data: cert.data,
    }).returning();

    const appliances = (await loadAppliances([cert.id])).get(cert.id) ?? [];
    if (appliances.length) {
      await db.insert(certificateAppliancesTable).values(appliances.map((a: any, i: number) => ({
        certificateId: draft.id,
        position: i,
        location: a.location,
        applianceType: a.applianceType,
        make: a.make,
        model: a.model,
        isLandlordOwned: a.isLandlordOwned,
        wasInspected: a.wasInspected,
        flueFlowPass: a.flueFlowPass,
        safetyDevicesPass: a.safetyDevicesPass,
        ventilationPass: a.ventilationPass,
        visualConditionPass: a.visualConditionPass,
        gasTightnessPass: a.gasTightnessPass,
        combustionReading: a.combustionReading,
        operatingPressure: a.operatingPressure,
        defects: a.defects,
        actionTaken: a.actionTaken,
        safeToUse: a.safeToUse,
      })));
    }

    await db.update(certificatesTable)
      .set({ status: "superseded", supersededById: draft.id })
      .where(eq(certificatesTable.id, cert.id));

    const copied = (await loadAppliances([draft.id])).get(draft.id) ?? [];
    res.status(201).json({ ...draft, appliances: copied });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Void: issued in error. The record and its PDF stay, the status says not to rely on it. */
router.post("/certificates/:id/void", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (cert.status === "draft") { res.status(409).json({ error: "A draft can simply be deleted." }); return; }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
    const [voided] = await db.update(certificatesTable)
      .set({ status: "void", data: { ...(cert.data as object), voidReason: reason } })
      .where(eq(certificatesTable.id, id)).returning();

    res.json(voided);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Download. Served through the authenticated route so one tenant can never read another's. */
router.get("/certificates/:id/pdf", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (!cert.pdfPath) { res.status(409).json({ error: "This certificate has not been issued yet." }); return; }

    const { readCertificatePdf } = await import("../lib/certificates/storage");
    const buf = await readCertificatePdf(cert.pdfPath);
    if (!buf) { res.status(404).json({ error: "The stored file is missing." }); return; }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${cert.reference}.pdf"`);
    res.send(buf);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
