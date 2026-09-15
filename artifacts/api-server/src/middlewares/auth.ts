import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, userTenantsTable, tenantsTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";

export interface AuthUser {
  id: number;
  clerkId: string | null;
  email: string;
  role: string;
  tenantId: number | null;
  /**
   * Set when this request is a support session inside somebody else's
   * business. Present so the dashboard can say so plainly and every log line
   * records who was really at the keyboard.
   */
  impersonating?: { tenantId: number };
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.SESSION_SECRET!;

export function signAuthToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * How long a support session lasts.
 *
 * Short on purpose. The failure mode being designed against is not an attack,
 * it is forgetting: a tab left open on a client's workspace for a fortnight,
 * and every action in it attributed to them. An hour covers a support job and
 * expires on its own if it does not.
 */
const IMPERSONATION_TTL = "1h";

/**
 * A token that puts a platform admin inside one tenant's workspace.
 *
 * The tenant is baked into the TOKEN, not sent as a header, because a header
 * is something the client chooses per request and this is a decision made once
 * and audited. Everything that makes it safe is re-checked at use, not trusted
 * from the payload — see tryBearerAuth.
 */
export function signImpersonationToken(userId: number, tenantId: number): string {
  return jwt.sign({ userId, impersonateTenantId: tenantId }, JWT_SECRET, { expiresIn: IMPERSONATION_TTL });
}

/** Resolves the caller's Bearer token to a user, or returns null — doesn't write a response,
 * so callers that have their own fallback auth (e.g. a signed object-access token) can try
 * this first without committing to a 401 if it's absent or invalid. */
export async function tryBearerAuth(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; impersonateTenantId?: number };
    const users = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    const user = users[0];
    if (!user) return null;

    /**
     * A support session inside somebody else's business.
     *
     * Three things are checked HERE rather than trusted from the payload,
     * because a signed token is a claim about the past and this has to be true
     * now:
     *
     *  1. The account is still a SUPER_ADMIN. Read live, so demoting or
     *     suspending a platform admin kills every impersonation token they
     *     already hold instead of leaving them valid for the hour.
     *
     *  2. The tenant still exists.
     *
     *  3. The role is forced DOWN to TENANT_ADMIN. This is the important one.
     *     tenantFilter returns undefined for a SUPER_ADMIN — meaning no tenant
     *     filter at all — so carrying that role into a tenant's screens would
     *     show one business's dashboard populated with every business's rows.
     *     Scoping down makes the session behave exactly like the client's own
     *     login, which is the entire point of looking at it.
     *
     * It also means /admin is closed while impersonating: you cannot delete a
     * tenant or read the platform console from inside a support session. Come
     * out first. That is a feature, not an oversight.
     */
    if (payload.impersonateTenantId) {
      if (user.role !== "SUPER_ADMIN") return null;
      const [tenant] = await db.select({ id: tenantsTable.id })
        .from(tenantsTable).where(eq(tenantsTable.id, payload.impersonateTenantId)).limit(1);
      if (!tenant) return null;
      return {
        ...user,
        tenantId: payload.impersonateTenantId,
        role: "TENANT_ADMIN",
        impersonating: { tenantId: payload.impersonateTenantId },
      };
    }

    // The caller may nominate which of THEIR businesses this device is working in. Never trust it:
    // it only takes effect after confirming a user_tenants row, so the header can't be used to
    // reach a business the user isn't a member of. Anything unrecognised falls back to the
    // account's own tenant rather than 401ing, so a revoked membership can't lock someone out.
    const requested = Number(req.headers["x-tenant-id"]);
    if (Number.isFinite(requested) && requested !== user.tenantId) {
      const [membership] = await db.select({ role: userTenantsTable.role })
        .from(userTenantsTable)
        .where(and(eq(userTenantsTable.userId, user.id), eq(userTenantsTable.tenantId, requested)))
        .limit(1);
      if (membership) return { ...user, tenantId: requested, role: membership.role };
    }
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await tryBearerAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.authUser = user;
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => {
      if (!req.authUser || !roles.includes(req.authUser.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    });
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("SUPER_ADMIN")(req, res, next);
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  return requireRole("SUPER_ADMIN", "TENANT_ADMIN", "STAFF")(req, res, next);
}

export function tenantFilter(req: Request, column: any): SQL | undefined {
  if (req.authUser?.role === "SUPER_ADMIN") return undefined;
  return eq(column, req.authUser?.tenantId ?? -1);
}
