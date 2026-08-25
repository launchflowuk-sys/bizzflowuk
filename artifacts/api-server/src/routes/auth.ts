import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db, userInvitesTable } from "@workspace/db";
import { usersTable, userTenantsTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, signAuthToken } from "../middlewares/auth";
import { loginRateLimiter } from "../middlewares/rateLimit";
import { buildRelativeObjectUrl } from "../lib/objectStorage";

const router = Router();

/** Uploaded avatars are stored as raw object paths (/objects/..); turn them into a signed,
 *  servable URL for display. Anything else (already a URL) passes through unchanged. */
function avatarDisplay(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/objects/") ? buildRelativeObjectUrl(url) : url;
}

/** The businesses a user can access, for the dashboard's business switcher. */
async function getUserBusinesses(userId: number) {
  // Brand colour comes from tenant_settings.primaryColor (what the Settings page edits), falling
  // back to tenants.primaryColor — so the admin themes to the colour the tenant actually set.
  return db
    .select({
      tenantId: userTenantsTable.tenantId, role: userTenantsTable.role, name: tenantsTable.name, slug: tenantsTable.slug,
      primaryColor: sql<string | null>`COALESCE(${tenantSettingsTable.primaryColor}, ${tenantsTable.primaryColor})`,
      industry: tenantsTable.industry,
    })
    .from(userTenantsTable)
    .innerJoin(tenantsTable, eq(userTenantsTable.tenantId, tenantsTable.id))
    .leftJoin(tenantSettingsTable, eq(tenantSettingsTable.tenantId, tenantsTable.id))
    .where(eq(userTenantsTable.userId, userId))
    .orderBy(tenantsTable.name);
}

router.get("/me", requireAuth, async (req, res) => {
  const { id, email, role, firstName, lastName, tenantId, clerkId, avatarUrl } = req.authUser as any;
  // Never let the business list break /me — the dashboard calls this on load, so a failure here
  // (e.g. user_tenants not yet migrated) would lock everyone out. Degrade to no switcher instead.
  let businesses: unknown[] = [];
  try {
    businesses = await getUserBusinesses(id);
  } catch (err) {
    req.log.error({ err }, "getUserBusinesses failed (user_tenants may be missing) — returning no businesses");
  }
  res.json({ id, email, role, firstName, lastName, tenantId, clerkId, avatarUrl: avatarDisplay(avatarUrl), businesses });
});

/** Set the current user's avatar image (relative object path from the dashboard upload flow). */
router.post("/avatar", requireAuth, async (req, res) => {
  try {
    const avatarUrl = typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl : null;
    await db.update(usersTable).set({ avatarUrl }).where(eq(usersTable.id, req.authUser!.id));
    res.json({ avatarUrl });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Switch the caller's active business. Security gate: only tenants the user actually belongs to
 * (a row in user_tenants) are allowed — otherwise this would be a cross-tenant data breach.
 * The active tenant is persisted on users.tenantId, which the auth middleware reads live, so
 * every subsequent request is scoped to the new business — and it's remembered for next login.
 * Also syncs users.role to the membership's role (a user may have different roles per business).
 */
router.post("/switch-tenant", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const tenantId = Number(req.body?.tenantId);
    if (!Number.isFinite(tenantId)) { res.status(400).json({ error: "tenantId required" }); return; }

    const membership = await db.select().from(userTenantsTable)
      .where(and(eq(userTenantsTable.userId, userId), eq(userTenantsTable.tenantId, tenantId)))
      .limit(1);
    if (!membership.length) { res.status(403).json({ error: "You do not have access to that business" }); return; }

    // Deliberately does NOT write tenantId back to the user row. That made the active business a
    // property of the ACCOUNT, so switching on one device changed it on every other device that
    // account was signed in on. The client now holds its own selection and presents it as
    // X-Tenant-Id, which requireAuth re-validates against user_tenants on every request. All this
    // endpoint does is confirm membership and echo the resulting identity back.
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!u) { res.status(401).json({ error: "Unauthorized" }); return; }
    Object.assign(u, { tenantId, role: membership[0].role });
    const businesses = await getUserBusinesses(userId);
    res.json({ id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName, tenantId: u.tenantId, clerkId: u.clerkId, avatarUrl: u.avatarUrl ?? null, businesses });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!users.length) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = users[0];
    if (!user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signAuthToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, tenantId: user.tenantId } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});


// ---------------------------------------------------------------------------
// Invitations — how an account gets its first password
// ---------------------------------------------------------------------------
const hashInvite = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/** Look up a pending invite so the page can greet the person by name before they set a password. */
router.get("/invite/:token", loginRateLimiter, async (req, res) => {
  try {
    const [invite] = await db.select().from(userInvitesTable)
      .where(eq(userInvitesTable.tokenHash, hashInvite(String(req.params.token))))
      .limit(1);
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      res.status(404).json({ error: "This invitation has already been used or has expired" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, invite.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "This invitation is no longer valid" }); return; }
    res.json({ email: user.email, firstName: user.firstName });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Accept an invitation: the invited person sets their own password and is signed straight in.
 * The invite is consumed in the same step, so a link cannot be replayed.
 */
router.post("/accept-invite", loginRateLimiter, async (req, res) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) { res.status(400).json({ error: "Token and password are required" }); return; }
    if (password.length < 10) { res.status(400).json({ error: "Choose a password of at least 10 characters" }); return; }

    const [invite] = await db.select().from(userInvitesTable)
      .where(eq(userInvitesTable.tokenHash, hashInvite(token)))
      .limit(1);
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "This invitation has already been used or has expired" });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, invite.userId));
    await db.update(userInvitesTable).set({ acceptedAt: new Date() }).where(eq(userInvitesTable.id, invite.id));

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, invite.userId)).limit(1);
    res.json({
      token: signAuthToken(user.id),
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, tenantId: user.tenantId },
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
