import { db } from "@workspace/db";
import { certificatesTable, leadsTable, customersTable } from "@workspace/db";
import { eq, and, sql, isNull } from "drizzle-orm";
import { getCertificateType } from "./registry";
import { fireNotification } from "../notifications";
import { logger } from "../logger";

/**
 * The renewal sweep — the part that makes the engine worth having.
 *
 * A renewal is not a new concept, it is a lead. The dashboard already has lead
 * ageing, the "needs you today" panel, one-tap Call and WhatsApp, the admin
 * email and the SMS path. A renewal that arrives as a lead row inherits every
 * one of those for free. A separate "renewals inbox" would duplicate all of it
 * and split the operator's attention across two screens.
 *
 * Idempotent: renewal_notified_at is the latch, so running this twice in a day —
 * or re-running it by hand while debugging — creates nothing extra.
 */

export type SweepResult = { scanned: number; raised: number; skipped: number };

export async function sweepRenewals(opts: { windowDays?: number; tenantId?: number } = {}): Promise<SweepResult> {
  const windowDays = Math.max(1, Math.min(365, opts.windowDays ?? 60));

  const filters = [
    eq(certificatesTable.status, "issued"),
    isNull(certificatesTable.supersededById),
    isNull(certificatesTable.renewalNotifiedAt),
    sql`${certificatesTable.expiresAt} <= (CURRENT_DATE + ${windowDays} * INTERVAL '1 day')`,
  ];
  if (opts.tenantId) filters.push(eq(certificatesTable.tenantId, opts.tenantId));

  const due = await db.select().from(certificatesTable).where(and(...filters)).limit(500);

  let raised = 0, skipped = 0;

  for (const cert of due) {
    const type = getCertificateType(cert.type);
    if (!type) { skipped++; continue; }

    try {
      // Contact details come from the linked customer where there is one; a
      // certificate with no customer still raises a lead, because the property
      // address alone is enough for the operator to act on.
      // firstName and lastName are NOT NULL on leads, so they take a fallback
      // rather than a null — a renewal with no customer on file still has to
      // reach the pipeline, and the property address is what the operator acts on.
      let firstName = "";
      let lastName = "";
      let email: string | null = null;
      let phone: string | null = null;

      if (cert.customerId) {
        const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, cert.customerId)).limit(1);
        if (cust) {
          firstName = cust.firstName ?? "";
          lastName = cust.lastName ?? "";
          email = cust.email ?? null;
          phone = cust.phone ?? null;
        }
      }

      const [lead] = await db.insert(leadsTable).values({
        tenantId: cert.tenantId,
        reference: `REN-${cert.reference}`,
        status: "New",
        source: "Renewal",
        serviceInterest: type.label,
        firstName: firstName || cert.landlordName || "Renewal due",
        lastName,
        email,
        phone,
        address: cert.propertyAddress,
        postcode: cert.propertyPostcode,
        notes: `${type.label} due ${cert.expiresAt}. Renews ${cert.reference}, checked ${cert.checkedAt}.`,
      }).returning();

      // Latch first, notify after: a failed email must not cause a duplicate
      // lead on the next run.
      await db.update(certificatesTable)
        .set({ renewalNotifiedAt: new Date() })
        .where(eq(certificatesTable.id, cert.id));

      fireNotification({
        tenantId: cert.tenantId,
        event: "lead_new",
        leadId: lead.id,
        firstName: lead.firstName ?? undefined,
        lastName: lead.lastName ?? undefined,
        customerEmail: lead.email ?? undefined,
        customerPhone: lead.phone ?? undefined,
        reference: lead.reference ?? undefined,
        serviceInterest: lead.serviceInterest ?? undefined,
        address: lead.address ?? undefined,
        postcode: lead.postcode ?? undefined,
        notes: lead.notes ?? undefined,
      }).catch(e => logger.error({ err: e, certificateId: cert.id }, "Renewal notification failed"));

      raised++;
    } catch (err) {
      logger.error({ err, certificateId: cert.id }, "Failed to raise a renewal lead");
      skipped++;
    }
  }

  if (raised || skipped) {
    logger.info({ scanned: due.length, raised, skipped, windowDays }, "Certificate renewal sweep complete");
  }
  return { scanned: due.length, raised, skipped };
}
