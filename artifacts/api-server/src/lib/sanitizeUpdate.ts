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

/**
 * Turns ISO date strings into Date objects for the timestamp fields these
 * routes accept.
 *
 * JSON has no date type, so any client sending `{"sentAt": "2026-09-14T12:00:00Z"}`
 * previously produced a 500 from the driver with nothing to explain it. That is
 * a trap for anyone writing against this API, including our own test suite,
 * which is exactly how it was found. Anything unparseable is left alone so the
 * existing validation still gets to reject it.
 */
const TIMESTAMP_FIELDS = [
  "sentAt", "acceptedAt", "completedAt", "paidAt", "issuedAt", "voidedAt",
  "scheduledStart", "scheduledEnd", "publishedAt", "reviewRequestSentAt",
  "lastChasedAt", "renewalNotifiedAt",
] as const;

export function coerceTimestamps<T extends Record<string, unknown>>(body: T): T {
  const out: Record<string, unknown> = { ...body };
  for (const field of TIMESTAMP_FIELDS) {
    const value = out[field];
    if (typeof value !== "string" || value === "") continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) out[field] = parsed;
  }
  return out as T;
}
