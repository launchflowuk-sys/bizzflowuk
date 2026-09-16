import { Router } from "express";
import { db, certificatesTable, certificatePhotosTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import {
  storeCertificatePhoto, readCertificateFile, removeCertificateFile,
} from "../lib/certificates/storage";
import { tid } from "./certificates";

/**
 * Photographs on a certificate.
 *
 * Its own file rather than more lines on certificates.ts, which is already the
 * longest route module in the trade set.
 *
 * The photo arrives as a data URL that the browser has already shrunk — a
 * phone camera produces four megabytes and the useful version is nearer two
 * hundred kilobytes. Doing that resize in the browser rather than here is
 * deliberate and it is not about our CPU: the engineer is on a phone in a
 * plant room on one bar, and the upload that never finishes is the one that
 * makes them stop using it.
 */
const router = Router();

/** Generous next to a resized photo, mean next to an untouched camera file. */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const ACCEPTED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function ownedCertificate(req: any, id: number) {
  const [cert] = await db.select().from(certificatesTable)
    .where(and(eq(certificatesTable.id, id), eq(certificatesTable.tenantId, tid(req)))).limit(1);
  return cert ?? null;
}

/** Everything attached to one certificate, oldest first. */
router.get("/certificates/:id/photos", requireTenantAccess, async (req: any, res) => {
  try {
    const cert = await ownedCertificate(req, Number(req.params.id));
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    const rows = await db.select({
      id: certificatePhotosTable.id,
      applianceKey: certificatePhotosTable.applianceKey,
      caption: certificatePhotosTable.caption,
      contentType: certificatePhotosTable.contentType,
      byteSize: certificatePhotosTable.byteSize,
      createdAt: certificatePhotosTable.createdAt,
    }).from(certificatePhotosTable)
      .where(eq(certificatePhotosTable.certificateId, cert.id))
      .orderBy(asc(certificatePhotosTable.position), asc(certificatePhotosTable.id));
    // Deliberately without `path`: it is ours, and the only way to the bytes is
    // the route below, which checks ownership.
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/certificates/:id/photos", requireTenantAccess, async (req: any, res) => {
  try {
    const cert = await ownedCertificate(req, Number(req.params.id));
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (cert.status !== "draft") {
      res.status(409).json({ error: "This certificate has been issued. Create a replacement to change it." });
      return;
    }

    const dataUrl = String(req.body?.dataUrl ?? "");
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) { res.status(400).json({ error: "That does not look like a photo we can take." }); return; }

    const contentType = match[1];
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) {
      res.status(400).json({ error: "That photo is too large — try taking it again." });
      return;
    }

    const stored = await storeCertificatePhoto(tid(req), cert.id, bytes, ACCEPTED[contentType]);
    const [row] = await db.insert(certificatePhotosTable).values({
      certificateId: cert.id,
      applianceKey: typeof req.body?.applianceKey === "string" ? req.body.applianceKey.slice(0, 64) : null,
      path: stored,
      caption: typeof req.body?.caption === "string" ? req.body.caption.trim().slice(0, 200) || null : null,
      contentType,
      byteSize: bytes.length,
      position: Number(req.body?.position) || 0,
    }).returning();

    res.status(201).json({
      id: row.id, applianceKey: row.applianceKey, caption: row.caption,
      contentType: row.contentType, byteSize: row.byteSize, createdAt: row.createdAt,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** The bytes. Behind auth and an ownership check, never a guessable path. */
router.get("/certificates/:id/photos/:photoId", requireTenantAccess, async (req: any, res) => {
  try {
    const cert = await ownedCertificate(req, Number(req.params.id));
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    const [photo] = await db.select().from(certificatePhotosTable).where(and(
      eq(certificatePhotosTable.id, Number(req.params.photoId)),
      eq(certificatePhotosTable.certificateId, cert.id),
    )).limit(1);
    if (!photo) { res.status(404).json({ error: "Not found" }); return; }

    const bytes = await readCertificateFile(photo.path);
    if (!bytes) { res.status(404).json({ error: "That photo is missing from storage." }); return; }

    res.setHeader("Content-Type", photo.contentType);
    // Private: it is somebody's property, and the record it belongs to is a
    // legal document about that property.
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(bytes);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/certificates/:id/photos/:photoId", requireTenantAccess, async (req: any, res) => {
  try {
    const cert = await ownedCertificate(req, Number(req.params.id));
    if (!cert) { res.status(404).json({ error: "Not found" }); return; }
    if (cert.status !== "draft") {
      res.status(409).json({ error: "This certificate has been issued and cannot be changed." });
      return;
    }
    const [photo] = await db.select().from(certificatePhotosTable).where(and(
      eq(certificatePhotosTable.id, Number(req.params.photoId)),
      eq(certificatePhotosTable.certificateId, cert.id),
    )).limit(1);
    if (!photo) { res.status(404).json({ error: "Not found" }); return; }

    await db.delete(certificatePhotosTable).where(eq(certificatePhotosTable.id, photo.id));
    // The row is the record; the file going or staying is housekeeping, so the
    // delete is not allowed to fail the request.
    await removeCertificateFile(photo.path);
    res.json({ ok: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
