import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userTenantsTable, userInvitesTable, tenantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

const INVITE_TTL_DAYS = 7;
const ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "STAFF", "CUSTOMER"] as const;

/** Raw token goes to the admin once; only its hash is ever stored. */
function newInviteToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: crypto.createHash("sha256").update(raw).digest("hex") };
}

async function issueInvite(userId: number, createdBy: number | null) {
  const { raw, hash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(userInvitesTable).values({ userId, tokenHash: hash, expiresAt, createdBy });
  return { token: raw, expiresAt };
}

router.get("/admin/users", requireSuperAdmin, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { role, tenantId } = req.body as { role?: string; tenantId?: number | null };
    const update: Record<string, unknown> = {};
    if (role !== undefined) update.role = role;
    if (tenantId !== undefined) update.tenantId = tenantId;
    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const users = await db
      .update(usersTable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(update as any)
      .where(eq(usersTable.id, Number(req.params.id)))
      .returning();
    if (!users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(users[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


/**
 * Create a login and return a single-use invite token.
 *
 * The account is created with NO password: the person invited sets their own via the returned
 * link, so a client's password never passes through the operator, an environment variable, or a
 * deploy. The token is returned exactly once — it is not recoverable from the database.
 */
router.post("/admin/users", requireSuperAdmin, async (req, res) => {
  try {
    const { email, firstName, lastName, role, tenantId } = req.body as Record<string, unknown>;
    const cleanEmail = String(email ?? "").toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { res.status(400).json({ error: "A valid email address is required" }); return; }
    if (!ROLES.includes(role as any)) { res.status(400).json({ error: `Role must be one of: ${ROLES.join(", ")}` }); return; }

    // Every role except a platform admin belongs to exactly one business.
    let tid: number | null = null;
    if (role !== "SUPER_ADMIN") {
      tid = Number(tenantId);
      if (!Number.isFinite(tid)) { res.status(400).json({ error: "Choose which business this person belongs to" }); return; }
      const [t] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, tid)).limit(1);
      if (!t) { res.status(400).json({ error: "That business no longer exists" }); return; }
    }

    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
    if (existing) { res.status(409).json({ error: "Someone already has an account with that email address" }); return; }

    const [created] = await db.insert(usersTable).values({
      email: cleanEmail,
      firstName: String(firstName ?? "").trim() || null,
      lastName: String(lastName ?? "").trim() || null,
      role: role as typeof ROLES[number],
      tenantId: tid,
      passwordHash: null,
    }).returning();

    if (tid) {
      await db.insert(userTenantsTable)
        .values({ userId: created.id, tenantId: tid, role: role as typeof ROLES[number] })
        .onConflictDoNothing();
    }

    const invite = await issueInvite(created.id, req.authUser?.id ?? null);
    res.status(201).json({ user: created, invite });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Issue a fresh invite — for an invite that expired, or a password reset the admin can't perform. */
router.post("/admin/users/:id/invite", requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const invite = await issueInvite(user.id, req.authUser?.id ?? null);
    res.json({ user, invite });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
