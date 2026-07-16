/**
 * Strips fields a PATCH body must never be allowed to set directly — most
 * importantly `tenantId`, since these routes are authenticated by tenant
 * membership but write with `.set(req.body)`: without this, a request could
 * move a row to a different tenant (or rewrite its id/timestamps) by simply
 * including those fields in the JSON body.
 */
export function sanitizeUpdate<T extends Record<string, unknown>>(body: T): Omit<T, "id" | "tenantId" | "createdAt" | "updatedAt"> {
  const { id, tenantId, createdAt, updatedAt, ...rest } = body as Record<string, unknown>;
  return rest as Omit<T, "id" | "tenantId" | "createdAt" | "updatedAt">;
}
