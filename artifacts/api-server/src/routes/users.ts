import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

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

export default router;
