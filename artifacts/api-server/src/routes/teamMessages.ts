import { Router } from "express";
import { db, teamMessagesTable, usersTable, projectsTable } from "@workspace/db";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireTenantAccess } from "../middlewares/auth";

/**
 * Messages between the people who work here.
 *
 * Small on purpose. A trade with two engineers needs a note that survives the
 * week and sits with the business rather than in somebody's WhatsApp — not
 * threads, reactions and typing indicators.
 *
 * Two kinds, and the difference is one nullable column:
 *   recipientId null  — the whole team sees it
 *   recipientId set   — only that person and the sender
 */

const router = Router();
function tid(req: any): number { return req.authUser?.tenantId!; }

const postSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(4000),
  /** Omitted or null posts to the whole team. */
  recipientId: z.number().int().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
});

/** Who you can message: everyone else in this business. */
router.get("/team-messages/people", requireTenantAccess, async (req: any, res) => {
  try {
    const rows = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    }).from(usersTable).where(eq(usersTable.tenantId, tid(req)));
    res.json(rows.filter(r => r.id !== req.authUser?.id));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * The messages this person is allowed to see.
 *
 * Tenant-scoped like everything else, and then narrowed again: a direct
 * message between two colleagues is not the rest of the team's business, so
 * the filter is "addressed to everyone, OR addressed to me, OR sent by me".
 * Without that second half, a private message to one engineer would be
 * readable by every other engineer in the business.
 */
router.get("/team-messages", requireTenantAccess, async (req: any, res) => {
  try {
    const me = req.authUser!.id;
    const rows = await db.select().from(teamMessagesTable).where(and(
      eq(teamMessagesTable.tenantId, tid(req)),
      or(
        isNull(teamMessagesTable.recipientId),
        eq(teamMessagesTable.recipientId, me),
        eq(teamMessagesTable.senderId, me),
      ),
    )).orderBy(desc(teamMessagesTable.createdAt)).limit(200);

    // Names in one query rather than one per message.
    const ids = [...new Set(rows.flatMap(r => [r.senderId, r.recipientId].filter(Boolean) as number[]))];
    const people = ids.length
      ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable).where(inArray(usersTable.id, ids))
      : [];
    const byId = new Map(people.map(p => [p.id, p]));
    const name = (id: number | null) => {
      if (id === null) return null;
      const p = byId.get(id);
      if (!p) return "Someone who has left";
      return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
    };

    const jobIds = [...new Set(rows.map(r => r.projectId).filter(Boolean) as number[])];
    const jobs = jobIds.length
      ? await db.select({ id: projectsTable.id, title: projectsTable.title })
        .from(projectsTable).where(and(eq(projectsTable.tenantId, tid(req)), inArray(projectsTable.id, jobIds)))
      : [];
    const jobById = new Map(jobs.map(j => [j.id, j.title]));

    res.json(rows.map(r => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      readAt: r.readAt,
      senderId: r.senderId,
      senderName: name(r.senderId),
      recipientId: r.recipientId,
      recipientName: name(r.recipientId),
      toEveryone: r.recipientId === null,
      mine: r.senderId === me,
      projectId: r.projectId,
      projectTitle: r.projectId ? jobById.get(r.projectId) ?? null : null,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/team-messages", requireTenantAccess, async (req: any, res) => {
  try {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
      return;
    }
    const { body, recipientId, projectId } = parsed.data;
    const tenantId = tid(req);

    /**
     * A recipient must be someone in THIS business.
     *
     * users.id arrives straight from the client, and nothing about the column
     * constrains it to the tenant. Without this check a crafted request could
     * post a message addressed to somebody at another company — who would then
     * read it in their own inbox.
     */
    if (recipientId != null) {
      const [mate] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.id, recipientId), eq(usersTable.tenantId, tenantId))).limit(1);
      if (!mate) { res.status(400).json({ error: "That person is not in this business." }); return; }
    }

    // Same exposure on the job it is pinned to.
    if (projectId != null) {
      const [job] = await db.select({ id: projectsTable.id }).from(projectsTable)
        .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId))).limit(1);
      if (!job) { res.status(400).json({ error: "That job does not belong to this business." }); return; }
    }

    const [row] = await db.insert(teamMessagesTable).values({
      tenantId,
      senderId: req.authUser!.id,
      recipientId: recipientId ?? null,
      projectId: projectId ?? null,
      body,
    }).returning();

    res.status(201).json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Mark everything addressed to me as read. Drives the unread badge. */
router.post("/team-messages/read", requireTenantAccess, async (req: any, res) => {
  try {
    await db.update(teamMessagesTable).set({ readAt: new Date() }).where(and(
      eq(teamMessagesTable.tenantId, tid(req)),
      eq(teamMessagesTable.recipientId, req.authUser!.id),
      isNull(teamMessagesTable.readAt),
    ));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Delete your own message.
 *
 * Only your own: being able to remove what a colleague wrote turns a shared
 * record into something nobody can rely on.
 */
router.delete("/team-messages/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const [row] = await db.select({ senderId: teamMessagesTable.senderId })
      .from(teamMessagesTable).where(and(
        eq(teamMessagesTable.id, Number(req.params.id)),
        eq(teamMessagesTable.tenantId, tid(req)),
      )).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.senderId !== req.authUser?.id) {
      res.status(403).json({ error: "You can only delete your own messages." });
      return;
    }
    await db.delete(teamMessagesTable).where(eq(teamMessagesTable.id, Number(req.params.id)));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
