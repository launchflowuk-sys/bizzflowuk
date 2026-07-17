import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, SQL } from "drizzle-orm";

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
    return users[0] ?? null;
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
