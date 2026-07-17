import { stat, mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class InvalidUploadError extends Error {}
export class ForbiddenError extends Error {}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const PENDING_UPLOAD_TTL_MS = 15 * 60 * 1000; // 15 min, matches the old presigned-URL TTL

interface PendingUpload {
  absolutePath: string;
  expiresAt: number;
}

// Single-instance in-memory pending-upload table. Fine for this app's scale
// (one API container); if the api service is ever scaled horizontally this
// needs to move to the DB or a shared cache instead.
const pendingUploads = new Map<string, PendingUpload>();

function sweepExpiredUploads(): void {
  const now = Date.now();
  for (const [token, entry] of pendingUploads) {
    if (entry.expiresAt < now) pendingUploads.delete(token);
  }
}

function getUploadRoot(): string {
  const dir = process.env["PRIVATE_UPLOAD_DIR"];
  if (!dir) {
    throw new Error(
      "PRIVATE_UPLOAD_DIR environment variable is required for file uploads.",
    );
  }
  return path.resolve(dir);
}

/**
 * Local-disk object store. Object paths are shaped
 * "/objects/{tenantId}/{uuid}.{ext}" — the tenant id embedded in the path IS
 * the access-control boundary: only that tenant's staff (or a super admin)
 * may read it back. Replaces a prior implementation that only worked against
 * Replit's dev-sidecar GCS credential exchange, which doesn't exist in the
 * Docker/Coolify production deployment.
 */
export class ObjectStorageService {
  /** Step 1 of upload: validate + reserve a disk path, hand back a same-origin PUT target. */
  async createUploadTarget({
    tenantId,
    contentType,
    declaredSize,
  }: {
    tenantId: number;
    contentType: string;
    declaredSize: number;
  }): Promise<{ uploadURL: string; objectPath: string }> {
    const ext = ALLOWED_CONTENT_TYPES[contentType];
    if (!ext) {
      throw new InvalidUploadError(`Unsupported content type: ${contentType}`);
    }
    if (declaredSize > MAX_UPLOAD_BYTES) {
      throw new InvalidUploadError(`File too large (max ${MAX_UPLOAD_BYTES} bytes)`);
    }

    sweepExpiredUploads();

    const objectId = randomUUID();
    const objectPath = `/objects/${tenantId}/${objectId}${ext}`;
    const absolutePath = path.join(getUploadRoot(), String(tenantId), `${objectId}${ext}`);

    const token = randomUUID();
    pendingUploads.set(token, {
      absolutePath,
      expiresAt: Date.now() + PENDING_UPLOAD_TTL_MS,
    });

    return { uploadURL: `/api/storage/uploads/direct/${token}`, objectPath };
  }

  /** Step 2 of upload: client PUTs the raw file to the token URL from step 1. */
  async completeUpload(token: string, body: Buffer): Promise<void> {
    const pending = pendingUploads.get(token);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingUploads.delete(token);
      throw new ObjectNotFoundError();
    }
    if (body.length === 0 || body.length > MAX_UPLOAD_BYTES) {
      pendingUploads.delete(token);
      throw new InvalidUploadError(`File too large (max ${MAX_UPLOAD_BYTES} bytes)`);
    }

    await mkdir(path.dirname(pending.absolutePath), { recursive: true });
    await writeFile(pending.absolutePath, body);
    pendingUploads.delete(token);
  }

  /** Resolve + authorize a stored object for download. */
  async resolveForDownload(
    objectPath: string,
    requester: { tenantId: number | null; isSuperAdmin: boolean },
  ): Promise<{ absolutePath: string; contentType: string }> {
    const match = /^\/objects\/(\d+)\/([a-f0-9-]+\.(jpg|png|webp|gif|heic|heif|pdf|doc|docx))$/i.exec(objectPath);
    if (!match) throw new ObjectNotFoundError();

    const ownerTenantId = Number(match[1]);
    const filename = match[2];

    if (!requester.isSuperAdmin && requester.tenantId !== ownerTenantId) {
      throw new ForbiddenError();
    }

    const root = getUploadRoot();
    const absolutePath = path.resolve(root, String(ownerTenantId), filename);
    if (!absolutePath.startsWith(root + path.sep)) {
      // Path traversal guard — unreachable given the regex above, kept as defense in depth.
      throw new ObjectNotFoundError();
    }

    try {
      await stat(absolutePath);
    } catch {
      throw new ObjectNotFoundError();
    }

    return { absolutePath, contentType: contentTypeForExt(path.extname(filename)) };
  }

  /** Public, unauthenticated assets served from {PRIVATE_UPLOAD_DIR}/public/** (e.g. seeded gallery images). */
  async resolvePublicObject(filePath: string): Promise<{ absolutePath: string; contentType: string } | null> {
    const root = path.resolve(getUploadRoot(), "public");
    const absolutePath = path.resolve(root, filePath);
    if (!absolutePath.startsWith(root + path.sep)) return null;

    try {
      await stat(absolutePath);
    } catch {
      return null;
    }

    return { absolutePath, contentType: contentTypeForExt(path.extname(absolutePath)) };
  }
}

function contentTypeForExt(ext: string): string {
  const found = Object.entries(ALLOWED_CONTENT_TYPES).find(([, e]) => e === ext.toLowerCase());
  return found?.[0] ?? "application/octet-stream";
}
