import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, SQL } from "drizzle-orm";

export interface AuthUser {
  id: number;
  clerkId: string;
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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    const clerkId = payload.sub;

    const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    if (!users.length) {
      res.status(401).json({ error: "User not found. Please sync your account." });
      return;
    }
    req.authUser = users[0];
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
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

/**
 * Returns a Drizzle where condition that filters by tenantId for regular users,
 * or undefined (no filter = all tenants) for SUPER_ADMIN.
 * Use: .where(tenantFilter(req, table.tenantId))
 */
export function tenantFilter(req: Request, column: any): SQL | undefined {
  if (req.authUser?.role === "SUPER_ADMIN") return undefined;
  return eq(column, req.authUser?.tenantId ?? -1);
}
