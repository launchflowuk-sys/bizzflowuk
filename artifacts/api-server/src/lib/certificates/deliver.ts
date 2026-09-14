import { db } from "@workspace/db";
import { customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendAndRecord } from "../emailLog";
import { buildSmtpConfig } from "../settingsHelpers";
import { readCertificatePdf } from "./storage";
import type { CertificateType } from "./registry";

/**
 * Certificate delivery.
 *
 * Goes through sendAndRecord, which logs every automated send including
 * "SMTP not configured" — so a silent drop is visible in the dashboard rather
 * than discovered months later when someone asks where their copy went. That
 * log is also the evidence trail for the statutory delivery deadline: proving
 * a copy was sent, and when, is a query rather than a feature.
 */

type DeliverArgs = {
  certificate: any;
  appliances: any[];
  type: CertificateType;
  tenant: any;
  settings: any;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function buildHtml(a: DeliverArgs, recipientRole: "landlord" | "occupier"): string {
  const { certificate: c, type, tenant, settings } = a;
  const deadline = type.deliveryDeadlineDays;

  const intro = recipientRole === "occupier"
    ? `A ${esc(type.label.toLowerCase())} has been completed for the property you occupy. Your copy is attached.`
    : `The ${esc(type.label.toLowerCase())} for your property is attached.`;

  const retention = type.retentionMonths && recipientRole === "landlord"
    ? `<p style="margin:0 0 14px;color:#4B5563">Please keep this record for ${Math.round(type.retentionMonths / 12)} years.${deadline ? ` A copy must also reach your tenants within ${deadline} days of the check.` : ""}</p>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#111827;max-width:560px">
  <p style="margin:0 0 14px">${intro}</p>
  <table style="border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:3px 18px 3px 0;color:#6B7280">Property</td><td style="padding:3px 0"><strong>${esc([c.propertyAddress, c.propertyPostcode].filter(Boolean).join(", "))}</strong></td></tr>
    <tr><td style="padding:3px 18px 3px 0;color:#6B7280">Reference</td><td style="padding:3px 0"><strong>${esc(c.reference)}</strong></td></tr>
    <tr><td style="padding:3px 18px 3px 0;color:#6B7280">Date of check</td><td style="padding:3px 0"><strong>${esc(fmtDate(c.checkedAt))}</strong></td></tr>
    <tr><td style="padding:3px 18px 3px 0;color:#6B7280">Next check due</td><td style="padding:3px 0"><strong>${esc(fmtDate(c.expiresAt))}</strong></td></tr>
    <tr><td style="padding:3px 18px 3px 0;color:#6B7280">Engineer</td><td style="padding:3px 0"><strong>${esc(c.engineerName)}${c.engineerRegNo ? `, reg ${esc(c.engineerRegNo)}` : ""}</strong></td></tr>
  </table>
  ${retention}
  <p style="margin:0 0 14px;color:#4B5563">We will remind you before the next one is due.</p>
  <p style="margin:0;color:#6B7280;font-size:13px">${esc(tenant?.name ?? "")}${settings?.phone ? ` · ${esc(settings.phone)}` : ""}${settings?.email ? ` · ${esc(settings.email)}` : ""}</p>
</div>`;
}

export async function sendCertificateEmail(a: DeliverArgs): Promise<void> {
  const { certificate: c, type, tenant, settings } = a;
  const smtp = buildSmtpConfig(settings as any);

  const pdf = c.pdfPath ? await readCertificatePdf(c.pdfPath) : null;
  const attachments = pdf ? [{ filename: `${c.reference}.pdf`, content: pdf, contentType: "application/pdf" }] : undefined;

  // The landlord, via the linked customer record where we have one.
  let landlordEmail: string | null = null;
  if (c.customerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, c.customerId)).limit(1);
    landlordEmail = cust?.email ?? null;
  }

  const recipients: Array<{ to: string; role: "landlord" | "occupier" }> = [];
  if (landlordEmail) recipients.push({ to: landlordEmail, role: "landlord" });
  if (c.tenantContactEmail) recipients.push({ to: c.tenantContactEmail, role: "occupier" });

  for (const r of recipients) {
    await sendAndRecord(
      {
        to: r.to,
        subject: `${type.label} — ${c.propertyAddress}`,
        html: buildHtml(a, r.role),
        attachments: attachments as any,
      },
      smtp,
      { tenantId: c.tenantId, event: "certificate_issued" },
    );
  }

  // Nobody to send to is worth recording too — otherwise "we emailed it" and
  // "there was no address on file" look identical from the dashboard.
  if (!recipients.length) {
    await sendAndRecord(
      {
        to: settings?.adminNotificationEmail || tenant?.email || "",
        subject: `${type.label} issued with no recipient — ${c.reference}`,
        html: `<p>${esc(type.label)} <strong>${esc(c.reference)}</strong> was issued for ${esc(c.propertyAddress)} but no landlord or tenant email was on file, so no copy was sent.</p>`,
      },
      smtp,
      { tenantId: c.tenantId, event: "certificate_no_recipient" },
    );
  }
}
