import { Router } from "express";
import {
  db, projectsTable, projectItemsTable, usersTable, customersTable,
  tenantsTable, tenantSettingsTable, invoicesTable,
} from "@workspace/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { paymentLinkRateLimiter } from "../middlewares/rateLimit";

/**
 * The job, as the customer sees it.
 *
 * Unauthenticated by design: the token in the URL is the credential, the same
 * way the payment link already works. That is the whole point — somebody
 * scanning a QR off a job sheet in their hallway is not going to make an
 * account to find out what time you are coming.
 *
 * WHAT IS EXPOSED IS A DELIBERATE, SHORT LIST. Anyone holding the link sees it,
 * so this endpoint names every field it returns rather than spreading the row.
 * Two things are kept back on purpose:
 *
 *   description   The job notes. "Access, parts needed, anything worth knowing
 *                 before you turn up" is written for the engineer, not for the
 *                 customer, and it is exactly where a trade would write "dog
 *                 bites" or "husband is difficult".
 *
 *   The engineer's surname, email and phone. A first name is what a customer
 *   needs to know who is knocking. The rest is the staff member's, not the
 *   business's, to give away.
 */

const router = Router();

/** Dates are sent whole; the browser formats them in the reader's own locale. */
router.get("/public/job/:token", paymentLinkRateLimiter, async (req, res) => {
  try {
    const token = String(req.params.token ?? "");
    // A short token means a truncated paste or a probe. Refuse before touching
    // the database so neither costs anything.
    if (token.length < 20) { res.status(404).json({ error: "Not found" }); return; }

    const [job] = await db.select().from(projectsTable).where(and(
      eq(projectsTable.shareToken, token),
      isNull(projectsTable.shareRevokedAt),
    )).limit(1);
    if (!job) { res.status(404).json({ error: "Not found" }); return; }

    const [tenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, job.tenantId)).limit(1);
    const [settings] = await db.select().from(tenantSettingsTable)
      .where(eq(tenantSettingsTable.tenantId, job.tenantId)).limit(1);

    let engineer: { firstName: string } | null = null;
    if (job.assignedUserId) {
      // First name only. That is what a customer needs in order to know who is
      // knocking; the surname, email and phone are the staff member's, not the
      // business's, to hand to whoever holds a link.
      const [u] = await db.select({ firstName: usersTable.firstName })
        .from(usersTable).where(eq(usersTable.id, job.assignedUserId)).limit(1);
      const first = (u?.firstName ?? "").trim();
      if (first) engineer = { firstName: first };
    }

    let customerFirstName: string | null = null;
    if (job.customerId) {
      const [c] = await db.select({ firstName: customersTable.firstName })
        .from(customersTable).where(eq(customersTable.id, job.customerId)).limit(1);
      customerFirstName = c?.firstName ?? null;
    }

    const items = await db.select({
      description: projectItemsTable.description,
      quantity: projectItemsTable.quantity,
      total: projectItemsTable.total,
    }).from(projectItemsTable)
      .where(eq(projectItemsTable.projectId, job.id))
      .orderBy(asc(projectItemsTable.sortOrder));

    /**
     * The invoice, if there is one — reference, status and what is outstanding,
     * so the customer can see they have been billed and whether it is settled.
     * Deliberately not the lines: the estimate above already says what the work
     * is, and the invoice email carries the detail.
     */
    const [invoice] = await db.select({
      reference: invoicesTable.reference,
      status: invoicesTable.status,
      total: invoicesTable.total,
      amountPaid: invoicesTable.amountPaid,
      dueOn: invoicesTable.dueOn,
    }).from(invoicesTable).where(and(
      eq(invoicesTable.projectId, job.id),
      sql`${invoicesTable.status} <> 'draft'`,
      sql`${invoicesTable.status} <> 'void'`,
    )).orderBy(asc(invoicesTable.id)).limit(1);

    res.json({
      business: {
        name: tenant?.name ?? "",
        phone: settings?.phone ?? null,
        email: settings?.email ?? null,
        logoUrl: settings?.logoUrl ?? null,
        primaryColor: settings?.primaryColor ?? null,
        whatsappNumber: settings?.whatsappNumber ?? null,
      },
      job: {
        title: job.title,
        status: job.status,
        scheduledStart: job.scheduledStart,
        scheduledEnd: job.scheduledEnd,
        allDay: job.allDay,
        completedAt: job.completedAt,
        address: job.address,
        city: job.city,
        postcode: job.postcode,
        customerFirstName,
      },
      engineer,
      items,
      invoice: invoice
        ? {
          reference: invoice.reference,
          status: invoice.status,
          total: invoice.total,
          outstanding: Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2),
          dueOn: invoice.dueOn,
        }
        : null,
    });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
