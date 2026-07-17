import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { createReadStream } from "fs";
import { db } from "@workspace/db";
import { tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  RequestDashboardUploadUrlBody,
  RequestDashboardUploadUrlResponse,
} from "@workspace/api-zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  InvalidUploadError,
  ForbiddenError,
  verifyObjectAccessToken,
} from "../lib/objectStorage";
import { requireTenantAccess, tryBearerAuth } from "../middlewares/auth";
import { uploadRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Public (used by the unauthenticated colour-visualiser upload) but rate
 * limited, size/type validated, and scoped to a real tenant by slug. Returns
 * a same-origin PUT target — NOT a cloud presigned URL, see objectStorage.ts.
 */
router.post("/storage/uploads/request-url", uploadRateLimiter, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { tenantSlug, name, size, contentType } = parsed.data;

  try {
    const tenants = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, tenantSlug))
      .limit(1);
    if (!tenants.length) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const { uploadURL, objectPath } = await objectStorageService.createUploadTarget({
      tenantId: tenants[0].id,
      contentType,
      declaredSize: size,
    });

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { tenantSlug, name, size, contentType },
      }),
    );
  } catch (error) {
    if (error instanceof InvalidUploadError) {
      res.status(400).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /dashboard/uploads/request-url
 *
 * Authenticated equivalent of the endpoint above — scoped to the caller's own
 * tenant via their session rather than a tenantSlug in the body. Used by
 * dashboard features like the email composer's attachments.
 */
router.post("/dashboard/uploads/request-url", requireTenantAccess, async (req: Request, res: Response) => {
  const parsed = RequestDashboardUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { size, contentType } = parsed.data;

  try {
    const tenantId = req.authUser!.tenantId!;
    const { uploadURL, objectPath } = await objectStorageService.createUploadTarget({
      tenantId,
      contentType,
      declaredSize: size,
    });

    res.json(RequestDashboardUploadUrlResponse.parse({ uploadURL, objectPath }));
  } catch (error) {
    if (error instanceof InvalidUploadError) {
      res.status(400).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Error generating dashboard upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/uploads/direct/:token
 *
 * The one-time, short-lived target handed back by request-url above. Token
 * is single-use and expires in 15 minutes; still rate limited since it's
 * reachable without auth (the visualiser upload flow is anonymous by design).
 */
router.put(
  "/storage/uploads/direct/:token",
  uploadRateLimiter,
  express.raw({ type: "*/*", limit: "11mb" }),
  async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Missing file body" });
        return;
      }
      await objectStorageService.completeUpload(req.params.token as string, body);
      res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Upload token not found or expired" });
        return;
      }
      if (error instanceof InvalidUploadError) {
        res.status(400).json({ error: error.message });
        return;
      }
      req.log.error({ err: error }, "Error completing upload");
      res.status(500).json({ error: "Failed to complete upload" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Unconditionally public static assets (e.g. seeded gallery images) — no
 * auth/ACL by design.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const resolved = await objectStorageService.resolvePublicObject(filePath);
    if (!resolved) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.setHeader("Content-Type", resolved.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    createReadStream(resolved.absolutePath).pipe(res);
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Private object entities. The tenant id embedded in the object path (see objectStorage.ts) is
 * checked against the caller's tenant. Accepts two ways in: the normal Authorization: Bearer
 * header (in-app fetches), or a `?token=` query param signed for this exact path — a plain
 * browser navigation (an "open in new tab" click, or a link in an emailed notification) never
 * carries the Bearer header, so without the token fallback those links can never resolve.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const user = await tryBearerAuth(req);
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
    const hasValidObjectToken = !user && !!queryToken && verifyObjectAccessToken(queryToken, objectPath);

    if (!user && !hasValidObjectToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { absolutePath, contentType } = await objectStorageService.resolveForDownload(objectPath, {
      tenantId: user?.tenantId ?? null,
      isSuperAdmin: hasValidObjectToken || user?.role === "SUPER_ADMIN",
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(absolutePath).pipe(res);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
