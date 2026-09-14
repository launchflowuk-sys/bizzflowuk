import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../logger";

/**
 * Certificate PDF storage.
 *
 * Writes into the same api-uploads volume the rest of the app uses, under a
 * per-tenant prefix. Files are served only through the authenticated
 * /certificates/:id/pdf route, which checks tenant ownership first — nothing
 * here is reachable by guessing a path.
 */

function uploadsRoot(): string {
  return process.env["PRIVATE_UPLOAD_DIR"] || "/data/uploads";
}

/** @returns the stored path, relative to the uploads root. */
export async function storeCertificatePdf(tenantId: number, certificateId: number, pdf: Buffer): Promise<string> {
  const rel = path.posix.join(String(tenantId), "certificates", `${certificateId}-${randomUUID()}.pdf`);
  const abs = path.join(uploadsRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, pdf);
  return rel;
}

export async function readCertificatePdf(relPath: string): Promise<Buffer | null> {
  // Defensive: a stored path is ours, but a traversal here would read anything
  // the process can, so resolve and confirm it stays under the root.
  const root = path.resolve(uploadsRoot());
  const abs = path.resolve(root, relPath);
  if (!abs.startsWith(root + path.sep)) {
    logger.warn({ relPath }, "Rejected certificate path outside the uploads root");
    return null;
  }
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}
