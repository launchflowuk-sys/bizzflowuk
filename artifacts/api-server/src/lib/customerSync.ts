import { db } from "@workspace/db";
import { customersTable, quotesTable, leadsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

/** A contact we can build (or match) a customer record from. */
export interface CustomerContact {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
}

const digitsOnly = (s?: string | null): string => (s ?? "").replace(/\D/g, "");

/**
 * Match-or-create a customer within a tenant, then backfill any contact details we now know but
 * the existing record was missing. Matching is by email first (most reliable), then by phone
 * (compared on digits only, so "+44 7…" and "07…" collapse to the same person). Idempotent:
 * calling it repeatedly for the same person returns the same customer id and never duplicates.
 */
export async function upsertCustomer(tenantId: number, c: CustomerContact): Promise<number | null> {
  const email = c.email?.trim() || null;
  const phone = c.phone?.trim() || null;

  // Need at least a name or a way to reach them — otherwise there's nothing worth a customer row.
  const firstName = c.firstName?.trim() || null;
  const lastName = c.lastName?.trim() || null;
  if (!firstName && !lastName && !email && !phone) return null;

  let existing: { id: number; email: string | null; phone: string | null; address: string | null; city: string | null; postcode: string | null } | undefined;

  if (email) {
    const rows = await db.select().from(customersTable)
      .where(and(eq(customersTable.tenantId, tenantId), sql`lower(${customersTable.email}) = ${email.toLowerCase()}`))
      .limit(1);
    existing = rows[0];
  }
  if (!existing && phone) {
    const digits = digitsOnly(phone);
    if (digits) {
      const rows = await db.select().from(customersTable)
        .where(and(eq(customersTable.tenantId, tenantId), sql`regexp_replace(coalesce(${customersTable.phone}, ''), '\\D', '', 'g') = ${digits}`))
        .limit(1);
      existing = rows[0];
    }
  }

  if (existing) {
    // Fill blanks only — never clobber details the tenant may have edited by hand.
    const patch: Record<string, string> = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.address && c.address) patch.address = c.address;
    if (!existing.city && c.city) patch.city = c.city;
    if (!existing.postcode && c.postcode) patch.postcode = c.postcode;
    if (Object.keys(patch).length) {
      await db.update(customersTable).set(patch).where(eq(customersTable.id, existing.id));
    }
    return existing.id;
  }

  const created = await db.insert(customersTable).values({
    tenantId,
    firstName: firstName ?? "—",
    lastName: lastName ?? "—",
    email,
    phone,
    address: c.address ?? null,
    city: c.city ?? null,
    postcode: c.postcode ?? null,
    notes: "Added automatically from an accepted quote.",
  }).returning({ id: customersTable.id });
  return created[0]?.id ?? null;
}

/**
 * Ensure the customer behind an accepted quote exists, and link them onto the quote. Called from
 * every path that accepts a quote (manual status change, convert-to-project, public accept, and
 * paid-in-full via Square) so the Customers table fills itself as deals close. Idempotent — if the
 * quote already has a customer, that id is returned untouched.
 * Returns the customer id, or null when there's no linked lead to source contact details from.
 */
export async function ensureCustomerForQuote(quoteId: number): Promise<number | null> {
  const quoteRows = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId)).limit(1);
  const quote = quoteRows[0];
  if (!quote) return null;
  if (quote.customerId) return quote.customerId;

  let contact: CustomerContact | null = null;
  if (quote.leadId) {
    const leadRows = await db.select().from(leadsTable).where(eq(leadsTable.id, quote.leadId)).limit(1);
    const lead = leadRows[0];
    if (lead) {
      contact = {
        firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone,
        address: lead.address, city: lead.city, postcode: lead.postcode,
      };
    }
  }
  if (!contact) return null;

  const customerId = await upsertCustomer(quote.tenantId, contact);
  if (customerId) {
    await db.update(quotesTable).set({ customerId }).where(eq(quotesTable.id, quote.id));
  }
  return customerId;
}
