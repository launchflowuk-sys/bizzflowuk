import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { certificatesTable, certificateAppliancesTable, certificatePhotosTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { getCertificateType, computeExpiry } from "../lib/certificates/registry";
import { renderCertificatePdf } from "../lib/certificates/pdf";
import { storeCertificatePdf, storeCertificateSignature } from "../lib/certificates/storage";
import { sendCertificateEmail } from "../lib/certificates/deliver";
import { nextReference, loadAppliances, tid } from "./certificates";

const router = Router();

/**
 * Capture a signature.
 *
 * On a gas safety record the engineer's signature is one of the particulars the
 * regulations require, so a record without one is not a finished document. Gas
 * Safe accept electronic signatures, which is what makes capturing it on a
 * phone at the property the intended route rather than a workaround.
 *
 * Only on a draft. A signature added after issue would mean the PDF in the
 * landlord's inbox and the record here no longer match, which is the whole
 * thing the issue lock exists to prevent -- correcting an issued record goes
 * through supersede.
 */
const MAX_SIGNATURE_BYTES = 400 * 1024;

router.post("/certificates/:id/signature", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const who = String(req.body?.who ?? "");
    if (who !== "engineer" && who !== "customer") {
      res.status(400).json({ error: "who must be engineer or customer" });
      return;
    }

    const [cert] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (cert.status !== "draft") {
      res.status(409).json({ error: "This certificate has been issued. Create a replacement to change it." });
      return;
    }

    // Clearing a signature is a legitimate thing to want after a bad squiggle.
    if (req.body?.dataUrl === null) {
      const [cleared] = await db.update(certificatesTable).set(
        who === "engineer"
          ? { engineerSignaturePath: null, signedAt: null }
          : { customerSignaturePath: null, customerSignatureName: null },
      ).where(eq(certificatesTable.id, id)).returning();
      res.json(cleared);
      return;
    }

    /**
     * Correcting who signed, without making them sign again.
     *
     * Sent with a name and no image. Worth handling here rather than as its own
     * endpoint: it is the same field on the same record, and a second route
     * would need the same draft check and the same ownership check to say the
     * same thing.
     */
    if (req.body?.dataUrl === undefined && typeof req.body?.name === "string") {
      if (who !== "customer") { res.status(400).json({ error: "Only the customer signature carries a name." }); return; }
      const [named] = await db.update(certificatesTable)
        .set({ customerSignatureName: req.body.name.trim().slice(0, 120) || null })
        .where(eq(certificatesTable.id, id)).returning();
      res.json(named);
      return;
    }

    const dataUrl = String(req.body?.dataUrl ?? "");
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) { res.status(400).json({ error: "Expected a PNG signature." }); return; }

    const png = Buffer.from(match[1], "base64");
    // A hand-drawn signature is tens of kilobytes. Anything near half a
    // megabyte is not a signature, and the cap is what stops this endpoint
    // being a way to fill the volume.
    if (!png.length || png.length > MAX_SIGNATURE_BYTES) {
      res.status(400).json({ error: "That signature image is not the right size." });
      return;
    }

    const stored = await storeCertificateSignature(tid(req), id, who, png);
    const [updated] = await db.update(certificatesTable).set(
      who === "engineer"
        ? { engineerSignaturePath: stored, signedAt: new Date() }
        : {
          customerSignaturePath: stored,
          customerSignatureName: typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) || null : null,
        },
    ).where(eq(certificatesTable.id, id)).returning();

    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

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
    /**
     * The engineer's signature is one of the particulars a landlord gas safety
     * record has to carry, so an unsigned one is not a finished document.
     * Enforced only where it is actually required -- a commissioning note or a
     * purge record does not need it, and demanding it everywhere would just
     * teach people to scribble something to get past the check.
     */
    if (type.key === "gas_safety" && !cert.engineerSignaturePath) {
      problems.push("A landlord gas safety record must carry the engineer's signature.");
    }
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

    const photos = await db.select().from(certificatePhotosTable)
      .where(eq(certificatePhotosTable.certificateId, cert.id))
      .orderBy(asc(certificatePhotosTable.position), asc(certificatePhotosTable.id));

    const pdf = await renderCertificatePdf({ certificate: cert, appliances, photos, type, tenant, settings });
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
