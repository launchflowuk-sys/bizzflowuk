import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userTenantsTable, tenantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, signAuthToken } from "../middlewares/auth";
import { loginRateLimiter } from "../middlewares/rateLimit";

const router = Router();

/** The businesses a user can access, for the dashboard's business switcher. */
async function getUserBusinesses(userId: number) {
  return db
    .select({ tenantId: userTenantsTable.tenantId, role: userTenantsTable.role, name: tenantsTable.name, slug: tenantsTable.slug })
    .from(userTenantsTable)
    .innerJoin(tenantsTable, eq(userTenantsTable.tenantId, tenantsTable.id))
    .where(eq(userTenantsTable.userId, userId))
    .orderBy(tenantsTable.name);
}

router.get("/me", requireAuth, async (req, res) => {
  const { id, email, role, firstName, lastName, tenantId, clerkId } = req.authUser as any;
  // Never let the business list break /me — the dashboard calls this on load, so a failure here
  // (e.g. user_tenants not yet migrated) would lock everyone out. Degrade to no switcher instead.
  let businesses: unknown[] = [];
  try {
    businesses = await getUserBusinesses(id);
  } catch (err) {
    req.log.error({ err }, "getUserBusinesses failed (user_tenants may be missing) — returning no businesses");
  }
  res.json({ id, email, role, firstName, lastName, tenantId, clerkId, businesses });
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

    const updated = await db.update(usersTable)
      .set({ tenantId, role: membership[0].role })
      .where(eq(usersTable.id, userId))
      .returning();
    const u = updated[0];
    const businesses = await getUserBusinesses(userId);
    res.json({ id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName, tenantId: u.tenantId, clerkId: u.clerkId, businesses });
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

export default router;
