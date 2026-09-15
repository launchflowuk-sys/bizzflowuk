import { db, projectsTable, usersTable, customersTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendAndRecord } from "../emailLog";
import { buildSmtpConfig } from "../settingsHelpers";
import { logger } from "../logger";

/**
 * Tell the engineer they have been given a job.
 *
 * Brandon, on why he uses his current app at all: "I added Michael as an
 * engineer and can log his schedule on there which SENDS IT TO HIS EMAIL."
 *
 * We could already assign a job to somebody. Nothing told them. The assignment
 * sat in a dashboard that the engineer, who is under a sink somewhere, is not
 * looking at — so the actual handover still happened by phone, and the
 * software was just bookkeeping after the fact.
 *
 * Sent to the ENGINEER, not the customer: their own address, the full job
 * details including the notes and the customer's phone number, because this is
 * the person turning up and they need all of it.
 */

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function whenText(start: Date | null, end: Date | null, allDay: boolean): string {
  if (!start) return "No date set yet";
  const day = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (allDay) return day;
  const t = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }).replace(":00", "");
  return end ? `${day}, ${t(start)} to ${t(end)}` : `${day} at ${t(start)}`;
}

export async function notifyEngineerAssigned(projectId: number, tenantId: number): Promise<void> {
  try {
    const [job] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!job?.assignedUserId) return;

    const [engineer] = await db.select().from(usersTable)
      .where(eq(usersTable.id, job.assignedUserId)).limit(1);
    if (!engineer?.email) return;

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    const [settings] = await db.select().from(tenantSettingsTable)
      .where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);

    let customer: any = null;
    if (job.customerId) {
      const [c] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId)).limit(1);
      customer = c ?? null;
    }

    const address = [job.address, job.city, job.postcode].filter(Boolean).join(", ");
    const when = whenText(job.scheduledStart as Date | null, job.scheduledEnd as Date | null, job.allDay ?? false);
    const brand = (settings as any)?.primaryColor || "#102333";

    const rows: Array<[string, string]> = [["When", when]];
    if (address) rows.push(["Where", address]);
    if (customer) {
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
      if (name) rows.push(["Customer", name]);
      if (customer.phone) rows.push(["Phone", customer.phone]);
    }

    const mapsLink = address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#111827;max-width:560px">
  <p style="margin:0 0 14px">Hi${engineer.firstName ? ` ${esc(engineer.firstName)}` : ""}, you have been put on this job.</p>
  <p style="margin:0 0 14px;font-size:17px"><strong>${esc(job.title)}</strong></p>
  <table style="border-collapse:collapse;margin:0 0 16px">
    ${rows.map(([k, v]) => `<tr><td style="padding:3px 18px 3px 0;color:#6B7280">${esc(k)}</td><td style="padding:3px 0"><strong>${esc(v)}</strong></td></tr>`).join("")}
  </table>
  ${job.description ? `<p style="margin:0 0 14px;padding:12px 14px;background:#F8FAFC;border-left:3px solid ${esc(brand)};font-size:14.5px">${esc(job.description)}</p>` : ""}
  ${mapsLink ? `<p style="margin:0 0 18px"><a href="${esc(mapsLink)}" style="display:inline-block;background:${esc(brand)};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">Open in Maps</a></p>` : ""}
  <p style="margin:0;color:#6B7280;font-size:13px">${esc(tenant?.name ?? "")}</p>
</div>`;

    await sendAndRecord(
      {
        to: engineer.email,
        subject: `You're on: ${job.title}${job.scheduledStart ? ` — ${when}` : ""}`,
        html,
      },
      buildSmtpConfig(settings as any),
      { tenantId, event: "job_assigned" },
    );
  } catch (err) {
    // Never let this break the assignment itself. The job being in the diary
    // is the thing that matters; the email is how somebody finds out sooner.
    logger.error({ err, projectId, tenantId }, "Could not tell the engineer about their job");
  }
}
