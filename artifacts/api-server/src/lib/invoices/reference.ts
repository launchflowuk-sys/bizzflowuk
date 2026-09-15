import { db, invoicesTable, tenantSettingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * The next invoice reference for a tenant.
 *
 * Extracted from the invoices route so the recurring-invoice sweep numbers its
 * copies exactly the way a hand-raised invoice is numbered. Two functions that
 * both "work out the next reference" is how a tenant ends up with two INV-0042
 * in the same year.
 *
 * Shares the quote prefix so a customer's paperwork reads as one set of
 * documents. Counts only references already on this exact prefix, so changing
 * the prefix starts a fresh sequence rather than colliding with the old one.
 */
export async function nextInvoiceReference(tenantId: number): Promise<string> {
  const [settings] = await db.select({ prefix: tenantSettingsTable.quoteRefPrefix })
    .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  // A tenant with no prefix set gets a plain "INV-0001" rather than "INV-INV-0001".
  const prefix = settings?.prefix ? settings.prefix.toUpperCase() : null;
  const base = prefix ? `${prefix}-INV` : "INV";

  const rows = await db.select({ reference: invoicesTable.reference })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      sql`${invoicesTable.reference} ~ ${`^${base}-[0-9]{1,6}$`}`,
    ));

  let max = 0;
  for (const r of rows) {
    const n = Number(r.reference.slice(base.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${base}-${String(max + 1).padStart(4, "0")}`;
}
