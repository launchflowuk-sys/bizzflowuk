import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, userTenantsTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";

export interface AuthUser {
  id: number;
  clerkId: string | null;
  email: string;
  role: string;
  tenantId: number | null;
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

/** Resolves the caller's Bearer token to a user, or returns null — doesn't write a response,
 * so callers that have their own fallback auth (e.g. a signed object-access token) can try
 * this first without committing to a 401 if it's absent or invalid. */
export async function tryBearerAuth(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const users = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    const user = users[0];
    if (!user) return null;

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
