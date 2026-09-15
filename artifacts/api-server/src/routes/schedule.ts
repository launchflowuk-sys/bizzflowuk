import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { projectsTable, usersTable, customersTable, calendarFeedsTable, tenantsTable } from "@workspace/db";
import { eq, and, sql, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { requireTenantAccess } from "../middlewares/auth";

const router = Router();
function tid(req: any): number { return req.authUser?.tenantId!; }

/**
 * The schedule.
 *
 * Reads the scheduledStart/scheduledEnd that projects have always carried — this
 * is a view over existing data rather than a new store of jobs, so a project
 * booked from the projects screen appears on the diary without anything syncing.
 */

const scheduleSchema = z.object({
  scheduledStart: z.string().nullable().optional(),
  scheduledEnd: z.string().nullable().optional(),
  assignedUserId: z.number().int().nullable().optional(),
  allDay: z.boolean().optional(),
  colour: z.string().nullable().optional(),
});

// ── The diary ────────────────────────────────────────────────────────────────

router.get("/schedule", requireTenantAccess, async (req: any, res) => {
  try {
    const { from, to, assignedUserId } = req.query as Record<string, string | undefined>;
    const filters = [eq(projectsTable.tenantId, tid(req))];

    // Unscheduled jobs are deliberately excluded: the diary shows booked work,
    // and an unbooked job belongs on the projects list.
    filters.push(sql`${projectsTable.scheduledStart} IS NOT NULL`);
    if (from) filters.push(sql`${projectsTable.scheduledStart} >= ${from}`);
    if (to) filters.push(sql`${projectsTable.scheduledStart} <= ${to}`);
    if (assignedUserId === "unassigned") filters.push(sql`${projectsTable.assignedUserId} IS NULL`);
    else if (assignedUserId) filters.push(eq(projectsTable.assignedUserId, Number(assignedUserId)));

    const rows = await db.select().from(projectsTable)
      .where(and(...filters))
      .orderBy(asc(projectsTable.scheduledStart))
      .limit(500);

    // Names resolved in two queries rather than per row — a busy month should not
    // fire a hundred lookups.
    const userIds = [...new Set(rows.map(r => r.assignedUserId).filter(Boolean))] as number[];
    const custIds = [...new Set(rows.map(r => r.customerId).filter(Boolean))] as number[];

    const users = userIds.length
      ? await db.select().from(usersTable).where(sql`${usersTable.id} = ANY(${sql.raw(`ARRAY[${userIds.join(",")}]`)})`)
      : [];
    const custs = custIds.length
      ? await db.select().from(customersTable).where(sql`${customersTable.id} = ANY(${sql.raw(`ARRAY[${custIds.join(",")}]`)})`)
      : [];

    const userById = new Map(users.map(u => [u.id, u]));
    const custById = new Map(custs.map(c => [c.id, c]));

    res.json(rows.map(r => {
      const u = r.assignedUserId ? userById.get(r.assignedUserId) : null;
      const c = r.customerId ? custById.get(r.customerId) : null;
      return {
        ...r,
        assignedTo: u ? { id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email } : null,
        customer: c ? { id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), phone: c.phone } : null,
      };
    }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Who a job can be dispatched to. Staff, not the website team list. */
router.get("/schedule/engineers", requireTenantAccess, async (req: any, res) => {
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.tenantId, tid(req)));
    res.json(rows.map(u => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl ?? null,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Book / move / assign ─────────────────────────────────────────────────────

router.patch("/schedule/:projectId", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.projectId);
    const tenantId = tid(req);

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.tenantId, tenantId))).limit(1);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }

    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid", details: parsed.error.issues }); return; }
    const input = parsed.data;

    // An engineer must belong to this tenant — otherwise a job could be assigned
    // across businesses by guessing an id.
    if (input.assignedUserId) {
      const [u] = await db.select().from(usersTable)
        .where(and(eq(usersTable.id, input.assignedUserId), eq(usersTable.tenantId, tenantId))).limit(1);
      if (!u) { res.status(400).json({ error: "That engineer is not on this team." }); return; }
    }

    const patch: Record<string, unknown> = {};
    if (input.scheduledStart !== undefined) patch.scheduledStart = input.scheduledStart ? new Date(input.scheduledStart) : null;
    if (input.scheduledEnd !== undefined) patch.scheduledEnd = input.scheduledEnd ? new Date(input.scheduledEnd) : null;
    if (input.assignedUserId !== undefined) patch.assignedUserId = input.assignedUserId;
    if (input.allDay !== undefined) patch.allDay = input.allDay;
    if (input.colour !== undefined) patch.colour = input.colour;

    if (!Object.keys(patch).length) { res.json(project); return; }

    // Booking a date moves an enquiry along by itself — the operator has just
    // told us it is scheduled, so making them set the status too is busywork.
    if (patch.scheduledStart && ["Enquiry", "Survey Booked", "Quote Approved"].includes(project.status)) {
      patch.status = "Scheduled";
    }

    const [updated] = await db.update(projectsTable).set(patch).where(eq(projectsTable.id, id)).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Calendar feed ────────────────────────────────────────────────────────────

/** Creates or returns this user's private feed URL. */
router.post("/schedule/feed", requireTenantAccess, async (req: any, res) => {
  try {
    const tenantId = tid(req);
    const userId = req.authUser?.id;

    const [existing] = await db.select().from(calendarFeedsTable)
      .where(and(eq(calendarFeedsTable.userId, userId), sql`${calendarFeedsTable.revokedAt} IS NULL`)).limit(1);

    const feed = existing ?? (await db.insert(calendarFeedsTable).values({
      tenantId, userId, token: randomBytes(24).toString("hex"), label: "My jobs",
    }).returning())[0];

    const base = process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com";
    res.json({ ...feed, url: `${base}/api/calendar/${feed.token}.ics` });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/schedule/feed", requireTenantAccess, async (req: any, res) => {
  try {
    await db.update(calendarFeedsTable).set({ revokedAt: new Date() })
      .where(and(eq(calendarFeedsTable.userId, req.authUser?.id), sql`${calendarFeedsTable.revokedAt} IS NULL`));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

function icsEscape(s: unknown): string {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(d: Date, allDay: boolean): string {
  const iso = d.toISOString();
  return allDay ? iso.slice(0, 10).replace(/-/g, "") : `${iso.slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * The read-only feed. Unauthenticated by design — the token is the credential,
 * which is how every calendar client expects a subscription URL to work. It is
 * revocable, and exposes nothing beyond what that user can already see in the
 * dashboard — their own bookings, or the tenant's diary if they own it.
 */
router.get("/calendar/:token.ics", async (req: any, res) => {
  try {
    const token = String(req.params.token || "").replace(/\.ics$/, "");
    const [feed] = await db.select().from(calendarFeedsTable)
      .where(and(eq(calendarFeedsTable.token, token), sql`${calendarFeedsTable.revokedAt} IS NULL`)).limit(1);
    if (!feed) { res.status(404).type("text/plain").send("Not found"); return; }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, feed.tenantId)).limit(1);

    /**
     * What the feed carries depends on who owns it, and the role is read live
     * rather than frozen onto the row so a promotion takes effect without
     * re-issuing the link.
     *
     * The owner of the business gets the whole diary. An engineer gets their
     * own jobs. This is not a nicety: filtering everyone to assignedUserId
     * handed a sole trader an EMPTY calendar, because a one-man band books a
     * job and never assigns it -- there is only one of him. He would have
     * subscribed, seen nothing, and concluded the feature was broken. It was.
     */
    const [owner] = await db.select().from(usersTable)
      .where(eq(usersTable.id, feed.userId)).limit(1);
    const wholeDiary = owner?.role === "TENANT_ADMIN" || owner?.role === "SUPER_ADMIN";

    const rows = await db.select().from(projectsTable).where(and(
      eq(projectsTable.tenantId, feed.tenantId),
      ...(wholeDiary ? [] : [eq(projectsTable.assignedUserId, feed.userId)]),
      sql`${projectsTable.scheduledStart} IS NOT NULL`,
      sql`${projectsTable.scheduledStart} >= (now() - INTERVAL '90 days')`,
    )).orderBy(asc(projectsTable.scheduledStart)).limit(500);

    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0",
      `PRODID:-//BizzFlow//${icsEscape(tenant?.name ?? "Schedule")}//EN`,
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      `X-WR-CALNAME:${icsEscape(`${tenant?.name ?? "BizzFlow"} — ${wholeDiary ? "the diary" : "my jobs"}`)}`,
      // Clients re-poll on their own schedule; this is a hint, not a guarantee.
      "X-PUBLISHED-TTL:PT1H",
    ];

    for (const p of rows) {
      const start = p.scheduledStart as Date;
      const end = (p.scheduledEnd as Date) ?? new Date(new Date(start).getTime() + 2 * 3600_000);
      const allDay = p.allDay ?? false;
      lines.push(
        "BEGIN:VEVENT",
        `UID:project-${p.id}@bizzflow`,
        `DTSTAMP:${icsDate(new Date(), false)}`,
        allDay ? `DTSTART;VALUE=DATE:${icsDate(start, true)}` : `DTSTART:${icsDate(start, false)}`,
        allDay ? `DTEND;VALUE=DATE:${icsDate(end, true)}` : `DTEND:${icsDate(end, false)}`,
        `SUMMARY:${icsEscape(p.title)}`,
        p.address ? `LOCATION:${icsEscape([p.address, p.city, p.postcode].filter(Boolean).join(", "))}` : "",
        p.description ? `DESCRIPTION:${icsEscape(p.description)}` : "",
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");

    await db.update(calendarFeedsTable).set({ lastReadAt: new Date() }).where(eq(calendarFeedsTable.id, feed.id));

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(lines.filter(Boolean).join("\r\n"));
  } catch (err) { req.log?.error(err); res.status(500).type("text/plain").send("Error"); }
});

export default router;
