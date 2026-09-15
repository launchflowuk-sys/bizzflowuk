import { db } from "@workspace/db";
import { invoicesTable, invoiceItemsTable, customersTable, tenantsTable, tenantSettingsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendAndRecord } from "../emailLog";
import { buildSmtpConfig } from "../settingsHelpers";
import { outstanding } from "./totals";

/**
 * Invoice delivery.
 *
 * Through sendAndRecord, like certificates, so every send is logged — including
 * "SMTP not configured". A silent drop is then visible in the dashboard rather
 * than discovered when a customer says they never got the bill.
 */

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function money(v: unknown): string {
  const n = Number(v ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export type InvoiceEmailKind = "issued" | "chase";

export async function sendInvoiceEmail(invoiceId: number, tenantId: number, kind: InvoiceEmailKind = "issued"): Promise<void> {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!inv) return;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  const [settings] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  const smtp = buildSmtpConfig(settings as any);

  let to: string | null = null;
  let name = "";
  if (inv.customerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, inv.customerId)).limit(1);
    to = cust?.email ?? null;
    name = [cust?.firstName, cust?.lastName].filter(Boolean).join(" ");
  }

  // No address on file is itself worth recording, so "we sent it" and "there was
  // nobody to send it to" never look the same from the dashboard.
  if (!to) {
    await sendAndRecord(
      {
        to: (settings as any)?.adminNotificationEmail || tenant?.email || "",
        subject: `Invoice ${inv.reference} has no customer email`,
        html: `<p>Invoice <strong>${esc(inv.reference)}</strong> for ${money(inv.total)} could not be sent — no email address on the customer record.</p>`,
      },
      smtp,
      { tenantId, event: "invoice_no_recipient" },
    );
    return;
  }

  const items = await db.select().from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId)).orderBy(invoiceItemsTable.sortOrder);

  const due = outstanding(inv.total, inv.amountPaid);
  const overdue = kind === "chase";

  const rows = items.map(i => `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #E5E7EB">${esc(i.description)}</td>
    <td style="padding:7px 0;border-bottom:1px solid #E5E7EB;text-align:right;white-space:nowrap">${esc(i.quantity)} &times; ${money(i.unitPrice)}</td>
    <td style="padding:7px 0 7px 16px;border-bottom:1px solid #E5E7EB;text-align:right;white-space:nowrap"><strong>${money(i.total)}</strong></td>
  </tr>`).join("");

  const intro = overdue
    ? `<p style="margin:0 0 14px">A quick reminder that invoice <strong>${esc(inv.reference)}</strong> was due on ${esc(fmtDate(inv.dueOn))} and is still showing as unpaid. If you have already paid it, please ignore this — and apologies for the nudge.</p>`
    : `<p style="margin:0 0 14px">Please find invoice <strong>${esc(inv.reference)}</strong> below${name ? `, ${esc(name)}` : ""}. Payment is due by ${esc(fmtDate(inv.dueOn))}.</p>`;

  /**
   * How to pay it.
   *
   * The email listed what was owed and gave the customer no way to pay it —
   * they had to ring up and ask for a sort code, which is a day's delay on
   * every invoice and, on a chase, faintly insulting. Rendered per invoice
   * from the tenant's settings, so correcting a digit once corrects it
   * everywhere.
   *
   * The invoice's own terms win over the tenant default when it has some.
   */
  const s = settings as any;
  const bankRows = [
    s?.bankAccountName ? ["Account name", s.bankAccountName] : null,
    s?.bankName ? ["Bank", s.bankName] : null,
    s?.bankSortCode ? ["Sort code", s.bankSortCode] : null,
    s?.bankAccountNumber ? ["Account number", s.bankAccountNumber] : null,
    ["Reference", inv.reference],
  ].filter(Boolean) as Array<[string, string]>;

  const canBankTransfer = Boolean(s?.bankSortCode || s?.bankAccountNumber);
  const payBlock = canBankTransfer
    ? `<div style="margin:0 0 18px;padding:14px 16px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px">
    <p style="margin:0 0 8px;font-weight:bold">How to pay</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${bankRows.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#6B7280">${esc(k)}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`).join("")}
    </table>
    ${s?.paymentInstructions ? `<p style="margin:10px 0 0;font-size:13.5px;color:#374151">${esc(s.paymentInstructions)}</p>` : ""}
  </div>`
    : (s?.paymentInstructions
      ? `<div style="margin:0 0 18px;padding:14px 16px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px">
    <p style="margin:0 0 6px;font-weight:bold">How to pay</p>
    <p style="margin:0;font-size:13.5px;color:#374151">${esc(s.paymentInstructions)}</p>
  </div>`
      : "");

  const termsText = inv.terms || s?.invoiceTerms || null;

  /**
   * A link back to the job, when the job has one (migration 0047).
   *
   * The same page the QR on the job sheet opens, so a customer who has thrown
   * the paper away still has it in their inbox. Only when a share link already
   * exists and has not been revoked — minting one here would hand out a
   * credential the business never asked to issue.
   */
  let jobLink: string | null = null;
  if (inv.projectId) {
    const [job] = await db.select({
      token: projectsTable.shareToken,
      revokedAt: projectsTable.shareRevokedAt,
    }).from(projectsTable).where(eq(projectsTable.id, inv.projectId)).limit(1);
    if (job?.token && !job.revokedAt) {
      const base = process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com";
      jobLink = `${base}/j/${job.token}`;
    }
  }

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#111827;max-width:580px">
  ${intro}
  <table style="border-collapse:collapse;width:100%;margin:0 0 14px">${rows}</table>
  <table style="border-collapse:collapse;margin:0 0 18px">
    <tr><td style="padding:3px 18px 3px 0;color:#6B7280">Subtotal</td><td style="padding:3px 0;text-align:right">${money(inv.subtotal)}</td></tr>
    ${Number(inv.vatAmount) > 0 ? `<tr><td style="padding:3px 18px 3px 0;color:#6B7280">VAT</td><td style="padding:3px 0;text-align:right">${money(inv.vatAmount)}</td></tr>` : ""}
    ${Number(inv.cisDeduction) > 0 ? `<tr><td style="padding:3px 18px 3px 0;color:#6B7280">CIS deduction</td><td style="padding:3px 0;text-align:right">-${money(inv.cisDeduction)}</td></tr>` : ""}
    <tr><td style="padding:6px 18px 3px 0"><strong>Total</strong></td><td style="padding:6px 0 3px;text-align:right"><strong>${money(inv.total)}</strong></td></tr>
    ${Number(inv.amountPaid) > 0 ? `<tr><td style="padding:3px 18px 3px 0;color:#6B7280">Paid so far</td><td style="padding:3px 0;text-align:right">${money(inv.amountPaid)}</td></tr>
    <tr><td style="padding:3px 18px 3px 0"><strong>Still to pay</strong></td><td style="padding:3px 0;text-align:right"><strong>${money(due)}</strong></td></tr>` : ""}
  </table>
  ${payBlock}
  ${jobLink ? `<p style="margin:0 0 14px;font-size:14px"><a href="${jobLink}" style="color:#0369A1">See the job this invoice is for</a></p>` : ""}
  ${inv.notes ? `<p style="margin:0 0 14px;font-size:14px">${esc(inv.notes)}</p>` : ""}
  ${termsText ? `<p style="margin:0 0 14px;color:#6B7280;font-size:13.5px">${esc(termsText)}</p>` : ""}
  <p style="margin:0;color:#6B7280;font-size:13px">${esc(tenant?.name ?? "")}${settings?.phone ? ` · ${esc(settings.phone)}` : ""}${settings?.email ? ` · ${esc(settings.email)}` : ""}</p>
</div>`;

  /**
   * The PDF goes with it.
   *
   * An invoice in the body of an email is a message; an invoice with a PDF
   * attached is a document the customer can file, forward to their accountant
   * and find again in two years. Same bytes the dashboard preview shows, so
   * what was checked is what was sent.
   *
   * Best effort: if the PDF cannot be built, the email still goes with the
   * figures in the body. A missing attachment is a nuisance, a missing invoice
   * is money.
   */
  let attachments: Array<{ filename: string; content: Buffer; contentType: string }> | undefined;
  try {
    const { buildInvoicePdf } = await import("../../routes/invoices");
    const pdf = await buildInvoicePdf(invoiceId, tenantId);
    if (pdf) attachments = [{ filename: `${inv.reference}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch {
    // Logged by sendAndRecord as an email that went without its attachment.
  }

  await sendAndRecord(
    {
      to,
      attachments,
      subject: overdue
        ? `Reminder: invoice ${inv.reference} — ${money(due)} outstanding`
        : `Invoice ${inv.reference} from ${tenant?.name ?? ""}`.trim(),
      html,
    },
    smtp,
    { tenantId, event: overdue ? "invoice_chase" : "invoice_sent" },
  );
}
