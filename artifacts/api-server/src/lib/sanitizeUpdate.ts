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

/**
 * Turn ISO strings back into Dates for every timestamp column on a table.
 *
 * Driven by the TABLE's own schema rather than a hand-kept list of field
 * names, which is the difference that matters. `coerceTimestamps` above names
 * its fields, and the day tenant_settings gained `googleReviewsSyncedAt` it
 * covered everything except that — so Save Settings returned a 500 with
 * "value.toISOString is not a function" thrown from inside drizzle, and
 * nothing in the response to say why.
 *
 * The failure mode is what makes this worth generalising: these routes hand a
 * whole row to the client and take the whole row back, so a timestamp column
 * is harmless while it is NULL and breaks Save the moment some unrelated
 * feature starts writing it. Editing a review broke the same way the day
 * imported reviews arrived carrying `sourceCreatedAt`.
 */
export function coerceTableTimestamps<T extends Record<string, unknown>>(
  // A drizzle table, read for its column metadata. Typed loosely on purpose:
  // PgTable has no index signature, and the alternative is a generic signature
  // that every call site has to satisfy for no benefit here.
  table: object,
  body: T,
): T {
  const out: Record<string, unknown> = { ...body };
  for (const [key, column] of Object.entries(table as Record<string, unknown>)) {
    const value = out[key];
    if (typeof value !== "string" || value === "") continue;
    if ((column as any)?.columnType !== "PgTimestamp") continue;
    const parsed = new Date(value);
    // Anything unparseable is left alone, so the driver's own error still gets
    // to surface rather than an epoch date being written silently.
    if (!Number.isNaN(parsed.getTime())) out[key] = parsed;
  }
  return out as T;
}
