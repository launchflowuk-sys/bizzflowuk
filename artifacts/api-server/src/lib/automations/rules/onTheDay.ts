import { z } from "zod/v4";
import { db, projectsTable, certificatesTable, usersTable } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type AutomationRule } from "../types";
import { automationEmail, customerRecipient, notifyCustomer, tenantVoice } from "../notify";

const PLATFORM_BASE_URL = process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com";

/**
 * Remind the customer you are coming.
 *
 * The single most expensive event in a trade's week is a no-access: driving to
 * an address, finding nobody in, and losing the slot. A reminder the day before
 * turns most of those into a rebook, which costs a text instead of a morning.
 *
 * It goes out the day before by default rather than the morning of, because the
 * point is to give the customer time to say "actually, can we move it?" while
 * the slot can still be refilled.
 */
export const appointmentReminders: AutomationRule = {
  key: "appointment_reminders",
  group: "On the day",
  label: "Remind customers you are coming",
  description:
    "A short message the day before, with the date, the time and who is coming. "
    + "A no-access costs a morning; a reminder costs a text.",
  configSchema: z.object({
    hoursBefore: z.union([z.number(), z.string()]).optional(),
    includeEngineer: z.boolean().optional(),
  }),
  defaults: { hoursBefore: 24, includeEngineer: true },
  setup: [
    { key: "hoursBefore", label: "Hours before the appointment", type: "number", hint: "24 gives them time to move it while you can still fill the slot." },
    { key: "includeEngineer", label: "Say who is coming", type: "boolean", hint: "First name only — it is what puts people at ease answering the door." },
  ],
  async run(ctx) {
    const voice = await tenantVoice(ctx.tenantId);
    if (!voice) return 0;

    const hours = Math.max(1, Number(ctx.config.hoursBefore ?? 24) || 24);
    const includeEngineer = ctx.config.includeEngineer !== false;

    /**
     * The window is "starts between now and `hours` from now".
     *
     * Deliberately not "starts exactly `hours` from now": the sweep runs daily,
     * so an exact match would miss almost everything. Anything already started
     * is excluded — a reminder for a visit that is underway is worse than no
     * reminder.
     */
    const soon = await db.select().from(projectsTable).where(and(
      eq(projectsTable.tenantId, ctx.tenantId),
      sql`${projectsTable.scheduledStart} IS NOT NULL`,
      sql`${projectsTable.scheduledStart} > now()`,
      sql`${projectsTable.scheduledStart} <= (now() + ${hours} * INTERVAL '1 hour')`,
      sql`${projectsTable.status} <> 'Completed'`,
    )).limit(100);

    let done = 0;
    for (const job of soon) {
      const to = await customerRecipient(job.customerId);
      if (!to?.email && !to?.phone) continue;

      const start = new Date(job.scheduledStart!);
      const day = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      const time = job.allDay
        ? null
        : start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }).replace(":00", "");

      let engineerLine = "";
      if (includeEngineer && job.assignedUserId) {
        const [u] = await db.select({ firstName: usersTable.firstName })
          .from(usersTable).where(eq(usersTable.id, job.assignedUserId)).limit(1);
        // First name only. The customer needs to know who is knocking; the rest
        // belongs to the staff member.
        if (u?.firstName) engineerLine = `${u.firstName} will be the one coming out to you.`;
      }

      const ok = await ctx.act({
        subjectType: "project",
        subjectId: job.id,
        summary: `Reminded ${to.firstName} about ${day}${time ? ` at ${time}` : ""}`,
      });
      if (!ok) continue;

      const jobLink = job.shareToken && !job.shareRevokedAt
        ? `${PLATFORM_BASE_URL}/j/${job.shareToken}`
        : null;

      const when = time ? `${day} at ${time}` : day;
      const sent = await notifyCustomer({
        tenantId: ctx.tenantId,
        voice,
        to,
        event: "appointment_reminder",
        subject: `Reminder: we are coming ${time ? `on ${when}` : when}`,
        html: automationEmail(voice, {
          greeting: `Hi ${to.firstName},`,
          body: [
            `Just a reminder that we are booked in for <strong>${when}</strong> for ${job.title}.`,
            ...(engineerLine ? [engineerLine] : []),
            "If that no longer suits, reply or give us a ring and we will move it.",
          ],
          ...(jobLink ? { cta: { label: "See your booking", url: jobLink } } : {}),
        }),
        sms: `Hi ${to.firstName}, ${voice.name} here — reminder we are booked in for ${when}. Reply or call if you need to move it.`,
      });
      if (sent) done++;
    }
    return done;
  },
};

/**
 * Send the paperwork when the job is done.
 *
 * A gas safety record that never leaves the van is, legally, a certificate that
 * was not issued — and the customer chasing it a week later is the trade's
 * problem, not theirs. This sends whatever exists against the finished job so
 * nobody has to remember.
 *
 * Only certificates that have actually been issued go out. A draft going to a
 * landlord as though it were a record is worse than being late.
 */
export const sendPaperwork: AutomationRule = {
  key: "send_paperwork",
  group: "After the job",
  label: "Send the paperwork when the job is finished",
  description:
    "The certificates raised against a job go to the customer once it is marked complete, "
    + "so nothing sits in the van waiting to be remembered.",
  requires: "certificates",
  configSchema: z.object({ hoursAfter: z.union([z.number(), z.string()]).optional() }),
  defaults: { hoursAfter: 2 },
  setup: [
    { key: "hoursAfter", label: "Hours after completing to send", type: "number", hint: "A couple of hours leaves room to tidy the record up first." },
  ],
  async run(ctx) {
    const hours = Math.max(0, Number(ctx.config.hoursAfter ?? 2) || 0);
    const { sendCertificateEmail } = await import("../../certificates/deliver");
    const { getCertificateType } = await import("../../certificates/registry");
    const { certificateAppliancesTable, tenantsTable, tenantSettingsTable } = await import("@workspace/db");

    const [tenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, ctx.tenantId)).limit(1);
    const [settings] = await db.select().from(tenantSettingsTable)
      .where(eq(tenantSettingsTable.tenantId, ctx.tenantId)).limit(1);

    const finished = await db.select().from(projectsTable).where(and(
      eq(projectsTable.tenantId, ctx.tenantId),
      eq(projectsTable.status, "Completed"),
      sql`${projectsTable.completedAt} IS NOT NULL`,
      sql`${projectsTable.completedAt} <= (now() - ${hours} * INTERVAL '1 hour')`,
      // A window, so switching this on does not re-send a year of paperwork.
      sql`${projectsTable.completedAt} >= (now() - INTERVAL '14 days')`,
    )).limit(100);

    let done = 0;
    for (const job of finished) {
      const certs = await db.select().from(certificatesTable).where(and(
        eq(certificatesTable.tenantId, ctx.tenantId),
        eq(certificatesTable.projectId, job.id),
        eq(certificatesTable.status, "issued"),
        isNull(certificatesTable.supersededById),
      ));
      if (!certs.length) continue;

      for (const cert of certs) {
        const type = getCertificateType(cert.type);
        // A certificate whose type is no longer in the registry cannot be
        // rendered, and a half-built email to a landlord is worse than none.
        if (!type) continue;

        const ok = await ctx.act({
          subjectType: "certificate",
          subjectId: cert.id,
          summary: `Sent ${cert.reference} after "${job.title}" was completed`,
        });
        if (!ok) continue;

        const appliances = await db.select().from(certificateAppliancesTable)
          .where(eq(certificateAppliancesTable.certificateId, cert.id));

        await sendCertificateEmail({ certificate: cert, appliances, type, tenant, settings })
          .catch(() => { /* sendAndRecord has already logged the failure */ });
        done++;
      }
    }
    return done;
  },
};
